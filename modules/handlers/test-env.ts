import { environment } from "@zuplo/runtime";

export default async function handler() {
  return new Response(
    JSON.stringify(
      {
        SUPABASEURL: environment.SUPABASEURL || null,
        SUPABASEKEY_first6: environment.SUPABASEKEY?.slice(0, 6) || null,
        FOURSQUARE_API_KEY_first6: environment.FOURSQUARE_API_KEY?.slice(0, 6) || null,
      },
      null,
      2
    ),
    { headers: { "Content-Type": "application/json" } }
  );
}
