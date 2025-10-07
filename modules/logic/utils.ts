import type { Place } from "./types";

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
    place.distanceMeters = calculateDistanceMeters(
      originLat,
      originLng,
      place.lat,
      place.lng
    );
  }
  return place;
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
