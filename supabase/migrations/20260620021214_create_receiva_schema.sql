-- Migration: Create Receiva multi-tenant database schema
-- Created at: 2026-06-20 02:12:14 UTC

-- Clean up any existing instances of the tables (with cascade) to avoid key conflicts and ensure fresh initialization
drop table if exists public.invoice_items cascade;
drop table if exists public.invoices cascade;
drop table if exists public.products cascade;
drop table if exists public.profiles cascade;
drop table if exists public.shops cascade;

----------------------------------------------------
-- 1. SHOPS TABLE
----------------------------------------------------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  current_tier text not null check (current_tier in ('freelancer', 'business', 'enterprise')),
  base_currency text not null default 'GHS',
  created_at timestamp with time zone not null default now()
);

----------------------------------------------------
-- 2. PROFILES TABLE (linked to Auth.Users)
----------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('owner', 'attendant')),
  shop_id uuid references public.shops(id) on delete set null
);

----------------------------------------------------
-- 3. PRODUCTS TABLE (Inventory tracking)
----------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  item_name text not null,
  cost_price numeric not null default 0,
  selling_price numeric not null default 0,
  stock_remaining integer not null default 0,
  low_stock_threshold integer not null default 5
);

----------------------------------------------------
-- 4. INVOICES TABLE (Sales and Credit management)
----------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  total_amount numeric not null default 0,
  payment_status text not null check (payment_status in ('paid', 'credit')),
  telco_transaction_id text,
  due_date timestamp with time zone,
  extra_notes text,
  created_at timestamp with time zone not null default now()
);

----------------------------------------------------
-- 5. INVOICE_ITEMS TABLE (Line item details)
----------------------------------------------------
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null,
  unit_price numeric not null
);

----------------------------------------------------
-- INDEXES FOR PERFORMANCE OPTIMIZATION
----------------------------------------------------
create index if not exists profiles_shop_id_idx on public.profiles(shop_id);
create index if not exists products_shop_id_idx on public.products(shop_id);
create index if not exists invoices_shop_id_idx on public.invoices(shop_id);
create index if not exists invoices_created_by_idx on public.invoices(created_by);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items(invoice_id);
create index if not exists invoice_items_product_id_idx on public.invoice_items(product_id);

----------------------------------------------------
-- ENABLE ROW LEVEL SECURITY (RLS)
----------------------------------------------------
alter table public.shops enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

----------------------------------------------------
-- SECURITY DEFINER HELPERS (Avoids RLS Recursion)
----------------------------------------------------
create or replace function public.get_user_shop_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select shop_id from public.profiles where id = auth.uid();
$$;

----------------------------------------------------
-- RLS POLICIES
----------------------------------------------------

-- A. Shops Policies
drop policy if exists "Users can view their own shop" on public.shops;
create policy "Users can view their own shop"
  on public.shops
  for select
  using (id = public.get_user_shop_id());

drop policy if exists "Users can update their own shop" on public.shops;
create policy "Users can update their own shop"
  on public.shops
  for update
  using (id = public.get_user_shop_id());

drop policy if exists "Users can insert a shop" on public.shops;
create policy "Users can insert a shop"
  on public.shops
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Users can delete their own shop" on public.shops;
create policy "Users can delete their own shop"
  on public.shops
  for delete
  using (id = public.get_user_shop_id());

-- B. Profiles Policies
drop policy if exists "Users can view profiles in their shop" on public.profiles;
create policy "Users can view profiles in their shop"
  on public.profiles
  for select
  using (shop_id = public.get_user_shop_id() or id = auth.uid());

drop policy if exists "Users can update profiles in their shop" on public.profiles;
create policy "Users can update profiles in their shop"
  on public.profiles
  for update
  using (shop_id = public.get_user_shop_id() or id = auth.uid());

drop policy if exists "Users can insert profiles" on public.profiles;
create policy "Users can insert profiles"
  on public.profiles
  for insert
  with check (id = auth.uid());

