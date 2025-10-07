import type { Place } from "./normalizer";

function minutes(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return Number.POSITIVE_INFINITY;
  }
  return value;
}

function distance(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return Number.POSITIVE_INFINITY;
  }
  return value;
}

export function rankPlaces(places: Place[]): Place[] {
  return [...places].sort((a, b) => {
    const openDiff = Number(Boolean(b.open_now)) - Number(Boolean(a.open_now));
    if (openDiff !== 0) {
      return openDiff;
    }

    const closingSoonDiff = Number(Boolean(a.closing_soon)) - Number(
      Boolean(b.closing_soon)
    );
    if (closingSoonDiff !== 0) {
      return closingSoonDiff;
    }

    const driveDiff = minutes(a.travel.drive_min) - minutes(b.travel.drive_min);
    if (driveDiff !== 0) {
      return driveDiff;
    }

    const walkDiff = minutes(a.travel.walk_min) - minutes(b.travel.walk_min);
    if (walkDiff !== 0) {
      return walkDiff;
    }

    return distance(a.distance_m) - distance(b.distance_m);
  });
}
