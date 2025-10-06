import type { CategoryBucket } from "./category-map";
import type { Place } from "./normalizer";

/** Category caps + 40% thresholds */
export const capByCategory: Record<CategoryBucket, number> = {
  food_drink: 50,
  outdoors: 40,
  shops: 35,
  arts: 25,
  activities: 30,
  coffee_wfh: 20,
  general: 20, // safety default
};

export const thresholdByCategory: Record<CategoryBucket, number> =
  Object.fromEntries(
    Object.entries(capByCategory).map(([k, cap]) => [k, Math.floor(cap * 0.4)])
  ) as Record<CategoryBucket, number>;

/** Michigan geofence (rough bounding box; refine later with polygon if needed) */
export function isInMichigan(lat: number, lng: number): boolean {
  const minLat = 41.7, maxLat = 48.5;
  const minLng = -90.5, maxLng = -82.1;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/** Shortfall cannot exceed cap; never negative */
export function clampToShortfall(shortfall: number, cap: number) {
  if (shortfall <= 0) return 0;
  return Math.min(shortfall, cap);
}

/** Summarize categories for frontend chips (filter out general/all) */
export function summarizeCategories(
  places: Place[]
): { name: string; count: number }[] {
  const counts: Record<string, number> = {};

  for (const p of places) {
    const cat = p.primary_category ?? "general";

    // 🚫 filter out "general" / "all"
    if (!cat || cat.toLowerCase() === "general" || cat.toLowerCase() === "all") {
      continue;
    }

    counts[cat] = (counts[cat] || 0) + 1;
  }

  return Object.entries(counts).map(([name, count]) => ({ name, count }));
}
