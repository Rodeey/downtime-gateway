# File Responsibility Map

_Last synced: 2025-10-07 (v1.0)_

This document provides explicit mapping of each repository file/module to its purpose, data inputs, and expected outputs.

---

## Backend Files (downtime-gateway / Zuplo)

### Core Orchestration

#### `api-logic.ts` (ORCHESTRATOR)
**Purpose**: Main request coordinator for `/places` endpoint  
**Inputs**: 
- Query params: `lat`, `lng`, `radius`, `categories`
- User location data

**Process**:
1. For each category:
   - Check cache via `supabase.ts`
   - If cached count < minimum threshold → fetch from providers
   - Enforce caps (trim extra results per category)
   - Merge and normalize results
2. Apply logic pipeline: filters → hours → ranker
3. Write to Supabase (request_logs, cached_places)
4. Return normalized JSON

**Outputs**: 
- JSON array of normalized, capped, filtered places
- Each place includes: `name`, `lat`, `lng`, `address`, `category`, `open_now`, `distance`
- Optional: `ratings`, `phone`, `social_links`, `website_url`, `walk_min`, `drive_min`

**Dependencies**: `supabase.ts`, provider files, logic pipeline files

---

### Configuration

#### `config/rules.config.ts`
**Purpose**: Central configuration for all system rules  
**Exports**:
- `K = 20` (max results cap)
- `K_MIN = 11` (minimum results threshold for "feels full")
- `METERS_PER_MILE = 1609.344`
- `CategoryKey` type definition
- `RADIUS_MI_DEFAULT` (default radius per category)
- `RADIUS_MI_RURAL` (rural fallback radius per category)
- `EXCLUDED_TYPES` (fast_food, gas_station, convenience, adult, permanently_closed)
- `ALLOWLIST` (cult favorite venues that bypass exclusion rules)
- `HOURS_DEFAULTS` (fallback hours: parks 6-21, general 9-21)

**Used By**: All logic files, orchestrator

---

### Logic Pipeline

#### `logic/filters.ts`
**Purpose**: Remove irrelevant and low-quality places  
**Inputs**: Array of place objects with `id`, `types` fields  
**Process**:
- Drop junk types (fast_food, gas, convenience, adult)
- Keep allowlisted venues (cult favorites)
- Remove places missing coordinates

**Outputs**: Filtered array of places  
**Functions**:
- `isExcludedType(types: string[]): boolean`
- `applyExclusions<T>(rows: T[]): T[]`
- `dropIfNoCoords<T>(rows: T[]): T[]`

---

#### `logic/hours.ts`
**Purpose**: Attach `open_now` status to venues  
**Inputs**: Place objects, optional schedule data  
**Process**:
1. Check provider-supplied hours first
2. Fallback to Google/Yelp APIs if needed
3. Apply local rule defaults (parks 6-21, general 9-21)
4. Handle overnight windows (e.g., 20:00 → 04:00)

**Outputs**: Places with `open_now: boolean` field  
**Functions**:
- `isOpenNowFromSchedule(schedule, categoryKey): boolean`

**Fallback Rules**:
- Parks: 6am-9pm
- Food/Shops: 9am-9pm
- 24/7 tags always open

---

#### `logic/ranker.ts`
**Purpose**: Order venues by relevance  
**Inputs**: Array of places with `lat`, `lng`, `open_now`, `popularity` data  
**Scoring**:
1. Distance (haversine calculation)
2. `open_now` status (priority boost)
3. Popularity/rating signals
4. Indie boost (+0.1 for local/independent tags)

**Outputs**: Sorted array of places  
**Functions**:
- `sortByDistance<T>(user: LatLng, items: T[]): T[]`

---

#### `logic/fill.ts`
**Purpose**: Backfill results when count < K_MIN (11)  
**Inputs**: Current result count, category, radius  
**Trigger**: If `n < 11` after filtering  
**Steps**:
1. Temporarily relax `excludeChains` filter
2. Widen radius once toward rural fallback
3. Fetch additional results

**Outputs**: Expanded results array (up to K=20)

---

#### `logic/geo.ts`
**Purpose**: Geographic calculations and utilities  
**Functions**:
- `haversineKm(a: LatLng, b: LatLng): number` - Distance calculation
- `estimatedMinutesFromKm(km: number): number` - Travel time estimate (~11 mph baseline)

**Used By**: `ranker.ts`, `sort.ts`, all distance calculations

---

### Provider Integration (`/modules/logic/providers/`)

#### `fsq.ts` (Foursquare)
**Purpose**: Fetch places from Foursquare API  
**Inputs**: lat, lng, radius, category  
**API**: Foursquare Places API (free tier: 99k calls/month)  
**Outputs**: Raw JSON + normalized subset  
**Best For**: Food & Drink discovery  
**Always Returns**: Raw JSON + normalized places with standard contract

---

