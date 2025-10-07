import { annotateDistance, withUserAgent } from "../utils";
import type { Place, PlacesQuery, ProviderSearchResult } from "../types";

interface PhotonFeature {
  geometry: {
    coordinates: [number, number];
  };
  properties: {
    osm_id: number;
    osm_type: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
    type?: string;
    osm_key?: string;
    osm_value?: string;
  };
}

interface PhotonResponse {
  features: PhotonFeature[];
}

export async function searchWithOsm(
  query: PlacesQuery
): Promise<ProviderSearchResult | null> {
  const { lat, lng, categories, limit = 20 } = query;
  const search = categories.length > 0 ? categories.join(" ") : "amenity";
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lon", lng.toString());
  url.searchParams.set("q", search);
  url.searchParams.set("limit", Math.min(limit, 50).toString());
  url.searchParams.set("lang", "en");

  const response = await fetch(url.toString(), withUserAgent());
  if (!response.ok) {
    throw new Error(`OSM search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as PhotonResponse;
  const places: Place[] = (payload.features ?? []).map((feature) => {
    const [featureLng, featureLat] = feature.geometry.coordinates;
    const { properties } = feature;

    const addressParts = [
      properties.housenumber && properties.street
        ? `${properties.housenumber} ${properties.street}`
        : properties.street,
      properties.city,
      properties.state,
      properties.country,
      properties.postcode,
    ].filter(Boolean);

    return annotateDistance(
      {
        id: `${properties.osm_type}:${properties.osm_id}`,
        name: properties.name ?? properties.type ?? "Unnamed place",
        lat: featureLat,
        lng: featureLng,
        address: addressParts.join(", "),
        categories: [
          properties.type,
          properties.osm_key,
          properties.osm_value,
        ].filter(Boolean) as string[],
        provider: "osm",
        raw: feature,
      },
      lat,
      lng
    );
  });

  if (places.length === 0) {
    return null;
  }

  return {
    provider: "osm",
    places,
  };
}
