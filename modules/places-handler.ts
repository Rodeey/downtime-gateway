import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { logRequest } from "./supabase";

export default async function handler(request: ZuploRequest, context: ZuploContext) {
  const url = new URL(request.url);

  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  const t0 = Date.now();

  const responseData = { message: "logging test", lat, lng };
  const duration_ms = Date.now() - t0;

  await logRequest({
    lat,
    lng,
    radius_m: 5000,
    categories: "test",
    client_id: url.searchParams.get("x-client-id") || null,
    session_id: url.searchParams.get("x-session-id") || null,
    ip_hash: null,
    result_count: 1,
    provider_used: "none",
    duration_ms,
    strategy: "default",
    user_agent: request.headers.get("user-agent") || ""
  });

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}1
