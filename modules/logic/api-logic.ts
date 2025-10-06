// modules/logic/api-logic.ts
import { fetchFSQPlaces } from "./providers/fsq";
import { fetchYelpPlaces } from "./providers/yelp";
import { getCachedPlaces, putCachedPlaces, logRequest } from "./supabase";
import type { Place } from "./normalizer";

import { filterPlaces } from "./filters";
import { applyOpenNowRules, filterClosingSoon } from "./hours";
import { addTravelTimes } from "./travel";
import { rankPlaces } from "./ranker";
import { resolveCategoryKey, categoryLabel } from "./category-map";
import { capByCategory, summarizeCategories } from "./utils";
import { pickPrimaryCategory } from "./category-priority";

/**
 * Normalize a place with our priority mapping so the frontend
 * always gets a single, deterministic primary_category.
 */
function normalizeWithPrimary(p: Place, categoryToken: string): Place {
  const rawTokens = [
    ...(p.categories ?? []),
    p.primary_category,
    categoryToken,
  ].filter(Boolean) as string[];

  const primary = pickPrimaryCategory(rawTokens, { placeName: p.name });
  return {
    ...p,
    primary_category: primary,
    category_label: categoryLabel(primary),
  };
}

/**
 * Deduplicate by place_id, merging category arrays and re-picking primary once.
 */
function dedupeAndMergeCategories(places: Place[]): Place[] {
  const map = new Map<string, Place>();

  for (const p of places) {
    const prev = map.get(p.place_id);
    if (!prev) {
      map.set(p.place_id, p);
      continue;
    }
    const mergedCats = Array.from(
      new Set([...(prev.categories ?? []), ...(p.categories ?? [])])
    );
    const merged: Place = { ...prev, ...p, categories: mergedCats };
    const primary = pickPrimaryCategory(
      [...mergedCats, merged.primary_category].filter(Boolean) as string[],
      { placeName: merged.name }
    );
    map.set(p.place_id, {
      ...merged,
      primary_category: primary,
      category_label: categoryLabel(primary),
    });
  }

  return Array.from(map.values());
}

/**
 * Phase 2 fuzzy deduplication (cross-provider).
 * Safely handles missing location fields.
 */
function dedupeFuzzy(places: Place[]): Place[] {
  const seen: Place[] = [];

  for (const place of places) {
    const isDuplicate = seen.some((s) => {
      const nameA = normalizeName(s.name);
      const nameB = normalizeName(place.name);
      const namesClose = levenshteinDistance(nameA, nameB) <= 2;

      // Guard against missing coords
      const hasCoordsA =
        s.location &&
        typeof s.location.lat === "number" &&
        typeof s.location.lng === "number";
      const hasCoordsB =
        place.location &&
        typeof place.location.lat === "number" &&
        typeof place.location.lng === "number";

      let dist = Infinity;
      if (hasCoordsA && hasCoordsB) {
        dist = haversineDistance(
          s.location!.lat,
          s.location!.lng,
          place.location!.lat,
          place.location!.lng
        );
      }

      return namesClose && dist < 0.05; // within 50m
    });

    if (!isDuplicate) {
      seen.push(place);
    }
  }

  return seen;
}

function normalizeName(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }
  return dp[a.length][b.length];
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Soft/strict trim per bucket using primary_category.
 */
function trimPerBucket(results: Place[]): Place[] {
  const buckets = new Map<string, Place[]>();
  for (const p of results) {
    const b =
      p.primary_category ??
      resolveCategoryKey(p.categories?.[0] ?? "general");
    const list = buckets.get(b) ?? [];
    list.push(p);
    buckets.set(b, list);
  }

  const out: Place[] = [];
  for (const [bucket, list] of buckets.entries()) {
    const cap = capByCategory[bucket as keyof typeof capByCategory] ?? 20;
    out.push(...list.slice(0, cap));
  }
  return out;
}

type ProviderFlags = {
  anyCache: boolean;
  anyFSQ: boolean;
  anyYelp: boolean;
};

/**
 * Pulls data for a single category with cache-first + provider fallback.
 */
