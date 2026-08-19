import { supabase } from "../config/supabase.js";

// Ambil user Supabase dari header Authorization: Bearer <access_token>.
// Return user object, atau null kalau tidak ada / token tidak valid.
export async function getUserFromReq(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) return null;
    return data?.user || null;
  } catch {
    return null;
  }
}

// Middleware: wajib login sebagai customer (Supabase Auth).
export async function requireUser(req, res, next) {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ error: "Silakan login dulu." });
  req.user = user;
  next();
}