#### `yelp.ts` (Yelp Fusion)
**Purpose**: Fetch detailed business data from Yelp  
**Inputs**: lat, lng, radius, category  
**API**: Yelp Fusion API ($299/month flat rate)  
**Outputs**: Business details, hours, phone, reviews, dog-friendly attributes  
**Priority**: Preferred provider for Michigan (higher quality for Detroit/Ann Arbor)  
**Supports**: Distance sorting, `open_now` filtering, category search

---

#### `google.ts` (Google Places)
**Purpose**: Fallback provider for enrichment  
**Inputs**: lat, lng, radius, category  
**API**: Google Places API (EXPENSIVE, pay-per-use)  
**Usage**: ONLY as last resort or enrichment  
**Caching**: Aggressive (15min+ per grid)  
**Rate Limit**: Max 10 calls/minute

---

#### `osm.ts` (OpenStreetMap)
**Purpose**: Free fallback for parks and public spaces  
**Inputs**: lat, lng, radius, category  
**API**: OpenStreetMap Overpass API (FREE)  
**Best For**: Parks, landmarks, public spaces  
**Limitations**: Less data on hours, phone, reviews  
**Usage**: Optional integration for cost savings

---

### Database & Caching

#### `supabase.ts`
**Purpose**: All database interactions with Supabase  
**Functions**:
- `logRequest()` → Insert into `request_logs`
- `getCachedPlaces()` / `putCachedPlaces()` → Read/write raw API JSON
- `writePlaces()` → (Future) Write normalized records to `places` table

**Tables**:
- `request_logs` - One row per request (tracks cache hits, providers used, duration, errors)
- `cached_places` - Raw API JSON payloads (15min cache per query params)
- `places` - (Future) Long-term normalized database of businesses

---

#### `travel.ts`
**Purpose**: Compute travel times (walking & driving)  
**Inputs**: User location, destination coordinates  
**API**: Google Distance Matrix or fallback calculation  
**Outputs**: `{ walkingMinutes: number | null, drivingMinutes: number | null }`  
**Note**: Pre-computed in backend, stored with cached places

---

### Utilities

#### `utils.ts`
**Purpose**: Helper functions  
**Functions**:
- Haversine calculation
- Hashing query parameters (for cache keys)
- String manipulation utilities

---

#### `geocode.ts`
**Purpose**: Shared geocoding logic  
**Use Cases**:
- `/geocode` handler (address → coordinates)
- Pipeline enrichment (add city/state to places)
- Reverse geocoding for travel times

---

## Frontend Files (downtime / Next.js)

### Pages

#### `pages/index.tsx`
**Purpose**: Home page / main discovery interface  
**Data Inputs**:
- User location (from browser geolocation or cached)
- Selected category (from URL param or "All" default)
- API response from `/api/places`

**State**:
- `userLoc: LatLng | null`
- `selectedCategory: string`
- `allPlaces: Place[]`
- `loading: boolean`
- `sortKey: "distance" | "rating"`

**Renders**:
- `TopBar` (logo, category selector)
- `CategoryChips` (category filter)
- `PlaceCard[]` (list of venues)
- `LocationPromptModal` (if no location)

---

#### `pages/map.tsx`
**Purpose**: Map view of nearby places  
**Data Inputs**: Same as `index.tsx`  
**Additional State**:
- `travelTimes: Record<string, {walkingMinutes, drivingMinutes}>`

**Renders**:
- `MapView` (Leaflet map with markers)
- Same UI components as home page

**Travel Times**: Fetched for top 50 places on mount via `fetchTravelTimes()`

---

#### `pages/api/places.ts`
**Purpose**: Next.js API route (proxy to Zuplo gateway)  
**Note**: Being deprecated/replaced by direct Zuplo calls  
**Current**: Wraps Google Places API  
**Future**: Direct fetch to Zuplo `/places` endpoint  

---

### Components

#### `components/PlaceCard.tsx`
**Purpose**: Display individual venue card  
**Props**:
```typescript
interface PlaceCardProps {
  place: {
    name: string;
    lat: number;
    lng: number;
    address: string;
    category: string;
    open_now: boolean;
    distance: number;
    website_url?: string;
    social_links?: { instagram?: string; facebook?: string };
    walk_min?: number;
    drive_min?: number;
    rating?: number;
    phone?: string;
  }
}
```

**Displays**:
- Venue name
- Distance badge
- `open_now` badge (green if true)
- Categories chips
- Travel time estimates (walk/drive)
- Action buttons (website, social links, directions)

---

#### `components/CategoryChips.tsx`
**Purpose**: Horizontal scrolling category filter  
**Props**:
```typescript
interface CategoryChipsProps {
  categories_available: Array<{ name: string; count: number }>;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}
```

**Displays**: Pills for each category with count  
**Behavior**: Horizontal scroll, snap-to-center, active state styling

---

