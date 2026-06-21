import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  TrendingUp, 
  Coins, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  Users,
  Percent,
  Search
} from 'lucide-react';

interface BranchStats {
  id: string;
  name: string;
  city: string;
  attendants_count: number;
  gross_revenue: number;
  wholesale_cost: number;
  outstanding_credit: number;
  low_stock_count: number;
}

// Enterprise mock datasets representing multi-branch scale
const MOCK_BRANCH_STATS: BranchStats[] = [
  {
    id: 'b-1',
    name: 'Accra Mall Branch',
    city: 'Accra',
    attendants_count: 3,
    gross_revenue: 14550.00,
    wholesale_cost: 9200.00,
    outstanding_credit: 2100.00,
    low_stock_count: 4
  },
  {
    id: 'b-2',
    name: 'Adum Kumasi Branch',
    city: 'Kumasi',
    attendants_count: 2,
    gross_revenue: 9570.00,
    wholesale_cost: 5800.00,
    outstanding_credit: 1450.00,
    low_stock_count: 7
  },
  {
    id: 'b-3',
    name: 'Tema Harbour Branch',
    city: 'Tema',
    attendants_count: 1,
    gross_revenue: 5150.00,
    wholesale_cost: 3200.00,
    outstanding_credit: 850.00,
    low_stock_count: 2
  }
];

interface ConsolidatedDashboardProps {
  branchesData?: BranchStats[];
  baseCurrency?: string;
}

