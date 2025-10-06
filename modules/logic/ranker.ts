// modules/logic/ranker.ts
import type { Place } from "./normalizer";

/**
 * Ranking:
 * 1) Open now first
 * 2) Not closing soon before closing soon
 * 3) Shorter drive time
 * 4) Shorter walk time
 * 5) Shorter straight-line distance
 */
export function rankPlaces(places: Place[]): Place[] {
  return [...places].sort((a, b) => {
    const ao = truthyScore(a.open_now);
    const bo = truthyScore(b.open_now);
    if (ao !== bo) return bo - ao;

    const ac = truthyScore(!a.closing_soon);
    const bc = truthyScore(!b.closing_soon);
    if (ac !== bc) return bc - ac;

    const ad = a.travel?.drive_min ?? Number.POSITIVE_INFINITY;
    const bd = b.travel?.drive_min ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;

    const aw = a.travel?.walk_min ?? Number.POSITIVE_INFINITY;
    const bw = b.travel?.walk_min ?? Number.POSITIVE_INFINITY;
    if (aw !== bw) return aw - bw;

    const ax = a.distance_m ?? Number.POSITIVE_INFINITY;
    const bx = b.distance_m ?? Number.POSITIVE_INFINITY;
    return ax - bx;
  });
}

function truthyScore(v: any): number {
  return v ? 1 : 0;
}
