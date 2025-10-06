import type { Place } from "./normalizer";

/**
 * MVP hours:
 * - Food/Drink: 11:00–22:00
 * - Parks/Outdoors: 07:00–20:00
 * - Coffee/WFH: 07:00–18:00
 *
 * Uses UTC for simplicity. Real impl should localize per-venue timezone.
 * Also sets closing_soon when within 45 minutes of closing.
 */
export function applyOpenNowRules(places: Place[]): Place[] {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();

  return places.map((p) => {
    const cats = (p.categories || []).map((c) => c.toLowerCase());
    const isFood = cats.some((c) =>
      includesAny(c, ["restaurant", "deli", "bar", "steak", "pizza", "sandwich"])
    );
    const isCoffee = cats.some((c) => includesAny(c, ["coffee", "cafe"]));
    const isPark = cats.some((c) =>
      includesAny(c, ["park", "trail", "playground", "outdoor", "outdoors"])
    );

    let window: { start: number; end: number } | null = null;
    if (isFood) window = { start: 11 * 60, end: 22 * 60 };
    else if (isCoffee) window = { start: 7 * 60, end: 18 * 60 };
    else if (isPark) window = { start: 7 * 60, end: 20 * 60 };

    if (!window) return { ...p, open_now: null, closing_soon: null };

    const nowMin = hour * 60 + minute;
    const open_now = nowMin >= window.start && nowMin < window.end;
    const closing_soon = open_now ? nowMin >= window.end - 45 : false;

    // Attach synthetic "closing time" for downstream filters
    const todayClosingTime = new Date(now);
    todayClosingTime.setUTCHours(Math.floor(window.end / 60), window.end % 60, 0, 0);

    return { ...p, open_now, closing_soon, todayClosingTime };
  });
}

/**
 * Helper: Exclude places closing in <=30 minutes.
 * Independent of the 45-min "closing_soon" flag above.
 */
export function filterClosingSoon(places: Place[]): Place[] {
  const now = new Date();
  return places.filter((p) => {
    const closing = (p as any).todayClosingTime as Date | undefined;
    if (!p.open_now || !closing) return true; // keep if unknown
    const minsUntilClose = (closing.getTime() - now.getTime()) / 60000;
    return minsUntilClose > 30;
  });
}

function includesAny(str: string, needles: string[]) {
  return needles.some((n) => str.includes(n));
}


