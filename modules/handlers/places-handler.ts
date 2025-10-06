import { getPlaces, GetPlacesResult } from "../logic/api-logic";

export default async function handler(request: Request) {
  const url = new URL(request.url);

  // --- Parse query params safely ---
  const latParam = url.searchParams.get("lat");
  const lngParam = url.searchParams.get("lng");
  const radiusParam = url.searchParams.get("radius_m");

  if (!latParam || !lngParam) {
    return new Response(
      JSON.stringify({ error: "lat & lng are required query params" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const lat = parseFloat(latParam);
  const lng = parseFloat(lngParam);
  const radius_m = radiusParam ? parseInt(radiusParam) : 1000;

  if (isNaN(lat) || isNaN(lng)) {
    return new Response(
      JSON.stringify({ error: "lat & lng must be numbers" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const categories =
    url.searchParams
      .get("categories")
      ?.split(",")
      .map((c) => c.trim().replace(/['"]+/g, "")) || [];

  // --- Call orchestrator ---
  const result: GetPlacesResult = await getPlaces(
    { lat, lng, radius_m, categories },
    request
  );

  // --- Return response ---
  return new Response(
    JSON.stringify({
      source: result.cache_hit ? "cache" : result.provider_used,
      places: result.places,
      error_code: result.error_code ?? null,
      error_message: result.error_message ?? null,
      duration_ms: result.duration_ms,
      categories_available: result.categories_available ?? [],
    }),
    {
      headers: { "Content-Type": "application/json" },
      status: result.error_code ? 500 : 200,
    }
  );
}
