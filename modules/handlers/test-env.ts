const KEYS = [
  "SUPABASEURL",
  "SUPABASEKEY",
  "FOURSQUARE_API_KEY",
  "YELP_API_KEY",
  "GEOAPIFY_API_KEY",
];

function readEnv(key: string): string | null {
  try {
    const value = (zuplo.env as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  } catch (error) {
    console.warn(`[test-env] Unable to read ${key}`, error);
  }
  if (typeof process !== "undefined" && process.env[key]) {
    return process.env[key] as string;
  }
  return null;
}

export default async function handler(): Promise<Response> {
  const result = Object.fromEntries(
    KEYS.map((key) => {
      const value = readEnv(key);
      if (!value) {
        return [key, null];
      }
      return [key, value.slice(0, 6)];
    })
  );

  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
