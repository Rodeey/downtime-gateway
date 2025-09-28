import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!supabase) {
    const supabaseUrl =
      process.env.SUPABASEURL ||
      process.env.SUPABASE_URL ||
      "";
    const supabaseKey =
      process.env.SUPABASEKEY ||
      process.env.SUPABASE_KEY ||
      "";

    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase env vars not set yet");
      throw new Error("Supabase env vars are missing");
    }

    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

export async function logRequest(row: any) {
  try {
    const client = getClient();
    await client.from("request_logs").insert([row]);
  } catch (err) {
    console.error("logRequest failed", err);
  }
}
