export type CategoryBucket =
  | "food_drink"
  | "coffee_wfh"
  | "outdoors"
  | "arts_culture"
  | "shops_services"
  | "wellness"
  | "general";

export const CATEGORY_LABELS: Record<CategoryBucket, string> = {
  food_drink: "Food & Drink",
  coffee_wfh: "Coffee & Wi-Fi",
  outdoors: "Parks & Outdoors",
  arts_culture: "Arts & Culture",
  shops_services: "Shops & Services",
  wellness: "Wellness",
  general: "General",
};

const CANONICAL_MAP: Record<string, CategoryBucket> = {
  // Generic terms
  food: "food_drink",
  drink: "food_drink",
  dining: "food_drink",
  restaurant: "food_drink",
  restaurants: "food_drink",
  bar: "food_drink",
  bars: "food_drink",
  pub: "food_drink",
  brewery: "food_drink",
  wineries: "food_drink",
  winetasting: "food_drink",
  distillery: "food_drink",
  cafe: "coffee_wfh",
  coffee: "coffee_wfh",
  coffeeshop: "coffee_wfh",
  tea: "coffee_wfh",
  bakery: "coffee_wfh",
  breakfast: "coffee_wfh",
  brunch: "food_drink",
  dessert: "food_drink",
  icecream: "food_drink",
  juicebar: "food_drink",
  fastfood: "food_drink",
  pizza: "food_drink",
  tacos: "food_drink",
  vegan: "food_drink",
  vegetarian: "food_drink",
  grocery: "shops_services",
  supermarket: "shops_services",
  convenience: "shops_services",
  market: "food_drink",
  deli: "food_drink",
  butcher: "food_drink",
  seafood: "food_drink",
  food_court: "food_drink",
  // Coffee/WFH variations
  coworking: "coffee_wfh",
  wifi: "coffee_wfh",
  study: "coffee_wfh",
  library: "arts_culture",
  bookstore: "arts_culture",
  // Outdoors tokens
  park: "outdoors",
  playground: "outdoors",
  trail: "outdoors",
  nature: "outdoors",
  camping: "outdoors",
  campground: "outdoors",
  garden: "outdoors",
  conservatory: "outdoors",
  zoo: "outdoors",
  beach: "outdoors",
  waterfront: "outdoors",
  lake: "outdoors",
  forest: "outdoors",
  ski: "outdoors",
  bike: "outdoors",
  hike: "outdoors",
  hiking: "outdoors",
  recreation: "outdoors",
  outdoors: "outdoors",
  swimming: "outdoors",
  pool: "outdoors",
  golf: "outdoors",
  stadium: "outdoors",
  sports: "outdoors",
  // Arts & culture
  museum: "arts_culture",
  art: "arts_culture",
  gallery: "arts_culture",
  theater: "arts_culture",
  theatre: "arts_culture",
  music: "arts_culture",
  concert: "arts_culture",
  cinema: "arts_culture",
  movie_theater: "arts_culture",
  cultural: "arts_culture",
  historic: "arts_culture",
  history: "arts_culture",
  monument: "arts_culture",
  landmark: "arts_culture",
  tourist: "arts_culture",
  // Shops & services
  shopping: "shops_services",
  shop: "shops_services",
  mall: "shops_services",
  boutique: "shops_services",
  clothing: "shops_services",
  shoes: "shops_services",
  jewelry: "shops_services",
  pharmacy: "shops_services",
  hardware: "shops_services",
  electronics: "shops_services",
  gifts: "shops_services",
  homegoods: "shops_services",
  pet: "shops_services",
  auto: "shops_services",
  gas: "shops_services",
  fuel: "shops_services",
  car: "shops_services",
  salon: "wellness",
  spa: "wellness",
  massage: "wellness",
  fitness: "wellness",
  gym: "wellness",
  yoga: "wellness",
  pilates: "wellness",
  wellness: "wellness",
  medical: "wellness",
  dentist: "wellness",
  hospital: "wellness",
  urgentcare: "wellness",
  chiropractor: "wellness",
  beauty: "wellness",
  nail: "wellness",
  barber: "wellness",
  // Foursquare category ids
  "4d4b7105d754a06374d81259": "food_drink", // Food
  "4d4b7105d754a06374d8125a": "shops_services", // Shops
  "4d4b7104d754a06370d81259": "arts_culture", // Arts & Entertainment
  "4d4b7105d754a06377d81259": "outdoors", // Outdoors & Recreation
  "4bf58dd8d48988d1e0931735": "coffee_wfh", // Coffee Shop
  "4bf58dd8d48988d1c9941735": "coffee_wfh", // Café
  "4bf58dd8d48988d14e941735": "food_drink", // Brewery
  "4bf58dd8d48988d16c941735": "food_drink", // Wine Bar
  "4bf58dd8d48988d10b941735": "food_drink", // Gastropub
  "4bf58dd8d48988d16d941735": "food_drink", // Cocktail Bar
  "4bf58dd8d48988d163941735": "food_drink", // Pizza Place
  "4bf58dd8d48988d154941735": "food_drink", // Burger Joint
};

export const CATEGORY_MAP = CANONICAL_MAP;

export function resolveCategoryKey(token: string): CategoryBucket {
  const normalized = token.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!normalized) {
    return "general";
  }
  return CATEGORY_MAP[normalized] ?? "general";
}

export function categoryLabel(bucket: CategoryBucket): string {
  return CATEGORY_LABELS[bucket] ?? CATEGORY_LABELS.general;
}
