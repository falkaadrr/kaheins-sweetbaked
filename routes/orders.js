import express from "express";
import multer from "multer";
import { supabase, PROOF_BUCKET } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap, ValidationError, notify, genOrderNo, signedUrl } from "../lib/helpers.js";
import { buildLineItems, calcSubtotal, computeDiscount, getActiveVoucher } from "../lib/pricing.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => file.mimetype.startsWith("image/") ? cb(null, true) : cb(new ValidationError("File harus gambar.")),
});

async function upsertCustomer({ name, phone, address, total }) {
  if (!phone) return null;
  const { data: existing } = await supabase.from("customers").select("*").eq("phone", phone).maybeSingle();
  if (existing) {
    await supabase.from("customers").update({
      name, address, orders_count: existing.orders_count + 1,
      total_spent: existing.total_spent + total, last_order_at: new Date().toISOString(),
    }).eq("id", existing.id);
    return existing.id;
  }
  const { data } = await supabase.from("customers").insert({
    name, phone, address, orders_count: 1, total_spent: total, last_order_at: new Date().toISOString(),
  }).select().single();
  return data?.id || null;
}

// POST /api/orders (publik)
router.post("/", wrap(async (req, res) => {
  const { customer, items, voucher_code, is_preorder } = req.body || {};
  const name = String(customer?.name || "").trim();
  const address = String(customer?.address || "").trim();
  const phone = String(customer?.phone || "").trim();
  if (!name) throw new ValidationError("Nama pembeli wajib diisi.");
  if (!address) throw new ValidationError("Alamat pengiriman wajib diisi.");

  const lines = await buildLineItems(items);
  const subtotal = calcSubtotal(lines);
  let voucher = null;
  if (voucher_code) { voucher = await getActiveVoucher(voucher_code); if (!voucher) throw new ValidationError("Kode voucher tidak valid."); }
  const discount = computeDiscount(voucher, subtotal);
  const total = subtotal - discount;
  const customerId = await upsertCustomer({ name, phone, address, total });

  const { data: order, error } = await supabase.from("orders").insert({
    order_no: genOrderNo(), customer_id: customerId, customer_name: name,
    customer_phone: phone || null, customer_address: address, is_preorder: !!is_preorder,
    voucher_code: voucher ? voucher.code : null, subtotal, discount, total, status: "pending",
  }).select().single();
  if (error) throw error;

  const { error: itemErr } = await supabase.from("order_items").insert(lines.map((l) => ({ ...l, order_id: order.id })));
  if (itemErr) throw itemErr;
  await notify("order", "Pesanan baru", `${name} — Rp ${total.toLocaleString("id-ID")}`);
  res.status(201).json({ order_id: order.id, order_no: order.order_no, subtotal, discount, total, voucher_code: order.voucher_code, status: order.status });
}));

// POST /api/orders/vouchers/check (publik)
router.post("/vouchers/check", wrap(async (req, res) => {
  const { code, subtotal } = req.body || {};
  const v = await getActiveVoucher(code);
  if (!v) throw new ValidationError("Kode voucher tidak valid.");
  const discount = computeDiscount(v, Number(subtotal) || 0);
  res.json({ code: v.code, type: v.type, value: v.value, min_order: v.min_order, max_discount: v.max_discount, label: v.label, discount });
}));

