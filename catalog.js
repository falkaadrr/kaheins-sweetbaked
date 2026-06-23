// ============================================================
//  SUMBER KEBENARAN HARGA & VOUCHER  (server-side)
//  Frontend cuma kirim id produk + qty + kode voucher.
//  Harga TIDAK pernah diambil dari frontend (anti utak-atik).
//  ID & harga di sini WAJIB sama dengan products[] di index.html.
// ============================================================

export const PRODUCTS = {
  1: { id: 1, name: "Classic Original", price: 7000 },
  2: { id: 2, name: "Red Velvet Cheese", price: 7000 },
  3: { id: 3, name: "Blue Monstery", price: 7000 },
  4: { id: 4, name: "Scoopable Classic Cookie", price: 10000 },
  5: { id: 5, name: "Scoopable Red Velvet Cheese", price: 10000 },
  6: { id: 6, name: "Scoopable Blue Monstery", price: 10000 },
};

// type: "percent" (potongan %) | "fixed" (potongan Rp). minOrder = minimal belanja.
// CATATAN: voucher sekarang disimpan di database (tabel `vouchers`) dan dikelola
// lewat dashboard admin. Nilai awal di-seed di schema.sql.

// Status order yang valid + urutan logisnya
export const ORDER_STATUSES = [
  "pending", // baru dibuat, belum bayar
  "waiting_confirmation", // bukti sudah diupload, nunggu admin
  "paid", // pembayaran dikonfirmasi admin
  "processing", // lagi disiapkan
  "shipped", // sudah dikirim
  "done", // selesai
  "cancelled", // dibatalkan
];

// Status yang boleh di-set admin lewat dashboard
export const ADMIN_SETTABLE_STATUSES = [
  "paid",
  "processing",
  "shipped",
  "done",
  "cancelled",
];
