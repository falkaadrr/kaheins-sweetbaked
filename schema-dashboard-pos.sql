-- =====================================================================
-- Migrasi untuk Dashboard + POS (Kasir) — Kaheins Sweetbaked
-- Jalankan di Supabase: SQL Editor -> paste -> Run (cukup sekali)
-- =====================================================================

-- Tandai sumber order: 'online' (dari toko web) atau 'pos' (dari kasir admin).
-- Order lama otomatis dianggap 'online'.
alter table public.orders
  add column if not exists source text not null default 'online';

-- Index bantu untuk laporan/dashboard
create index if not exists idx_orders_created on public.orders (created_at desc);
create index if not exists idx_orders_status  on public.orders (status);
create index if not exists idx_orders_source  on public.orders (source);
