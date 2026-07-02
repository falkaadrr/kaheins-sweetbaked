import express from "express";
import multer from "multer";
import { supabase, MEDIA_BUCKET } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap, ValidationError, audit, signedUrl } from "../lib/helpers.js";

const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => file.mimetype.startsWith("image/") ? cb(null, true) : cb(new ValidationError("File harus gambar.")),
});

// SETTINGS
export const settingsRouter = express.Router();
settingsRouter.get("/:key", wrap(async (req, res) => {
  const { data } = await supabase.from("settings").select("*").eq("key", req.params.key).maybeSingle();
  res.json({ data: data || { key: req.params.key, value: {} } });
}));
settingsRouter.put("/:key", requireAuth, wrap(async (req, res) => {
  const { data, error } = await supabase.from("settings").upsert({ key: req.params.key, value: req.body?.value ?? {}, updated_at: new Date().toISOString() }).select().single();
  if (error) throw error;
  await audit(req.user?.email, "update", "settings", req.params.key);
  res.json({ data });
}));

// HOMEPAGE
export const homepageRouter = express.Router();
homepageRouter.get("/", wrap(async (_req, res) => {
  const { data, error } = await supabase.from("homepage_sections").select("*");
  if (error) throw error; res.json({ data });
}));
homepageRouter.put("/:key", requireAuth, wrap(async (req, res) => {
  const { data, error } = await supabase.from("homepage_sections").upsert({ key: req.params.key, data: req.body?.data ?? {}, updated_at: new Date().toISOString() }).select().single();
  if (error) throw error;
  await audit(req.user?.email, "update", "homepage_sections", req.params.key);
  res.json({ data });
}));

// CUSTOMERS (read-only)
export const customersRouter = express.Router();
customersRouter.get("/", requireAuth, wrap(async (_req, res) => {
  const { data, error } = await supabase.from("customers").select("*").order("last_order_at", { ascending: false });
  if (error) throw error; res.json({ data });
}));

// NOTIFICATIONS
export const notificationsRouter = express.Router();
notificationsRouter.get("/", requireAuth, wrap(async (_req, res) => {
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) throw error; res.json({ data });
}));
notificationsRouter.patch("/:id/read", requireAuth, wrap(async (req, res) => {
  await supabase.from("notifications").update({ read: true }).eq("id", req.params.id);
  res.json({ ok: true });
}));

// MEDIA
export const mediaRouter = express.Router();
mediaRouter.get("/", requireAuth, wrap(async (_req, res) => {
  const { data, error } = await supabase.from("media").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  for (const m of data) m.signed_url = await signedUrl(m.path, MEDIA_BUCKET);
  res.json({ data });
}));
mediaRouter.post("/", requireAuth, upload.single("file"), wrap(async (req, res) => {
  if (!req.file) throw new ValidationError("File wajib diunggah.");
  const ext = (req.file.originalname.split(".").pop() || "jpg").toLowerCase();
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(path, req.file.buffer, { contentType: req.file.mimetype });
  if (upErr) throw upErr;
  const { data, error } = await supabase.from("media").insert({ path, mime: req.file.mimetype, size: req.file.size }).select().single();
  if (error) throw error;
  await audit(req.user?.email, "create", "media", data.id);
  res.status(201).json({ data: { ...data, signed_url: await signedUrl(path, MEDIA_BUCKET) } });
}));
mediaRouter.delete("/:id", requireAuth, wrap(async (req, res) => {
  const { data: m } = await supabase.from("media").select("*").eq("id", req.params.id).maybeSingle();
  if (m?.path) await supabase.storage.from(MEDIA_BUCKET).remove([m.path]);
  await supabase.from("media").delete().eq("id", req.params.id);
  res.json({ ok: true });
}));

// AUDIT
export const auditRouter = express.Router();
auditRouter.get("/", requireAuth, wrap(async (_req, res) => {
  const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw error; res.json({ data });
}));
