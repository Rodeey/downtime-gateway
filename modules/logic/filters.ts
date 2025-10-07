import type { Place } from "./normalizer";

const NAME_BLACKLIST = [
  /mcdonald/i,
  /burger\s*king/i,
  /wendy'?s/i,
  /taco\s*bell/i,
  /kfc/i,
  /subway/i,
  /little\s*caesars/i,
  /domino'?s/i,
  /papa\s*john/i,
  /starbucks/i,
  /shell\b/i,
  /bp\b/i,
  /chevron/i,
];

const CATEGORY_BLACKLIST = [
  "gas station",
  "fuel",
  "petrol",
  "convenience store",
  "pharmacy",
  "auto",
  "car wash",
  "oil",
];

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function gridKey(place: Place): string {
  const latBucket = Math.round(place.lat * 1000);
  const lngBucket = Math.round(place.lng * 1000);
  return `${latBucket}:${lngBucket}`;
}

export function filterPlaces(places: Place[]): Place[] {
  const seenNames = new Map<string, Set<string>>();

  return places.filter((place) => {
    const name = place.name ?? "";
    if (!name) {
      return false;
    }
    if (NAME_BLACKLIST.some((pattern) => pattern.test(name))) {
      return false;
    }
    if (
      place.categories.some((category) =>
        CATEGORY_BLACKLIST.includes(category.toLowerCase())
      )
    ) {
      return false;
    }

    const normalized = normalizeName(name);
    if (!normalized) {
      return false;
    }

    const key = gridKey(place);
    const buckets = seenNames.get(normalized);
    if (buckets) {
      if (buckets.has(key)) {
        return false;
      }
      buckets.add(key);
    } else {
      seenNames.set(normalized, new Set([key]));
    }

    return true;
  });
}
