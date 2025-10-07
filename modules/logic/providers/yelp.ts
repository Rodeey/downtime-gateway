import { normalizeYelp, type Place } from "../normalizer";
import { withUserAgent } from "../utils";
import { readEnvValue, type EnvSource } from "../env";

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
  const value = readEnvValue(env, "YELP_API_KEY");
  if (value) {
    return value;
  }
  console.warn("[Yelp] API key not configured");
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
