// modules/logic/category-priority.ts
export type CanonCategory =
  | "coffee" | "cafe" | "bakery" | "restaurant" | "bar" | "fast_food"
  | "park" | "outdoors"
  | "shopping" | "arts"
  | "general";

const FOOD_DRINK: CanonCategory[] = ["coffee","cafe","bakery","fast_food","restaurant","bar"];
const OUTDOORS:   CanonCategory[] = ["park","outdoors"];

// Provider aliases → canonical + optional modifiers (e.g., wifi)
const ALIAS_TO_CANON: Record<string, { cat: CanonCategory; mods?: string[] }> = {
  "wifi/coffee": { cat: "coffee", mods: ["wifi"] },
  "coffee_wifi": { cat: "coffee", mods: ["wifi"] },
  "coffee_shop": { cat: "coffee" },
  "espresso_bar": { cat: "coffee" },
  "café": { cat: "cafe" },
  "dessert_shop": { cat: "bakery" },
  "patisserie": { cat: "bakery" },
  "pub": { cat: "bar" },
  "taproom": { cat: "bar" },
  "gastropub": { cat: "bar" },
  "brewpub": { cat: "bar" },
  "quick_bites": { cat: "fast_food" },
  "fast_food": { cat: "fast_food" },
  "pizza": { cat: "restaurant" },
  "sandwich_shop": { cat: "restaurant" },
  "diner": { cat: "restaurant" },

  // passthroughs
  "coffee": { cat: "coffee" },
  "cafe": { cat: "cafe" },
  "bakery": { cat: "bakery" },
  "restaurant": { cat: "restaurant" },
  "bar": { cat: "bar" },
  "park": { cat: "park" },
  "outdoors": { cat: "outdoors" },
  "shopping": { cat: "shopping" },
  "arts": { cat: "arts" },
  "general": { cat: "general" },
};

export function normalizeCategories(raw: string[] = []): { cats: CanonCategory[]; mods: string[] } {
  const cats = new Set<CanonCategory>();
  const mods = new Set<string>();

  for (const t of raw) {
    if (!t) continue;
    const key = String(t).toLowerCase().replace(/[^\p{L}\p{N}_/]+/gu, "_");
    const hit =
      ALIAS_TO_CANON[key] ??
      ALIAS_TO_CANON[key.replace("/", "_")] ??
      ALIAS_TO_CANON[key.replace("_", "/")];
    if (hit) {
      cats.add(hit.cat);
      (hit.mods ?? []).forEach((m) => mods.add(m));
    } else {
      // coarse inference
      if (key.includes("coffee")) cats.add("coffee");
      else if (key.includes("cafe")) cats.add("cafe");
      else if (key.includes("bakery")) cats.add("bakery");
      else if (key.includes("fast")) cats.add("fast_food");
      else if (key.includes("restaurant") || key.includes("diner")) cats.add("restaurant");
      else if (key.includes("bar") || key.includes("pub")) cats.add("bar");
      else if (key.includes("park")) cats.add("park");
      else if (key.includes("outdoor")) cats.add("outdoors");
      else cats.add("general");
      if (key.includes("wifi")) mods.add("wifi");
    }
  }
  return { cats: Array.from(cats), mods: Array.from(mods) };
}

const FOOD_DRINK_PRIORITY: CanonCategory[] = [
  "coffee", "cafe", "bakery", "fast_food", "restaurant", "bar"
];

export function pickPrimaryCategory(
  rawCats: string[] = [],
  opts?: { placeName?: string }
): CanonCategory {
  const { cats } = normalizeCategories(rawCats);
  if (cats.length === 0) return "general";

  // Food & Drink cluster first (where most overlap happens)
  const foodCats = cats.filter((c) => FOOD_DRINK.includes(c));
  if (foodCats.length) {
    const name = (opts?.placeName ?? "");
    const hasRestaurant = foodCats.includes("restaurant");
    const hasBar = foodCats.includes("bar");

    // Tie-break restaurant vs bar by name cues
    if (hasRestaurant && hasBar && /\b(bar|pub|taproom|tavern|brewery)\b/i.test(name)) {
      return "bar";
    }
    for (const p of FOOD_DRINK_PRIORITY) {
      if (foodCats.includes(p)) return p;
    }
    return foodCats[0];
  }

  // Outdoors specificity
  const outdoorCats = cats.filter((c) => OUTDOORS.includes(c));
  if (outdoorCats.length) {
    if (outdoorCats.includes("park")) return "park";
    return "outdoors";
  }

  // Otherwise, first non-general win
  const nonGeneral = cats.find((c) => c !== "general");
  return nonGeneral ?? "general";
}

