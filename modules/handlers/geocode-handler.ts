export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const resp = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&apiKey=${process.env.GEOAPIFY_KEY}`
    );
    if (!resp.ok) {
      console.error("Geoapify geocode failed:", resp.statusText);
      return null;
    }
    const data = await resp.json();
    if (data.features?.length) {
      const [lng, lat] = data.features[0].geometry.coordinates;
      return { lat, lng };
    }
    return null;
  } catch (err) {
    console.error("Geoapify geocode error:", err);
    return null;
  }
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address") || "";
  if (!address) {
    return new Response(JSON.stringify({ error: "Missing ?address= query param" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const coords = await geocodeAddress(address);
  return new Response(JSON.stringify({ address, coords }), {
    headers: { "Content-Type": "application/json" },
  });
}

