import { normalizeYelp, type Place } from "../normalizer";
import { withUserAgent } from "../utils";
import type { EnvSource } from "../env";

declare const zuplo: any;
const YELP_API_KEY: string | null = zuplo.env.YELP_API_KEY ?? null;

const BASE_URL = "https://api.yelp.com/v3/businesses/search";

export interface YelpQuery {
  lat: number;
  lng: number;
  radius_m: number;
  limit: number;
  categories?: string[];
  open_now?: boolean;
}

function getApiKey(): string | null {
  try {
    const key = YELP_API_KEY;
    try {
      console.log('[Yelp Provider] Key present:', Boolean(key));
      console.log('[Yelp Provider] Key length:', key ? String(key).length : 0);
    } catch (e) {
      // ignore logging failures
    }
    return key;
  } catch (error) {
<<<<<<< Updated upstream
    console.warn("[Yelp] API key not configured", error);
=======
    console.warn('[Yelp] API key not configured', error);
    return null;
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
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
=======
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lng.toString());
  url.searchParams.set('radius', Math.min(radiusMeters, 40_000).toString());
  url.searchParams.set('limit', Math.min(limit, 50).toString());
  if (categories.length > 0) {
    url.searchParams.set('categories', categories.join(','));
  }
  if (openNow !== undefined) {
    url.searchParams.set('open_now', openNow ? 'true' : 'false');
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Yelp search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as YelpResponse;
  const places: Place[] = (payload.businesses ?? []).map((business) => {
    const address =
      (business.location.display_address ?? []).join(', ') ||
      [
        business.location.address1,
        business.location.city,
        business.location.state,
        business.location.country,
        business.location.zip_code,
      ]
        .filter(Boolean)
        .join(', ');

    return annotateDistance(
      {
        id: business.id,
        name: business.name,
        lat: business.coordinates.latitude,
        lng: business.coordinates.longitude,
        address,
        categories: (business.categories ?? []).map((category) => category.title),
        rating: business.rating,
        reviewCount: business.review_count,
        priceLevel: business.price ? business.price.length : undefined,
        openNow: business.is_closed === undefined ? undefined : !business.is_closed,
        phone: business.display_phone,
        website: business.url,
        provider: 'yelp',
        raw: business,
      },
      lat,
      lng
>>>>>>> Stashed changes
    );
    return [];
  }

<<<<<<< Updated upstream
  const payload = (await response.json()) as { businesses?: unknown[] };
  return normalizeYelp(payload.businesses ?? []);
=======
  return {
    provider: 'yelp',
    places,
  };
>>>>>>> Stashed changes
}
