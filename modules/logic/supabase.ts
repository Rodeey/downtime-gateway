import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CategoryBucket } from "./category-map";
import type { Place } from "./normalizer";
import type { EnvSource } from "./env";

export interface PlaceCacheKey {
  lat: number;
  lng: number;
  radius_m: number;
  category: CategoryBucket;
  open_now: boolean;
}

export interface CacheMetadata {
  provider?: string;
  count?: number;
  duration_ms?: number;
}

export type CacheSource = "cache" | "live";

export interface TravelCacheKey {
  lat: number;
  lng: number;
}

export interface TravelCacheRecord {
  place_id: string;
  walk_min?: number;
  drive_min?: number;
}

export interface RequestLogEntry {
  category: CategoryBucket;
  provider_used: string;
  source: CacheSource;
  count: number;
  duration_ms: number;
  lat: number;
  lng: number;
  radius_m: number;
  open_now: boolean;
  force_refresh: boolean;
  request?: Request;
}

interface RequestContext {
  visitor_id: string | null;
  session_id: string | null;
  ip_hash: string | null;
  user_agent: string | null;
}

let cachedClient: SupabaseClient | null | undefined;
let cachedCredentials: { url: string; key: string } | null = null;
let warnedMissingCredentials = false;
const requestContextCache = new WeakMap<Request, Promise<RequestContext>>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readEnv(key: string, env?: EnvSource): string | null {
  if (!env) {
    return null;
  }
  const value = env[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getClient(env?: EnvSource): SupabaseClient | null {
  const url = readEnv("SUPABASEURL", env);
  const key = readEnv("SUPABASEKEY", env);
  if (!url || !key) {
    if (!warnedMissingCredentials) {
      console.warn("[Supabase] Missing SUPABASEURL or SUPABASEKEY");
      warnedMissingCredentials = true;
    }
    cachedClient = null;
    cachedCredentials = null;
    return cachedClient;
  }

  if (
    cachedClient &&
    cachedCredentials &&
    cachedCredentials.url === url &&
    cachedCredentials.key === key
  ) {
    return cachedClient;
  }
  cachedClient = createClient(url, key, {
    auth: { persistSession: false },
  });
  cachedCredentials = { url, key };
  return cachedClient;
}

function makeQueryHash(key: PlaceCacheKey): string {
  const lat = key.lat.toFixed(4);
  const lng = key.lng.toFixed(4);
  const radius = Math.round(key.radius_m);
  const open = key.open_now ? "1" : "0";
  return `${lat}:${lng}:${radius}:${key.category}:${open}`;
}

function makeOriginHash(origin: TravelCacheKey): string {
  return `${origin.lat.toFixed(4)}:${origin.lng.toFixed(4)}`;
}

function safeUUID(): string {
  const globalCrypto = (globalThis as typeof globalThis & {
    crypto?: Crypto;
  }).crypto;
  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function djb2Hex(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function sanitizePlaces(places: Place[]): Record<string, unknown>[] {
  return places.map((place) => ({
    ...place,
    travel: {},
    open_now: false,
    closing_soon: false,
  }));
}

function hydratePlaces(payload: unknown): Place[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }
      const record = entry as Record<string, unknown> & { travel?: unknown };
      return {
        ...record,
        travel:
          typeof record.travel === "object" && record.travel !== null
            ? { ...(record.travel as Record<string, number>) }
            : {},
      } as Place;
    })
    .filter((place): place is Place => Boolean(place));
}

function getClientIp(request?: Request): string | null {
  if (!request) {
    return null;
  }
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-client-ip") ??
    null
  );
}

async function getOrCreateVisitor(
  client: SupabaseClient,
  ipHash: string | null,
  userAgent: string | null
): Promise<string | null> {
  if (!ipHash) {
    return null;
  }
  const { data, error } = await client
    .from("visitors")
    .select("id, visit_count")
    .eq("ip_hash", ipHash)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.warn("[Supabase] Failed to load visitor", error);
    return null;
  }

  if (data) {
    await client
      .from("visitors")
      .update({
        visit_count: (data.visit_count ?? 0) + 1,
        last_seen: new Date().toISOString(),
        last_user_agent: userAgent ?? null,
      })
      .eq("id", data.id);
    return data.id as string;
  }

  const visitorId = safeUUID();
  const { error: insertError } = await client.from("visitors").insert({
    id: visitorId,
    ip_hash: ipHash,
    user_agent: userAgent ?? null,
    visit_count: 1,
    last_seen: new Date().toISOString(),
  });
  if (insertError) {
    console.warn("[Supabase] Failed to insert visitor", insertError);
    return null;
  }
  return visitorId;
}

async function startSession(
  client: SupabaseClient,
  visitorId: string | null,
  ipHash: string | null,
  userAgent: string | null
): Promise<string | null> {
  const sessionId = safeUUID();
  const { error } = await client.from("sessions").insert({
    id: sessionId,
    visitor_id: visitorId,
    ip_hash: ipHash,
    user_agent: userAgent ?? null,
    started_at: new Date().toISOString(),
  });
  if (error) {
    console.warn("[Supabase] Failed to start session", error);
    return null;
  }
  return sessionId;
}

