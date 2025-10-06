import type { Place } from "./normalizer";
import { getCachedTravelTimes, putCachedTravelTimes } from "./supabase";

/**
 * Adds walk/drive times (minutes) using a lightweight estimate and cache.
 * Origin is the query (lat,lng). We use straight-line distance with speed heuristics:
 * - walk: 5 km/h  → 12 min per km
 * - drive (urban): 30 km/h → 2 min per km
 */
export async function addTravelTimes(
  places: Place[],
  origin: { lat: number; lng: number }
): Promise<Place[]> {
  if (!places.length) return places;

  const enriched: Place[] = [];
  for (const p of places) {
    // 1) Try cache
    const cached = await getCachedTravelTimes(origin, p.place_id);
    if (cached) {
      enriched.push({
        ...p,
        travel: {
          walk_min: cached.walk_min,
          drive_min: cached.drive_min,
          ...(p.travel || {}),
        },
      });
      continue;
    }

    // 2) Compute quick estimates
    const km = haversineKm(origin.lat, origin.lng, p.lat, p.lng);
    const walk_min = Math.round(km * 12);
    const drive_min = Math.max(2, Math.round(km * 2)); // floor at ~2 minutes

    // 3) Save to cache (best effort)
    await putCachedTravelTimes(origin, p.place_id, { walk_min, drive_min });

    enriched.push({
      ...p,
      travel: {
        walk_min,
        drive_min,
        ...(p.travel || {}),
      },
    });
  }

  return enriched;
}

// at bottom of travel.ts
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function deg2rad(d: number) {
  return (d * Math.PI) / 180;
}

