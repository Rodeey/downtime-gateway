import { withUserAgent } from "../logic/utils";
import type { HandlerContext } from "./context";

interface GeoapifyFeature {
  properties?: {
    lat?: number;
    lon?: number;
    formatted?: string;
  };
}

interface GeoapifyResponse {
  features?: GeoapifyFeature[];
}

function getApiKey(): string | null {
  try {
    const value = (zuplo.env as Record<string, unknown>).GEOAPIFY_KEY;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  } catch (error) {
    console.warn("[Geocode] Unable to read GEOAPIFY_KEY", error);
  }
  if (typeof process !== "undefined" && process.env.GEOAPIFY_KEY) {
    return process.env.GEOAPIFY_KEY;
  }
  console.warn("[Geocode] Unable to read GEOAPIFY_KEY");
  return null;
}

export default async function handler(
  request: Request,
  ctx: HandlerContext
): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim();

  if (!query) {
    return new Response(JSON.stringify({ error: "query parameter is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = getApiKey(ctx);
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Geocoding provider not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const geoapifyUrl = new URL("https://api.geoapify.com/v1/geocode/search");
  geoapifyUrl.searchParams.set("text", query);
  geoapifyUrl.searchParams.set("limit", "1");
  geoapifyUrl.searchParams.set("apiKey", apiKey);

  const response = await fetch(geoapifyUrl.toString(), withUserAgent());
  if (!response.ok) {
    console.error("[Geocode] Geoapify request failed", response.status, response.statusText);
    return new Response(JSON.stringify({ error: "Unable to geocode query" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = (await response.json()) as GeoapifyResponse;
  const [feature] = payload.features ?? [];
  const lat = feature?.properties?.lat;
  const lon = feature?.properties?.lon;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return new Response(JSON.stringify({ error: "No results found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      location: { lat, lng: lon },
      address: feature?.properties?.formatted ?? query,
      provider: "geoapify",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
