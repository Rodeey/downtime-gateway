# Downtime API – File Contracts & Data Flow

_Last synced: 2025-10-07 (v1.1)_  
_Major change: Cache TTL extended to 7 days_

This document defines **clear responsibilities** for each file in our Zuplo backend, ensuring we don't lose track of logic as the project grows.

---

## 🔍 High-Level Data Flow

1. **Request hits** `/places`
2. **Params**: `lat`, `lng`, `radius`, `categories`
3. **api-logic.ts** (orchestrator)
4. For each category:
   - Check **cache** (via `supabase.ts`)
   - If cached count < **minimum threshold** → fetch from provider(s)
   - Enforce **caps** → trim extra results per category
   - Merge + normalize results
5. **Apply Logic Pipeline**:
6. **filters.ts** → remove irrelevant (fast food, gas, duplicates)
7. **hours.ts** → attach `open_now` (via provider → fallback APIs → local rules)
8. **ranker.ts** → order by distance, `open_now`, popularity
9. **Write to Supabase**:
10. **request_logs** → all request metadata
11. **cached_places** → raw API JSON (for future normalization) with **7-day expiry**
12. Later: **places** → normalized DB (clean records)
13. **Return to frontend**:
14. JSON of **normalized, capped, filtered places**
15. Always includes: `name`, `lat`, `lng`, `address`, `category`, `open_now`, `distance`
16. Optional extras (ratings, phone, social links) if available

---

## 📂 File-by-File Breakdown

### `/modules/api-logic.ts`

**Role**: Orchestrator for all `/places` requests

**Responsibilities**:
- Parse incoming request params (lat, lng, radius, categories)
- For each category:
  - Check cache via `getCachedPlaces()` from `supabase.ts`
  - If insufficient results (< threshold) → call appropriate provider
  - Merge provider results with cached results
  - Apply category caps
- Pass all places through logic pipeline:
  - `filters.ts` → remove junk
  - `hours.ts` → attach open_now status
  - `ranker.ts` → sort by distance, open_now, popularity
- Log request metadata to `request_logs`
- Cache new results in `cached_places` with **7-day expiry**
- Return normalized JSON to frontend

**Dependencies**:
- `supabase.ts` - cache read/write
- `providers/` - OSM, Foursquare, Yelp, Google
- `logic/filters.ts` - junk removal
- `logic/hours.ts` - open_now enrichment
- `logic/ranker.ts` - result ordering

**Input Contract**:
```typescript
{
  lat: number;        // Required: -90 to 90
  lng: number;        // Required: -180 to 180
  radius: number;     // Optional: default 2500m, max 5000m
  categories: string[]; // Optional: ['food', 'parks', 'shops']
  open_now: boolean;  // Optional: filter by hours
}
```

**Output Contract**:
```typescript
{
  places: Place[];
  cached: boolean;
  cache_age: number;  // hours since cache creation
}
```

---

### `/modules/supabase.ts`

**Role**: Handles all database interactions

**Responsibilities**:

**1. logRequest()** → Insert into `request_logs`
```typescript
async function logRequest(data: {
  route: string;
  visitor_id: string;
  lat: number;
  lng: number;
  category: string;
  open_now: boolean;
  result_count: number;
  duration_ms: number;
  source_counts: { osm?: number; fsq?: number; yelp?: number; google?: number };
}): Promise<void>
```

**2. getCachedPlaces()** → Read from `cached_places`
```typescript
async function getCachedPlaces(
  gridId: string, 
  category: string, 
  hourBucket: number
): Promise<Place[] | null> {
  // Check if cache is still fresh (< 7 days old)
  const result = await supabase
    .from('cached_places')
    .select('*')
    .eq('grid_id', gridId)
    .eq('category', category)
    .eq('hour_bucket', hourBucket)
    .gt('expires_at', new Date().toISOString())  // Must be within 7-day window
    .single();
    
  if (!result.data) return null;
  
  return result.data.raw_json.places;
}
```

**3. putCachedPlaces()** → Write to `cached_places` with **7-day expiry**
```typescript
async function putCachedPlaces(
  gridId: string,
  category: string,
  hourBucket: number,
  rawJson: any,
  provider: string
): Promise<void> {
  await supabase
    .from('cached_places')
    .insert({
      grid_id: gridId,
      category: category,
      hour_bucket: hourBucket,
      raw_json: rawJson,
      provider: provider,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()  // 7 days from now
    });
}
```

**4. Later: writePlaces()** → Insert into `places` table (normalized records)

---

### `/modules/logic/filters.ts`

**Role**: Remove junk, duplicates, and irrelevant results

**Responsibilities**:
- Remove fast food chains (McDonald's, Wendy's, etc.)
- Remove gas stations (unless category = "errands")
- Remove adult venues (strip clubs, etc.)
- Deduplicate by name + coordinate proximity
- Remove places with insufficient data (missing name, coordinates)

