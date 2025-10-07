import { readEnvValue } from "../logic/env";
import type { HandlerContext } from "./context";

const KEYS = [
  "SUPABASEURL",
  "SUPABASEKEY",
  "FOURSQUARE_API_KEY",
  "YELP_API_KEY",
  "GEOAPIFY_KEY",
];

export default async function handler(
  _request: Request,
  ctx: HandlerContext
): Promise<Response> {
  const result = Object.fromEntries(
    KEYS.map((key) => [key, readEnvValue(ctx?.env, key) !== null])
  );

  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
