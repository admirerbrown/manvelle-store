-- Replace this placeholder with the email of an auth user created in Supabase.
-- Do not use a real admin email in source control.
insert into public.admins (email)
values ('replace-with-admin@example.com')
on conflict (email) do nothing;
