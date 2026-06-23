# Kaheins Sweetbaked 🍪 — satu service (Railway)

Frontend (website toko) dan backend (API) jalan dari **satu server Express yang
sama**, di-deploy ke **satu service Railway**. Express menyajikan halaman toko
sekaligus melayani API — jadi cuma satu URL dan **tanpa pusing CORS**.

```
kaheins-sweetbaked/
├── package.json          # proyek Node (di sini npm dijalankan)
├── server.js             # entry point: serve frontend + API
├── catalog.js            # harga produk + status order
├── pricing.js            # hitung total + validasi voucher
├── supabase.js           # koneksi Supabase
├── railway.json          # konfigurasi deploy Railway
├── schema.sql            # skema database Supabase
├── .env.example          # contoh konfigurasi
└── public/               # SATU-SATUNYA folder yang dibuka ke browser
    ├── index.html        # halaman toko        -> di URL "/"
    ├── admin.html        # dashboard admin     -> di URL "/admin.html"
    └── images/           # taruh gambar produk + qris.png di sini
```

> Catatan: `public/` sengaja dipisah karena hanya isi folder itulah yang
> disajikan ke internet. Kode server (`server.js` dll) & `.env` ada di luar
> `public/` supaya tidak ikut terbuka ke publik.

## Cara kerja

- `GET /` → halaman toko (`public/index.html`)
- `GET /admin.html` → dashboard admin (kelola order, **voucher**, export Excel/PDF)
- `GET /api/health` → cek server hidup
- `POST /api/orders` → buat order (total & voucher dihitung di server)
- `POST /api/orders/:id/proof` → upload bukti bayar ke Supabase Storage
- `POST /api/vouchers/check` → cek voucher (dipakai storefront buat preview diskon)
- `GET/PATCH /api/admin/orders` → kelola order (butuh `x-admin-token`)
- `GET/POST/PATCH/DELETE /api/admin/vouchers` → kelola voucher (butuh `x-admin-token`)

Voucher disimpan di tabel `vouchers` (Supabase) dan diatur lewat tab **🎫 Voucher**
di dashboard admin — tambah, aktif/nonaktifkan, edit nilai, atau hapus. Nilai awal
(`KAHEINS10`, `HEMAT5K`, `ONGKIRGRATIS`) sudah di-seed lewat `schema.sql`.

Frontend memanggil API lewat path relatif (`/api/...`) karena satu origin —
makanya `BACKEND_URL` di `public/index.html` dibiarkan `""`.

## 1. Setup Supabase

1. Buat project di [supabase.com](https://supabase.com).
2. **SQL Editor** → tempel `schema.sql` → **Run**.
3. **Storage** → **New bucket** → nama `bukti-bayar` → **Private**.
4. **Project Settings → API** → catat `Project URL` + `service_role` key.

## 2. Jalankan lokal

```bash
cp .env.example .env      # lalu isi nilainya
npm install
npm run dev
```

Buka:
- Toko: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin.html`

## 3. Taruh gambar

Masukkan gambar produk + `qris.png` ke folder `public/images/`
(daftar nama file ada di `public/images/README.txt`).

## 4. Deploy ke Railway

1. Push folder ini ke GitHub (file `.env` TIDAK ikut — sudah di-`.gitignore`).
2. Railway → **New Project → Deploy from GitHub repo** → pilih repo.
3. Kalau `package.json` ada di root repo, **Root Directory** dibiarkan kosong.
   Kalau folder ini berada di dalam subfolder repo, set Root Directory ke folder
   ini.
4. **Variables** → isi: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `PROOF_BUCKET`, `ADMIN_TOKEN`. (`PORT` & `FRONTEND_ORIGIN` tidak wajib.)
5. **Settings → Networking → Generate Domain** → dapat URL publik.

Selesai. Toko ada di `https://<domain>.up.railway.app/`, dashboard di
`/admin.html`. Frontend & backend satu paket, satu URL.

## Catatan

- Harga & voucher dihitung ulang di server (`src/catalog.js`) — frontend tidak
  bisa memalsukan total.
- `service_role` key cuma di server. Jangan pernah ditaruh di kode frontend.
