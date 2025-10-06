import { normalizeYelp, Place } from "../normalizer";
import { environment } from "@zuplo/runtime";

const YELP_API_KEY = environment.YELP_API_KEY;

export async function fetchYelpPlaces(params: {
  lat: number;
  lng: number;
  radius_m: number;
  categories: string[];
}): Promise<Place[]> {
  const { lat, lng, radius_m, categories } = params;

  const url = new URL("https://api.yelp.com/v3/businesses/search");
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lng.toString());
  url.searchParams.set("radius", radius_m.toString());
  url.searchParams.set("limit", "20");

  if (categories.length) {
    // keep it simple for now: join category aliases
    url.searchParams.set("categories", categories.join(","));
  }

  console.log("🔑 Yelp key (first 6 chars):", YELP_API_KEY?.slice(0, 6));

  const resp = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${YELP_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Yelp error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  return normalizeYelp(data.businesses || []);
}