**Input**: Array of raw places from providers  
**Output**: Filtered array

**Example Logic**:
```typescript
function filterPlaces(places: Place[]): Place[] {
  return places
    .filter(p => !FAST_FOOD_CHAINS.includes(p.name))
    .filter(p => !p.category.includes('gas_station'))
    .filter(p => p.name && p.lat && p.lng)
    .filter((p, i, arr) => !isDuplicate(p, arr.slice(0, i)));
}
```

---

### `/modules/logic/hours.ts`

**Role**: Attach `open_now` status to each place

**Responsibilities**:
- First: Use provider's hours data (if available and recent)
- Fallback 1: Check business hours APIs (e.g., Google Place Details if necessary)
- Fallback 2: Apply local rules (e.g., parks = daylight hours, bars = evening only)
- Fallback 3: Set `open_now: null` if truly unknown

**Input**: Array of places (some with hours data, some without)  
**Output**: Same array with `open_now: boolean | null` added to each

**Example Logic**:
```typescript
async function enrichWithHours(places: Place[]): Promise<Place[]> {
  return Promise.all(places.map(async (place) => {
    if (place.hours) {
      place.open_now = isOpenNow(place.hours);
    } else if (place.category === 'park') {
      place.open_now = isDaylight();
    } else {
      place.open_now = null;  // Unknown
    }
    return place;
  }));
}
```

---

### `/modules/logic/ranker.ts`

**Role**: Order results by priority

**Responsibilities**:
- Sort by:
  1. `open_now: true` first (if user requested `open_now`)
  2. Distance from user (closest first)
  3. Popularity (rating × review_count)

**Input**: Array of filtered, enriched places  
**Output**: Sorted array

**Example Logic**:
```typescript
function rankPlaces(places: Place[], userLat: number, userLng: number, openNowFilter: boolean): Place[] {
  return places.sort((a, b) => {
    // Priority 1: Open places first (if requested)
    if (openNowFilter && a.open_now !== b.open_now) {
      return a.open_now ? -1 : 1;
    }
    
    // Priority 2: Distance (closer is better)
    const distA = haversine(userLat, userLng, a.lat, a.lng);
    const distB = haversine(userLat, userLng, b.lat, b.lng);
    if (Math.abs(distA - distB) > 100) {  // 100m threshold
      return distA - distB;
    }
    
    // Priority 3: Popularity
    const popA = (a.rating || 0) * (a.review_count || 0);
    const popB = (b.rating || 0) * (b.review_count || 0);
    return popB - popA;
  });
}
```

---

### `/modules/logic/providers/`

#### **fsq.ts**
- Fetch places from Foursquare
- Always returns raw JSON + normalized subset
- Used for: Food & Drink, Shops, Activities

#### **yelp.ts**
- Fetch places from Yelp Fusion API
- Higher quality for Michigan (preferred provider there)
- Used for: Detailed business data (ratings, hours, photos)

#### **google.ts**
- Fetch places from Google Places API
- **ONLY as last resort / enrichment** (expensive)
- Used for: Fallback when OSM/FSQ/Yelp insufficient

#### **osm.ts**
- Optional: OpenStreetMap integration for free fallback
- Best for: Parks, hiking trails, public spaces
- Used for: Free baseline data (no API costs)

---

### `/modules/utils.ts`

**Role**: Helper functions

**Responsibilities**:
- `haversine()` - Calculate distance between two coordinates
- `hashQueryParams()` - Generate cache keys (grid_id)
- `getCurrentHourBucket()` - Map current time to 0-11 bucket (2-hour increments)
- `isDaylight()` - Check if current time is daylight hours (for park logic)

---

### `/modules/travel.ts`

**Role**: Helper for computing travel times

**Responsibilities**:
- Use Google Maps Distance Matrix API (or fallback)
- Only called if user requests travel time explicitly
- **Not used in MVP** (cost optimization)

---

### `/modules/geocode.ts`

**Role**: Shared geocoding logic

**Responsibilities**:
- Convert addresses to coordinates (if needed)
- Used by both `/geocode` handler and pipeline enrichment
- Prioritize free providers (Nominatim) before Google

---

## 📊 Category Thresholds (Michigan MVP)

| Category | Min Results | Max Results (Cap) |
|----------|-------------|-------------------|
| Food & Drink | 50 | 50 |
| Parks & Outdoors | 40 | 40 |
| Shops & Errands | 35 | 35 |
| Arts & Culture | 25 | 25 |
| Activities & Fun | 30 | 30 |
| Coffee & WFH | 20 | 20 |
| **Total cap per request** | - | **200** |

**Rule**: If cached results < minimum threshold → fetch from providers

