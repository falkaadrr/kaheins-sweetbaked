import express from "express";
import multer from "multer";
import { supabase, UPLOAD_BUCKET } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap, ValidationError, audit } from "../lib/helpers.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith("image/") ? cb(null, true) : cb(new ValidationError("File harus gambar.")),
});

// POST /api/uploads/image (admin) — upload gambar ke bucket PUBLIK, balikin URL permanen
router.post("/image", requireAuth, upload.single("image"), wrap(async (req, res) => {
  if (!req.file) throw new ValidationError("File wajib diunggah.");
  const ext = (req.file.originalname.split(".").pop() || "jpg").toLowerCase();
  const path = `img/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage.from(UPLOAD_BUCKET)
    .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(path);
  await audit(req.user?.email, "upload", "uploads", path);
  res.status(201).json({ url: data.publicUrl });
}));

export default router;
