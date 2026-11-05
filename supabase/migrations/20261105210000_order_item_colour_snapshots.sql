begin;

alter table public.order_items
  add column if not exists color_snapshot text;

-- Keep the existing, security-reviewed order function as the source and make
-- the smallest data-model extension needed for colour-specific lines.
do $migration$
declare
  definition text;
begin
  select pg_get_functiondef(
    'private.create_guest_order_with_zone(uuid,text,text,uuid,text,jsonb)'::regprocedure
  )
  into definition;

  definition := replace(
    definition,
    'v_seen_variant_ids uuid[] := array[]::uuid[];',
    'v_seen_variant_ids uuid[] := array[]::uuid[]; v_color_name text;'
  );
  definition := replace(
    definition,
    'v_item - ''product_id'' - ''variant_id'' - ''quantity'' <> ''{}''::jsonb',
    'v_item - ''product_id'' - ''variant_id'' - ''quantity'' - ''image_id'' - ''color_name'' <> ''{}''::jsonb'
  );
  definition := replace(
    definition,
    'if v_variant_id = any(v_seen_variant_ids) then
      raise exception using
        errcode = ''22023'',
        message = ''Each variant may appear only once in an order.'';
    end if;
    v_seen_variant_ids := pg_catalog.array_append(v_seen_variant_ids, v_variant_id);',
    'v_seen_variant_ids := pg_catalog.array_append(v_seen_variant_ids, v_variant_id);'
  );
  definition := replace(
    definition,
    'v_quantity := v_quantity_text::integer;',
    'v_quantity := v_quantity_text::integer;
    v_color_name := nullif(pg_catalog.btrim(v_item ->> ''color_name''), '''');'
  );
  definition := replace(
    definition,
    'v_quantity := (v_item ->> ''quantity'')::integer;',
    'v_quantity := (v_item ->> ''quantity'')::integer;
    v_color_name := nullif(pg_catalog.btrim(v_item ->> ''color_name''), '''');'
  );
  definition := replace(
    definition,
    '''quantity'', v_quantity,
        ''subtotal'', v_line_subtotal',
    '''quantity'', v_quantity,
        ''color_name'', v_color_name,
        ''subtotal'', v_line_subtotal'
  );
  definition := replace(
    definition,
    'quantity,
      line_subtotal
    )
    values (',
    'quantity,
      line_subtotal,
      color_snapshot
    )
    values ('
  );
  definition := replace(
    definition,
    '(v_saved_item ->> ''quantity'')::integer,
      (v_saved_item ->> ''subtotal'')::numeric',
    '(v_saved_item ->> ''quantity'')::integer,
      (v_saved_item ->> ''subtotal'')::numeric,
      v_saved_item ->> ''color_name'''
  );

  if position('color_snapshot' in definition) = 0
    or position('v_color_name' in definition) = 0 then
    raise exception 'Could not extend the order RPC with colour snapshots.';
  end if;

  execute definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
