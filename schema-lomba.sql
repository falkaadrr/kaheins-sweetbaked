-- =====================================================================
-- Tabel pendaftaran Lomba Hias Cookies — Kaheins Sweetbaked
-- Jalankan di Supabase: Dashboard -> SQL Editor -> paste -> Run
-- =====================================================================

create table if not exists public.lomba_registrations (
  id          uuid primary key default gen_random_uuid(),
  reg_no      text unique not null,        -- nomor pendaftaran, mis. KHS-LOMBA/20260805/AB12
  name        text not null,               -- nama peserta
  whatsapp    text not null,               -- no. WhatsApp
  email       text not null,               -- email
  city        text not null,               -- domisili / kota
  proof_path  text,                        -- path bukti bayar di Storage (bucket bukti-bayar)
  status      text not null default 'pending', -- pending | verified | rejected
  created_at  timestamptz not null default now()
);

-- Index bantu untuk sortir & cari
create index if not exists idx_lomba_created on public.lomba_registrations (created_at desc);
create index if not exists idx_lomba_status  on public.lomba_registrations (status);

-- Catatan:
-- Bukti bayar disimpan di bucket "bukti-bayar" yang SUDAH ada (dipakai fitur order).
-- Tidak perlu bikin bucket baru. Row Level Security tidak perlu diaktifkan karena
-- semua akses lewat backend memakai service_role key (bukan dari browser langsung).
