// ============================================================
//  Konfigurasi Kaheins Sweetbaked (frontend)
// ============================================================
// BACKEND_URL: biarkan kosong "" kalau frontend & backend satu domain (Vercel).
window.BACKEND_URL = "";

// --- Akun Customer (Supabase Auth) ---
// Ambil dari Supabase: Project Settings -> API
//   SUPABASE_URL      = Project URL (mis. https://xxxx.supabase.co)
//   SUPABASE_ANON_KEY = anon public key (BUKAN service_role!)
// anon key AMAN ditaruh di frontend (memang untuk publik).
window.SUPABASE_URL = "https://eubeggcdvldbqaayykyv.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_cdwKAwWgmzXMcpxgxfZttg_8rUNtvfV";
