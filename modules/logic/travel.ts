import type { Place } from "./normalizer";
import { calculateDistanceMeters } from "./utils";
import {
  getCachedTravelTimes,
  putCachedTravelTimes,
  type TravelCacheRecord,
  type TravelCacheKey,
} from "./supabase";

export interface TravelOrigin {
  lat: number;
  lng: number;
}

export interface AddTravelTimesOptions {
  forceRefresh?: boolean;
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

export async function addTravelTimes(
  places: Place[],
  origin: TravelOrigin | null,
  options: AddTravelTimesOptions = {}
): Promise<Place[]> {
  if (!origin) {
    return places;
  }

  const key: TravelCacheKey = {
    lat: origin.lat,
    lng: origin.lng,
  };

  const cached = options.forceRefresh
    ? new Map<string, TravelCacheRecord>()
    : await getCachedTravelTimes(key, places.map((place) => place.place_id));

  const updates: TravelCacheRecord[] = [];

  for (const place of places) {
    const cacheEntry = cached.get(place.place_id);
    if (cacheEntry) {
      place.travel.walk_min = cacheEntry.walk_min;
      place.travel.drive_min = cacheEntry.drive_min;
    } else {
      const distanceMeters = calculateDistanceMeters(
        origin.lat,
        origin.lng,
        place.lat,
        place.lng
      );
      place.distance_m = distanceMeters;
      const distanceKm = haversineKm(origin.lat, origin.lng, place.lat, place.lng);
      const walkMinutes = Number.parseFloat(((distanceKm / 5) * 60).toFixed(1));
      const driveMinutes = Number.parseFloat(((distanceKm / 30) * 60).toFixed(1));
      place.travel.walk_min = walkMinutes;
      place.travel.drive_min = Math.max(2, driveMinutes);
      updates.push({
        place_id: place.place_id,
        walk_min: walkMinutes,
        drive_min: Math.max(2, driveMinutes),
      });
    }
  }

  if (updates.length > 0) {
    await putCachedTravelTimes(key, updates);
  }

  return places;
}