// POST /api/orders/:id/proof (publik)
router.post("/:id/proof", upload.single("proof"), wrap(async (req, res) => {
  const orderId = req.params.id;
  if (!req.file) throw new ValidationError("Bukti pembayaran wajib diunggah.");
  const { data: order } = await supabase.from("orders").select("id, status").eq("id", orderId).maybeSingle();
  if (!order) throw new ValidationError("Order tidak ditemukan.");
  if (!["pending", "waiting_confirmation"].includes(order.status)) throw new ValidationError(`Order sudah berstatus "${order.status}".`);
  const ext = (req.file.originalname.split(".").pop() || "jpg").toLowerCase();
  const objectPath = `${orderId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(PROOF_BUCKET).upload(objectPath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (upErr) throw upErr;
  await supabase.from("orders").update({ proof_path: objectPath, status: "waiting_confirmation", updated_at: new Date().toISOString() }).eq("id", orderId);
  res.json({ ok: true, status: "waiting_confirmation" });
}));

// GET /api/orders/:id (publik)
router.get("/:id", wrap(async (req, res) => {
  const { data, error } = await supabase.from("orders").select("id, order_no, status, subtotal, discount, total, created_at").eq("id", req.params.id).single();
  if (error || !data) throw new ValidationError("Order tidak ditemukan.");
  res.json({ data });
}));

// ---------- ADMIN ----------
router.get("/admin/list", requireAuth, wrap(async (req, res) => {
  let q = supabase.from("orders").select("*, items:order_items(*)").order("created_at", { ascending: false }).limit(300);
  if (req.query.status) q = q.eq("status", req.query.status);
  const { data: orders, error } = await q;
  if (error) throw error;
  for (const o of orders) o.proof_url = o.proof_path ? await signedUrl(o.proof_path) : null;
  res.json({ data: orders });
}));

router.patch("/admin/:id", requireAuth, wrap(async (req, res) => {
  const allowed = ["paid", "processing", "shipped", "done", "cancelled"];
  const { status } = req.body || {};
  if (!allowed.includes(status)) throw new ValidationError("Status tidak valid.");
  const { data, error } = await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", req.params.id).select().single();
  if (error || !data) throw new ValidationError("Order tidak ditemukan.");
  res.json({ data });
}));

// POST /api/orders/admin/manual (admin) — input order offline / walk-in di kasir
router.post("/admin/manual", requireAuth, wrap(async (req, res) => {
  const { customer, items, voucher_code, is_preorder, note } = req.body || {};
  const name = String(customer?.name || "").trim();
  if (!name) throw new ValidationError("Nama pembeli wajib diisi.");
  const phone = String(customer?.phone || "").trim();
  // Alamat opsional untuk order offline — default penanda pembelian langsung di toko
  const address = String(customer?.address || "").trim() || "Pembelian di toko (offline)";

  const allowedStatus = ["pending", "paid", "done"];
  const status = allowedStatus.includes(req.body?.status) ? req.body.status : "paid";

  const lines = await buildLineItems(items);
  const subtotal = calcSubtotal(lines);
  let voucher = null;
  if (voucher_code) { voucher = await getActiveVoucher(voucher_code); if (!voucher) throw new ValidationError("Kode voucher tidak valid."); }
  const discount = computeDiscount(voucher, subtotal);
  const total = subtotal - discount;
  const customerId = await upsertCustomer({ name, phone, address, total });

  const { data: order, error } = await supabase.from("orders").insert({
    order_no: genOrderNo(), customer_id: customerId, customer_name: name,
    customer_phone: phone || null, customer_address: address, is_preorder: !!is_preorder,
    voucher_code: voucher ? voucher.code : null, subtotal, discount, total, status,
    note: note ? String(note).trim() : null,
  }).select().single();
  if (error) throw error;

  const { error: itemErr } = await supabase.from("order_items").insert(lines.map((l) => ({ ...l, order_id: order.id })));
  if (itemErr) throw itemErr;
  await notify("order", "Order manual dibuat", `${name} — Rp ${total.toLocaleString("id-ID")} (${status})`);
  res.status(201).json({ order_id: order.id, order_no: order.order_no, subtotal, discount, total, status });
}));

// POST /api/orders/admin/:id/proof (admin) — upload bukti bayar atas nama customer
// (mis. customer kirim bukti via WhatsApp lalu admin unggah di CMS)
router.post("/admin/:id/proof", requireAuth, upload.single("proof"), wrap(async (req, res) => {
  const orderId = req.params.id;
  if (!req.file) throw new ValidationError("Bukti pembayaran wajib diunggah.");
  const { data: order } = await supabase.from("orders").select("id, status").eq("id", orderId).maybeSingle();
  if (!order) throw new ValidationError("Order tidak ditemukan.");
  const ext = (req.file.originalname.split(".").pop() || "jpg").toLowerCase();
  const objectPath = `${orderId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(PROOF_BUCKET).upload(objectPath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (upErr) throw upErr;
  // Default: sekaligus tandai Lunas. Kirim mark_paid=false untuk hanya menyimpan bukti tanpa ubah status.
  const markPaid = String(req.body?.mark_paid ?? "true") !== "false";
  const patch = { proof_path: objectPath, updated_at: new Date().toISOString() };
  if (markPaid) patch.status = "paid";
  await supabase.from("orders").update(patch).eq("id", orderId);
  const url = await signedUrl(objectPath);
  res.json({ ok: true, proof_url: url, status: patch.status || order.status });
}));

export default router;
