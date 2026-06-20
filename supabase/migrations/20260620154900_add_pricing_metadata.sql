-- Migration: Add subscription pricing metadata
-- Created at: 2026-06-20 15:49:00 UTC

CREATE TABLE IF NOT EXISTS public.pricing_tiers (
  tier_name text primary key check (tier_name in ('freelancer', 'business', 'enterprise')),
  price_per_month numeric not null,
  currency text not null default 'GHS',
  created_at timestamp with time zone not null default now()
);

-- Enable Row Level Security
ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Allow read access to pricing tiers for all users
CREATE POLICY "Allow read access to pricing tiers for all users"
  ON public.pricing_tiers
  FOR SELECT
  TO public
  USING (true);

-- Populate default prices
INSERT INTO public.pricing_tiers (tier_name, price_per_month, currency) VALUES
  ('freelancer', 23.00, 'GHS'),
  ('business', 45.00, 'GHS'),
  ('enterprise', 89.00, 'GHS')
ON CONFLICT (tier_name) DO UPDATE 
SET price_per_month = EXCLUDED.price_per_month, currency = EXCLUDED.currency;
