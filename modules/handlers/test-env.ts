import type { EnvSource } from "../logic/env";
import type { HandlerContext } from "./context";

// Read Zuplo environment variables at module initialization time.
// This ensures the global `zuplo.env` is accessed when the module loads
// (the pattern that works in `modules/test-db.ts`).

declare const zuplo: any;

const SUPABASEURL = zuplo.env.SUPABASEURL;
const SUPABASEKEY = zuplo.env.SUPABASEKEY;
const FOURSQUARE_API_KEY = zuplo.env.FOURSQUARE_API_KEY;
const YELP_API_KEY = zuplo.env.YELP_API_KEY;
const KEYS = [
  "SUPABASEURL",
  "SUPABASEKEY",
  "FOURSQUARE_API_KEY",
  "YELP_API_KEY",
];

function hasEnv(key: string, ctxEnv?: EnvSource): boolean {
  try {
    // prefer the actual zuplo.env variable read at module init
    const moduleValue = (zuplo.env as Record<string, unknown>)[key];
    if (typeof moduleValue === "string" && moduleValue.length > 0) {
      return true;
    }
  } catch (_) {
    // ignore
  }

  // fallback to context-provided env (from origin/main changes)
  if (ctxEnv && typeof ctxEnv[key] === "string" && ctxEnv[key]!.length > 0) {
    return true;
  }

  if (
    typeof process !== "undefined" &&
    process.env &&
    typeof process.env[key] === "string" &&
    process.env[key]!.length > 0
  ) {
    return true;
  }
  return false;
}

export default async function handler(
  _request: Request,
  ctx: HandlerContext
): Promise<Response> {
  const env = ctx?.env;
  const result = Object.fromEntries(
    KEYS.map((key) => {
      return [key, hasEnv(key, env)];
    })
  );

  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    });
}
