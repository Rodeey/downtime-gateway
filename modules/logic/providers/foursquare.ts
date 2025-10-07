import { annotateDistance } from "../utils";
import type { Place, PlacesQuery, ProviderSearchResult } from "../types";

const BASE_URL = "https://api.foursquare.com/v3/places/search";

interface FoursquarePlace {
  fsq_id: string;
  name: string;
  location: {
    address?: string;
    locality?: string;
    region?: string;
    country?: string;
    postcode?: string;
    formatted_address?: string;
    latitude: number;
    longitude: number;
  };
  categories?: Array<{
    id: number;
    name: string;
  }>;
  rating?: number;
  popularity?: number;
  closed_bucket?: string;
}

interface FoursquareResponse {
  results: FoursquarePlace[];
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
  query: PlacesQuery
): Promise<ProviderSearchResult | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  const { lat, lng, categories, radiusMeters, limit = 20, openNow } = query;
  const url = new URL(BASE_URL);
  url.searchParams.set("ll", `${lat},${lng}`);
  url.searchParams.set("radius", Math.min(radiusMeters, 100_000).toString());
  url.searchParams.set("limit", Math.min(limit, 50).toString());
  if (categories.length > 0) {
    url.searchParams.set("categories", categories.join(","));
  }
  if (openNow !== undefined) {
    url.searchParams.set("open_now", openNow ? "true" : "false");
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
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
        .join(", ");

    return annotateDistance(
      {
        id: result.fsq_id,
        name: result.name,
        lat: result.location.latitude,
        lng: result.location.longitude,
        address,
        categories: (result.categories ?? []).map((category) => category.name),
        rating: result.rating,
        provider: "foursquare",
        raw: result,
      },
      lat,
      lng
    );
  });

  if (places.length === 0) {
    return null;
  }

  return {
    provider: "foursquare",
    places,
  };
}
