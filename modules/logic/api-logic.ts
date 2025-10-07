import { filterPlaces } from "./filters";
import { applyOpenNowRules, filterClosingSoon } from "./hours";
import type { Place } from "./normalizer";
import { pickPrimaryCategory } from "./category-priority";
import {
  categoryLabel,
  resolveCategoryKey,
  type CategoryBucket,
} from "./category-map";
import {
  capByCategory,
  summarizeCategories,
  thresholdByCategory,
  type CategorySummary,
  annotateDistance,
} from "./utils";
import {
  getCachedPlaces,
  putCachedPlaces,
  logRequest,
  type CacheSource,
  type PlaceCacheKey,
} from "./supabase";
import { addTravelTimes, type TravelOrigin } from "./travel";
import { rankPlaces } from "./ranker";
import { searchWithOsm } from "./providers/osm";
import { searchWithFoursquare } from "./providers/foursquare";
import { searchWithYelp } from "./providers/yelp";
import type { EnvSource } from "./env";

export interface PlacesRequest {
  lat: number;
  lng: number;
  radius_m: number;
  categories: string[];
  open_now?: boolean;
  force_refresh?: boolean;
}

export interface PlacesContext {
  request?: Request;
  env?: EnvSource;
}

interface InternalRequest extends PlacesRequest {
  open_now: boolean;
  force_refresh: boolean;
}

interface CategoryGatherResult {
  bucket: CategoryBucket;
  places: Place[];
  source: CacheSource;
  provider_used: string;
  duration_ms: number;
  provider_counts: Record<string, number>;
}

export interface PlacesResponse {
  source: CacheSource;
  places: Place[];
  categories_available: CategorySummary[];
  provider_counts: Record<string, number>;
  duration_ms: number;
  error_code: string | null;
  error_message: string | null;
}

const DEFAULT_CATEGORY: CategoryBucket = "food_drink";

const YELP_CATEGORY_MAP: Record<CategoryBucket, string[]> = {
  food_drink: ["restaurants", "food"],
  coffee_wfh: ["coffee", "cafes", "coffeeroasteries"],
  outdoors: ["parks", "hiking", "recreation"],
  arts_culture: ["museums", "galleries", "theater"],
  shops_services: ["shopping", "fashion"],
  wellness: ["health", "beautysvc", "fitness"],
  general: ["localflavor"],
};

const FSQ_CATEGORY_MAP: Record<CategoryBucket, string[]> = {
  food_drink: ["4d4b7105d754a06374d81259"],
  coffee_wfh: ["4bf58dd8d48988d1e0931735", "4bf58dd8d48988d1c9941735"],
  outdoors: ["4d4b7105d754a06377d81259"],
  arts_culture: ["4d4b7104d754a06370d81259"],
  shops_services: ["4d4b7105d754a06378d81259"],
  wellness: ["4bf58dd8d48988d104941735"],
  general: ["4d4b7105d754a06376d81259"],
};

