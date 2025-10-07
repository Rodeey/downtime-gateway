import { getPlaces, type PlacesRequest } from "../logic/api-logic";
import { parseCategories } from "../logic/utils";
import type { HandlerContext } from "./context";

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") {
    return true;
  }
  if (normalized === "0" || normalized === "false") {
    return false;
  }
  return undefined;
}

function parseNumber(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildRequest(url: URL): PlacesRequest {
  const lat = parseNumber(url.searchParams.get("lat"));
  const lng = parseNumber(url.searchParams.get("lng"));
  const radius = parseNumber(url.searchParams.get("radius_m"));
  const categories = parseCategories(url.searchParams.get("categories") ?? "");
  const openNow = parseBoolean(url.searchParams.get("open_now"));
  const forceRefresh = parseBoolean(url.searchParams.get("force_refresh"));

  if (lat === undefined || lng === undefined) {
    throw Object.assign(new Error("lat and lng query parameters are required"), {
      status: 400,
    });
  }

  return {
    lat,
    lng,
    radius_m: radius ?? 8_000,
    categories,
    open_now: openNow,
    force_refresh: forceRefresh,
  };
}

export default async function handler(
  request: Request,
  ctx: HandlerContext
): Promise<Response> {
  const url = new URL(request.url);

  try {
    const query = buildRequest(url);
    const result = await getPlaces(query, { request, env: ctx?.env });

    return new Response(
      JSON.stringify({
        source: result.source,
        places: result.places,
        categories_available: result.categories_available,
        duration_ms: result.duration_ms,
        error_code: result.error_code,
        error_message: result.error_message,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[Gateway] /places error", error);
    const status = (error as { status?: number }).status ?? 500;
    const message =
      error instanceof Error ? error.message : "Unable to complete request";

    return new Response(
      JSON.stringify({
        error_code: status === 400 ? "bad_request" : "internal_error",
        error_message: message,
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
