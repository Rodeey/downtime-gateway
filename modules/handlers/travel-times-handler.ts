import { getCachedTravelTimes, putCachedTravelTimes } from "../logic/supabase";
import { haversineKm } from "../logic/travel"; // export haversineKm in travel.ts
import type { Place } from "../logic/normalizer";

export default async function handler(request: Request) {
  try {
    const body = await request.json();
    const { origin, place_ids }: { origin: { lat: number; lng: number }; place_ids: string[] } = body;

    if (!origin?.lat || !origin?.lng || !Array.isArray(place_ids)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const results: Record<
      string,
      { walk_min: number | null; drive_min: number | null }
    > = {};

    for (const pid of place_ids) {
      // 1) Try cache
      const cached = await getCachedTravelTimes(origin, pid);
      if (cached) {
        results[pid] = cached;
        continue;
      }

      // 2) Estimate new
      const km = haversineKm(origin.lat, origin.lng, origin.lat + Math.random() * 0.01, origin.lng + Math.random() * 0.01);
      // NOTE: above line is placeholder if you don’t have full place lat/lng; see below comment.

      const walk_min = Math.round(km * 12);
      const drive_min = Math.max(2, Math.round(km * 2));

      await putCachedTravelTimes(origin, pid, { walk_min, drive_min });
      results[pid] = { walk_min, drive_min };
    }

    return new Response(JSON.stringify({ origin, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("❌ travel-times-handler error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
