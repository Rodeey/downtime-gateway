// modules/geocode-handler.ts
import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { geocodeAddress } from "./api-logic";

export default async function handler(request: ZuploRequest, context: ZuploContext) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query");

  if (!query) {
    return new Response(JSON.stringify({ error: "query required" }), { status: 400 });
  }

  const coords = await geocodeAddress(query);
  return new Response(JSON.stringify(coords), { status: 200, headers: { "Content-Type": "application/json" } });
}
