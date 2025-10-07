import type { Place } from "./normalizer";
import { resolveCategoryKey, type CategoryBucket } from "./category-map";

const CATEGORY_WINDOWS: Record<CategoryBucket, { open: number; close: number }> = {
  food_drink: { open: 11 * 60, close: 22 * 60 },
  coffee_wfh: { open: 7 * 60, close: 18 * 60 },
  outdoors: { open: 7 * 60, close: 20 * 60 },
  arts_culture: { open: 10 * 60, close: 20 * 60 },
  shops_services: { open: 10 * 60, close: 19 * 60 },
  wellness: { open: 9 * 60, close: 20 * 60 },
  general: { open: 9 * 60, close: 21 * 60 },
};

const closingMeta = new WeakMap<Place, number>();

function bucketForPlace(place: Place): CategoryBucket {
  return (
    place.category_bucket ??
    resolveCategoryKey(place.primary_category ?? place.categories[0] ?? "general")
  );
}

function minutesSinceMidnightUtc(now: Date): number {
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

export function applyOpenNowRules(places: Place[], now = new Date()): Place[] {
  const currentMinutes = minutesSinceMidnightUtc(now);

  return places
    .map((place) => {
      const bucket = bucketForPlace(place);
      const window = CATEGORY_WINDOWS[bucket] ?? CATEGORY_WINDOWS.general;
      const open = currentMinutes >= window.open && currentMinutes < window.close;
      place.open_now = open;
      if (open) {
        const minutesUntilClose = window.close - currentMinutes;
        closingMeta.set(place, minutesUntilClose);
        place.closing_soon = minutesUntilClose <= 45;
      } else {
        place.closing_soon = false;
        closingMeta.delete(place);
      }
      return place;
    })
    .filter((place) => place.open_now === true);
}

export function filterClosingSoon(places: Place[]): Place[] {
  return places.filter((place) => {
    const minutesUntilClose = closingMeta.get(place);
    if (typeof minutesUntilClose === "number") {
      return minutesUntilClose > 30;
    }
    // If we do not have metadata assume the venue is safe to keep.
    return true;
  });
}
