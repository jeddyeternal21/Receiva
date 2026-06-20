import React, { useState } from 'react';
import { 
  Share2, 
  Copy, 
  Check, 
  Calendar, 
  Phone, 
  FileText, 
  ArrowLeft,
  DollarSign,
  Briefcase
} from 'lucide-react';
import { Shop, Invoice, InvoiceItem, Product } from '../types';

export interface InvoiceItemWithProduct extends InvoiceItem {
  product?: Product;
}

interface InvoiceDetailViewProps {
  invoice: Invoice;
  invoiceItems: InvoiceItemWithProduct[];
  shop?: Shop;
  onBack?: () => void;
}

export const InvoiceDetailView: React.FC<InvoiceDetailViewProps> = ({
  invoice,
  invoiceItems,
  shop = {
    id: 'shop-default',
    name: 'Receiva Retailer',
    current_tier: 'business',
    base_currency: 'GHS',
    created_at: new Date().toISOString()
  },
  onBack
}) => {
  const [copied, setCopied] = useState(false);

  const formattedDate = new Date(invoice.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // 1. Text receipt compiler function
  const receiptText = React.useMemo(() => {
    const statusLabel = invoice.payment_status === 'paid' ? '✅ Paid' : '⚠️ Credit (Unpaid)';
    const baseCurrency = shop.base_currency || 'GHS';
    
    let itemList = '';
    invoiceItems.forEach((item, index) => {
      const name = item.product?.item_name || 'General Item';
      const qty = item.quantity || 0;
      const price = Number(item.unit_price || 0).toFixed(2);
      const total = (qty * Number(item.unit_price || 0)).toFixed(2);
      itemList += `${index + 1}. ${name}\n   Qty: ${qty} x ${baseCurrency} ${price} = ${baseCurrency} ${total}\n`;
    });

    let text = `🧾 *RECEIPT FROM ${shop.name.toUpperCase()}*\n`;
    text += `===============================\n`;
    text += `*Invoice Ref:* #${invoice.id.substring(0, 8).toUpperCase()}\n`;
    text += `*Date:* ${new Date(invoice.created_at).toLocaleDateString()}\n`;
    text += `*Client:* ${invoice.customer_name}\n`;
    if (invoice.customer_phone) {
      text += `*Phone:* ${invoice.customer_phone}\n`;
    }
    text += `===============================\n`;
    text += `*Items Purchased:*\n${itemList}`;
    text += `===============================\n`;
    text += `*Grand Total:* ${baseCurrency} ${Number(invoice.total_amount).toFixed(2)}\n`;
    text += `*Payment Status:* ${statusLabel}\n`;

    if (invoice.payment_status === 'credit' && invoice.due_date) {
      const dueStr = new Date(invoice.due_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      text += `*Due Date:* ${dueStr}\n`;
    }

    if (invoice.telco_transaction_id) {
      text += `*Transaction Ref:* ${invoice.telco_transaction_id}\n`;
    }

    text += `\n`;
    text += `Generated via Receiva — Track your shop sales & profits for free.`;
    return text;
  }, [invoice, invoiceItems, shop]);

  // 2. Clipboard action handler
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(receiptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy text receipt to clipboard', err);
    }
  };

  // 3. WhatsApp sharing link compiler
  const handleWhatsAppShare = () => {
    // Format the phone number: remove non-numeric values
    let phoneNum = invoice.customer_phone ? invoice.customer_phone.replace(/[^0-9]/g, '') : '';
    
    // Fallback prefix: If it starts with 0 and has length of 10 (Ghanan local code format), prefix with Ghana country code 233
    if (phoneNum.length === 10 && phoneNum.startsWith('0')) {
      phoneNum = '233' + phoneNum.substring(1);
    }

    const whatsappUrl = `https://wa.me/${phoneNum}?text=${encodeURIComponent(receiptText)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-sans text-gray-800">
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 mb-6 group cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to invoices
        </button>
      )}

      {/* Main card design */}
      <div className="bg-white border border-gray-150 rounded-3xl overflow-hidden shadow-sm">
        {/* Header Block: Charcoal Gray */}
        <div className="bg-gray-800 text-white px-8 py-8 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-green-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{shop.name}</span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight mt-1 text-white">
                Invoice #{invoice.id.substring(0, 8).toUpperCase()}
              </h2>
              <p className="text-xs text-gray-400 mt-1">{formattedDate}</p>
            </div>
            
            <div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                invoice.payment_status === 'paid'
                  ? 'bg-green-500/10 text-green-400 border-green-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  invoice.payment_status === 'paid' ? 'bg-green-400' : 'bg-rose-400'
                }`}></span>
                {invoice.payment_status === 'paid' ? 'PAID RECEIPT' : 'CREDIT DUE'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-6 border-t border-gray-700/50 text-xs">
            <div>
              <span className="block text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Bill To</span>
              <span className="block text-sm font-extrabold text-white mt-1">{invoice.customer_name}</span>
              {invoice.customer_phone && (
                <span className="flex items-center gap-1 text-gray-300 mt-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {invoice.customer_phone}
                </span>
              )}
            </div>

            <div>
              <span className="block text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Payment Metadata</span>
              {invoice.payment_status === 'paid' && invoice.telco_transaction_id ? (
                <span className="block mt-1">
                  <span className="text-gray-300">Transaction ID:</span>
                  <span className="font-mono text-white font-bold ml-1">{invoice.telco_transaction_id}</span>
                </span>
              ) : invoice.payment_status === 'credit' && invoice.due_date ? (
                <span className="flex items-center gap-1 text-rose-300 font-bold mt-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Due on {new Date(invoice.due_date).toLocaleDateString()}
                </span>
              ) : (
                <span className="block text-gray-300 mt-1 italic">No extra metadata</span>
              )}
            </div>

            <div className="md:text-right">
              <span className="block text-gray-400 font-semibold uppercase tracking-wider text-[9px]">Total Billed</span>
              <span className="block text-2xl font-black text-green-400 mt-0.5">
                {shop.base_currency} {Number(invoice.total_amount).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Body Content */}
        <div className="p-8">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Line Items</h3>
          
          {/* Tailwind HTML Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 pr-4">Item Description</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 pl-4 text-right">Total Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {invoiceItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="py-4 pr-4 font-bold text-gray-900">
                      {item.product?.item_name || 'General Inventory Item'}
                    </td>
                    <td className="py-4 px-4 text-center text-gray-600 font-semibold">
                      {item.quantity}
                    </td>
                    <td className="py-4 px-4 text-right text-gray-600 font-medium">
                      {shop.base_currency} {Number(item.unit_price).toFixed(2)}
                    </td>
                    <td className="py-4 pl-4 text-right font-bold text-gray-900">
                      {shop.base_currency} {(item.quantity * Number(item.unit_price)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom summaries */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 pt-8 border-t border-gray-100">
            {/* Notes Section */}
            <div>
              {invoice.extra_notes ? (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    Internal Notes (Private)
                  </span>
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{invoice.extra_notes}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No internal remarks left on this register.</p>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span className="font-bold text-gray-900">
                  {shop.base_currency} {Number(invoice.total_amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Tax / V.A.T</span>
                <span className="font-medium text-gray-900">0.00%</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-gray-900 pt-3 border-t border-gray-100">
                <span>Total Amount Due</span>
                <span className="text-green-600">
                  {shop.base_currency} {Number(invoice.total_amount).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Sharing Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10">
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center justify-center gap-2 py-3.5 px-6 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-green-50"
            >
              <Share2 className="w-4 h-4" />
              Share via WhatsApp
            </button>

            <button
              onClick={handleCopyText}
              className="flex items-center justify-center gap-2 py-3.5 px-6 border border-gray-250 hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  Copied Receipt!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Text Receipt
                </>
              )}
            </button>
          </div>

          {/* Virality Footnote */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center text-xs text-gray-400 font-medium italic">
            Generated via Receiva — Track your shop sales & profits for free.
          </div>
        </div>
      </div>
    </div>
  );
};