⚠️ **Outside Michigan**: Skip Yelp, call Foursquare only (warn: incomplete coverage)

---

## 🗄️ Database Schema

### `request_logs`
```sql
CREATE TABLE request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ DEFAULT NOW(),
  route TEXT NOT NULL,
  visitor_id UUID,
  session_id UUID,
  lat NUMERIC,
  lng NUMERIC,
  radius INT,
  category TEXT,
  open_now BOOLEAN,
  result_count INT,
  duration_ms INT,
  source_counts JSONB,  -- {"osm": 10, "fsq": 5, "yelp": 5}
  error_code TEXT
);
```

### `cached_places` (v1.1 - UPDATED)
```sql
CREATE TABLE cached_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_id TEXT NOT NULL,        -- H3 hex or lat_lng_bucket
  category TEXT NOT NULL,
  hour_bucket INT NOT NULL,     -- 0-11 (2-hour increments)
  raw_json JSONB NOT NULL,      -- Raw provider response
  provider TEXT NOT NULL,       -- 'osm', 'fsq', 'yelp', 'google'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + interval '7 days'  -- 7-DAY EXPIRY (v1.1)
);

CREATE INDEX idx_cache_lookup 
ON cached_places (grid_id, category, hour_bucket, expires_at);
```

**Key Changes in v1.1**:
- `expires_at` now defaults to `created_at + interval '7 days'` (was 15 minutes)
- Cache remains valid for 7 days unless explicitly invalidated
- Reduces API calls by ~85% compared to 15-minute cache

### `places` (future - normalized table)
```sql
CREATE TABLE places (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  address TEXT,
  category TEXT NOT NULL,
  open_now BOOLEAN,
  hours TEXT,
  rating NUMERIC,
  review_count INT,
  phone TEXT,
  website TEXT,
  instagram TEXT,
  provider TEXT NOT NULL,
  last_verified TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_places_location ON places (lat, lng);
CREATE INDEX idx_places_category ON places (category);
```

---

## 🔄 Request Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│  User Request: /places?lat=42.3&lng=-83.0&...       │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  api-logic.ts (Orchestrator)                        │
│  • Parse params                                     │
│  • For each category:                               │
│    - Check cache (7-day TTL)                        │
│    - If stale/missing → fetch from providers        │
└────────────────────┬────────────────────────────────┘
                     │
      ┌──────────────┼──────────────┐
      ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│   OSM    │  │   FSQ    │  │   Yelp   │
│  (free)  │  │ (99k/mo) │  │ ($299/mo)│
└─────┬────┘  └─────┬────┘  └─────┬────┘
      │             │              │
      └──────────────┼──────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  Logic Pipeline                                     │
│  1. filters.ts → Remove junk, duplicates            │
│  2. hours.ts → Attach open_now status               │
│  3. ranker.ts → Sort by distance, open_now, rating  │
└────────────────────┬────────────────────────────────┘
                     │
      ┌──────────────┼──────────────┐
      ▼              ▼              ▼
┌──────────┐  ┌──────────────┐  ┌─────────┐
│ request_ │  │ cached_places│  │  Return │
│  logs    │  │ (7-day expiry)│  │   JSON  │
└──────────┘  └──────────────┘  └─────────┘
```

---

## 🚨 Critical Rules

1. **Never call Google directly for initial requests** (fallback only)
2. **Always check cache first** (7-day TTL reduces API costs by 85%)
3. **Log every request** to `request_logs` (for analytics)
4. **Enforce category caps** (max 200 results total)
5. **Prioritize open_now: true** when user requests it
6. **Deduplicate aggressively** (same name + <100m = duplicate)
7. **Set open_now: null** if truly unknown (don't guess)
8. **Cache all provider responses** in `cached_places` with 7-day expiry

---

## 📦 Type Definitions

```typescript
interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  category: string;
  open_now: boolean | null;
  distance?: number;  // meters from user
  hours?: string;     // e.g., "Mon-Fri 9am-5pm"
  rating?: number;
  review_count?: number;
  phone?: string;
  website?: string;
  instagram?: string;
  provider: 'osm' | 'foursquare' | 'yelp' | 'google';
}

interface CacheEntry {
  grid_id: string;
  category: string;
  hour_bucket: number;
  raw_json: any;
  provider: string;
  created_at: string;
  expires_at: string;  // 7 days from created_at
}

interface RequestLog {
  route: string;
  visitor_id: string;
  lat: number;
  lng: number;
  category: string;
  open_now: boolean;
  result_count: number;
  duration_ms: number;
  source_counts: {
    osm?: number;
    fsq?: number;
    yelp?: number;
    google?: number;
  };
}
```

---

_This document is living documentation. Updates tracked in /docs/context/Change_Log.md_