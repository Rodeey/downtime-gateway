import {
  getCachedTravelTimes,
  putCachedTravelTimes,
  type TravelCacheRecord,
  type TravelCacheKey,
} from "../logic/supabase";
import { haversineKm } from "../logic/travel";

interface TravelTimesRequestBody {
  origin: { lat: number; lng: number };
  destinations: Array<{ place_id: string; lat: number; lng: number }>;
}

function isValidCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseBody(body: unknown): TravelTimesRequestBody {
  if (typeof body !== "object" || body === null) {
    throw Object.assign(new Error("Invalid request body"), { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  const origin = payload.origin as Record<string, unknown> | undefined;
  const destinations = payload.destinations as unknown;

  if (!origin || !isValidCoordinate(origin.lat) || !isValidCoordinate(origin.lng)) {
    throw Object.assign(new Error("origin.lat and origin.lng are required"), {
      status: 400,
    });
  }

  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw Object.assign(new Error("destinations must be a non-empty array"), {
      status: 400,
    });
  }

  const parsedDestinations = destinations.map((destination) => {
    if (typeof destination !== "object" || destination === null) {
      throw Object.assign(new Error("Invalid destination entry"), { status: 400 });
    }
    const entry = destination as Record<string, unknown>;
    const place_id = entry.place_id;
    if (typeof place_id !== "string" || place_id.length === 0) {
      throw Object.assign(new Error("destination.place_id is required"), {
        status: 400,
      });
    }
    if (!isValidCoordinate(entry.lat) || !isValidCoordinate(entry.lng)) {
      throw Object.assign(new Error("destination lat/lng are required"), {
        status: 400,
      });
    }
    return {
      place_id,
      lat: entry.lat as number,
      lng: entry.lng as number,
    };
  });

  return {
    origin: { lat: origin.lat as number, lng: origin.lng as number },
    destinations: parsedDestinations,
  };
}

function estimateTravelMinutes(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): { walk_min: number; drive_min: number } {
  const distanceKm = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
  const walkMinutes = Number.parseFloat(((distanceKm / 5) * 60).toFixed(1));
  const driveMinutes = Math.max(2, Number.parseFloat(((distanceKm / 30) * 60).toFixed(1)));
  return { walk_min: walkMinutes, drive_min: driveMinutes };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { origin, destinations } = parseBody(body);
    const cacheKey: TravelCacheKey = { lat: origin.lat, lng: origin.lng };
    const cached = await getCachedTravelTimes(
      cacheKey,
      destinations.map((destination) => destination.place_id)
    );

    const updates: TravelCacheRecord[] = [];
    const results = destinations.map((destination) => {
      const cachedEntry = cached.get(destination.place_id);
      if (cachedEntry) {
        return {
          place_id: destination.place_id,
          walk_min: cachedEntry.walk_min ?? null,
          drive_min: cachedEntry.drive_min ?? null,
          source: "cache" as const,
        };
      }
      const estimate = estimateTravelMinutes(origin, destination);
      updates.push({
        place_id: destination.place_id,
        walk_min: estimate.walk_min,
        drive_min: estimate.drive_min,
      });
      return {
        place_id: destination.place_id,
        walk_min: estimate.walk_min,
        drive_min: estimate.drive_min,
        source: "live" as const,
      };
    });

    if (updates.length > 0) {
      await putCachedTravelTimes(cacheKey, updates);
    }

    const overallSource = results.every((result) => result.source === "cache")
      ? "cache"
      : "live";

    return new Response(
      JSON.stringify({
        origin,
        results,
        source: overallSource,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[Gateway] /travel-times error", error);
    const status = (error as { status?: number }).status ?? 500;
    const message =
      error instanceof Error ? error.message : "Unable to compute travel times";

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
