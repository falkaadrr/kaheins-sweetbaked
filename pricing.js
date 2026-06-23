import { PRODUCTS } from "./catalog.js";

// Error khusus biar bisa dibedain dari error server (dibalas 400, bukan 500)
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

// Validasi & normalisasi item dari frontend.
// Input: [{ id, qty }]  ->  Output: [{ product_id, product_name, unit_price, qty, line_total }]
export function buildLineItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ValidationError("Keranjang kosong.");
  }

  const lines = [];
  for (const item of rawItems) {
    const id = Number(item?.id);
    const qty = Number(item?.qty);

    const product = PRODUCTS[id];
    if (!product) {
      throw new ValidationError(`Produk dengan id ${item?.id} tidak ditemukan.`);
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new ValidationError(`Jumlah untuk "${product.name}" tidak valid.`);
    }

    lines.push({
      product_id: product.id,
      product_name: product.name,
      unit_price: product.price,
      qty,
      line_total: product.price * qty,
    });
  }
  return lines;
}

// Hitung subtotal dari line items (harga dari server, bukan frontend)
export function calcSubtotal(lines) {
  return lines.reduce((sum, l) => sum + l.line_total, 0);
}

// Hitung diskon dari satu baris voucher (dari database) terhadap subtotal.
// voucher: { code, type:'percent'|'fixed', value, min_order } | null
// Balikin angka diskon (Rp). Throw ValidationError kalau di bawah minimal belanja.
export function computeDiscount(voucher, subtotal) {
  if (!voucher) return 0;
  if (subtotal < voucher.min_order) {
    throw new ValidationError(
      `Minimal belanja Rp ${Number(voucher.min_order).toLocaleString("id-ID")} untuk pakai kode ini.`,
    );
  }
  const raw =
    voucher.type === "percent"
      ? Math.round((subtotal * voucher.value) / 100)
      : voucher.value;
  return Math.min(raw, subtotal); // diskon nggak boleh > subtotal
}
