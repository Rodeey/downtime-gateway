import { normalizeYelp, type Place } from "../normalizer";
import { withUserAgent } from "../utils";
import { readEnvValue, type EnvSource } from "../env";

declare const zuplo: any;
const YELP_API_KEY: string | null = zuplo?.env?.YELP_API_KEY ?? null;

const BASE_URL = "https://api.yelp.com/v3/businesses/search";

export interface YelpQuery {
  lat: number;
  lng: number;
  radius_m: number;
  limit: number;
  categories?: string[];
  open_now?: boolean;
}

function getApiKey(env?: EnvSource): string | null {
  try {
    const key = YELP_API_KEY;
    try {
      console.log("[Yelp Provider] Key present:", Boolean(key));
      console.log("[Yelp Provider] Key length:", key ? String(key).length : 0);
    } catch (e) {
      // ignore logging failures
    }
    if (key) {
      return key;
    }
  } catch (error) {
    console.warn("[Yelp] API key not configured", error);
  }

  const envKey = readEnvValue(env, "YELP_API_KEY");
  if (envKey) {
    return envKey;
  }

  if (typeof process !== "undefined" && process.env?.YELP_API_KEY) {
    return process.env.YELP_API_KEY;
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
