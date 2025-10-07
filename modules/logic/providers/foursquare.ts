import { normalizeFSQ, type Place } from "../normalizer";
import { withUserAgent } from "../utils";

const BASE_URL = "https://api.foursquare.com/v3/places/search";

export interface FoursquareQuery {
  lat: number;
  lng: number;
  radius_m: number;
  limit: number;
  categories?: string[];
  open_now?: boolean;
}

function getApiKey(): string | null {
  try {
    return zuplo.env.FOURSQUARE_API_KEY ?? null;
  } catch (error) {
    console.warn("[Foursquare] API key not configured", error);
    return null;
  }
}

export async function searchWithFoursquare(
  query: FoursquareQuery
): Promise<Place[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return [];
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("ll", `${query.lat},${query.lng}`);
  url.searchParams.set("radius", Math.min(query.radius_m, 100_000).toString());
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
        Accept: "application/json",
        Authorization: apiKey,
      },
    })
  );

  if (!response.ok) {
    console.warn(
      `[Foursquare] search failed with status ${response.status}: ${response.statusText}`
    );
    return [];
  }

  const payload = (await response.json()) as { results?: unknown[] };
  return normalizeFSQ(payload.results ?? []);
}