#### `components/MapView.tsx`
**Purpose**: Leaflet map with place markers  
**Props**:
```typescript
interface MapViewProps {
  places: Place[];
  userLocation: LatLng;
  onMarkerClick?: (place: Place) => void;
}
```

**Dependencies**: `react-leaflet`, `leaflet`  
**Imports**: Dynamic (SSR disabled via `next/dynamic`)  
**Markers**: One per place, custom icon for user location

---

#### `components/TopBar.tsx`
**Purpose**: Navigation header  
**Displays**:
- Downtime logo (animated gradient)
- Location refresh button
- Category dropdown/selector
- Sort toggle (distance vs rating)

---

#### `components/LocationPromptModal.tsx`
**Purpose**: Request user location permission  
**Behavior**:
- Shows on first visit if no cached location
- Animated glowing border effect
- Triggers browser geolocation API
- Saves result to localStorage as `dt_user_loc`

---

#### `components/SortToggle.tsx`
**Purpose**: Toggle between distance and rating sort  
**Props**: `sortKey: "distance" | "rating"`, `onToggle: (key) => void`

---

### Library Functions

#### `lib/geo.ts`
**Purpose**: Frontend geographic utilities  
**Functions**:
- `haversineKm(a: LatLng, b: LatLng): number`
- `saveUserLocation(loc: LatLng): void` - Save to localStorage
- `loadStoredUserLocation(): LatLng | null` - Load from localStorage

---

#### `lib/getTravelTimes.ts`
**Purpose**: Fetch pre-computed travel times  
**Function**: `fetchTravelTimes(origin: LatLng, destinations: Array<{id, lat, lng}>)`  
**Returns**: `Promise<Record<string, {walkingMinutes, drivingMinutes}>>`  
**Note**: Backend pre-computes these, frontend just fetches

---

### Metadata & Config

#### `categoryMeta.ts`
**Purpose**: Category metadata and type mappings  
**Exports**:
- `CATEGORY_MAP` - Maps category keys to display labels
- `ALL_TYPES` - Array of all category types
- Category icons, colors, descriptions

---

#### `categoryLabels.ts`
**Purpose**: Human-readable labels for categories  
**Maps**: Backend `primary_category` → Frontend display label  
**Example**: `"food_drink"` → `"Food & Drink"`

---

## Database Schema (Supabase)

### `request_logs`
**Purpose**: Track every API request for debugging and analytics  
**Columns**:
- `id` (UUID, primary key)
- `ts` (timestamp)
- `route` (API endpoint)
- `visitor_id` (UUID, FK to visitors)
- `session_id` (UUID, FK to sessions)
- `lat`, `lng`, `radius` (query params)
- `category` (requested category)
- `open_now` (boolean filter)
- `result_count` (number of results returned)
- `duration_ms` (response time)
- `source_counts` (JSONB: `{"osm": 10, "fsq": 5, "yelp": 5}`)
- `error_code` (if request failed)

---

### `cached_places`
**Purpose**: Store raw API responses for 15-minute reuse  
**Columns**:
- `id` (UUID, primary key)
- `query_hash` (unique key: lat/lng/radius/category/time_bucket)
- `raw_json` (JSONB: full provider response)
- `created_at` (timestamp)
- `expires_at` (timestamp, created_at + 15min)

**Cache Key**: `HASH(lat, lng, radius, category, FLOOR(timestamp/2h))`

---

### `places` (Future)
**Purpose**: Long-term normalized database of businesses  
**Columns**:
- `id` (UUID, primary key)
- `name`, `lat`, `lng`, `address`
- `category`, `subcategory`
- `open_now`, `hours_schedule` (JSONB)
- `rating`, `phone`, `website_url`
- `social_links` (JSONB)
- `dog_friendly`, `outdoor_seating` (boolean attributes)
- `last_verified` (timestamp)
- `source_provider` (osm/fsq/yelp/google)

---

## Summary of Key Data Flows

### 1. User Requests Places
```
Frontend → Backend /places API
  → api-logic.ts (orchestrator)
    → Check supabase.ts cache
    → If stale, call providers (fsq.ts, yelp.ts, google.ts)
    → Apply filters.ts, hours.ts, ranker.ts
    → Cache result in supabase.ts
  → Return JSON to frontend
→ Render PlaceCard[] components
```

### 2. Cache Hit Path (Optimal)
```
Frontend → Backend /places API
  → api-logic.ts
    → supabase.ts.getCachedPlaces()
    → ✅ Cache hit (< 15min old)
  → Return cached JSON immediately
→ Render PlaceCard[] components
```

### 3. Provider Waterfall (Cache Miss)
```
api-logic.ts
  → OSM (free) - Parks/Outdoors
  → Foursquare (free tier) - Food/Drink
  → Yelp ($299/mo) - Everything else
  → Google (expensive) - Only if critical data missing
→ Merge, normalize, deduplicate
→ Cache for 15min
```

---

_This map ensures Codex and GPT-5 always know where to look for specific functionality._