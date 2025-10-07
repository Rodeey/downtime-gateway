import { CATEGORY_LABELS, type CategoryBucket } from "../logic/category-map";
import { capByCategory, thresholdByCategory } from "../logic/utils";
import type { HandlerContext } from "./context";

interface CategorySummaryResponse {
  key: CategoryBucket;
  label: string;
  cap: number;
  minimum: number;
}

export default async function handler(
  _request: Request,
  _ctx: HandlerContext
): Promise<Response> {
  const categories: CategorySummaryResponse[] = Object.keys(
    capByCategory
  ).map((key) => {
    const bucket = key as CategoryBucket;
    return {
      key: bucket,
      label: CATEGORY_LABELS[bucket],
      cap: capByCategory[bucket],
      minimum: thresholdByCategory[bucket],
    };
  });

  return new Response(JSON.stringify({ categories }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
}
