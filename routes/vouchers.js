import express from "express";
import { supabase } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap, ValidationError, audit } from "../lib/helpers.js";
import { getActiveVoucher, computeDiscount } from "../lib/pricing.js";

const router = express.Router();

router.post("/check", wrap(async (req, res) => {
  const { code, subtotal } = req.body || {};
  const v = await getActiveVoucher(code);
  if (!v) throw new ValidationError("Kode voucher tidak valid.");
  const discount = computeDiscount(v, Number(subtotal) || 0);
  res.json({ code: v.code, type: v.type, value: v.value, min_order: v.min_order, label: v.label, discount });
}));
router.get("/", requireAuth, wrap(async (_req, res) => {
  const { data, error } = await supabase.from("vouchers").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  res.json({ data });
}));
router.post("/", requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const code = String(b.code || "").trim().toUpperCase();
  const value = Number(b.value);
  if (!code) throw new ValidationError("Kode wajib diisi.");
  if (!["percent", "fixed"].includes(b.type)) throw new ValidationError("Tipe harus percent / fixed.");
  if (!Number.isFinite(value) || value <= 0) throw new ValidationError("Nilai harus > 0.");
  if (b.type === "percent" && value > 100) throw new ValidationError("Persen maksimal 100.");
  const { data, error } = await supabase.from("vouchers").insert({
    code, type: b.type, value: Math.round(value), min_order: Math.round(Number(b.min_order) || 0),
    label: b.label ? String(b.label).trim() : null, active: b.active === false ? false : true,
  }).select().single();
  if (error) throw error;
  await audit(req.user?.email, "create", "vouchers", code);
  res.status(201).json({ data });
}));
router.patch("/:code", requireAuth, wrap(async (req, res) => {
  const b = req.body || {}; const patch = {};
  if (b.type !== undefined) { if (!["percent", "fixed"].includes(b.type)) throw new ValidationError("Tipe harus percent / fixed."); patch.type = b.type; }
  if (b.value !== undefined) { const v = Number(b.value); if (!Number.isFinite(v) || v <= 0) throw new ValidationError("Nilai harus > 0."); patch.value = Math.round(v); }
  if (b.min_order !== undefined) patch.min_order = Math.round(Number(b.min_order) || 0);
  if (b.label !== undefined) patch.label = b.label ? String(b.label).trim() : null;
  if (b.active !== undefined) patch.active = !!b.active;
  if (Object.keys(patch).length === 0) throw new ValidationError("Tidak ada perubahan.");
  const { data, error } = await supabase.from("vouchers").update(patch).eq("code", String(req.params.code).toUpperCase()).select().single();
  if (error || !data) throw new ValidationError("Voucher tidak ditemukan.");
  await audit(req.user?.email, "update", "vouchers", req.params.code);
  res.json({ data });
}));
router.delete("/:code", requireAuth, wrap(async (req, res) => {
  const { error } = await supabase.from("vouchers").delete().eq("code", String(req.params.code).toUpperCase());
  if (error) throw error;
  await audit(req.user?.email, "delete", "vouchers", req.params.code);
  res.json({ ok: true });
}));

export default router;
