import { normalizeFSQ, type Place } from "../normalizer";
import { withUserAgent } from "../utils";
import type { EnvSource } from "../env";

declare const zuplo: any;

// Read key at module initialization so the Zuplo runtime provides the env
const FOURSQUARE_API_KEY: string | null = zuplo.env.FOURSQUARE_API_KEY ?? null;

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
    const key = FOURSQUARE_API_KEY;
    try {
      console.log('[FSQ Provider] Key present:', Boolean(key));
      console.log('[FSQ Provider] Key length:', key ? String(key).length : 0);
    } catch (e) {
      // ignore logging failures
    }
    return key;
  } catch (error) {
<<<<<<< Updated upstream
    console.warn("[Foursquare] API key not configured", error);
=======
    console.warn('[Foursquare] API key not configured', error);
    return null;
>>>>>>> Stashed changes
  }
  if (typeof process !== "undefined" && process.env?.FOURSQUARE_API_KEY) {
    return process.env.FOURSQUARE_API_KEY;
  }
  return null;
}

export async function searchWithFoursquare(
  query: FoursquareQuery,
  env?: EnvSource
): Promise<Place[]> {
  const apiKey = getApiKey(env);
  if (!apiKey) {
    return [];
  }

  const url = new URL(BASE_URL);
<<<<<<< Updated upstream
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
=======
  url.searchParams.set('ll', `${lat},${lng}`);
  url.searchParams.set('radius', Math.min(radiusMeters, 100_000).toString());
  url.searchParams.set('limit', Math.min(limit, 50).toString());
  if (categories.length > 0) {
    url.searchParams.set('categories', categories.join(','));
  }
  if (openNow !== undefined) {
    url.searchParams.set('open_now', openNow ? 'true' : 'false');
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      Authorization: apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Foursquare search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as FoursquareResponse;
  const places: Place[] = (payload.results ?? []).map((result) => {
    const address =
      result.location.formatted_address ??
      [
        result.location.address,
        result.location.locality,
        result.location.region,
        result.location.country,
        result.location.postcode,
      ]
        .filter(Boolean)
        .join(', ');

    return annotateDistance(
      {
        id: result.fsq_id,
        name: result.name,
        lat: result.location.latitude,
        lng: result.location.longitude,
        address,
        categories: (result.categories ?? []).map((category) => category.name),
        rating: result.rating,
        provider: 'foursquare',
        raw: result,
      },
      lat,
      lng
>>>>>>> Stashed changes
    );
    return [];
  }

<<<<<<< Updated upstream
  const payload = (await response.json()) as { results?: unknown[] };
  return normalizeFSQ(payload.results ?? []);
=======
  return {
    provider: 'foursquare',
    places,
  };
>>>>>>> Stashed changes
}
