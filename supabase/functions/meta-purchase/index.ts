import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Database } from "../../../src/lib/supabase/database.types.ts";

type JsonRecord = Record<string, unknown>;

const responseHeaders = { "Content-Type": "application/json" };

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const hookSecret = Deno.env.get("META_WEBHOOK_SECRET");
  if (!hookSecret) {
    console.error("META_WEBHOOK_SECRET is not configured.");
    return jsonResponse({ error: "Purchase delivery is not configured." }, 500);
  }
  if (request.headers.get("authorization") !== `Bearer ${hookSecret}`) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const pixelId = Deno.env.get("META_PIXEL_ID");
  const accessToken = Deno.env.get("META_ACCESS_TOKEN");
  const graphApiVersion = Deno.env.get("META_GRAPH_API_VERSION");
  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !pixelId ||
    !accessToken ||
    !graphApiVersion
  ) {
    console.error("Meta Purchase function secrets are incomplete.");
    return jsonResponse({ error: "Purchase delivery is not configured." }, 500);
  }
  if (!/^\d+$/.test(pixelId) || !/^v\d+\.\d+$/.test(graphApiVersion)) {
    console.error("Meta Pixel ID or Graph API version is invalid.");
    return jsonResponse({ error: "Purchase delivery is misconfigured." }, 500);
  }

  const body: unknown = await request.json().catch((cause: unknown) => {
    console.error("Meta Purchase request body is not valid JSON.", cause);
    return null;
  });
  if (!isRecord(body) || typeof body.order_id !== "string" || !isUuid(body.order_id)) {
    return jsonResponse({ error: "A valid order ID is required." }, 400);
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: claimData, error: claimError } = await supabase.rpc(
    "claim_meta_purchase",
    { p_order_id: body.order_id },
  );
  if (claimError) {
    console.error("Could not claim the Meta Purchase event.", claimError);
    return jsonResponse({ error: "Could not prepare Purchase delivery." }, 500);
  }

  const claim = isRecord(claimData) ? claimData : null;
  if (!claim || typeof claim.status !== "string") {
    console.error("The Meta Purchase claim returned an invalid response.");
    return jsonResponse({ error: "Could not prepare Purchase delivery." }, 500);
  }
  if (claim.status !== "claimed") {
    return jsonResponse({ status: claim.status }, 200);
  }
  if (
    typeof claim.event_id !== "string" ||
    typeof claim.event_time !== "number" ||
    typeof claim.event_source_url !== "string" ||
    !isRecord(claim.user_data) ||
    !isRecord(claim.custom_data)
  ) {
    await releaseClaim(supabase, body.order_id);
    console.error("The claimed Meta Purchase event is incomplete.");
    return jsonResponse({ error: "Could not prepare Purchase delivery." }, 500);
  }

  const event = {
    event_name: "Purchase",
    event_time: claim.event_time,
    event_id: claim.event_id,
    action_source: "website",
    event_source_url: claim.event_source_url,
    user_data: claim.user_data,
    custom_data: claim.custom_data,
  };
  const eventPayload: JsonRecord = { data: [event] };
  const testEventCode = Deno.env.get("META_TEST_EVENT_CODE");
  if (testEventCode) {
    eventPayload.test_event_code = testEventCode;
  }

  try {
    const metaResponse = await fetch(
      `https://graph.facebook.com/${graphApiVersion}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventPayload),
      },
    );
    const responseBody: unknown = await metaResponse.json().catch(() => null);
    if (
      !metaResponse.ok ||
      !isRecord(responseBody) ||
      responseBody.events_received !== 1
    ) {
      console.error("Meta did not accept the Purchase event.", {
        status: metaResponse.status,
        response: responseBody,
      });
      await releaseClaim(supabase, body.order_id);
      return jsonResponse({ error: "Meta rejected the Purchase event." }, 502);
    }

    const { error: markError } = await supabase.rpc(
      "mark_meta_purchase_sent",
      { p_order_id: body.order_id },
    );
    if (markError) {
      console.error(
        "Meta accepted Purchase, but the sent timestamp could not be saved.",
        markError,
      );
      await releaseClaim(supabase, body.order_id);
      return jsonResponse({ error: "Could not record Purchase delivery." }, 500);
    }

    return jsonResponse({ status: "sent", event_id: claim.event_id }, 200);
  } catch (cause) {
    console.error("Meta Purchase delivery failed.", cause);
    await releaseClaim(supabase, body.order_id);
    return jsonResponse({ error: "Purchase delivery failed." }, 502);
  }
});

async function releaseClaim(
  supabase: SupabaseClient<Database>,
  orderId: string,
): Promise<void> {
  const { error } = await supabase.rpc("release_meta_purchase_claim", {
    p_order_id: orderId,
  });
  if (error) {
    console.error("Could not release the Meta Purchase claim.", error);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function jsonResponse(body: JsonRecord, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}
