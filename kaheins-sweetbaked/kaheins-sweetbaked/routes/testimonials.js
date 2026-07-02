import express from "express";
import { supabase } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap, ValidationError, notify, audit } from "../lib/helpers.js";

function makeRouter(table, withProduct) {
  const router = express.Router();
  router.get("/", wrap(async (req, res) => {
    let q = supabase.from(table).select("*").eq("approved", true).order("created_at", { ascending: false });
    if (withProduct && req.query.product_id) q = q.eq("product_id", req.query.product_id);
    const { data, error } = await q; if (error) throw error;
    res.json({ data });
  }));
  router.post("/", wrap(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const rating = Number(req.body?.rating) || 5;
    const message = String(req.body?.message || "").trim();
    if (!name) throw new ValidationError("Nama wajib diisi.");
    if (rating < 1 || rating > 5) throw new ValidationError("Rating 1-5.");
    const row = { name, rating, message, approved: false };
    if (withProduct && req.body?.product_id) row.product_id = req.body.product_id;
    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) throw error;
    await notify("review", "Review baru", `${name} (${rating}★)`);
    res.status(201).json({ data });
  }));
  router.get("/admin", requireAuth, wrap(async (_req, res) => {
    const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
    if (error) throw error; res.json({ data });
  }));
  router.patch("/:id", requireAuth, wrap(async (req, res) => {
    if (req.body?.approved === undefined) throw new ValidationError("Tidak ada perubahan.");
    const { data, error } = await supabase.from(table).update({ approved: !!req.body.approved }).eq("id", req.params.id).select().single();
    if (error || !data) throw new ValidationError("Tidak ditemukan.");
    await audit(req.user?.email, "update", table, req.params.id);
    res.json({ data });
  }));
  router.delete("/:id", requireAuth, wrap(async (req, res) => {
    const { error } = await supabase.from(table).delete().eq("id", req.params.id);
    if (error) throw error;
    await audit(req.user?.email, "delete", table, req.params.id);
    res.json({ ok: true });
  }));
  return router;
}
export const testimonialsRouter = makeRouter("testimonials", false);
export const reviewsRouter = makeRouter("reviews", true);
