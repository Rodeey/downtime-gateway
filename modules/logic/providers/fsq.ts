import { normalizeFSQ, Place } from "../normalizer";
import { environment } from "@zuplo/runtime";

const FOURSQUARE_API_KEY = environment.FOURSQUARE_API_KEY;

export async function fetchFSQPlaces(params: {
  lat: number;
  lng: number;
  radius_m: number;
  categories: string[];
}): Promise<Place[]> {

  const { lat, lng, radius_m, categories } = params;

  const url = new URL("https://places-api.foursquare.com/places/search");
  url.searchParams.set("ll", `${lat},${lng}`);
  url.searchParams.set("radius", String(radius_m));
  url.searchParams.set("limit", "20");
  url.searchParams.set("sort", "DISTANCE");
  if (categories.length) {
    url.searchParams.set("categories", categories.join(","));
  }

  console.log("🔑 FSQ key (first 6 chars):", FOURSQUARE_API_KEY?.slice(0, 6));

  const resp = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${FOURSQUARE_API_KEY}`,
      Accept: "application/json",
      "X-Places-Api-Version": "2025-06-17",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`FSQ error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  return normalizeFSQ(data.results || []);
}