export const ConsolidatedDashboard: React.FC<ConsolidatedDashboardProps> = ({
  branchesData = MOCK_BRANCH_STATS,
  baseCurrency = 'GHS'
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 1. Dynamic Dropdown location list
  const branchOptions = useMemo(() => {
    return branchesData.map(b => ({ id: b.id, name: b.name }));
  }, [branchesData]);

  // 2. Consolidated Metric Cards calculations
  const metrics = useMemo(() => {
    let grossRev = 0;
    let costPrice = 0;
    let creditOwed = 0;
    let lowStock = 0;

    if (selectedBranchId === 'all') {
      branchesData.forEach(b => {
        grossRev += b.gross_revenue;
        costPrice += b.wholesale_cost;
        creditOwed += b.outstanding_credit;
        lowStock += b.low_stock_count;
      });
    } else {
      const match = branchesData.find(b => b.id === selectedBranchId);
      if (match) {
        grossRev = match.gross_revenue;
        costPrice = match.wholesale_cost;
        creditOwed = match.outstanding_credit;
        lowStock = match.low_stock_count;
      }
    }

    const netProfit = grossRev - costPrice;
    const profitMargin = grossRev > 0 ? (netProfit / grossRev) * 100 : 0;

    return {
      grossRev,
      netProfit,
      creditOwed,
      lowStock,
      profitMargin
    };
  }, [selectedBranchId, branchesData]);

  // Rank storefronts by profitability for the comparison table
  const sortedBranches = useMemo(() => {
    return [...branchesData]
      .map(b => ({
        ...b,
        net_profit: b.gross_revenue - b.wholesale_cost
      }))
      .filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.net_profit - a.net_profit); // Rank highest profit first
  }, [branchesData, searchTerm]);

  // Find the top performer ID
  const topPerformerId = useMemo(() => {
    if (branchesData.length === 0) return '';
    return [...branchesData]
      .map(b => ({ id: b.id, profit: b.gross_revenue - b.wholesale_cost }))
      .sort((a, b) => b.profit - a.profit)[0]?.id || '';
  }, [branchesData]);

  return (
    <div className="max-w-6xl mx-auto font-sans text-[var(--c-text)]">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[var(--c-border)] pb-4 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[var(--c-light)] border border-[var(--c-border)] rounded-lg">
              <Building2 className="w-6 h-6 text-[#22c55e]" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--c-text)]">Enterprise Console</h1>
          </div>
          <p className="text-[var(--c-muted)] mt-1 text-sm">Multi-branch financial metrics, inventory deficits, and attendant scale analytics.</p>
        </div>

        {/* 1. Global Filter Header Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-[var(--c-muted)] uppercase tracking-wider hidden sm:block">
            Filter Location:
          </label>
          <div className="relative">
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="appearance-none bg-[var(--c-white)] border border-[var(--c-border)] px-4 py-2 pr-10 rounded-lg text-xs font-bold text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all cursor-pointer shadow-sm"
            >
              <option value="all">All Branches (Consolidated)</option>
              {branchOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[var(--c-muted)]">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Card 1: Gross Revenue */}
        <div className="bg-[var(--c-white)] border border-[var(--c-border)] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[var(--c-muted)] uppercase tracking-widest">Gross Revenue</span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">
              <TrendingUp className="w-3 h-3" />
              +14.2% today
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-[var(--c-text)]">
              {baseCurrency} {metrics.grossRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-[var(--c-muted)] mt-1">Total revenue collected from client invoices.</p>
          </div>
        </div>

        {/* Card 2: Total Net Profit */}
        <div className="bg-[var(--c-white)] border border-[var(--c-border)] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[var(--c-muted)] uppercase tracking-widest">Net Profit Margin</span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-green-500/10 text-green-500 border border-green-500/20">
              <Percent className="w-3 h-3 text-[#22c55e]" />
              {metrics.profitMargin.toFixed(1)}% margin
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#22c55e]">
              {baseCurrency} {metrics.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-[var(--c-muted)] mt-1">Derived from retail minus wholesale pricing.</p>
          </div>
        </div>

        {/* Card 3: Outstanding Credit */}
        <div className="bg-[var(--c-white)] border border-[var(--c-border)] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[var(--c-muted)] uppercase tracking-widest">Credit Receivables</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-amber-500">
              {baseCurrency} {metrics.creditOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-[var(--c-muted)] mt-1">Outstanding debts logged under client profiles.</p>
          </div>
        </div>

        {/* Card 4: Low Stock Alert Count */}
        <div className="bg-[var(--c-white)] border border-[var(--c-border)] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[var(--c-muted)] uppercase tracking-widest">Low Stock Items</span>
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-extrabold ${
              metrics.lowStock > 0 ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-[var(--c-light)] text-[var(--c-muted)] border border-[var(--c-border)]'
            }`}>
              {metrics.lowStock}
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-[var(--c-text)]">{metrics.lowStock} Alerts</h3>
            <p className="text-[10px] text-[var(--c-muted)] mt-1">Products below safety thresholds across branches.</p>
          </div>
        </div>
      </div>

      {/* 3. Side-by-Side Performance Comparison Table */}
      <div className="bg-[var(--c-white)] border border-[var(--c-border)] rounded-2xl overflow-hidden shadow-sm">
        {/* Table header controls */}
        <div className="p-6 border-b border-[var(--c-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--c-light)]/50">
          <div>
            <h3 className="text-lg font-bold text-[var(--c-text)] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[var(--c-muted)]" />
              Branch Storefront Rankings
            </h3>
            <p className="text-xs text-[var(--c-muted)] mt-1">Detailed performance metrics sorted by branch net profitability.</p>
          </div>

          {/* Quick search filter */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[var(--c-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search branch location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--c-white)] border border-[var(--c-border)] text-[var(--c-text)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--c-border)] text-[10px] font-bold text-[var(--c-muted)] uppercase tracking-wider">
                <th className="py-4 px-6">Branch storefront name</th>
                <th className="py-4 px-6 text-center">Active Attendants</th>
                <th className="py-4 px-6 text-right">Today's Sales Volume</th>
                <th className="py-4 px-6 text-right">Outstanding Credit</th>
                <th className="py-4 px-6 text-right">Calculated Net Profit</th>
                <th className="py-4 px-6 text-center">Location City</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--c-border)] text-xs text-[var(--c-text)]">
              {sortedBranches.map((br) => {
                const isTopPerformer = br.id === topPerformerId;
                
                return (
                  <tr key={br.id} className="hover:bg-[var(--c-light)]/50 transition-colors">
                    {/* Branch Name */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--c-text)] text-sm">{br.name}</span>
                        {isTopPerformer && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-green-500/10 text-green-500 border border-green-500/20">
                            <Sparkles className="w-2.5 h-2.5 text-[#22c55e] animate-spin" />
                            Top Performer
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Active Attendants */}
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--c-light)] border border-[var(--c-border)] text-[var(--c-text)] rounded-lg font-bold">
                        <Users className="w-3.5 h-3.5 text-[var(--c-muted)]" />
                        {br.attendants_count} staff
                      </span>
                    </td>

                    {/* Today's Sales */}
                    <td className="py-4 px-6 text-right font-semibold text-[var(--c-text)]">
                      {baseCurrency} {br.gross_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Outstanding Credit */}
                    <td className="py-4 px-6 text-right font-medium text-rose-500">
                      {baseCurrency} {br.outstanding_credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Calculated Net Profit */}
                    <td className="py-4 px-6 text-right">
                      <span className="font-extrabold text-green-500 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-lg">
                        {baseCurrency} {br.net_profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* City location */}
                    <td className="py-4 px-6 text-center">
                      <span className="text-[var(--c-muted)] font-bold uppercase tracking-wider text-[10px]">
                        {br.city}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {sortedBranches.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-[var(--c-muted)] italic">
                    No branch storefront data matches the search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default ConsolidatedDashboard;
