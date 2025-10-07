export type ProviderName = "osm" | "foursquare" | "yelp" | "google";

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  categories?: string[];
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  phone?: string;
  website?: string;
  distanceMeters?: number;
  openNow?: boolean;
  provider?: ProviderName;
  raw?: unknown;
}

export interface PlacesQuery {
  lat: number;
  lng: number;
  radiusMeters: number;
  categories: string[];
  limit?: number;
  openNow?: boolean;
}

export interface ProviderSearchResult {
  provider: ProviderName;
  places: Place[];
  cacheHit?: boolean;
}

export interface GeocodeResult {
  location: {
    lat: number;
    lng: number;
  };
  address?: string;
  provider: ProviderName;
}

export interface TravelTimesRequest {
  origin: {
    lat: number;
    lng: number;
  };
  destinations: Array<{
    id: string;
    lat: number;
    lng: number;
  }>;
}

export interface TravelTimeEstimate {
  id: string;
  drivingMinutes?: number;
  walkingMinutes?: number;
  bikingMinutes?: number;
  distanceMeters: number;
}

export interface TravelTimesResponse {
  results: TravelTimeEstimate[];
  provider: "heuristic" | ProviderName;
}

export class ProviderError extends Error {
  constructor(message: string, public provider: ProviderName) {
    super(message);
    this.name = "ProviderError";
  }
}