drop policy if exists "Users can delete profiles in their shop" on public.profiles;
create policy "Users can delete profiles in their shop"
  on public.profiles
  for delete
  using (shop_id = public.get_user_shop_id() or id = auth.uid());

-- C. Products Policies
drop policy if exists "Users can view products in their shop" on public.products;
create policy "Users can view products in their shop"
  on public.products
  for select
  using (shop_id = public.get_user_shop_id());

drop policy if exists "Users can insert products in their shop" on public.products;
create policy "Users can insert products in their shop"
  on public.products
  for insert
  with check (shop_id = public.get_user_shop_id());

drop policy if exists "Users can update products in their shop" on public.products;
create policy "Users can update products in their shop"
  on public.products
  for update
  using (shop_id = public.get_user_shop_id());

drop policy if exists "Users can delete products in their shop" on public.products;
create policy "Users can delete products in their shop"
  on public.products
  for delete
  using (shop_id = public.get_user_shop_id());

-- D. Invoices Policies
drop policy if exists "Users can view invoices in their shop" on public.invoices;
create policy "Users can view invoices in their shop"
  on public.invoices
  for select
  using (shop_id = public.get_user_shop_id());

drop policy if exists "Users can insert invoices in their shop" on public.invoices;
create policy "Users can insert invoices in their shop"
  on public.invoices
  for insert
  with check (shop_id = public.get_user_shop_id());

drop policy if exists "Users can update invoices in their shop" on public.invoices;
create policy "Users can update invoices in their shop"
  on public.invoices
  for update
  using (shop_id = public.get_user_shop_id());

drop policy if exists "Users can delete invoices in their shop" on public.invoices;
create policy "Users can delete invoices in their shop"
  on public.invoices
  for delete
  using (shop_id = public.get_user_shop_id());

-- E. Invoice Items Policies
drop policy if exists "Users can view invoice items in their shop" on public.invoice_items;
create policy "Users can view invoice items in their shop"
  on public.invoice_items
  for select
  using (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.shop_id = public.get_user_shop_id()
    )
  );

drop policy if exists "Users can insert invoice items in their shop" on public.invoice_items;
create policy "Users can insert invoice items in their shop"
  on public.invoice_items
  for insert
  with check (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.shop_id = public.get_user_shop_id()
    )
  );

drop policy if exists "Users can update invoice items in their shop" on public.invoice_items;
create policy "Users can update invoice items in their shop"
  on public.invoice_items
  for update
  using (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.shop_id = public.get_user_shop_id()
    )
  );

drop policy if exists "Users can delete invoice items in their shop" on public.invoice_items;
create policy "Users can delete invoice items in their shop"
  on public.invoice_items
  for delete
  using (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.shop_id = public.get_user_shop_id()
    )
  );

----------------------------------------------------
-- INVENTORY TRACKING TRIGGER ON INVOICE ITEMS
----------------------------------------------------
create or replace function public.handle_invoice_item_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock_remaining integer;
  v_item_name text;
begin
  -- Retrieve current stock level and item name
  select stock_remaining, item_name
  into v_stock_remaining, v_item_name
  from public.products
  where id = new.product_id;

  -- Ensure the product exists
  if not found then
    raise exception 'Product with ID % not found', new.product_id;
  end if;

  -- Prevent transaction if stock is insufficient
  if v_stock_remaining < new.quantity then
    raise exception 'Insufficient stock for product "%". Requested: %, Available: %',
      v_item_name, new.quantity, v_stock_remaining;
  end if;

  -- Deduct the purchased quantity from the remaining inventory stock
  update public.products
  set stock_remaining = stock_remaining - new.quantity
  where id = new.product_id;

  return new;
end;
$$;

drop trigger if exists trg_invoice_item_inserted on public.invoice_items;
create trigger trg_invoice_item_inserted
  before insert
  on public.invoice_items
  for each row
  execute function public.handle_invoice_item_inserted();
