import { normalizeFSQ, type Place } from "../normalizer";
import { withUserAgent } from "../utils";
import type { EnvSource } from "../env";

declare const zuplo: any;

// Read key at module initialization so the Zuplo runtime provides the env
// (touched to ensure a clean copy is committed)
const FOURSQUARE_API_KEY: string | null = zuplo?.env?.FOURSQUARE_API_KEY ?? null;

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
    if (key) return key;
  } catch (error) {
    console.warn('[Foursquare] API key not configured', error);
  }

  if (typeof process !== 'undefined' && process.env?.FOURSQUARE_API_KEY) {
    return process.env.FOURSQUARE_API_KEY;
  }

  return null;
}

export async function searchWithFoursquare(
  query: FoursquareQuery,
  env?: EnvSource
): Promise<Place[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const url = new URL(BASE_URL);
  url.searchParams.set('ll', `${query.lat},${query.lng}`);
  url.searchParams.set('radius', Math.min(query.radius_m, 100_000).toString());
  url.searchParams.set('limit', Math.min(query.limit, 50).toString());
  if (query.categories && query.categories.length > 0) {
    url.searchParams.set('categories', query.categories.join(','));
  }
  if (query.open_now !== undefined) {
    url.searchParams.set('open_now', query.open_now ? 'true' : 'false');
  }

  const response = await fetch(
    url.toString(),
    withUserAgent({
      headers: {
        Accept: 'application/json',
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
