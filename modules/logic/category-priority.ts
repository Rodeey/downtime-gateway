export type CanonCategory =
  | "coffee"
  | "cafe"
  | "bakery"
  | "fast_food"
  | "restaurant"
  | "bar"
  | "brewery"
  | "dessert"
  | "grocery"
  | "park"
  | "outdoors"
  | "museum"
  | "shop"
  | "wellness"
  | "general";

const CATEGORY_PRIORITY: CanonCategory[] = [
  "coffee",
  "cafe",
  "bakery",
  "fast_food",
  "restaurant",
  "bar",
  "brewery",
  "dessert",
  "grocery",
  "park",
  "outdoors",
  "museum",
  "shop",
  "wellness",
  "general",
];

const ALIAS_TO_CANON: Record<string, CanonCategory> = {
  coffee: "coffee",
  coffeeshop: "coffee",
  espresso: "coffee",
  cafe: "cafe",
  tea: "cafe",
  bakery: "bakery",
  bagel: "bakery",
  donut: "bakery",
  dessert: "dessert",
  icecream: "dessert",
  gelato: "dessert",
  chocolate: "dessert",
  fastfood: "fast_food",
  burger: "fast_food",
  tacos: "fast_food",
  sandwich: "fast_food",
  restaurant: "restaurant",
  restaurants: "restaurant",
  dining: "restaurant",
  diner: "restaurant",
  sushi: "restaurant",
  pizza: "restaurant",
  bbq: "restaurant",
  steak: "restaurant",
  bar: "bar",
  pub: "bar",
  nightlife: "bar",
  cocktail: "bar",
  winebar: "bar",
  brewery: "brewery",
  distillery: "brewery",
  winery: "brewery",
  grocery: "grocery",
  supermarket: "grocery",
  market: "grocery",
  deli: "grocery",
  butcher: "grocery",
  seafood: "grocery",
  park: "park",
  playground: "park",
  trail: "outdoors",
  hike: "outdoors",
  hiking: "outdoors",
  nature: "outdoors",
  outdoors: "outdoors",
  recreation: "outdoors",
  garden: "outdoors",
  zoo: "outdoors",
  museum: "museum",
  gallery: "museum",
  art: "museum",
  theatre: "museum",
  theater: "museum",
  concert: "museum",
  music: "museum",
  shop: "shop",
  shopping: "shop",
  mall: "shop",
  boutique: "shop",
  clothing: "shop",
  hardware: "shop",
  electronics: "shop",
  pharmacy: "shop",
  spa: "wellness",
  salon: "wellness",
  massage: "wellness",
  yoga: "wellness",
  gym: "wellness",
  fitness: "wellness",
  wellness: "wellness",
  health: "wellness",
};

const NAME_HINTS: Array<{ pattern: RegExp; category: CanonCategory }> = [
  { pattern: /coffee|espresso|latte/i, category: "coffee" },
  { pattern: /cafe|caf[eé]/i, category: "cafe" },
  { pattern: /bake|donut|bagel|pastry/i, category: "bakery" },
  { pattern: /brew|tap|pub|bar/i, category: "bar" },
  { pattern: /pizza/i, category: "restaurant" },
  { pattern: /bbq|barbecue/i, category: "restaurant" },
  { pattern: /park|trail|nature|garden/i, category: "outdoors" },
  { pattern: /museum|gallery|art/i, category: "museum" },
  { pattern: /shop|store|market/i, category: "shop" },
  { pattern: /spa|wellness|yoga|fitness/i, category: "wellness" },
];

export interface NormalizedCategories {
  cats: CanonCategory[];
  mods: string[];
}

export function normalizeCategories(raw: string[]): NormalizedCategories {
  const cats: CanonCategory[] = [];
  const mods: string[] = [];
  const seen = new Set<CanonCategory>();

  for (const token of raw) {
    if (typeof token !== "string") {
      continue;
    }
    const normalized = token.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!normalized) {
      continue;
    }
    const alias = ALIAS_TO_CANON[normalized];
    if (alias) {
      if (!seen.has(alias)) {
        seen.add(alias);
        cats.push(alias);
      }
      continue;
    }
    if (normalized.includes("wifi")) {
      mods.push("wifi");
    } else if (normalized.includes("outdoor")) {
      mods.push("outdoor");
    } else if (normalized.includes("patio")) {
      mods.push("patio");
    } else if (normalized.includes("vegan")) {
      mods.push("vegan");
    }
  }

  if (cats.length === 0) {
    cats.push("general");
  }

  return { cats, mods };
}

export interface PickPrimaryOptions {
  name?: string;
  fallback?: CanonCategory;
}

export function pickPrimaryCategory(
  rawCats: string[],
  options: PickPrimaryOptions = {}
): CanonCategory {
  const { cats } = normalizeCategories(rawCats);
  if (cats.length === 1 && cats[0] !== "general") {
    return cats[0];
  }

  for (const candidate of CATEGORY_PRIORITY) {
    if (cats.includes(candidate)) {
      return candidate;
    }
  }

  if (options.name) {
    for (const hint of NAME_HINTS) {
      if (hint.pattern.test(options.name)) {
        return hint.category;
      }
    }
  }

  return options.fallback ?? "general";
}
