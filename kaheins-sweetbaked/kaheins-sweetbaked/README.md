# Kaheins Sweetbaked — CMS + POS v2.1 🍪

Toko cookies + dashboard **gaya POS** dalam satu service (Express) dengan database
**Supabase (Postgres + Storage)**. Deploy ke Railway; toko & dashboard jalan dari
server yang sama. Storage Supabase gratis tanpa perlu kartu kredit.

## Alur pemesanan

buka web → lihat produk → keranjang → voucher (opsional) → form nama/alamat/HP →
transfer QRIS → **upload bukti → langsung masuk database**. Tombol WhatsApp opsional
(langsung buka chat admin, tanpa cari kontak).

## Modul

CRUD via dashboard: **Produk, Kategori, Banner, Promo, Voucher, Testimoni**. Plus
API: **Order** (nomor `KHS/YYYYMMDD/XXXX`, QRIS + bukti), **Customer** (otomatis),
Settings, Homepage CMS, Gallery, Media, Notifications, Audit log. Login admin **JWT**.

## Struktur

```
kaheins-sweetbaked/
├── server.js            # entry
├── config/supabase.js   # koneksi Supabase
├── middleware/          # auth (JWT), error
├── lib/                 # helpers, crud factory, pricing
├── routes/              # auth, products, orders, vouchers, cms, testimonials, misc
├── schema.sql           # semua tabel + seed
├── public/              # index.html (toko), admin.html (POS), images/
├── .env.example
└── railway.json
```

## Setup Supabase

1. Buat project di [supabase.com](https://supabase.com).
2. **SQL Editor** → tempel `schema.sql` → **Run**.
3. **Storage** → buat 2 bucket **Private**: `bukti-bayar` dan `media`.
4. **Project Settings → API** → catat `Project URL` + `service_role` key.

## Jalankan lokal

```bash
cp .env.example .env      # isi nilainya
npm install
npm run dev
```
Toko: `http://localhost:3000/` · Admin: `http://localhost:3000/admin.html`
(login pakai ADMIN_EMAIL/PASSWORD — akun admin dibuat otomatis saat start).

## Variabel .env

| Variable | Wajib | Keterangan |
|---|---|---|
| `SUPABASE_URL` | ✅ | URL project |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service_role key (rahasia) |
| `ADMIN_EMAIL` | ✅ | email login admin |
| `ADMIN_PASSWORD` | ✅ | password login admin |
| `JWT_SECRET` | ✅ | string acak untuk token |
| `PROOF_BUCKET` | – | default `bukti-bayar` |
| `MEDIA_BUCKET` | – | default `media` |
| `PORT` | – | diisi Railway otomatis |

## Deploy ke Railway

1. Push ke GitHub (`.env` tidak ikut).
2. Railway → Deploy from GitHub repo → isi **Variables** dari tabel di atas.
3. **Settings → Networking → Generate Domain**.

## Catatan

- Harga & voucher dihitung/divalidasi di server — frontend tak bisa memalsukan total.
- Kalau sebelumnya sempat pakai Firebase: sekarang balik ke Supabase karena Firebase
  Storage butuh upgrade Blaze (berbayar), sedangkan Supabase Storage gratis.
- UI dashboard: Pesanan (POS), Produk, Kategori, Banner, Promo, Voucher, Testimoni.
  Modul lain (media, homepage, settings, gallery, customers, notifications, audit)
  API-nya sudah jalan, UI bisa ditambah menyusul.
