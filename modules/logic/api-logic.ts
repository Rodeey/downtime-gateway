import { searchWithFoursquare } from "./providers/foursquare";
import { searchWithGoogle } from "./providers/google";
import { searchWithOsm } from "./providers/osm";
import { searchWithYelp } from "./providers/yelp";
import type {
  GeocodeResult,
  PlacesQuery,
  ProviderName,
  ProviderSearchResult,
  TravelTimesRequest,
  TravelTimesResponse,
} from "./types";
import { calculateDistanceMeters } from "./utils";

interface WaterfallResult extends ProviderSearchResult {
  provider: ProviderName;
}

const providerSequence: ProviderName[] = [
  "osm",
  "foursquare",
  "yelp",
  "google",
];

type ProviderSearcher = (
  query: PlacesQuery
) => Promise<ProviderSearchResult | null>;

const searchers: Record<ProviderName, ProviderSearcher> = {
  osm: searchWithOsm,
  foursquare: searchWithFoursquare,
  yelp: searchWithYelp,
  google: searchWithGoogle,
};

export async function getPlaces(
  query: PlacesQuery
): Promise<WaterfallResult> {
  const errors: Array<{ provider: ProviderName; error: unknown }> = [];

  for (const provider of providerSequence) {
    const searcher = searchers[provider];
    try {
      const result = await searcher(query);
      if (result && result.places.length > 0) {
        return {
          provider,
          places: result.places,
          cacheHit: result.cacheHit,
        };
      }
    } catch (error) {
      console.warn(`[Gateway] Provider ${provider} failed`, error);
      errors.push({ provider, error });
    }
  }

  const error = new Error(
    `No providers returned results. Failures: ${errors
      .map((entry) => `${entry.provider}: ${String(entry.error)}`)
      .join("; ")}`
  );
  throw error;
}

export async function geocode(query: string): Promise<GeocodeResult> {
  const normalized = query.trim();
  if (!normalized) {
    throw new Error("Query cannot be empty");
  }

  const nominatim = new URL("https://nominatim.openstreetmap.org/search");
  nominatim.searchParams.set("q", normalized);
  nominatim.searchParams.set("format", "jsonv2");
  nominatim.searchParams.set("limit", "1");

  const osmResponse = await fetch(nominatim, {
    headers: {
      "User-Agent": "Downtime-Gateway/1.0 (+https://github.com/zuplo)",
    },
  });

  if (osmResponse.ok) {
    const payload = (await osmResponse.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (payload.length > 0) {
      const [result] = payload;
      return {
        location: {
          lat: Number.parseFloat(result.lat),
          lng: Number.parseFloat(result.lon),
        },
        address: result.display_name,
        provider: "osm",
      };
    }
  }

  const googleKey = (() => {
    try {
      return (
        zuplo.env.GOOGLE_GEOCODING_API_KEY ??
        zuplo.env.GOOGLE_PLACES_API_KEY ??
        zuplo.env.GOOGLE_MAPS_API_KEY ??
        null
      );
    } catch (error) {
      console.warn("[Gateway] Google geocoding key missing", error);
      return null;
    }
  })();

  if (!googleKey) {
    throw new Error("No geocoding providers returned results");
  }

  const googleUrl = new URL(
    "https://maps.googleapis.com/maps/api/geocode/json"
  );
  googleUrl.searchParams.set("address", normalized);
  googleUrl.searchParams.set("key", googleKey);

  const googleResponse = await fetch(googleUrl);
  if (!googleResponse.ok) {
    throw new Error(
      `Google geocode failed with status ${googleResponse.status}`
    );
  }

  const googlePayload = (await googleResponse.json()) as {
    results: Array<{
      geometry: { location: { lat: number; lng: number } };
      formatted_address: string;
    }>;
    status: string;
  };

  if (googlePayload.status !== "OK" || googlePayload.results.length === 0) {
    throw new Error(
      `Google geocode returned status ${googlePayload.status}`
    );
  }

  const [googleResult] = googlePayload.results;
  return {
    location: googleResult.geometry.location,
    address: googleResult.formatted_address,
    provider: "google",
  };
}

export function estimateTravelTimes(
  request: TravelTimesRequest
): TravelTimesResponse {
  const AVERAGE_SPEEDS = {
    driving: 50_000 / 60, // 50 km/h in meters per minute
    walking: 5_000 / 60, // 5 km/h in meters per minute
    biking: 15_000 / 60, // 15 km/h in meters per minute
  } as const;

  const results = request.destinations.map((destination) => {
    const distanceMeters = calculateDistanceMeters(
      request.origin.lat,
      request.origin.lng,
      destination.lat,
      destination.lng
    );

    return {
      id: destination.id,
      distanceMeters,
      drivingMinutes: Number.parseFloat(
        (distanceMeters / AVERAGE_SPEEDS.driving).toFixed(2)
      ),
      walkingMinutes: Number.parseFloat(
        (distanceMeters / AVERAGE_SPEEDS.walking).toFixed(2)
      ),
      bikingMinutes: Number.parseFloat(
        (distanceMeters / AVERAGE_SPEEDS.biking).toFixed(2)
      ),
    };
  });

  return {
    results,
    provider: "heuristic",
  };
}
