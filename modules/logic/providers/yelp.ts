import { normalizeYelp, type Place } from "../normalizer";
import { withUserAgent } from "../utils";
import { readEnvValue, type EnvSource } from "../env";

declare const zuplo: undefined | { env?: Record<string, unknown> };

function readZuploEnv(key: string): string | null {
  try {
    if (typeof zuplo !== "undefined" && zuplo?.env) {
      const value = zuplo.env[key];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  } catch (error) {
    console.warn(`[Yelp] Failed to read ${key} from zuplo.env`, error);
  }
  return null;
}

let cachedModuleKey: string | null = readZuploEnv("YELP_API_KEY");
let missingKeyWarned = false;

const BASE_URL = "https://api.yelp.com/v3/businesses/search";

export interface YelpQuery {
  lat: number;
  lng: number;
  radius_m: number;
  limit: number;
  categories?: string[];
  open_now?: boolean;
}

function remember(key: string | null): string | null {
  if (key && key.length > 0) {
    cachedModuleKey = key;
    return key;
  }
  return null;
}

function resolveProcessEnv(key: string): string | null {
  if (typeof process === "undefined" || !process.env) {
    return null;
  }
  const value = process.env[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getApiKey(env?: EnvSource): string | null {
  const moduleKey = cachedModuleKey ?? readZuploEnv("YELP_API_KEY");
  if (moduleKey) {
    return remember(moduleKey);
  }

  const envKey = readEnvValue(env, "YELP_API_KEY");
  if (envKey) {
    return remember(envKey);
  }

  const processKey = resolveProcessEnv("YELP_API_KEY");
  if (processKey) {
    return remember(processKey);
  }

  if (!missingKeyWarned) {
    console.warn(
      "[Yelp] API key not configured; skipping Yelp search results for this request."
    );
    missingKeyWarned = true;
  }

  return null;
}

export async function searchWithYelp(
  query: YelpQuery,
  env?: EnvSource
): Promise<Place[]> {
  const apiKey = getApiKey(env);
  if (!apiKey) {
    return [];
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("latitude", query.lat.toString());
  url.searchParams.set("longitude", query.lng.toString());
  url.searchParams.set("radius", Math.min(query.radius_m, 40_000).toString());
  url.searchParams.set("limit", Math.min(query.limit, 50).toString());
  if (query.categories && query.categories.length > 0) {
    url.searchParams.set("categories", query.categories.join(","));
  }
  if (query.open_now !== undefined) {
    url.searchParams.set("open_now", query.open_now ? "true" : "false");
  }

  const response = await fetch(
    url.toString(),
    withUserAgent({
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
  );

  if (!response.ok) {
    console.warn(
      `[Yelp] search failed with status ${response.status}: ${response.statusText}`
    );
    return [];
  }

  const payload = (await response.json()) as { businesses?: unknown[] };
  return normalizeYelp(payload.businesses ?? []);
}
