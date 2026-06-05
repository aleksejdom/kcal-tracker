import { createClient } from "@supabase/supabase-js";

// Strip any characters outside printable ASCII range (encoding artifacts from env var storage)
function cleanVar(v: string | undefined): string {
  return (v ?? "").replace(/[^\x21-\x7E]/g, "");
}

export const supabase = createClient(
  cleanVar(process.env.NEXT_PUBLIC_SUPABASE_URL),
  cleanVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
);
