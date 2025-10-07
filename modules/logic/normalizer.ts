import type { CategoryBucket } from "./category-map";

export type ProviderName = "osm" | "foursquare" | "yelp";

export interface NormalizedLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface TravelEstimates {
  walk_min?: number;
  drive_min?: number;
}

export interface Place {
  provider: ProviderName;
  place_id: string;
  name: string;
  location: NormalizedLocation;
  lat: number;
  lng: number;
  address?: string;
  categories: string[];
  primary_category?: string;
  category_bucket?: CategoryBucket;
  category_label?: string;
  rating?: number;
  review_count?: number;
  price_level?: number;
  phone?: string;
  website?: string;
  open_now?: boolean;
  closing_soon?: boolean;
  distance_m?: number;
  travel: TravelEstimates;
  raw?: unknown;
}

function toFixedLocation(lat?: unknown, lng?: unknown): NormalizedLocation | null {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

function makeBasePlace(
  provider: ProviderName,
  place_id: string,
  name: string,
  location: NormalizedLocation
): Place {
  return {
    provider,
    place_id,
    name,
    location,
    lat: location.lat,
    lng: location.lng,
    categories: [],
    travel: {},
  };
}

function appendCommonFields(place: Place, source: Record<string, unknown>): void {
  if (typeof source["rating"] === "number") {
    place.rating = source["rating"] as number;
  }
  if (typeof source["review_count"] === "number") {
    place.review_count = source["review_count"] as number;
  } else if (typeof source["stats"] === "object" && source["stats"] !== null) {
    const stats = source["stats"] as Record<string, unknown>;
    const count = stats["total_ratings"] ?? stats["votes"] ?? stats["checkins"];
    if (typeof count === "number") {
      place.review_count = count;
    }
  }
  if (typeof source["price"] === "number") {
    place.price_level = source["price"] as number;
  } else if (typeof source["price_level"] === "number") {
    place.price_level = source["price_level"] as number;
  }
  if (typeof source["phone"] === "string") {
    place.phone = source["phone"] as string;
  } else if (typeof source["display_phone"] === "string") {
    place.phone = source["display_phone"] as string;
  }
  if (typeof source["website"] === "string") {
    place.website = source["website"] as string;
  } else if (typeof source["canonicalUrl"] === "string") {
    place.website = source["canonicalUrl"] as string;
  }
}

export function normalizeFSQ(results: unknown[]): Place[] {
  if (!Array.isArray(results)) {
    return [];
  }
  const places: Place[] = [];

  for (const raw of results) {
    if (typeof raw !== "object" || raw === null) {
      continue;
    }
    const record = raw as Record<string, unknown>;
    const id = typeof record["fsq_id"] === "string" ? record["fsq_id"] : undefined;
    const name = typeof record["name"] === "string" ? record["name"] : undefined;
    const lat = (record["geocodes"] as Record<string, unknown> | undefined)?.main;
    const location = toFixedLocation(
      typeof lat === "object" && lat !== null ? (lat as Record<string, unknown>)["latitude"] : undefined,
      typeof lat === "object" && lat !== null ? (lat as Record<string, unknown>)["longitude"] : undefined
    );

    if (!id || !name || !location) {
      continue;
    }

    const place = makeBasePlace("foursquare", id, name, location);

    const address = record["location"] as Record<string, unknown> | undefined;
    if (address) {
      const formatted =
        (address["formatted_address"] as string | undefined) ??
        (address["address"] as string | undefined);
      if (formatted) {
        place.address = formatted;
        place.location.address = formatted;
      }
    }

    const categories = Array.isArray(record["categories"])
      ? (record["categories"] as Array<Record<string, unknown>>)
          .map((entry) => {
            const cat = entry?.["name"];
            return typeof cat === "string" ? cat : undefined;
          })
          .filter((value): value is string => Boolean(value))
      : [];

    place.categories = categories;

    appendCommonFields(place, record);
    place.raw = record;

    places.push(place);
  }

  return places;
}

export function normalizeYelp(results: unknown[]): Place[] {
  if (!Array.isArray(results)) {
    return [];
  }
  const places: Place[] = [];

  for (const raw of results) {
    if (typeof raw !== "object" || raw === null) {
      continue;
    }
    const record = raw as Record<string, unknown>;
    const id = typeof record["id"] === "string" ? record["id"] : undefined;
    const name = typeof record["name"] === "string" ? record["name"] : undefined;
    const coordinates = record["coordinates"] as Record<string, unknown> | undefined;
    const location = toFixedLocation(coordinates?.["latitude"], coordinates?.["longitude"]);

    if (!id || !name || !location) {
      continue;
    }

    const place = makeBasePlace("yelp", id, name, location);

    const addressParts = record["location"] as Record<string, unknown> | undefined;
    if (addressParts) {
      const display = addressParts["display_address"];
      if (Array.isArray(display)) {
        const joined = display.filter((value): value is string => typeof value === "string").join(", ");
        if (joined) {
          place.address = joined;
          place.location.address = joined;
        }
      } else if (typeof display === "string") {
        place.address = display;
        place.location.address = display;
      }
    }

    const categories = Array.isArray(record["categories"])
      ? (record["categories"] as Array<Record<string, unknown>>)
          .map((entry) => {
            const title = entry?.["title"] ?? entry?.["alias"];
            return typeof title === "string" ? title : undefined;
          })
          .filter((value): value is string => Boolean(value))
      : [];

    place.categories = categories;

    appendCommonFields(place, {
      rating: record["rating"],
      review_count: record["review_count"],
      price_level: typeof record["price"] === "string" ? record["price"].length : undefined,
      phone: record["display_phone"],
      website: record["url"],
    });

    place.raw = record;
    places.push(place);
  }

  return places;
}

export function normalizeOSM(results: unknown[], provider: ProviderName = "osm"): Place[] {
  if (!Array.isArray(results)) {
    return [];
  }
  const places: Place[] = [];

  for (const raw of results) {
    if (typeof raw !== "object" || raw === null) {
      continue;
    }
    const record = raw as Record<string, unknown>;
    const id = typeof record["id"] === "number" ? String(record["id"]) : undefined;
    const name = typeof record["name"] === "string" ? record["name"] : undefined;
    const center = record["center"] as Record<string, unknown> | undefined;
    const lat =
      typeof record["lat"] === "number"
        ? (record["lat"] as number)
        : typeof center?.["lat"] === "number"
        ? (center["lat"] as number)
        : undefined;
    const lng =
      typeof record["lon"] === "number"
        ? (record["lon"] as number)
        : typeof center?.["lon"] === "number"
        ? (center["lon"] as number)
        : undefined;
    const location = toFixedLocation(lat, lng);

    if (!id || !name || !location) {
      continue;
    }

    const place = makeBasePlace(provider, id, name, location);

    const tags = record["tags"] as Record<string, unknown> | undefined;
    if (tags) {
      const addrParts = [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:city"],
        tags["addr:state"],
      ]
        .filter((value): value is string => typeof value === "string")
        .join(" ");
      if (addrParts) {
        place.address = addrParts;
        place.location.address = addrParts;
      }

      const categories: string[] = [];
      const leisure = tags["leisure"];
      const natural = tags["natural"];
      const tourism = tags["tourism"];
      const sport = tags["sport"];
      for (const token of [leisure, natural, tourism, sport]) {
        if (typeof token === "string") {
          categories.push(token);
        }
      }
      place.categories = categories;
    }

    place.raw = record;
    places.push(place);
  }

  return places;
}
