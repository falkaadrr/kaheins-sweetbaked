import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  // Di serverless jangan pakai process.exit (bikin function crash tanpa pesan jelas).
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum di-set. Set di Environment Variables Vercel (atau .env untuk lokal).");
}
export const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
export const PROOF_BUCKET = process.env.PROOF_BUCKET || "bukti-bayar";
export const MEDIA_BUCKET = process.env.MEDIA_BUCKET || "media";
// Bucket PUBLIK untuk gambar yang tampil di toko (produk/banner/promo)
export const UPLOAD_BUCKET = process.env.UPLOAD_BUCKET || "uploads";
