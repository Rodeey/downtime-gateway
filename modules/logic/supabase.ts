// modules/logic/supabase.ts
import { createClient } from "@supabase/supabase-js";
import { environment } from "@zuplo/runtime";
import type { Place } from "./normalizer";
import { resolveCategoryKey, categoryLabel } from "./category-map";

/** -----------------------------
 *  Minimal runtime-safe helpers
 * ----------------------------- */

// UUID without importing node 'crypto'
function safeUUID(): string {
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  // Fallback: RFC4122-ish (not cryptographically strong)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Simple DJB2 hash -> hex (not secure; good enough for pseudo "ip_hash")
function djb2Hex(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // force unsigned and hex
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** -----------------------------
 *  ENV + Supabase client
 * ----------------------------- */
const SUPABASEURL = environment.SUPABASEURL;
const SUPABASEKEY = environment.SUPABASEKEY;

if (!SUPABASEURL || !SUPABASEKEY) {
  throw new Error("❌ Missing Supabase environment variables");
}

export const supabase = createClient(SUPABASEURL, SUPABASEKEY);

/** -----------------------------
 *  Utilities
 * ----------------------------- */
function makeQueryHash(lat: number, lng: number, radius: number, categories: string[]) {
  return `${lat.toFixed(4)}|${lng.toFixed(4)}|${radius}|${categories.sort().join(",")}`;
}
function makeOriginHash(lat: number, lng: number) {
  return `${lat.toFixed(5)}|${lng.toFixed(5)}`;
}

/** -----------------------------
 *  Visitor + Session
 * ----------------------------- */
async function getOrCreateVisitor(ip: string, ua: string) {
  const ipHash = djb2Hex(ip || "unknown");

  const { data: existing } = await supabase
    .from("visitors")
    .select("*")
    .eq("last_ip_hash", ipHash)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("visitors")
      .update({
        last_seen: new Date().toISOString(),
        visit_count: (existing.visit_count ?? 0) + 1,
        last_user_agent: ua,
      })
      .eq("visitor_id", existing.visitor_id);

    return existing.visitor_id as string;
  }

  const visitor_id = safeUUID();
  const { error } = await supabase.from("visitors").insert([
    {
      visitor_id,
      last_ip_hash: ipHash,
      last_user_agent: ua,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      visit_count: 1,
    },
  ]);

  if (error) throw error;
  return visitor_id;
}

async function startSession(visitor_id: string, ip: string, ua: string) {
  const ipHash = djb2Hex(ip || "unknown");
  const session_id = safeUUID();

  const { error } = await supabase.from("sessions").insert([
    {
      session_id,
      visitor_id,
      started_at: new Date().toISOString(),
      ip_hash: ipHash,
      ua,
    },
  ]);
  if (error) throw error;
  return session_id;
}

/** -----------------------------
 *  Request logging
 * ----------------------------- */
export async function logRequest(data: {
  lat: number;
  lng: number;
  radius_m: number;
  categories: string[];
  provider_used?: "cache" | "fsq" | "yelp" | "google" | "none" | null;
  cache_hit?: boolean;
  result_count?: number;
  error_code?: string | null;
  error_message?: string | null;
  duration_ms?: number;
  strategy?: string | null;
  client_id?: string | null;
  request?: Request;
}) {
  const query_hash = makeQueryHash(data.lat, data.lng, data.radius_m, data.categories);

  // Extract IP + UA
  const ip = data.request?.headers.get("x-forwarded-for") || "unknown";
  const ua = data.request?.headers.get("user-agent") || "unknown";

  // Get visitor + session
  let visitor_id: string | null = null;
  let session_id: string | null = null;
  let ipHash: string | null = null;
  try {
    if (ip !== "unknown") {
      ipHash = djb2Hex(ip);
    }
    visitor_id = await getOrCreateVisitor(ip, ua);
    session_id = await startSession(visitor_id, ip, ua);
  } catch (err) {
    console.warn("⚠️ Visitor/session logging failed:", err);
  }

  // Counts
  const counts = {
    count_places: data.result_count ?? 0,
    count_cache: data.cache_hit ? 1 : 0,
    count_api_fsq: data.provider_used === "fsq" ? 1 : 0,
    count_api_yelp: data.provider_used === "yelp" ? 1 : 0,
    count_api_google: data.provider_used === "google" ? 1 : 0,
  };

  const { error } = await supabase.from("request_logs").insert([
    {
      lat: data.lat,
      lng: data.lng,
      radius_m: data.radius_m,
      categories: data.categories,
      query_hash,
      provider_used: data.provider_used ?? null,
      cache_hit: data.cache_hit ?? false,
      result_count: data.result_count ?? null,
      error_code: data.error_code ?? null,
      error_message: data.error_message ?? null,
      duration_ms: data.duration_ms ?? null,
      strategy: data.strategy ?? null,
      client_id: data.client_id ?? null,
      visitor_id,
      session_id,
      ip_hash: ipHash,
      user_agent: ua,
      requested_at: new Date().toISOString(),
      ...counts,
    },
  ]);

  if (error) {
    console.error("❌ Supabase logRequest error:", error);
    return false;
  }

  return true;
}

/** -----------------------------
 *  Cache: places (live, no TTL)
 * ----------------------------- */
export async function getCachedPlaces(
  lat: number,
  lng: number,
  radius: number,
  category: string
): Promise<Place[] | null> {
  const query_hash = makeQueryHash(lat, lng, radius, [category]);

  const { data, error } = await supabase
    .from("cached_places")
    .select("*")
    .eq("query_hash", query_hash)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("❌ Supabase getCachedPlaces error:", error);
    return null;
  }
  if (!data?.length) return null;

  return data.map((row) => ({
    provider: "cache",
    place_id: row.place_id,
    name: row.name,
    categories: row.category ? [row.category] : [],
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    city: row.city,
    region: row.region,
    postal_code: row.postal_code,
    country: row.country,
    website: row.website_url,
    phone: row.formatted_phone_number,
    distance_m: row.distance,
    primary_category: row.primary_category ?? undefined,
    category_label: row.category_label ?? undefined,
  }));
}

