import { normalizeOSM, type Place } from "../normalizer";
import { withUserAgent } from "../utils";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export interface OsmQuery {
  lat: number;
  lng: number;
  radius_m: number;
  limit: number;
}

const OUTDOOR_FILTER = [
  "leisure=park",
  "leisure=garden",
  "leisure=playground",
  "leisure=pitch",
  "leisure=sports_centre",
  "leisure=track",
  "natural=wood",
  "natural=grassland",
  "natural=beach",
  "natural=heath",
  "natural=water",
  "tourism=zoo",
  "tourism=theme_park",
  "tourism=attraction",
  "tourism=camp_site",
  "tourism=picnic_site",
];

function buildOverpassQuery(query: OsmQuery): string {
  const radius = Math.min(query.radius_m, 40_000);
  const filters = OUTDOOR_FILTER.map((statement) => {
    const [key, value] = statement.split("=");
    return `  node["${key}"="${value}"](around:${radius},${query.lat},${query.lng});`;
  }).join("\n");

  const wayFilters = OUTDOOR_FILTER.map((statement) => {
    const [key, value] = statement.split("=");
    return `  way["${key}"="${value}"](around:${radius},${query.lat},${query.lng});`;
  }).join("\n");

  return `[out:json][timeout:25];
  (
${filters}
${wayFilters}
  );
  out center ${query.limit};`;
}

export async function searchWithOsm(query: OsmQuery): Promise<Place[]> {
  const body = buildOverpassQuery(query);

  const response = await fetch(
    OVERPASS_URL,
    withUserAgent({
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
    })
  );

  if (!response.ok) {
    console.warn(
      `[OSM] Overpass query failed with status ${response.status}: ${response.statusText}`
    );
    return [];
  }

  const payload = (await response.json()) as { elements?: unknown[] };
  return normalizeOSM(payload.elements ?? [], "osm");
}
