import { annotateDistance } from "../utils";
import type { Place, PlacesQuery, ProviderSearchResult } from "../types";

const BASE_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

interface GooglePlace {
  place_id: string;
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  vicinity?: string;
  business_status?: string;
  opening_hours?: {
    open_now?: boolean;
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
  formatted_address?: string;
}

interface GoogleResponse {
  results: GooglePlace[];
  status: string;
}

function getApiKey(): string | null {
  try {
    return zuplo.env.GOOGLE_PLACES_API_KEY ?? zuplo.env.GOOGLE_MAPS_API_KEY ?? null;
  } catch (error) {
    console.warn("[Google Places] API key not configured", error);
    return null;
  }
}

export async function searchWithGoogle(
  query: PlacesQuery
): Promise<ProviderSearchResult | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  const { lat, lng, categories, radiusMeters, limit = 20, openNow } = query;
  const url = new URL(BASE_URL);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", Math.min(radiusMeters, 50_000).toString());
  if (categories.length > 0) {
    url.searchParams.set("keyword", categories.join(" "));
  }
  if (openNow !== undefined) {
    url.searchParams.set("opennow", openNow ? "true" : "false");
  }
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Google Places search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GoogleResponse;
  if (payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places search returned status ${payload.status}`);
  }

  const places: Place[] = (payload.results ?? []).slice(0, limit).map((result) =>
    annotateDistance(
      {
        id: result.place_id,
        name: result.name,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        address: result.formatted_address ?? result.vicinity,
        categories: result.types,
        rating: result.rating,
        reviewCount: result.user_ratings_total,
        priceLevel: result.price_level,
        openNow: result.opening_hours?.open_now,
        provider: "google",
        raw: result,
      },
      lat,
      lng
    )
  );

  if (places.length === 0) {
    return null;
  }

  return {
    provider: "google",
    places,
  };
}
