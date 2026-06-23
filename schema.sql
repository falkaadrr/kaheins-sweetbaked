-- ============================================================
--  Skema database Kaheins Sweetbaked
--  Jalankan di Supabase: SQL Editor -> tempel -> Run
-- ============================================================

create extension if not exists "pgcrypto";

-- Tabel order utama
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text,
  customer_address text not null,
  voucher_code text,
  subtotal integer not null,
  discount integer not null default 0,
  total integer not null,
  status text not null default 'pending',
  proof_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rincian item per order
create table if not exists order_items (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  product_id integer not null,
  product_name text not null,
  unit_price integer not null,
  qty integer not null,
  line_total integer not null
);

create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created on orders(created_at desc);

-- Voucher (dikelola lewat dashboard admin)
create table if not exists vouchers (
  code text primary key,
  type text not null check (type in ('percent', 'fixed')),
  value integer not null,
  min_order integer not null default 0,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed voucher awal (boleh diubah/hapus nanti lewat dashboard)
insert into vouchers (code, type, value, min_order, label) values
  ('KAHEINS10', 'percent', 10, 50000, 'Diskon 10%'),
  ('HEMAT5K', 'fixed', 5000, 30000, 'Potongan Rp 5.000'),
  ('ONGKIRGRATIS', 'fixed', 10000, 75000, 'Gratis ongkir Rp 10.000')
on conflict (code) do nothing;

-- ============================================================
--  Catatan RLS:
--  Backend pakai SERVICE ROLE KEY yang otomatis bypass RLS,
--  jadi tabel ini TIDAK perlu policy apa pun untuk MVP.
--  Pastikan service role key HANYA dipakai di backend.
-- ============================================================
