// modules/logic/category-map.ts

export type CategoryBucket =
  | "food_drink"
  | "coffee_wfh"
  | "outdoors"
  | "arts"
  | "activities"
  | "shops"
  | "general";

export const CATEGORY_LABELS: Record<CategoryBucket, string> = {
  food_drink: "Food & Drink",
  coffee_wfh: "Coffee/Wifi",
  outdoors: "Outdoors",
  arts: "Arts & Learning",
  activities: "Activities / Play",
  shops: "Shops",
  general: "General",
};

/**
 * Cross-API category mapping
 * Keys may be: Google Place Types, Yelp aliases, FSQ category IDs (lowercased),
 * or any ad-hoc token we decide to support.
 */
export const CATEGORY_MAP: Record<string, CategoryBucket> = {
  // Google Place Types
  restaurant: "food_drink",
  bar: "food_drink",
  bakery: "food_drink",
  meal_takeaway: "food_drink",
  meal_delivery: "food_drink",

  cafe: "coffee_wfh",

  park: "outdoors",
  campground: "outdoors",
  tourist_attraction: "outdoors",
  zoo: "outdoors",
  natural_feature: "outdoors",

  museum: "arts",
  art_gallery: "arts",
  library: "arts",

  movie_theater: "activities",
  bowling_alley: "activities",
  amusement_park: "activities",
  aquarium: "activities",
  stadium: "activities",
  casino: "activities",

  shopping_mall: "shops",
  store: "shops",
  supermarket: "shops",
  grocery_or_supermarket: "shops",
  convenience_store: "shops",
  hardware_store: "shops",
  pharmacy: "shops",

  // Yelp aliases
  restaurants: "food_drink",
  bars: "food_drink",
  food: "food_drink",
  pizza: "food_drink",
  burgers: "food_drink",

  coffee: "coffee_wfh",
  cafes: "coffee_wfh",

  parks: "outdoors",
  campgrounds: "outdoors",
  zoos: "outdoors",

  museums: "arts",
  galleries: "arts",
  libraries: "arts",

  movietheaters: "activities",
  bowling: "activities",
  amusementparks: "activities",
  aquariums: "activities",
  stadiumsarenas: "activities",
  casinos: "activities",

  shopping: "shops",
  grocery: "shops",
  conveniencestores: "shops",
  hardware: "shops",
  drugstores: "shops",

  // FSQ Category IDs (add more as you expand)
  "4d4b7105d754a06374d81259": "food_drink", // Food
  "4bf58dd8d48988d1e0931735": "coffee_wfh", // Coffee Shop
  "4bf58dd8d48988d163941735": "outdoors",   // Park
  "4bf58dd8d48988d181941735": "arts",       // Museum
  "4bf58dd8d48988d17f941735": "activities", // Movie Theater
  "4bf58dd8d48988d1f9941735": "shops",      // Mall
};

export function resolveCategoryKey(token: string | undefined | null): CategoryBucket {
  if (!token) return "general";
  const key = String(token).toLowerCase().trim();
  return CATEGORY_MAP[key] ?? "general";
}

export function categoryLabel(bucket: CategoryBucket | undefined): string {
  return (bucket && CATEGORY_LABELS[bucket]) || "General";
}

