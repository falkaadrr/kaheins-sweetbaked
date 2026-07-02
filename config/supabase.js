import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum di-set. Cek .env");
  process.exit(1);
}
export const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
export const PROOF_BUCKET = process.env.PROOF_BUCKET || "bukti-bayar";
export const MEDIA_BUCKET = process.env.MEDIA_BUCKET || "media";
