const KEYS = [
  "SUPABASEURL",
  "SUPABASEKEY",
  "FOURSQUARE_API_KEY",
  "YELP_API_KEY",
  "GEOAPIFY_KEY",
];

function hasEnv(key: string): boolean {
  try {
    const value = (zuplo.env as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) {
      return true;
    }
  } catch (error) {
    console.warn(`[test-env] Unable to read ${key}`, error);
  }
  if (
    typeof process !== "undefined" &&
    process.env &&
    typeof process.env[key] === "string" &&
    process.env[key]!.length > 0
  ) {
    return true;
  }
  return false;
}

export default async function handler(): Promise<Response> {
  const result = Object.fromEntries(
    KEYS.map((key) => {
      return [key, hasEnv(key)];
    })
  );

  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