async function resolveRequestContext(
  client: SupabaseClient,
  request?: Request
): Promise<RequestContext> {
  if (!request) {
    return {
      visitor_id: null,
      session_id: null,
      ip_hash: null,
      user_agent: null,
    };
  }
  let cached = requestContextCache.get(request);
  if (!cached) {
    cached = (async () => {
      const ip = getClientIp(request);
      const userAgent = request.headers.get("user-agent");
      const ipHash = ip ? djb2Hex(ip) : null;
      const visitorId = await getOrCreateVisitor(client, ipHash, userAgent);
      const sessionId = await startSession(client, visitorId, ipHash, userAgent);
      return {
        visitor_id: visitorId,
        session_id: sessionId,
        ip_hash: ipHash,
        user_agent: userAgent ?? null,
      };
    })();
    requestContextCache.set(request, cached);
  }
  return cached;
}

export async function getCachedPlaces(
  key: PlaceCacheKey,
  env?: EnvSource
): Promise<Place[] | null> {
  const client = getClient(env);
  if (!client) {
    return null;
  }
  const query_hash = makeQueryHash(key);
  const { data, error } = await client
    .from("cached_places")
    .select<{ places: unknown; expires_at: string | null }>(
      "places, expires_at"
    )
    .eq("query_hash", query_hash)
    .maybeSingle();

  if (error) {
    console.warn("[Supabase] Failed to read cached places", error);
    return null;
  }

  if (!data || !data.places) {
    return null;
  }

  const expiresAt = data.expires_at
    ? Date.parse(data.expires_at as string)
    : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    try {
      await client.from("cached_places").delete().eq("query_hash", query_hash);
    } catch (cleanupError) {
      console.warn("[Supabase] Failed to clear expired cache entry", cleanupError);
    }
    return null;
  }
  return hydratePlaces(data.places);
}

export async function putCachedPlaces(
  key: PlaceCacheKey,
  places: Place[],
  meta: CacheMetadata,
  env?: EnvSource
): Promise<void> {
  const client = getClient(env);
  if (!client || places.length === 0) {
    return;
  }
  const query_hash = makeQueryHash(key);
  const payload = sanitizePlaces(places);
  const { error } = await client.from("cached_places").upsert(
    {
      query_hash,
      category: key.category,
      lat: key.lat,
      lng: key.lng,
      radius_m: key.radius_m,
      open_now: key.open_now,
      provider: meta.provider ?? null,
      count: meta.count ?? payload.length,
      duration_ms: meta.duration_ms ?? null,
      places: payload,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    },
    { onConflict: "query_hash" }
  );
  if (error) {
    console.warn("[Supabase] Failed to store cached places", error);
  }
}

export async function logRequest(
  entry: RequestLogEntry,
  env?: EnvSource
): Promise<void> {
  const client = getClient(env);
  if (!client) {
    return;
  }
  const context = await resolveRequestContext(client, entry.request);
  const { error } = await client.from("request_logs").insert({
    id: safeUUID(),
    category: entry.category,
    provider_used: entry.provider_used,
    source: entry.source,
    count: entry.count,
    duration_ms: entry.duration_ms,
    lat: entry.lat,
    lng: entry.lng,
    radius_m: entry.radius_m,
    open_now: entry.open_now,
    force_refresh: entry.force_refresh,
    visitor_id: context.visitor_id,
    session_id: context.session_id,
    ip_hash: context.ip_hash,
    user_agent: context.user_agent,
    created_at: new Date().toISOString(),
  });
  if (error) {
    console.warn("[Supabase] Failed to log request", error);
  }
}

export async function getCachedTravelTimes(
  origin: TravelCacheKey,
  placeIds: string[],
  env?: EnvSource
): Promise<Map<string, TravelCacheRecord>> {
  const client = getClient(env);
  const result = new Map<string, TravelCacheRecord>();
  if (!client || placeIds.length === 0) {
    return result;
  }
  const origin_hash = makeOriginHash(origin);
  const { data, error } = await client
    .from("cached_travel_times")
    .select("place_id, walk_min, drive_min")
    .eq("origin_hash", origin_hash)
    .in("place_id", placeIds);

  if (error) {
    console.warn("[Supabase] Failed to read travel cache", error);
    return result;
  }

  for (const row of data ?? []) {
    if (row.place_id) {
      result.set(row.place_id, {
        place_id: row.place_id as string,
        walk_min: row.walk_min ?? undefined,
        drive_min: row.drive_min ?? undefined,
      });
    }
  }

  return result;
}

export async function putCachedTravelTimes(
  origin: TravelCacheKey,
  records: TravelCacheRecord[],
  env?: EnvSource
): Promise<void> {
  const client = getClient(env);
  if (!client || records.length === 0) {
    return;
  }
  const origin_hash = makeOriginHash(origin);
  const payload = records.map((record) => ({
    origin_hash,
    place_id: record.place_id,
    walk_min: record.walk_min ?? null,
    drive_min: record.drive_min ?? null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await client
    .from("cached_travel_times")
    .upsert(payload, { onConflict: "origin_hash,place_id" });
  if (error) {
    console.warn("[Supabase] Failed to store travel cache", error);
  }
}
