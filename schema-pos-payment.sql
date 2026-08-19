-- =====================================================================
-- Migrasi POS: metode bayar + uang bayar + kembalian — Kaheins Sweetbaked
-- Jalankan di Supabase: SQL Editor -> paste -> Run (sekali aja)
-- =====================================================================
alter table public.orders
  add column if not exists payment_method text,   -- 'cash' | 'qris' | 'transfer'
  add column if not exists paid_amount bigint,     -- uang yang dibayar customer
  add column if not exists change_amount bigint;   -- kembalian