export async function putCachedPlaces(
  lat: number,
  lng: number,
  radius: number,
  category: string, // query category token
  places: Place[]
) {
  const query_hash = makeQueryHash(lat, lng, radius, [category]);

  const rows = places.map((p) => {
    const bucket = resolveCategoryKey(p.categories?.[0] ?? category);
    return {
      query_hash,
      provider: p.provider ?? "fsq",
      place_id: p.place_id,
      name: p.name,
      category,
      primary_category: bucket,
      category_label: categoryLabel(bucket),
      formatted_phone_number: p.phone ?? null,
      website_url: p.website ?? null,
      address: p.address ?? null,
      city: p.city ?? null,
      region: p.region ?? null,
      postal_code: p.postal_code ?? null,
      country: p.country ?? null,
      lat: p.lat,
      lng: p.lng,
      distance: p.distance_m ?? null,
      created_at: new Date().toISOString(),
    };
  });

  // ✅ Use upsert to avoid unique constraint errors
  const { error } = await supabase.from("cached_places").upsert(rows, {
    onConflict: "query_hash,provider,place_id",
  });
  if (error) {
    console.error("❌ Supabase putCachedPlaces error:", error);
    return false;
  }
  return true;
}

/** -----------------------------
 *  Cache: travel times (live, no TTL)
 * ----------------------------- */
export async function getCachedTravelTimes(
  origin: { lat: number; lng: number },
  place_id: string
): Promise<{ walk_min: number | null; drive_min: number | null } | null> {
  const origin_hash = makeOriginHash(origin.lat, origin.lng);

  const { data, error } = await supabase
    .from("cached_travel_times")
    .select("*")
    .eq("origin_hash", origin_hash)
    .eq("place_id", place_id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data?.[0]) return null;

  return { walk_min: data[0].walk_min, drive_min: data[0].drive_min };
}

export async function putCachedTravelTimes(
  origin: { lat: number; lng: number },
  place_id: string,
  times: { walk_min: number | null; drive_min: number | null }
) {
  const origin_hash = makeOriginHash(origin.lat, origin.lng);

  const { error } = await supabase.from("cached_travel_times").upsert(
    [
      {
        origin_hash,
        place_id,
        walk_min: times.walk_min,
        drive_min: times.drive_min,
        created_at: new Date().toISOString(),
      },
    ],
    { onConflict: "origin_hash,place_id" }
  );

  if (error) {
    console.error("❌ Supabase putCachedTravelTimes error:", error);
    return false;
  }
  return true;
}

