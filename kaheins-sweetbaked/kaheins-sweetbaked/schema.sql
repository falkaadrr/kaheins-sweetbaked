-- ============================================================
--  Kaheins Sweetbaked — Skema Database (Supabase / Postgres)
--  Jalankan di Supabase: SQL Editor -> tempel -> Run
-- ============================================================
create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null, password_hash text not null,
  name text, role text not null default 'admin', created_at timestamptz not null default now());

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text unique not null, description text,
  sort_order integer not null default 0, active boolean not null default true,
  created_at timestamptz not null default now());

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text unique, category_id uuid references categories(id) on delete set null,
  price integer not null default 0, description text, image_url text, emoji text default '🍪',
  stock integer, is_preorder boolean not null default false, preorder_ready_date date,
  active boolean not null default true, featured boolean not null default false,
  sort_order integer not null default 0, created_at timestamptz not null default now());

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null, sort_order integer not null default 0);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no text, customer_id uuid, customer_name text not null, customer_phone text,
  customer_address text not null, is_preorder boolean not null default false,
  voucher_code text, subtotal integer not null, discount integer not null default 0,
  total integer not null, status text not null default 'pending', proof_path text, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table if not exists order_items (
  id bigserial primary key, order_id uuid not null references orders(id) on delete cascade,
  product_id uuid, product_name text not null, unit_price integer not null,
  qty integer not null, line_total integer not null);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text unique, address text,
  orders_count integer not null default 0, total_spent integer not null default 0,
  last_order_at timestamptz, created_at timestamptz not null default now());

create table if not exists vouchers (
  code text primary key, type text not null check (type in ('percent','fixed')),
  value integer not null, min_order integer not null default 0, label text,
  active boolean not null default true, created_at timestamptz not null default now());

create table if not exists banners (
  id uuid primary key default gen_random_uuid(), title text, subtitle text,
  image_url text, link_url text, sort_order integer not null default 0,
  active boolean not null default true, created_at timestamptz not null default now());

create table if not exists promos (
  id uuid primary key default gen_random_uuid(), title text not null, description text,
  image_url text, badge text, active boolean not null default true, created_at timestamptz not null default now());

create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(), name text not null,
  rating integer not null default 5 check (rating between 1 and 5), message text,
  approved boolean not null default false, created_at timestamptz not null default now());

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(), product_id uuid references products(id) on delete cascade,
  name text not null, rating integer not null default 5 check (rating between 1 and 5),
  message text, approved boolean not null default false, created_at timestamptz not null default now());

create table if not exists gallery (
  id uuid primary key default gen_random_uuid(), title text, image_url text not null,
  sort_order integer not null default 0, created_at timestamptz not null default now());

create table if not exists media (
  id uuid primary key default gen_random_uuid(), path text not null, url text, mime text,
  size integer, created_at timestamptz not null default now());

create table if not exists homepage_sections (
  key text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());

create table if not exists settings (
  key text primary key, value jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(), type text not null, title text not null,
  body text, read boolean not null default false, created_at timestamptz not null default now());

create table if not exists audit_logs (
  id bigserial primary key, actor text, action text not null, entity text not null,
  entity_id text, created_at timestamptz not null default now());

create index if not exists idx_products_category on products(category_id);
create index if not exists idx_products_active on products(active);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created on orders(created_at desc);

-- ---------- SEED ----------
insert into categories (name, slug, sort_order) values
  ('Cookies','cookies',1), ('Scoopable','scoopable',2) on conflict (slug) do nothing;

insert into products (name, slug, price, emoji, category_id, featured, sort_order)
select v.name, v.slug, v.price, v.emoji, (select id from categories c where c.slug=v.cat), v.featured, v.so
from (values
  ('Classic Original','classic-original',7000,'🍪','cookies',true,1),
  ('Red Velvet Cheese','red-velvet-cheese',7000,'❤️','cookies',true,2),
  ('Blue Monstery','blue-monstery',7000,'💙','cookies',false,3),
  ('Scoopable Classic Cookie','scoopable-classic',10000,'🍪','scoopable',false,4),
  ('Scoopable Red Velvet Cheese','scoopable-red-velvet',10000,'❤️','scoopable',false,5),
  ('Scoopable Blue Monstery','scoopable-blue-monstery',10000,'💙','scoopable',false,6)
) as v(name,slug,price,emoji,cat,featured,so) on conflict (slug) do nothing;

insert into vouchers (code, type, value, min_order, label) values
  ('KAHEINS10','percent',10,50000,'Diskon 10%'),
  ('HEMAT5K','fixed',5000,30000,'Potongan Rp 5.000'),
  ('ONGKIRGRATIS','fixed',10000,75000,'Gratis ongkir Rp 10.000') on conflict (code) do nothing;

insert into settings (key, value) values
  ('contact','{"whatsapp":"6283848531389","instagram":"@kaheins.sweetbaked","email":"halo@kaheins.com","address":"Jakarta"}'::jsonb),
  ('seo','{"title":"Kaheins Sweetbaked — Cookies Bikin Nagih","description":"Cookies homemade premium.","keywords":"cookies, kue, jakarta"}'::jsonb),
  ('store','{"name":"Kaheins Sweetbaked","qris_image":"images/qris.png"}'::jsonb) on conflict (key) do nothing;
