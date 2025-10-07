import type { HandlerContext } from "./context";
import { withUserAgent } from "../logic/utils";

interface NominatimResult {
  lat?: string;
  lon?: string;
  display_name?: string;
}

function parseCoordinate(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function handler(
  request: Request,
  _ctx: HandlerContext
): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim();

  if (!query) {
    return new Response(JSON.stringify({ error: "query parameter is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
  nominatimUrl.searchParams.set("q", query);
  nominatimUrl.searchParams.set("format", "json");
  nominatimUrl.searchParams.set("limit", "1");
  nominatimUrl.searchParams.set("addressdetails", "0");

  const response = await fetch(
    nominatimUrl.toString(),
    withUserAgent({
      headers: {
        "Accept": "application/json",
      },
    })
  );

  if (!response.ok) {
    console.error(
      "[Geocode] Nominatim request failed",
      response.status,
      response.statusText
    );
    return new Response(JSON.stringify({ error: "Unable to geocode query" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = (await response.json()) as NominatimResult[];
  const [result] = payload;

  const lat = parseCoordinate(result?.lat);
  const lon = parseCoordinate(result?.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return new Response(JSON.stringify({ error: "No results found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      location: { lat, lng: lon },
      address: result?.display_name ?? query,
      provider: "nominatim",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400",
      },
    }
  );
}
