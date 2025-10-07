# Downtime Gateway API Contract

## Base URL
Not defined in repository configuration. Deployments should configure `NEXT_PUBLIC_GATEWAY_URL` to the desired Zuplo domain.

## Authentication
Not required. All routes currently opt into the permissive `anything-goes` CORS policy with no inbound authentication policies.

## Endpoints

### GET /places
**Request Parameters**
- `lat` (number, required): Latitude of the origin point.
- `lng` (number, required): Longitude of the origin point.
- `radius_m` (number, required): Search radius in meters.
- `categories` (string, required): Comma-separated list of categories/keywords.
- `limit` (number, optional, default 20, max 50): Maximum number of places to return.
- `open_now` (boolean, optional): When provided, filters for places currently open.

**Example Request**
```
GET /places?lat=42.3314&lng=-83.0458&radius_m=1000&categories=coffee,cafe&limit=25
```

**Response Structure**
Returns a JSON object with provider metadata and the waterfall-normalized places list.
```json
{
  "places": [
    {
      "id": "string",
      "name": "string",
      "lat": 42.332,
      "lng": -83.046,
      "address": "optional formatted address",
      "categories": ["category", "keywords"],
      "rating": 4.6,
      "reviewCount": 128,
      "priceLevel": 2,
      "openNow": true,
      "distanceMeters": 187,
      "provider": "foursquare",
      "raw": { "providerSpecific": "payload" }
    }
  ],
  "provider_used": "foursquare",
  "cache_hit": false
}
```

**Provider Logic**
The provider waterfall tries the following order until results are returned:
1. OpenStreetMap Photon search (`modules/logic/providers/osm.ts`).
2. Foursquare Places (`modules/logic/providers/foursquare.ts`).
3. Yelp Fusion (`modules/logic/providers/yelp.ts`).
4. Google Places Nearby Search (`modules/logic/providers/google.ts`).

Each provider returns normalized `Place` objects; the orchestrator stops at the first provider that yields results. Failures are logged and the next provider is attempted. Implementation: `modules/logic/api-logic.ts#getPlaces`.

**Error Handling**
- `400 Bad Request` when required query parameters are missing or invalid.
- `500 Internal Server Error` when all providers fail or an unexpected error occurs.

---

### GET /geocode
**Request Parameters**
- `query` (string, required): Address or place name to geocode.

**Example Request**
```
GET /geocode?query=1600+Pennsylvania+Ave+NW+Washington+DC
```

**Response Structure**
```json
{
  "location": { "lat": 38.8977, "lng": -77.0365 },
  "address": "1600 Pennsylvania Avenue NW, Washington, DC 20500, USA",
  "provider": "google"
}
```

**Provider Logic**
1. OpenStreetMap Nominatim (`modules/logic/api-logic.ts#geocode`).
2. Google Geocoding (fallback when OSM misses and a Google key is configured).

**Error Handling**
- `400 Bad Request` when `query` is empty.
- `500 Internal Server Error` when providers fail.

---

### POST /travel-times
**Request Body**
```json
{
  "origin": { "lat": 42.3314, "lng": -83.0458 },
  "destinations": [
    { "id": "gm-1", "lat": 42.3401, "lng": -83.0523 }
  ]
}
```

**Response Structure**
```json
{
  "results": [
    {
      "id": "gm-1",
      "distanceMeters": 1250,
      "drivingMinutes": 1.5,
      "walkingMinutes": 15.0,
      "bikingMinutes": 5.0
    }
  ],
  "provider": "heuristic"
}
```

**Provider Logic**
The handler uses an internal heuristic speed model to approximate travel times by distance (50 km/h driving, 5 km/h walking, 15 km/h biking). Implementation: `modules/logic/api-logic.ts#estimateTravelTimes`.

**Error Handling**
- `400 Bad Request` for invalid payloads.
- `405 Method Not Allowed` for non-POST requests.
- `500 Internal Server Error` for unexpected failures.

---

### GET /test-db
**Request Parameters**
- _None_: The handler reads no query string parameters and simply queries Supabase for a single `places` record.

**Example Request**
```
GET /test-db
```

**Response Structure**
```json
{
  "success": true,
  "sample": [
    { "id": "<uuid>", "name": "<place name>" }
  ]
}
```

**Provider Logic**
Direct Supabase read to validate connectivity: `modules/test-db.ts`.

**Error Handling**
- `500 Internal Server Error` surfaces Supabase error messages when the query fails.

---

## Environment Variables
| Variable | Purpose | Required |
|----------|---------|----------|
| `SUPABASEURL` | Supabase project URL used by `/test-db`. | ✅ |
| `SUPABASEKEY` | Supabase key used by `/test-db`. | ✅ |
| `FOURSQUARE_API_KEY` | Credential for Foursquare provider. | ⚠️ Required for Foursquare coverage. |
| `YELP_API_KEY` | Credential for Yelp provider. | ⚠️ Required for Yelp coverage. |
| `GOOGLE_PLACES_API_KEY` | Credential for Google Places fallback. | ⚠️ Required for Google provider usage. |
| `GOOGLE_GEOCODING_API_KEY` | Optional dedicated key for geocoding fallback. | ⚠️ Needed if Google geocoding should be available. |
| `NEXT_PUBLIC_GATEWAY_URL` | Frontend configuration pointing to the deployed gateway. | ✅ for frontend integration |

## Deployment / CORS Notes
- Every route opts into the `anything-goes` CORS policy allowing all origins.
- No inbound auth policies or IP allow-lists are configured; Zuplo policies can be layered later if required.

## Code References
- Route configuration: `config/routes.oas.json`.
- Places handler: `modules/handlers/places-handler.ts`.
- Geocode handler: `modules/handlers/geocode-handler.ts`.
- Travel times handler: `modules/handlers/travel-times-handler.ts`.
- Provider orchestrator: `modules/logic/api-logic.ts`.
- Provider adapters: `modules/logic/providers/*.ts`.
- Utility helpers: `modules/logic/utils.ts`.
