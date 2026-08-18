import express from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../config/supabase.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { wrap, ValidationError } from "../lib/helpers.js";

const router = express.Router();

export async function ensureAdminSeed() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) { console.warn("⚠️  ADMIN_EMAIL/PASSWORD belum di-set — admin awal tidak dibuat."); return; }
  const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  const password_hash = bcrypt.hashSync(password, 10);
  if (existing) await supabase.from("users").update({ password_hash }).eq("id", existing.id);
  else { await supabase.from("users").insert({ email, password_hash, name: "Admin", role: "admin" }); console.log(`✅ Admin awal dibuat: ${email}`); }
}

router.post("/login", wrap(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) throw new ValidationError("Email dan password wajib diisi.");
  const { data: user } = await supabase.from("users").select("*").eq("email", email).maybeSingle();
  if (!user || !bcrypt.compareSync(password, user.password_hash)) throw new ValidationError("Email atau password salah.");
  res.json({ token: signToken(user), user: { email: user.email, name: user.name, role: user.role } });
}));
router.get("/me", requireAuth, (req, res) =>
  res.json({ user: { email: req.user.email, name: req.user.name, role: req.user.role } }));

export default router;