function countProviders(places: Place[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const place of places) {
    const key = place.provider ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function normalizeRequest(params: PlacesRequest): InternalRequest {
  return {
    ...params,
    radius_m: Number.isFinite(params.radius_m)
      ? Math.max(100, Math.min(params.radius_m, 40_000))
      : 8_000,
    open_now: params.open_now ?? true,
    force_refresh: params.force_refresh ?? false,
  };
}

function resolveRequestedBuckets(categories: string[]): CategoryBucket[] {
  const buckets = new Set<CategoryBucket>();
  for (const token of categories) {
    if (typeof token !== "string") {
      continue;
    }
    buckets.add(resolveCategoryKey(token));
  }
  if (buckets.size === 0) {
    buckets.add(DEFAULT_CATEGORY);
  }
  return Array.from(buckets);
}

function sanitizePlace(place: Place, bucket: CategoryBucket): Place {
  return {
    ...place,
    category_bucket: bucket,
    category_label: categoryLabel(bucket),
    primary_category: pickPrimaryCategory(place.categories, {
      name: place.name,
      fallback: "general",
    }),
    travel: { ...place.travel },
    open_now: undefined,
    closing_soon: undefined,
  };
}

function clonePlaces(places: Place[], bucket: CategoryBucket): Place[] {
  return places.map((place) => sanitizePlace(place, bucket));
}

function dedupeByPlaceId(places: Place[]): Place[] {
  const deduped = new Map<string, Place>();
  for (const place of places) {
    if (!deduped.has(place.place_id)) {
      deduped.set(place.place_id, place);
    }
  }
  return Array.from(deduped.values());
}

async function runPipeline(
  places: Place[],
  bucket: CategoryBucket,
  request: InternalRequest,
  origin: TravelOrigin,
  env?: EnvSource
): Promise<Place[]> {
  const annotated = places.map((place) =>
    annotateDistance(place, request.lat, request.lng)
  );
  const filtered = filterPlaces(annotated);
  const open = applyOpenNowRules(filtered);
  const withoutClosingSoon = filterClosingSoon(open);
  const cap = capByCategory[bucket];
  const preRank = withoutClosingSoon.slice(0, Math.max(cap * 2, cap));
  const withTravel = await addTravelTimes(preRank, origin, {
    forceRefresh: request.force_refresh,
    env,
  });
  const ranked = rankPlaces(withTravel);
  return ranked.slice(0, cap);
}

interface ProviderFetchResult {
  places: Place[];
  providersUsed: string[];
}

async function fetchForCategory(
  bucket: CategoryBucket,
  request: InternalRequest,
  env?: EnvSource
): Promise<ProviderFetchResult> {
  const limit = capByCategory[bucket];
  const threshold = thresholdByCategory[bucket];
  const aggregated = new Map<string, Place>();
  const providersUsed: string[] = [];

  const addPlaces = (provider: string, places: Place[]): void => {
    let added = 0;
    for (const place of places) {
      if (!aggregated.has(place.place_id)) {
        aggregated.set(place.place_id, place);
        added += 1;
      }
    }
    if (added > 0) {
      providersUsed.push(provider);
    }
  };

  if (bucket === "outdoors") {
    const osmResults = await searchWithOsm({
      lat: request.lat,
      lng: request.lng,
      radius_m: request.radius_m,
      limit,
    });
    addPlaces("osm", osmResults);
  }

  if (aggregated.size < threshold) {
    const fsqCategories = FSQ_CATEGORY_MAP[bucket] ?? [];
    const fsqResults = await searchWithFoursquare(
      {
        lat: request.lat,
        lng: request.lng,
        radius_m: request.radius_m,
        limit,
        categories: fsqCategories,
        open_now: request.open_now,
      },
      env
    );
    addPlaces("foursquare", fsqResults);
  }

  if (aggregated.size < threshold) {
    const yelpCategories = YELP_CATEGORY_MAP[bucket] ?? [];
    const yelpResults = await searchWithYelp(
      {
        lat: request.lat,
        lng: request.lng,
        radius_m: request.radius_m,
        limit,
        categories: yelpCategories,
        open_now: request.open_now,
      },
      env
    );
    addPlaces("yelp", yelpResults);
  }

  return {
    places: Array.from(aggregated.values()),
    providersUsed,
  };
}

async function gatherForCategory(
  bucket: CategoryBucket,
  request: InternalRequest,
  origin: TravelOrigin,
  context: PlacesContext
): Promise<CategoryGatherResult> {
  const started = Date.now();
  const cacheKey: PlaceCacheKey = {
    lat: request.lat,
    lng: request.lng,
    radius_m: request.radius_m,
    category: bucket,
    open_now: request.open_now,
  };

  let source: CacheSource = "live";
  let providerUsed = "none";
  let basePlaces: Place[] | null = null;

  if (!request.force_refresh) {
    const cached = await getCachedPlaces(cacheKey, context.env);
    if (cached && cached.length > 0) {
      basePlaces = clonePlaces(cached, bucket);
      providerUsed = "cache";
      source = "cache";
    }
  }

  if (!basePlaces) {
    const fetched = await fetchForCategory(bucket, request, context.env);
    basePlaces = clonePlaces(fetched.places, bucket);
    providerUsed = fetched.providersUsed.join(",") || "none";
    await putCachedPlaces(
      cacheKey,
      basePlaces,
      {
        provider: providerUsed,
        count: basePlaces.length,
        duration_ms: Date.now() - started,
      },
      context.env
    );
  }

  const processed = await runPipeline(
    basePlaces,
    bucket,
    request,
    origin,
    context.env
  );
  const duration_ms = Date.now() - started;
  const processedCounts = countProviders(processed);

  await logRequest(
    {
      category: bucket,
      provider_used: providerUsed,
      source,
      count: processed.length,
      duration_ms,
      lat: request.lat,
      lng: request.lng,
      radius_m: request.radius_m,
      open_now: request.open_now,
      force_refresh: request.force_refresh,
      request: context.request,
    },
    context.env
  );

  return {
    bucket,
    places: processed,
    source,
    provider_used: providerUsed,
    duration_ms,
    provider_counts: processedCounts,
  };
}

export async function getPlaces(
  params: PlacesRequest,
  context: PlacesContext = {}
): Promise<PlacesResponse> {
  const started = Date.now();
  const request = normalizeRequest(params);
  const buckets = resolveRequestedBuckets(request.categories ?? []);
  const origin: TravelOrigin = { lat: request.lat, lng: request.lng };

  const results = await Promise.all(
    buckets.map((bucket) =>
      gatherForCategory(bucket, request, origin, context)
    )
  );

  const combined = dedupeByPlaceId(results.flatMap((result) => result.places));
  const ranked = rankPlaces(combined);
  const categories_available = summarizeCategories(ranked);
  const provider_counts = countProviders(ranked);
  const duration_ms = Date.now() - started;
  const source: CacheSource = results.every((result) => result.source === "cache")
    ? "cache"
    : "live";

  return {
    source,
    places: ranked,
    categories_available,
    provider_counts,
    duration_ms,
    error_code: null,
    error_message: null,
  };
}
