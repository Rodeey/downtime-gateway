import { getPlaces } from "../logic/api-logic";
import type { PlacesQuery } from "../logic/types";
import { parseCategories } from "../logic/utils";

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === "1" || value.toLowerCase() === "true") return true;
  if (value === "0" || value.toLowerCase() === "false") return false;
  return undefined;
}

function buildQuery(url: URL): PlacesQuery {
  const lat = Number.parseFloat(url.searchParams.get("lat") ?? "");
  const lng = Number.parseFloat(url.searchParams.get("lng") ?? "");
  const radiusMeters = Number.parseInt(
    url.searchParams.get("radius_m") ?? "",
    10
  );
  const categoriesParam = url.searchParams.get("categories") ?? "";
  const categories = parseCategories(categoriesParam);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const openNow = parseBoolean(url.searchParams.get("open_now"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("lat and lng query parameters are required numbers");
  }

  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    throw new Error("radius_m query parameter must be a positive number");
  }

  if (categories.length === 0) {
    throw new Error("categories query parameter must contain at least one value");
  }

  return {
    lat,
    lng,
    radiusMeters,
    categories,
    limit,
    openNow,
  };
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  try {
    const query = buildQuery(url);
    const result = await getPlaces(query);

    return new Response(
      JSON.stringify({
        places: result.places,
        provider_used: result.provider,
        cache_hit: Boolean(result.cacheHit),
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[Gateway] /places error", error);
    const status = error instanceof Error && /required/.test(error.message)
      ? 400
      : 500;

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
