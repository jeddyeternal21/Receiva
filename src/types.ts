// TypeScript interfaces for Receiva schema

export interface Shop {
  id: string;
  name: string;
  current_tier: 'freelancer' | 'business' | 'enterprise';
  base_currency: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: 'owner' | 'attendant';
  shop_id: string | null;
}

export interface Product {
  id: string;
  shop_id: string;
  item_name: string;
  cost_price: number;
  selling_price: number;
  stock_remaining: number;
  low_stock_threshold: number;
}

export interface Invoice {
  id: string;
  shop_id: string;
  created_by: string | null;
  customer_name: string;
  customer_phone: string | null;
  total_amount: number;
  payment_status: 'paid' | 'credit';
  telco_transaction_id: string | null;
  due_date: string | null;
  extra_notes: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
}

// Joined types helper
export interface ProfileWithShop extends Profile {
  shop: Shop | null;
}

export interface PricingTierMeta {
  tier_name: 'freelancer' | 'business' | 'enterprise';
  price_per_month: number;
  currency: string;
}

export const PRICING_TIER_DETAILS: Record<Shop['current_tier'], { price: number; label: string; features: string[] }> = {
  freelancer: {
    price: 23,
    label: 'Freelancer',
    features: [
      'Single User Access',
      'Basic Sales Logging',
      'Digital Receipts (Branded)',
      'GRA-friendly monthly summaries'
    ]
  },
  business: {
    price: 45,
    label: 'Business',
    features: [
      'Multi-user Attendant accounts',
      'Inventory Stock Tracking & Alerts',
      'Momo & Multi-Wallet Support',
      'PDF Export & Reports'
    ]
  },
  enterprise: {
    price: 89,
    label: 'Enterprise',
    features: [
      'Multi-Branch Tracking',
      'Bulletproof Attendant Lockouts',
      'Deep Financial Analytics',
      '"The AI Accountant" Natural Language Chat',
      'Automated Credit Recovery Copywriter'
    ]
  }
};
