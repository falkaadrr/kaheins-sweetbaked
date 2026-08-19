import express from "express";
import { supabase } from "../config/supabase.js";
import { wrap } from "../lib/helpers.js";
import { requireUser } from "../lib/authUser.js";

const router = express.Router();

// GET /api/account/orders — riwayat pesanan milik user yang login
router.get("/orders", requireUser, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_no, subtotal, discount, total, status, created_at, items:order_items(product_id, product_name, unit_price, qty, line_total)")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  res.json({ data: data || [] });
}));

// GET /api/account/me — info singkat user (buat cek sesi dari server)
router.get("/me", requireUser, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});

export default router;
