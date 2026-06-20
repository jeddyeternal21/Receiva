-- Migration: Add multi-branch scaling and role-based staff isolation
-- Created at: 2026-06-20 15:35:04 UTC

----------------------------------------------------
-- 1. Create branch_locations Table
----------------------------------------------------
create table if not exists public.branch_locations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  branch_name text not null,
  location_city text not null,
  created_at timestamp with time zone not null default now()
);

----------------------------------------------------
-- 2. Alter Profiles, Invoices, and Products Tables
----------------------------------------------------
-- Alter profiles: add assigned_branch_id
alter table public.profiles 
  add column if not exists assigned_branch_id uuid references public.branch_locations(id) on delete set null;

-- Alter invoices: add branch_id
alter table public.invoices 
  add column if not exists branch_id uuid references public.branch_locations(id) on delete set null;

-- Alter products: add branch_id
alter table public.products 
  add column if not exists branch_id uuid references public.branch_locations(id) on delete set null;

----------------------------------------------------
-- 3. Create Performance Index Optimizations
----------------------------------------------------
create index if not exists branch_locations_shop_id_idx on public.branch_locations(shop_id);
create index if not exists profiles_assigned_branch_id_idx on public.profiles(assigned_branch_id);
create index if not exists invoices_branch_id_idx on public.invoices(branch_id);
create index if not exists products_branch_id_idx on public.products(branch_id);

----------------------------------------------------
-- 4. Enable Row Level Security (RLS)
----------------------------------------------------
alter table public.branch_locations enable row level security;

----------------------------------------------------
-- 5. Security Definer Helper Functions (RLS Recursion Safe)
----------------------------------------------------
create or replace function public.get_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.get_user_assigned_branch_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select assigned_branch_id from public.profiles where id = auth.uid();
$$;

----------------------------------------------------
-- 6. Implement RLS Policies for Staff Isolation
----------------------------------------------------

-- A. Branch Locations Policies
drop policy if exists "Users can view branches matching their shop" on public.branch_locations;
create policy "Users can view branches matching their shop"
  on public.branch_locations
  for select
  using (shop_id = public.get_user_shop_id());

drop policy if exists "Owners can manage branch locations" on public.branch_locations;
create policy "Owners can manage branch locations"
  on public.branch_locations
  for all
  using (
    public.get_user_role() = 'owner' and 
    shop_id = public.get_user_shop_id()
  );

-- B. Invoices Policies (Role-based Isolation)
drop policy if exists "Users can view invoices based on role" on public.invoices;
create policy "Users can view invoices based on role"
  on public.invoices
  for select
  using (
    (public.get_user_role() = 'owner' and shop_id = public.get_user_shop_id()) or
    (public.get_user_role() = 'attendant' and branch_id = public.get_user_assigned_branch_id())
  );

drop policy if exists "Users can insert invoices based on role" on public.invoices;
create policy "Users can insert invoices based on role"
  on public.invoices
  for insert
  with check (
    (public.get_user_role() = 'owner' and shop_id = public.get_user_shop_id()) or
    (public.get_user_role() = 'attendant' and branch_id = public.get_user_assigned_branch_id())
  );

drop policy if exists "Users can update invoices based on role" on public.invoices;
create policy "Users can update invoices based on role"
  on public.invoices
  for update
  using (
    (public.get_user_role() = 'owner' and shop_id = public.get_user_shop_id()) or
    (public.get_user_role() = 'attendant' and branch_id = public.get_user_assigned_branch_id())
  );

drop policy if exists "Users can delete invoices based on role" on public.invoices;
create policy "Users can delete invoices based on role"
  on public.invoices
  for delete
  using (
    (public.get_user_role() = 'owner' and shop_id = public.get_user_shop_id()) or
    (public.get_user_role() = 'attendant' and branch_id = public.get_user_assigned_branch_id())
  );

-- C. Products Policies (Role-based Isolation)
drop policy if exists "Users can view products based on role" on public.products;
create policy "Users can view products based on role"
  on public.products
  for select
  using (
    (public.get_user_role() = 'owner' and shop_id = public.get_user_shop_id()) or
    (public.get_user_role() = 'attendant' and branch_id = public.get_user_assigned_branch_id())
  );

drop policy if exists "Users can insert products based on role" on public.products;
create policy "Users can insert products based on role"
  on public.products
  for insert
  with check (
    (public.get_user_role() = 'owner' and shop_id = public.get_user_shop_id()) or
    (public.get_user_role() = 'attendant' and branch_id = public.get_user_assigned_branch_id())
  );

drop policy if exists "Users can update products based on role" on public.products;
create policy "Users can update products based on role"
  on public.products
  for update
  using (
    (public.get_user_role() = 'owner' and shop_id = public.get_user_shop_id()) or
    (public.get_user_role() = 'attendant' and branch_id = public.get_user_assigned_branch_id())
  );

drop policy if exists "Users can delete products based on role" on public.products;
create policy "Users can delete products based on role"
  on public.products
  for delete
  using (
    (public.get_user_role() = 'owner' and shop_id = public.get_user_shop_id()) or
    (public.get_user_role() = 'attendant' and branch_id = public.get_user_assigned_branch_id())
  );
