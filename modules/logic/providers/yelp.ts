import { annotateDistance } from "../utils";
import type { Place, PlacesQuery, ProviderSearchResult } from "../types";

const BASE_URL = "https://api.yelp.com/v3/businesses/search";

interface YelpBusiness {
  id: string;
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  location: {
    address1?: string;
    city?: string;
    state?: string;
    country?: string;
    zip_code?: string;
    display_address?: string[];
  };
  categories?: Array<{
    alias: string;
    title: string;
  }>;
  rating?: number;
  review_count?: number;
  price?: string;
  is_closed?: boolean;
  display_phone?: string;
  url?: string;
}

interface YelpResponse {
  businesses: YelpBusiness[];
}

function getApiKey(): string | null {
  try {
    return zuplo.env.YELP_API_KEY ?? null;
  } catch (error) {
    console.warn("[Yelp] API key not configured", error);
    return null;
  }
}

export async function searchWithYelp(
  query: PlacesQuery
): Promise<ProviderSearchResult | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  const { lat, lng, categories, radiusMeters, limit = 20, openNow } = query;
  const url = new URL(BASE_URL);
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lng.toString());
  url.searchParams.set("radius", Math.min(radiusMeters, 40_000).toString());
  url.searchParams.set("limit", Math.min(limit, 50).toString());
  if (categories.length > 0) {
    url.searchParams.set("categories", categories.join(","));
  }
  if (openNow !== undefined) {
    url.searchParams.set("open_now", openNow ? "true" : "false");
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Yelp search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as YelpResponse;
  const places: Place[] = (payload.businesses ?? []).map((business) => {
    const address =
      (business.location.display_address ?? []).join(", ") ||
      [
        business.location.address1,
        business.location.city,
        business.location.state,
        business.location.country,
        business.location.zip_code,
      ]
        .filter(Boolean)
        .join(", ");

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
        provider: "yelp",
        raw: business,
      },
      lat,
      lng
    );
  });

  if (places.length === 0) {
    return null;
  }

  return {
    provider: "yelp",
    places,
  };
}
