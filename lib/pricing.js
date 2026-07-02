import { supabase } from "../config/supabase.js";
import { ValidationError } from "./helpers.js";

async function fetchProducts(ids) {
  const { data, error } = await supabase
    .from("products").select("id, name, price, active, stock").in("id", ids);
  if (error) throw error;
  const map = {};
  for (const p of data) map[p.id] = p;
  return map;
}

export async function buildLineItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new ValidationError("Keranjang kosong.");
  const ids = rawItems.map((i) => i?.id).filter(Boolean);
  if (ids.length === 0) throw new ValidationError("Item tidak valid.");
  const map = await fetchProducts(ids);
  const lines = [];
  for (const item of rawItems) {
    const product = map[item?.id];
    const qty = Number(item?.qty);
    if (!product || product.active === false) throw new ValidationError("Produk tidak tersedia.");
    if (!Number.isInteger(qty) || qty < 1 || qty > 99)
      throw new ValidationError(`Jumlah untuk "${product.name}" tidak valid.`);
    if (product.stock !== null && product.stock !== undefined && qty > product.stock)
      throw new ValidationError(`Stok "${product.name}" tinggal ${product.stock}.`);
    lines.push({ product_id: product.id, product_name: product.name, unit_price: product.price, qty, line_total: product.price * qty });
  }
  return lines;
}
export function calcSubtotal(lines) { return lines.reduce((s, l) => s + l.line_total, 0); }
export function computeDiscount(voucher, subtotal) {
  if (!voucher) return 0;
  if (subtotal < voucher.min_order)
    throw new ValidationError(`Minimal belanja Rp ${Number(voucher.min_order).toLocaleString("id-ID")} untuk pakai kode ini.`);
  const raw = voucher.type === "percent" ? Math.round((subtotal * voucher.value) / 100) : voucher.value;
  return Math.min(raw, subtotal);
}
export async function getActiveVoucher(code) {
  if (!code) return null;
  const key = String(code).trim().toUpperCase();
  const { data } = await supabase.from("vouchers").select("*").eq("code", key).eq("active", true).maybeSingle();
  return data || null;
}
