create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name character varying not null,
  color character varying default '#F97316',
  created_at timestamp with time zone default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  category_id uuid references public.product_categories(id) on delete set null,
  name character varying not null,
  sku character varying,
  type character varying not null default 'product' check (type in ('product', 'service')),
  cost_price numeric not null default 0,
  sell_price numeric not null default 0,
  tax_rate numeric not null default 0,
  track_stock boolean not null default true,
  stock integer not null default 0,
  description text,
  created_at timestamp with time zone default now()
);

alter table public.product_categories enable row level security;
alter table public.products enable row level security;

drop policy if exists "Users own product categories" on public.product_categories;
create policy "Users own product categories"
  on public.product_categories
  for all
  using (business_id in (select businesses.id from public.businesses where businesses.owner_id = auth.uid()));

drop policy if exists "Users own products" on public.products;
create policy "Users own products"
  on public.products
  for all
  using (business_id in (select businesses.id from public.businesses where businesses.owner_id = auth.uid()));

create index if not exists product_categories_business_id_idx on public.product_categories(business_id);
create index if not exists products_business_id_idx on public.products(business_id);
create index if not exists products_category_id_idx on public.products(category_id);
