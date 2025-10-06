// modules/logic/filters.ts
import type { Place } from "./normalizer";

/**
 * Filters and dedupes Places:
 * - Removes obvious fast-food chains and gas stations
 * - Deduplicates by normalized name + rounded lat/lng (≈100m)
 */
export function filterPlaces(places: Place[]): Place[] {
  const blacklistNames = [
    "mcdonald", "burger king", "wendy", "taco bell", "kfc", "subway",
    "arbys", "papa john", "little caesars", "domino", "bp ", "shell ",
    "mobil ", "exxon", "circle k", "7-eleven", "7 eleven"
  ];

  const seen = new Set<string>();
  const out: Place[] = [];

  function normalizeName(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  for (const p of places) {
    const n = (p.name || "").toLowerCase();
    if (blacklistNames.some((b) => n.includes(b))) continue;

    const cats = (p.categories || []).map((c) => c.toLowerCase());
    const isGas = cats.some((c) => c.includes("gas") || c.includes("fuel"));
    const isFast = cats.some((c) => c.includes("fast"));
    if (isGas || isFast) continue;

    // Deduplication key: normalized name + ~100m rounded lat/lng
    const key = `${normalizeName(p.name || "")}|${Math.round(p.lat * 1000)}|${Math.round(p.lng * 1000)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push(p);
  }

  return out;
}