async function gatherForCategory(
  lat: number,
  lng: number,
  radius_m: number,
  categoryToken: string,
  flags: ProviderFlags
): Promise<Place[]> {
  const bucket = resolveCategoryKey(categoryToken);
  const cap = capByCategory[bucket] ?? 20;

  // 1) Cache-first
  const cached = await getCachedPlaces(lat, lng, radius_m, categoryToken);
  if (cached && cached.length > 0) {
    flags.anyCache = true;
    return cached
      .map((p) => normalizeWithPrimary(p, categoryToken))
      .slice(0, cap);
  }

  // 2) FSQ
  try {
    let fsq = await fetchFSQPlaces({
      lat,
      lng,
      radius_m,
      categories: [categoryToken],
    });

    fsq = filterPlaces(fsq).map((p) => normalizeWithPrimary(p, categoryToken));
    fsq = applyOpenNowRules(fsq);
    fsq = filterClosingSoon(fsq);
    fsq = await addTravelTimes(fsq, { lat, lng });
    fsq = rankPlaces(fsq);

    if (fsq.length > 0) {
      flags.anyFSQ = true;
      await putCachedPlaces(lat, lng, radius_m, categoryToken, fsq);
      return fsq
        .map((p) => normalizeWithPrimary(p, categoryToken))
        .slice(0, cap);
    }
  } catch (err) {
    console.warn(`⚠️ FSQ failed for category "${categoryToken}":`, err);
  }

  // 3) Yelp fallback
  try {
    let yelp = await fetchYelpPlaces({
      lat,
      lng,
      radius_m,
      categories: [categoryToken],
    });

    yelp = filterPlaces(yelp).map((p) => normalizeWithPrimary(p, categoryToken));
    yelp = applyOpenNowRules(yelp);
    yelp = filterClosingSoon(yelp);
    yelp = await addTravelTimes(yelp, { lat, lng });
    yelp = rankPlaces(yelp);

    if (yelp.length > 0) {
      flags.anyYelp = true;
      await putCachedPlaces(lat, lng, radius_m, categoryToken, yelp);
      return yelp
        .map((p) => normalizeWithPrimary(p, categoryToken))
        .slice(0, cap);
    }
  } catch (err) {
    console.warn(`⚠️ Yelp failed for category "${categoryToken}":`, err);
  }

  return [];
}

/**
 * Multi-category orchestrator for /places
 */
export async function getPlaces(
  params: { lat: number; lng: number; radius_m: number; categories: string[] },
  request: Request
) {
  const { lat, lng, radius_m, categories } = params;
  const start = Date.now();

  try {
    // 🔑 Default to all categories if none provided
    const requestedCategories =
      categories && categories.length > 0
        ? categories
        : [
            "coffee_wfh",
            "food_drink",
            "outdoors",
            "shops",
            "arts",
            "activities",
            "family",
            "music",
            "dance",
            "fitness",
            "nightlife",
            "shopping",
            "pets",
          ];

    const flags: ProviderFlags = {
      anyCache: false,
      anyFSQ: false,
      anyYelp: false,
    };

    // 1) Gather per category
    let merged: Place[] = [];
    for (const categoryToken of requestedCategories) {
      const perCategory = await gatherForCategory(
        lat,
        lng,
        radius_m,
        categoryToken,
        flags
      );
      merged = merged.concat(perCategory);
    }

    // 2) Deduplicate across categories
    merged = dedupeAndMergeCategories(merged);
    merged = dedupeFuzzy(merged);

    // 3) Global post-processing
    merged = trimPerBucket(merged);
    merged = filterPlaces(merged);
    merged = applyOpenNowRules(merged);
    merged = filterClosingSoon(merged);
    merged = await addTravelTimes(merged, { lat, lng });
    merged = rankPlaces(merged);
    merged = trimPerBucket(merged);

    // 4) Provider signals
    let provider_used: "cache" | "fsq" | "yelp" | "none" = "none";
    if (flags.anyCache) provider_used = "cache";
    else if (flags.anyFSQ) provider_used = "fsq";
    else if (flags.anyYelp) provider_used = "yelp";

    const cache_hit = provider_used === "cache";
    const duration_ms = Date.now() - start;
    const categories_available = summarizeCategories(merged);

    await logRequest({
      lat,
      lng,
      radius_m,
      categories: requestedCategories,
      categories_normalized: Array.from(
        new Set(merged.map((p) => p.primary_category))
      ),
      provider_used,
      cache_hit,
      result_count: merged.length,
      duration_ms,
      strategy: provider_used,
      request,
    });

    return {
      places: merged,
      provider_used,
      cache_hit,
      duration_ms,
      categories_available,
    };
  } catch (err: any) {
    const duration_ms = Date.now() - start;
    console.error("❌ getPlaces orchestrator error:", err);

    await logRequest({
      lat,
      lng,
      radius_m,
      categories,
      categories_normalized: [],
      provider_used: "none",
      cache_hit: false,
      result_count: 0,
      duration_ms,
      error_code: "UNKNOWN_ERROR",
      error_message: err?.message ?? String(err),
      strategy: "error",
      request,
    });

    return {
      places: [],
      provider_used: "none",
      cache_hit: false,
      duration_ms,
      error_code: "UNKNOWN_ERROR",
      error_message: err?.message ?? String(err),
    };
  }
}
