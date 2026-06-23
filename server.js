import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { supabase, PROOF_BUCKET } from "./supabase.js";
import {
  buildLineItems,
  calcSubtotal,
  computeDiscount,
  ValidationError,
} from "./pricing.js";
import { ADMIN_SETTABLE_STATUSES } from "./catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ---------- Middleware dasar ----------
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "*", // produksi: isi domain frontend kamu
  }),
);
// Sajikan frontend statis (public/index.html di "/", public/admin.html di "/admin.html")
app.use(express.static(path.join(__dirname, "public")));

// Upload bukti: simpan di memori, maks 5MB, hanya gambar
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new ValidationError("File harus berupa gambar."));
  },
});

// Guard untuk endpoint admin: butuh header x-admin-token
function requireAdmin(req, res, next) {
  const token = req.header("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Tidak diizinkan." });
  }
  next();
}

// ============================================================
//  ENDPOINT PUBLIK (dipakai frontend toko)
// ============================================================

// Cek server hidup (root "/" sekarang menyajikan halaman toko)
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "kaheins-sweetbaked" });
});

// Ambil voucher aktif dari database berdasarkan kode. Balikin row | null.
async function getActiveVoucher(code) {
  if (!code) return null;
  const key = String(code).trim().toUpperCase();
  const { data } = await supabase
    .from("vouchers")
    .select("*")
    .eq("code", key)
    .eq("active", true)
    .maybeSingle();
  return data || null;
}

// 1) Buat order baru — total & voucher dihitung ULANG di server
app.post("/api/orders", async (req, res, next) => {
  try {
    const { customer, items, voucher_code } = req.body || {};

    const name = String(customer?.name || "").trim();
    const address = String(customer?.address || "").trim();
    const phone = String(customer?.phone || "").trim();
    if (!name) throw new ValidationError("Nama pembeli wajib diisi.");
    if (!address) throw new ValidationError("Alamat pengiriman wajib diisi.");

    // Inti anti-curang: harga dari katalog server, voucher dari database
    const lines = buildLineItems(items);
    const subtotal = calcSubtotal(lines);

    let voucher = null;
    if (voucher_code) {
      voucher = await getActiveVoucher(voucher_code);
      if (!voucher) throw new ValidationError("Kode voucher tidak valid.");
    }
    const discount = computeDiscount(voucher, subtotal);
    const total = subtotal - discount;
    const code = voucher ? voucher.code : null;

    // Simpan order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_name: name,
        customer_phone: phone || null,
        customer_address: address,
        voucher_code: code,
        subtotal,
        discount,
        total,
        status: "pending",
      })
      .select()
      .single();
    if (orderErr) throw orderErr;

    // Simpan item-itemnya
    const itemRows = lines.map((l) => ({ ...l, order_id: order.id }));
    const { error: itemErr } = await supabase
      .from("order_items")
      .insert(itemRows);
    if (itemErr) throw itemErr;

    res.status(201).json({
      order_id: order.id,
      subtotal,
      discount,
      total,
      voucher_code: code,
      status: order.status,
    });
  } catch (err) {
    next(err);
  }
});

// 1b) Cek voucher (dipakai storefront buat preview diskon sebelum checkout)
app.post("/api/vouchers/check", async (req, res, next) => {
  try {
    const { code, subtotal } = req.body || {};
    const sub = Number(subtotal) || 0;
    const voucher = await getActiveVoucher(code);
    if (!voucher) throw new ValidationError("Kode voucher tidak valid.");
    const discount = computeDiscount(voucher, sub); // throw kalau di bawah minimal
    res.json({
      code: voucher.code,
      type: voucher.type,
      value: voucher.value,
      min_order: voucher.min_order,
      label: voucher.label,
      discount,
    });
  } catch (err) {
    next(err);
  }
});

