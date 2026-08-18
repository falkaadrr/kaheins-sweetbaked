import express from "express";
import multer from "multer";
import { supabase, PROOF_BUCKET } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap, ValidationError, notify, signedUrl } from "../lib/helpers.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // Vercel batasin body serverless ~4.5MB
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new ValidationError("Bukti bayar harus berupa gambar (JPG/PNG).")),
});

// Nomor pendaftaran: KHS-LOMBA/YYYYMMDD/XXXX
function genRegNo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `KHS-LOMBA/${ymd}/${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// ============================================================
// POST /api/lomba/register  (publik)
// Satu langkah: kirim data peserta + bukti bayar sekaligus.
// ============================================================
router.post("/register", upload.single("proof"), wrap(async (req, res) => {
  const name = (req.body.name || "").trim();
  const whatsapp = (req.body.whatsapp || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const city = (req.body.city || "").trim();

  // Validasi
  if (!name) throw new ValidationError("Nama wajib diisi.");
  if (!whatsapp || whatsapp.replace(/\D/g, "").length < 8)
    throw new ValidationError("No. WhatsApp tidak valid.");
  if (!isEmail(email)) throw new ValidationError("Email tidak valid.");
  if (!city) throw new ValidationError("Domisili/kota wajib diisi.");
  if (!req.file) throw new ValidationError("Bukti pembayaran wajib diunggah.");

  const reg_no = genRegNo();

  // Upload bukti bayar ke bucket privat (bukti-bayar)
  const ext = (req.file.originalname.split(".").pop() || "jpg").toLowerCase();
  const proof_path = `lomba/${reg_no.replace(/\//g, "-")}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(proof_path, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (upErr) throw upErr;

  // Simpan pendaftaran
  const { error: insErr } = await supabase.from("lomba_registrations").insert({
    reg_no, name, whatsapp, email, city, proof_path, status: "pending",
  });
  if (insErr) throw insErr;

  // Notif ke admin (muncul di dashboard)
  await notify("lomba", "Pendaftar Lomba Baru", `${name} (${city}) — ${reg_no}`);

  res.status(201).json({ ok: true, reg_no });
}));

// ============================================================
// GET /api/lomba/admin/list  (admin) — daftar pendaftar + link bukti
// ============================================================
router.get("/admin/list", requireAuth, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from("lomba_registrations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  for (const r of data) r.proof_url = r.proof_path ? await signedUrl(r.proof_path) : null;
  res.json(data);
}));

// PATCH /api/lomba/admin/:id  (admin) — ubah status (verified/rejected)
router.patch("/admin/:id", requireAuth, wrap(async (req, res) => {
  const status = (req.body.status || "").trim();
  if (!["pending", "verified", "rejected"].includes(status))
    throw new ValidationError("Status tidak valid.");
  const { error } = await supabase
    .from("lomba_registrations")
    .update({ status })
    .eq("id", req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

export default router;
