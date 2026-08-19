-- =====================================================================
-- Migrasi untuk Akun Customer (riwayat pesanan) — Kaheins Sweetbaked
-- Jalankan di Supabase: SQL Editor -> paste -> Run (sekali aja)
-- =====================================================================

-- Kaitkan order ke akun customer (Supabase Auth). NULL = checkout tamu.
alter table public.orders
  add column if not exists user_id uuid;

create index if not exists idx_orders_user on public.orders (user_id);
