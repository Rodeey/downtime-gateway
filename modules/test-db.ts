import { type CategoryBucket } from "./logic/category-map";
import { logRequest } from "./logic/supabase";

const TEST_CATEGORY: CategoryBucket = "general";

export default async function handler(request: Request): Promise<Response> {
  await logRequest({
    category: TEST_CATEGORY,
    provider_used: "test-db",
    source: "live",
    count: 0,
    duration_ms: 0,
    lat: 0,
    lng: 0,
    radius_m: 0,
    open_now: false,
    force_refresh: false,
    request,
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
