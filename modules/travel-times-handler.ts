// modules/travel-times-handler.ts
import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { getTravelTimes } from "./api-logic";

export default async function handler(request: ZuploRequest, context: ZuploContext) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const { origin, destinations } = await request.json();

  if (!origin || !destinations?.length) {
    return new Response(JSON.stringify({ error: "origin and destinations[] required" }), { status: 400 });
  }

  const times = await getTravelTimes(origin, destinations);
  return new Response(JSON.stringify(times), { status: 200, headers: { "Content-Type": "application/json" } });
}
