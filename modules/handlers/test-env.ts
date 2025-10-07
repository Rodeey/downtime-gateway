import type { EnvSource } from "../logic/env";
import type { HandlerContext } from "./context";

const KEYS = [
  "SUPABASEURL",
  "SUPABASEKEY",
  "FOURSQUARE_API_KEY",
  "YELP_API_KEY",
  "GEOAPIFY_KEY",
];

function readEnv(key: string, env: EnvSource | undefined): string | null {
  if (!env) {
    return null;
  }
  const value = env[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default async function handler(
  _request: Request,
  ctx: HandlerContext
): Promise<Response> {
  const env = ctx?.env;
  const result = Object.fromEntries(
    KEYS.map((key) => {
      const value = readEnv(key, env);
      if (!value) {
        return [key, null];
      }
      return [key, value.slice(0, 6)];
    })
  );

  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
