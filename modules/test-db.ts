import { createClient } from "@supabase/supabase-js";
import { environment } from "@zuplo/runtime"; 

const SUPABASEURL = environment.SUPABASEURL;   
const SUPABASEKEY = environment.SUPABASEKEY;   

const supabase = createClient(SUPABASEURL, SUPABASEKEY);

export default async function handler(request: Request) {
  const { data, error } = await supabase.from("places").select("id, name").limit(1);

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ success: true, sample: data }), {
    headers: { "Content-Type": "application/json" }
  });
}
