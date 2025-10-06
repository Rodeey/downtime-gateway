import { capByCategory, thresholdByCategory } from "../logic/utils.ts";
import { CATEGORY_LABELS } from "../logic/category-map.ts";

export default async function handler(_request: Request) {
  const categories = Object.keys(capByCategory).map((key) => ({
    key,
    label: CATEGORY_LABELS[key] ?? key,
    cap: capByCategory[key as keyof typeof capByCategory],
    min: thresholdByCategory[key as keyof typeof thresholdByCategory],
  }));

  return new Response(JSON.stringify({ categories }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
