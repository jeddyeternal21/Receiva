import React, { useState, useMemo, useCallback } from 'react';
import { CreditCopywriterModal } from './CreditCopywriterModal';
import { 
  Phone, 
  Calendar, 
  MessageSquare, 
  Copy, 
  Check, 
  AlertTriangle, 
  CheckCircle, 
  Search,
  Users,
  Coins,
  History
} from 'lucide-react';
import { Invoice } from '../types';

interface CreditBookProps {
  invoices?: Invoice[];
  shopName?: string;
  baseCurrency?: string;
  onSelectInvoice?: (invoice: Invoice) => void;
}

const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    shop_id: 'shop-1',
    created_by: 'owner-1',
    customer_name: 'Kojo Mensah',
    customer_phone: '+233 24 111 2222',
    total_amount: 450.00,
    payment_status: 'credit',
    telco_transaction_id: null,
    due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days in future
    extra_notes: 'Promised to pay via Momo next week Tuesday.',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'inv-2',
    shop_id: 'shop-1',
    created_by: 'owner-1',
    customer_name: 'Ama Serwaa',
    customer_phone: '+233 55 333 4444',
    total_amount: 120.50,
    payment_status: 'credit',
    telco_transaction_id: null,
    due_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days ago
    extra_notes: 'Regular retail customer. Buy sachet water and groceries.',
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'inv-3',
    shop_id: 'shop-1',
    created_by: 'owner-1',
    customer_name: 'Kwame Appiah',
    customer_phone: '+233 20 555 6666',
    total_amount: 850.00,
    payment_status: 'credit',
    telco_transaction_id: null,
    due_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 days ago
    extra_notes: 'Wholesale client. Urgent follow-up needed.',
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'inv-4',
    shop_id: 'shop-1',
    created_by: 'owner-1',
    customer_name: 'Abena Osei',
    customer_phone: '+233 24 777 8888',
    total_amount: 300.00,
    payment_status: 'paid',
    telco_transaction_id: 'TXN918237',
    due_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    extra_notes: 'Settled cash balance in full.',
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export const CreditBook: React.FC<CreditBookProps> = ({
  invoices = MOCK_INVOICES,
  shopName = 'Receiva Retailer',
  baseCurrency = 'GHS',
  onSelectInvoice
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'settled'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null);
  const [copywriterInvoice, setCopywriterInvoice] = useState<Invoice | null>(null);

  // Helper: calculate days differences between target due date and today
  const getDaysOverdue = (dueDateStr: string | null): number => {
    if (!dueDateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dueDateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - target.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Helper: Generate structured follow-up reminder messages
  const generateReminderText = useCallback((invoice: Invoice): string => {
    const formattedDate = new Date(invoice.created_at).toLocaleDateString();
    const balance = Number(invoice.total_amount).toFixed(2);
    const daysOverdue = getDaysOverdue(invoice.due_date);
    const isOverdue = daysOverdue > 0;

    let text = '';
    if (isOverdue) {
      // Overdue notice (past due date)
      text += `⚠️ *URGENT BALANCE NOTICE: ${shopName.toUpperCase()}*\n`;
      text += `----------------------------------------\n`;
      text += `Hello ${invoice.customer_name},\n\n`;
      text += `This is a reminder that invoice Ref *#${invoice.id.substring(0, 8).toUpperCase()}* issued on *${formattedDate}* was due on *${new Date(invoice.due_date!).toLocaleDateString()}*.\n\n`;
      text += `Your payment is currently *${daysOverdue} days OVERDUE*.\n`;
      text += `Outstanding Balance: *${baseCurrency} ${balance}*.\n\n`;
      text += `Kindly arrange for settlement via cash or Momo as soon as possible. Thank you!\n`;
    } else {
      // Friendly reminder (future due date)
      text += `🔔 *PAYMENT REMINDER: ${shopName.toUpperCase()}*\n`;
      text += `----------------------------------------\n`;
      text += `Hello ${invoice.customer_name},\n\n`;
      text += `This is a friendly reminder that invoice Ref *#${invoice.id.substring(0, 8).toUpperCase()}* issued on *${formattedDate}* has a payment scheduled for *${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}*.\n\n`;
      text += `Amount Due: *${baseCurrency} ${balance}*.\n\n`;
      text += `Thank you for your continued business!\n`;
    }
    text += `----------------------------------------\n`;
    text += `Powered by Receiva — Track your shop sales & profits for free.`;

    return text;
  }, [shopName, baseCurrency]);

  // Actions
  const handleCopyReminder = async (invoice: Invoice) => {
    const text = generateReminderText(invoice);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInvoiceId(invoice.id);
      setTimeout(() => setCopiedInvoiceId(null), 2000);
    } catch (err) {
      console.error('Failed to copy reminder text', err);
    }
  };

  const handleWhatsAppRemind = (invoice: Invoice) => {
    const text = generateReminderText(invoice);
    let phone = invoice.customer_phone ? invoice.customer_phone.replace(/[^0-9]/g, '') : '';
    
    // Auto-prefix local Ghana format
    if (phone.length === 10 && phone.startsWith('0')) {
      phone = '233' + phone.substring(1);
    }

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Filtered invoices calculations
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Search filter
      const matchesSearch = 
        inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.customer_phone && inv.customer_phone.includes(searchTerm));

      if (!matchesSearch) return false;

      // Tab filter
      if (activeTab === 'all') {
        return inv.payment_status === 'credit';
      }
      if (activeTab === 'overdue') {
        return inv.payment_status === 'credit' && getDaysOverdue(inv.due_date) > 0;
      }
      if (activeTab === 'settled') {
        return inv.payment_status === 'paid';
      }
      return true;
    });
  }, [invoices, activeTab, searchTerm]);

  // Counts for badge tabs
  const stats = useMemo(() => {
    let debtors = 0;
    let overdue = 0;
    let settled = 0;
    let totalDebt = 0;

    invoices.forEach(inv => {
      if (inv.payment_status === 'credit') {
        debtors++;
        totalDebt += Number(inv.total_amount) || 0;
        if (getDaysOverdue(inv.due_date) > 0) {
          overdue++;
        }
      } else if (inv.payment_status === 'paid') {
        settled++;
      }
    });

    return { debtors, overdue, settled, totalDebt };
  }, [invoices]);

  return (
    <div className="max-w-6xl mx-auto font-sans text-gray-900">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-100 pb-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
            <Coins className="w-8 h-8 text-[#22c55e]" />
            Credit Book
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Track customer balances, evaluate credit due dates, and dispatch reminders.</p>
        </div>

        {/* Global Debt Summary Box */}
        <div className="mt-4 md:mt-0 p-4 bg-white border border-gray-100 rounded-2xl flex items-center gap-3 shadow-sm">
          <div className="p-2.5 bg-[#22c55e] text-white rounded-lg">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Active Debt</span>
            <h4 className="text-xl font-black text-gray-900 mt-0.5">{baseCurrency} {stats.totalDebt.toFixed(2)}</h4>
          </div>
        </div>
      </div>

      {/* Tabs & Search controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        {/* Navigation Tabs */}
        <div className="flex p-1 bg-gray-100 rounded-lg space-x-1 self-start">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 py-2 px-4 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white text-[#22c55e] shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            All Debtors
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${activeTab === 'all' ? 'bg-green-100 text-[#22c55e]' : 'bg-gray-200 text-gray-600'}`}>
              {stats.debtors}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('overdue')}
            className={`flex items-center gap-2 py-2 px-4 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'overdue'
                ? 'bg-white text-[#22c55e] shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Overdue balances
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${activeTab === 'overdue' ? 'bg-red-100 text-rose-600' : 'bg-gray-200 text-gray-600'}`}>
              {stats.overdue}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settled')}
            className={`flex items-center gap-2 py-2 px-4 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'settled'
                ? 'bg-white text-[#22c55e] shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Settled history
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${activeTab === 'settled' ? 'bg-green-100 text-[#22c55e]' : 'bg-gray-200 text-gray-600'}`}>
              {stats.settled}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by client or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all text-xs"
          />
        </div>
      </div>

      {/* Credit Ledger Container */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {filteredInvoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Customer Details</th>
                  <th className="py-4 px-6">Invoice Reference</th>
                  <th className="py-4 px-6">Billing & Promise Dates</th>
                  <th className="py-4 px-6 text-right">Outstanding Balance</th>
                  <th className="py-4 px-6 text-center">Follow-Up Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredInvoices.map((inv) => {
                  const daysOverdue = getDaysOverdue(inv.due_date);
                  const isOverdue = inv.payment_status === 'credit' && daysOverdue > 0;
                  const isPaid = inv.payment_status === 'paid';
                  const formattedIssued = new Date(inv.created_at).toLocaleDateString();
                  const formattedDue = inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A';

                  return (
                    <tr 
                      key={inv.id} 
                      className={`hover:bg-gray-50/50 transition-colors ${
                        onSelectInvoice ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => onSelectInvoice && onSelectInvoice(inv)}
                    >
                      {/* Customer Details */}
                      <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                        <span className="block font-bold text-gray-900 text-sm">{inv.customer_name}</span>
                        {inv.customer_phone ? (
                          <span className="flex items-center gap-1 text-gray-400 mt-1">
                            <Phone className="w-3.5 h-3.5" />
                            {inv.customer_phone}
                          </span>
                        ) : (
                          <span className="text-gray-300 italic mt-1 block">No number provided</span>
                        )}
                      </td>

                      {/* Invoice Reference */}
                      <td className="py-4 px-6">
                        <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                          #{inv.id.substring(0, 8).toUpperCase()}
                        </span>
                        {inv.extra_notes && (
                          <span className="block text-[10px] text-gray-400 mt-1.5 truncate max-w-xs" title={inv.extra_notes}>
                            "{inv.extra_notes}"
                          </span>
                        )}
                      </td>

                      {/* Dates details */}
                      <td className="py-4 px-6">
                        <div>
                          <span className="text-gray-400">Issued:</span>
                          <span className="font-medium text-gray-700 ml-1">{formattedIssued}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <span className="text-gray-400">Due:</span>
                          <span className={`font-semibold ml-1 ${isOverdue ? 'text-rose-600' : 'text-gray-700'}`}>
                            {formattedDue}
                          </span>
                        </div>
                      </td>

                      {/* Outstanding Balance */}
                      <td className="py-4 px-6 text-right">
                        <span className={`inline-block font-extrabold text-sm px-3 py-1.5 rounded-xl ${
                          isPaid
                            ? 'text-green-700 bg-green-50 border border-green-100'
                            : isOverdue
                              ? 'text-rose-700 bg-rose-50 border border-rose-100 animate-pulse'
                              : 'text-amber-700 bg-amber-50 border border-amber-100'
                        }`}>
                          {baseCurrency} {Number(inv.total_amount).toFixed(2)}
                        </span>
                        
                        {/* Overdue alert badge */}
                        {isOverdue && (
                          <span className="block text-[9px] font-bold text-rose-500 mt-1 text-right">
                            {daysOverdue} Days Overdue
                          </span>
                        )}
                        {isPaid && (
                          <span className="block text-[9px] font-bold text-green-500 mt-1 text-right flex items-center justify-end gap-0.5">
                            <CheckCircle className="w-2.5 h-2.5" />
                            Settled Account
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                        {!isPaid ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setCopywriterInvoice(inv)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-[#22c55e] border border-green-200 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                              title="Compose Tone Reminder Message"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              Remind (AI)
                            </button>

                            <button
                              onClick={() => handleCopyReminder(inv)}
                              className="inline-flex items-center gap-1 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                              title="Copy Reminder"
                            >
                              {copiedInvoiceId === inv.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-green-500" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-[10px]">No action required</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center space-y-3">
            <Users className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="font-bold text-gray-600 text-base">No Records Found</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">There are no transactions in this category matching your search terms.</p>
          </div>
        )}
      </div>

      {copywriterInvoice && (
        <CreditCopywriterModal
          isOpen={!!copywriterInvoice}
          onClose={() => setCopywriterInvoice(null)}
          customer_name={copywriterInvoice.customer_name}
          customer_phone={copywriterInvoice.customer_phone || ''}
          balance_due={copywriterInvoice.total_amount}
          days_overdue={getDaysOverdue(copywriterInvoice.due_date)}
          shopName={shopName}
          baseCurrency={baseCurrency}
        />
      )}
    </div>
  );
};
