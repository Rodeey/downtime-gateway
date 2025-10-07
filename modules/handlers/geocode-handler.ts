import { geocode } from "../logic/api-logic";

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";

  try {
    const result = await geocode(query);
    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[Gateway] /geocode error", error);
    const status = error instanceof Error && /cannot be empty/i.test(error.message)
      ? 400
      : 500;

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
