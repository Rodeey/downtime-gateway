// modules/log-handler.ts
import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { logRequest } from "./supabase";

export default async function handler(request: ZuploRequest, context: ZuploContext) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const payload = await request.json();
  await logRequest("frontend", payload);

  return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
}
