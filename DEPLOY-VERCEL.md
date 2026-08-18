# Deploy Kaheins Sweetbaked ke Vercel

Frontend (storefront + admin) dan backend (API Express) jalan **bareng di satu project Vercel**.
Database, Auth token admin, dan Storage tetap di **Supabase** (tidak berubah, data aman).

---

## Bagaimana ini bekerja

- File di `/public` (index.html, admin.html, config.js, images) → dilayani langsung oleh **CDN Vercel**.
- Semua request `/api/*` → masuk ke **satu serverless function** (`api/index.js`) yang menjalankan Express app.
- Aturan routing ada di `vercel.json`: file statis dilayani duluan, sisanya diarahkan ke function.

Struktur yang berubah dari versi Railway:
- `app.js` (BARU) — inti Express app, tanpa `app.listen()`.
- `server.js` — sekarang cuma untuk **dev lokal** (`npm run dev`).
- `api/index.js` (BARU) — entry serverless Vercel.
- `vercel.json` (BARU) — konfigurasi routing.

`config.js` tetap `window.BACKEND_URL = ""` (kosong) karena frontend & API satu domain.

---

## Langkah deploy

### 1. Push kode ke GitHub
```bash
git init
git add .
git commit -m "Migrasi ke Vercel"
git branch -M main
git remote add origin https://github.com/USERNAME/kaheins.git
git push -u origin main
```
(Kalau repo GitHub-nya sudah ada, cukup `git add . && git commit && git push`.)

### 2. Import project di Vercel
1. Buka https://vercel.com → **Add New… → Project**.
2. Pilih repo GitHub Kaheins.
3. Framework Preset: **Other** (biarkan default, jangan pilih Next.js dsb).
4. Build & Output Settings: biarkan kosong (tidak perlu build command).
5. **Jangan klik Deploy dulu** — isi Environment Variables di langkah 3.

### 3. Isi Environment Variables (WAJIB)
Di halaman import (atau Settings → Environment Variables), tambahkan:

| Nama | Isi |
|---|---|
| `SUPABASE_URL` | URL project Supabase kamu (https://xxxx.supabase.co) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (RAHASIA, bukan anon) |
| `PROOF_BUCKET` | `bukti-bayar` |
| `MEDIA_BUCKET` | `media` |
| `UPLOAD_BUCKET` | `uploads` |
| `ADMIN_EMAIL` | email admin (mis. admin@kaheins.com) |
| `ADMIN_PASSWORD` | password admin yang kuat |
| `JWT_SECRET` | string acak panjang (untuk tanda tangan token login) |
| `FRONTEND_ORIGIN` | `*` (opsional) |

`PORT` **tidak perlu** di Vercel (itu cuma untuk lokal).

Ambil nilai Supabase dari: dashboard Supabase → Project Settings → API.

### 4. Deploy
Klik **Deploy**. Tunggu ± 1 menit.

### 5. Cek hasil
- Storefront: `https://NAMA-PROJECT.vercel.app/`
- Admin: `https://NAMA-PROJECT.vercel.app/admin.html`
- Health API: `https://NAMA-PROJECT.vercel.app/api/health` → harus `{"ok":true,...}`

Login admin pakai `ADMIN_EMAIL` + `ADMIN_PASSWORD` yang tadi diisi. Admin dibuat
otomatis saat function pertama kali jalan.

---

## Catatan penting

- **Upload gambar maks 4MB.** Vercel membatasi body serverless ~4.5MB, jadi limit
  upload diturunkan dari 10MB → 4MB. Kompres foto produk kalau lebih besar. (Kalau
  nanti butuh upload file besar, solusinya upload langsung dari browser ke Supabase
  Storage pakai signed URL — bisa ditambah menyusul.)
- **Supabase tidak disentuh.** Semua tabel & data tetap seperti sekarang.
- **Railway sudah tidak dipakai.** `railway.json` sudah dihapus dari repo.

## Jalankan lokal (opsional, untuk ngoprek)
```bash
cp .env.example .env   # lalu isi nilainya
npm install
npm run dev            # buka http://localhost:3000
```
