// modules/logic/normalizer.ts
import type { CategoryBucket } from "./category-map";

/** Unified place type returned to frontend */
export type Place = {
  provider: "fsq" | "yelp" | "google";
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  location: { lat: number; lng: number }; // ✅ ensure location always exists
  address?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  categories?: string[]; // raw provider categories (names/aliases/ids)
  phone?: string | null;
  website?: string | null;

  // computed/enriched later
  open_now?: boolean | null;
  closing_soon?: boolean | null;
  distance_m?: number | null;

  // normalized category fields (set downstream)
  primary_category?: CategoryBucket;
  category_label?: string;

  // travel times (minutes), filled by travel.ts
  travel?: {
    walk_min?: number | null;
    drive_min?: number | null;
  };
};

/** FSQ → Place[] */
export function normalizeFSQ(results: any[]): Place[] {
  if (!results?.length) return [];
  return results
    .map((r) => {
      if (r?.provider === "fsq" && r?.place_id) return r as Place;

      const id = r.fsq_place_id ?? r.id ?? r.link ?? "";
      const loc = r.location || {};
      const cats = Array.isArray(r.categories) ? r.categories : [];
      const catNames = cats
        .map((c: any) => c.name || c.short_name || c.id)
        .filter(Boolean)
        .map(String);

      const lat = Number(r.latitude ?? r.geocodes?.main?.latitude ?? NaN);
      const lng = Number(r.longitude ?? r.geocodes?.main?.longitude ?? NaN);

      const safeLat = isNaN(lat) ? 0 : lat;
      const safeLng = isNaN(lng) ? 0 : lng;

      return {
        provider: "fsq",
        place_id: String(id),
        name: r.name ?? "",
        lat: safeLat,
        lng: safeLng,
        location: { lat: safeLat, lng: safeLng }, // ✅ new
        address: loc.formatted_address ?? loc.address ?? "",
        city: loc.locality ?? "",
        region: loc.region ?? "",
        postal_code: loc.postcode ?? "",
        country: loc.country ?? "",
        categories: catNames,
        phone: r.tel ?? null,
        website: r.website ?? null,
        open_now: null,
        closing_soon: null,
        distance_m: typeof r.distance === "number" ? r.distance : null,
        travel: {},
      } as Place;
    })
    .filter((p) => p.place_id && p.name && p.lat !== 0 && p.lng !== 0);
}

/** Yelp → Place[] */
export function normalizeYelp(results: any[]): Place[] {
  if (!results?.length) return [];
  return results
    .map((r: any) => {
      const lat = Number(r.coordinates?.latitude ?? NaN);
      const lng = Number(r.coordinates?.longitude ?? NaN);

      const safeLat = isNaN(lat) ? 0 : lat;
      const safeLng = isNaN(lng) ? 0 : lng;

      return {
        provider: "yelp",
        place_id: String(r.id ?? ""),
        name: r.name ?? "",
        lat: safeLat,
        lng: safeLng,
        location: { lat: safeLat, lng: safeLng }, // ✅ new
        address: Array.isArray(r.location?.display_address)
          ? r.location.display_address.join(", ")
          : "",
        city: r.location?.city ?? "",
        region: r.location?.state ?? "",
        postal_code: r.location?.zip_code ?? "",
        country: r.location?.country ?? "",
        categories: (r.categories || [])
          .map((c: any) => c.alias || c.title)
          .filter(Boolean)
          .map(String),
        phone: r.display_phone ?? null,
        website: r.url ?? null,
        open_now: null,
        closing_soon: null,
        distance_m: typeof r.distance === "number" ? r.distance : null,
        travel: {},
      } as Place;
    })
    .filter((p) => p.place_id && p.name && p.lat !== 0 && p.lng !== 0);
}


