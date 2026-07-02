import express from "express";
import { supabase } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap, ValidationError, slugify, audit } from "../lib/helpers.js";

const router = express.Router();
const FIELDS = ["name","slug","category_id","price","description","image_url","emoji","stock","is_preorder","preorder_ready_date","active","featured","sort_order"];
const pick = (b) => { const o = {}; for (const k of FIELDS) if (b[k] !== undefined) o[k] = b[k]; return o; };
const withCat = (rows) => rows.map((p) => ({ ...p, category_name: p.categories?.name || null }));

// GET /api/products (publik)
router.get("/", wrap(async (req, res) => {
  let q = supabase.from("products").select("*, categories(name, slug)").order("sort_order", { ascending: true });
  if (req.query.all !== "1") q = q.eq("active", true);
  if (req.query.category) q = q.eq("category_id", req.query.category);
  const { data, error } = await q;
  if (error) throw error;
  res.json({ data: withCat(data) });
}));
// GET /api/products/admin
router.get("/admin", requireAuth, wrap(async (_req, res) => {
  const { data, error } = await supabase.from("products").select("*, categories(name, slug)").order("sort_order", { ascending: true });
  if (error) throw error;
  res.json({ data: withCat(data) });
}));
// GET /api/products/:id
router.get("/:id", wrap(async (req, res) => {
  const { data, error } = await supabase.from("products").select("*").eq("id", req.params.id).single();
  if (error || !data) throw new ValidationError("Produk tidak ditemukan.");
  res.json({ data });
}));
// POST
router.post("/", requireAuth, wrap(async (req, res) => {
  const body = pick(req.body || {});
  if (!body.name) throw new ValidationError("Nama produk wajib diisi.");
  if (body.price === undefined || Number(body.price) < 0) throw new ValidationError("Harga tidak valid.");
  body.price = Math.round(Number(body.price));
  if (body.stock !== undefined && body.stock !== null && body.stock !== "") body.stock = Math.round(Number(body.stock));
  if (!body.slug) body.slug = slugify(body.name);
  const { data, error } = await supabase.from("products").insert(body).select().single();
  if (error) throw error;
  await audit(req.user?.email, "create", "products", data.id);
  res.status(201).json({ data });
}));
// PATCH
router.patch("/:id", requireAuth, wrap(async (req, res) => {
  const body = pick(req.body || {});
  if (body.price !== undefined) body.price = Math.round(Number(body.price));
  if (body.stock !== undefined && body.stock !== null && body.stock !== "") body.stock = Math.round(Number(body.stock));
  if (Object.keys(body).length === 0) throw new ValidationError("Tidak ada perubahan.");
  const { data, error } = await supabase.from("products").update(body).eq("id", req.params.id).select().single();
  if (error || !data) throw new ValidationError("Produk tidak ditemukan.");
  await audit(req.user?.email, "update", "products", req.params.id);
  res.json({ data });
}));
// DELETE
router.delete("/:id", requireAuth, wrap(async (req, res) => {
  const { error } = await supabase.from("products").delete().eq("id", req.params.id);
  if (error) throw error;
  await audit(req.user?.email, "delete", "products", req.params.id);
  res.json({ ok: true });
}));

export default router;