// 2) Upload bukti pembayaran untuk sebuah order
app.post(
  "/api/orders/:id/proof",
  upload.single("proof"),
  async (req, res, next) => {
    try {
      const orderId = req.params.id;
      if (!req.file) throw new ValidationError("Bukti pembayaran wajib diunggah.");

      // Pastikan order ada & masih menunggu pembayaran
      const { data: order, error: findErr } = await supabase
        .from("orders")
        .select("id, status")
        .eq("id", orderId)
        .single();
      if (findErr || !order) throw new ValidationError("Order tidak ditemukan.");
      if (!["pending", "waiting_confirmation"].includes(order.status)) {
        throw new ValidationError(
          `Order ini sudah berstatus "${order.status}", tidak bisa upload bukti lagi.`,
        );
      }

      // Upload ke Supabase Storage (bucket privat)
      const ext = (req.file.originalname.split(".").pop() || "jpg").toLowerCase();
      const objectPath = `${orderId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(PROOF_BUCKET)
        .upload(objectPath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });
      if (upErr) throw upErr;

      // Update order: simpan path + ubah status
      const { error: updErr } = await supabase
        .from("orders")
        .update({
          proof_path: objectPath,
          status: "waiting_confirmation",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (updErr) throw updErr;

      res.json({ ok: true, status: "waiting_confirmation" });
    } catch (err) {
      next(err);
    }
  },
);

// 3) Cek status order (buat halaman "lacak pesanan" customer, opsional)
app.get("/api/orders/:id", async (req, res, next) => {
  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, subtotal, discount, total, created_at")
      .eq("id", req.params.id)
      .single();
    if (error || !order) throw new ValidationError("Order tidak ditemukan.");
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// ============================================================
//  ENDPOINT ADMIN (butuh header x-admin-token)
// ============================================================

// Daftar order + item + link bukti (signed URL, berlaku 1 jam)
app.get("/api/admin/orders", requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status; // filter opsional
    let query = supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status) query = query.eq("status", status);

    const { data: orders, error } = await query;
    if (error) throw error;

    // Bikin signed URL buat tiap bukti
    for (const o of orders) {
      if (o.proof_path) {
        const { data: signed } = await supabase.storage
          .from(PROOF_BUCKET)
          .createSignedUrl(o.proof_path, 60 * 60);
        o.proof_url = signed?.signedUrl || null;
      } else {
        o.proof_url = null;
      }
    }

    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// Ubah status order (konfirmasi bayar, tandai dikirim, dst)
app.patch("/api/admin/orders/:id", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!ADMIN_SETTABLE_STATUSES.includes(status)) {
      throw new ValidationError(
        `Status "${status}" tidak valid. Pilih: ${ADMIN_SETTABLE_STATUSES.join(", ")}.`,
      );
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error || !data) throw new ValidationError("Order tidak ditemukan.");

    res.json({ ok: true, order: data });
  } catch (err) {
    next(err);
  }
});

// ---------- Kelola voucher (admin) ----------

// Daftar semua voucher
app.get("/api/admin/vouchers", requireAdmin, async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("vouchers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ vouchers: data });
  } catch (err) {
    next(err);
  }
});

// Tambah voucher baru
app.post("/api/admin/vouchers", requireAdmin, async (req, res, next) => {
  try {
    const b = req.body || {};
    const code = String(b.code || "").trim().toUpperCase();
    const type = b.type;
    const value = Number(b.value);
    const minOrder = Number(b.min_order) || 0;

    if (!code) throw new ValidationError("Kode voucher wajib diisi.");
    if (!["percent", "fixed"].includes(type)) {
      throw new ValidationError("Tipe harus 'percent' atau 'fixed'.");
    }
    if (!Number.isFinite(value) || value <= 0) {
      throw new ValidationError("Nilai voucher harus angka lebih dari 0.");
    }
    if (type === "percent" && value > 100) {
      throw new ValidationError("Diskon persen maksimal 100.");
    }

    const { data, error } = await supabase
      .from("vouchers")
      .insert({
        code,
        type,
        value: Math.round(value),
        min_order: Math.round(minOrder),
        label: b.label ? String(b.label).trim() : null,
        active: b.active === false ? false : true,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new ValidationError("Kode voucher itu sudah ada.");
      }
      throw error;
    }
    res.status(201).json({ ok: true, voucher: data });
  } catch (err) {
    next(err);
  }
});

// Ubah voucher (nilai, minimal, label, aktif/nonaktif)
app.patch("/api/admin/vouchers/:code", requireAdmin, async (req, res, next) => {
  try {
    const b = req.body || {};
    const patch = {};
    if (b.type !== undefined) {
      if (!["percent", "fixed"].includes(b.type)) {
        throw new ValidationError("Tipe harus 'percent' atau 'fixed'.");
      }
      patch.type = b.type;
    }
    if (b.value !== undefined) {
      const v = Number(b.value);
      if (!Number.isFinite(v) || v <= 0) {
        throw new ValidationError("Nilai voucher harus angka lebih dari 0.");
      }
      patch.value = Math.round(v);
    }
    if (b.min_order !== undefined) patch.min_order = Math.round(Number(b.min_order) || 0);
    if (b.label !== undefined) patch.label = b.label ? String(b.label).trim() : null;
    if (b.active !== undefined) patch.active = !!b.active;

    if (Object.keys(patch).length === 0) {
      throw new ValidationError("Tidak ada perubahan.");
    }

    const code = String(req.params.code).toUpperCase();
    const { data, error } = await supabase
      .from("vouchers")
      .update(patch)
      .eq("code", code)
      .select()
      .single();
    if (error || !data) throw new ValidationError("Voucher tidak ditemukan.");
    res.json({ ok: true, voucher: data });
  } catch (err) {
    next(err);
  }
});

// Hapus voucher
app.delete("/api/admin/vouchers/:code", requireAdmin, async (req, res, next) => {
  try {
    const code = String(req.params.code).toUpperCase();
    const { error } = await supabase.from("vouchers").delete().eq("code", code);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
app.use((err, _req, res, _next) => {
  if (err instanceof ValidationError || err?.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Ukuran file maksimal 5MB." });
  }
  console.error("Server error:", err);
  res.status(500).json({ error: "Terjadi kesalahan di server." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🍪 Kaheins Sweetbaked jalan di port ${PORT}`);
  console.log(`   Toko : http://localhost:${PORT}/`);
  console.log(`   Admin: http://localhost:${PORT}/admin.html`);
});
