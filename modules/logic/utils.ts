import type { Place } from "./normalizer";
import { categoryLabel, resolveCategoryKey } from "./category-map";
import type { CategoryBucket } from "./category-map";

const EARTH_RADIUS_METERS = 6371_000;

export function parseCategories(categories: string): string[] {
  return categories
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}

export function annotateDistance(
  place: Place,
  originLat: number,
  originLng: number
): Place {
  if (Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
    const distance = calculateDistanceMeters(
      originLat,
      originLng,
      place.lat,
      place.lng
    );
    place.distance_m = distance;
    // Maintain backward compatibility for any legacy callers while the
    // migration completes.
    (place as Place & { distanceMeters?: number }).distanceMeters = distance;
  }
  return place;
}

export const capByCategory: Record<CategoryBucket, number> = {
  food_drink: 50,
  coffee_wfh: 20,
  outdoors: 40,
  arts_culture: 24,
  shops_services: 30,
  wellness: 20,
  general: 12,
};

export const thresholdByCategory: Record<CategoryBucket, number> = Object.fromEntries(
  Object.entries(capByCategory).map(([bucket, cap]) => [
    bucket,
    Math.max(1, Math.round((cap as number) * 0.4)),
  ])
) as Record<CategoryBucket, number>;

const CATEGORY_ORDER: CategoryBucket[] = [
  "food_drink",
  "coffee_wfh",
  "outdoors",
  "arts_culture",
  "shops_services",
  "wellness",
  "general",
];

export interface CategorySummary {
  key: CategoryBucket;
  label: string;
  count: number;
}

export function summarizeCategories(places: Place[]): CategorySummary[] {
  const counts = new Map<CategoryBucket, number>();

  for (const place of places) {
    const bucket =
      place.category_bucket ??
      resolveCategoryKey(
        place.primary_category ?? place.categories[0] ?? "general"
      );
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return CATEGORY_ORDER
    .map((key) => ({
      key,
      label: categoryLabel(key),
      count: counts.get(key) ?? 0,
    }))
    .filter((entry) => entry.count > 0);
}

export function withUserAgent(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("User-Agent")) {
    headers.set(
      "User-Agent",
      "Downtime-Gateway/1.0 (+https://github.com/zuplo/downtime-gateway)"
    );
  }
  return {
    ...init,
    headers,
  };
}
