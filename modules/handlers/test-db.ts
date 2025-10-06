import { supabase } from "../logic/supabase";

export default async function handler(request: Request) {
  const { error } = await supabase
    .from("request_logs")
    .insert([
      {
        lat: 42.33,
        lng: -83.04,
        radius_m: 1000,
        categories: ["test"],
        provider_used: "test-db"
      }
    ]);

  if (error) {
    console.error("Supabase insert error:", error);
    return new Response(JSON.stringify({ ok: false, error }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
