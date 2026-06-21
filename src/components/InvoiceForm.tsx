import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  User, 
  Phone, 
  CreditCard, 
  Layers, 
  AlertCircle, 
  CheckCircle,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { Product } from '../types';
import { useOfflineSync } from '../providers/OfflineSyncProvider';
import { VoiceInputTrigger } from './VoiceInputTrigger';

// Rich fallback mock data if no products are passed in
const MOCK_PRODUCTS: Product[] = [
  { id: '1', shop_id: 'shop-1', item_name: 'Momo Cashout Medium', cost_price: 150, selling_price: 180, stock_remaining: 120, low_stock_threshold: 10 },
  { id: '2', shop_id: 'shop-1', item_name: 'Sachet Water Bundle', cost_price: 6, selling_price: 10, stock_remaining: 45, low_stock_threshold: 10 },
  { id: '3', shop_id: 'shop-1', item_name: 'Premium Jasmine Rice 5kg', cost_price: 65, selling_price: 85, stock_remaining: 12, low_stock_threshold: 5 },
  { id: '4', shop_id: 'shop-1', item_name: 'Cooking Oil 1L', cost_price: 32, selling_price: 40, stock_remaining: 3, low_stock_threshold: 5 },
  { id: '5', shop_id: 'shop-1', item_name: 'Voltic Mineral Water 1.5L', cost_price: 24, selling_price: 36, stock_remaining: 8, low_stock_threshold: 5 },
];

export interface InvoiceLineItemState {
  product_id: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceFormProps {
  products?: Product[];
  onSave?: (invoiceHeader: any, lineItems: InvoiceLineItemState[]) => void;
  isSaving?: boolean;
  isEnterprise?: boolean;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  products = MOCK_PRODUCTS,
  onSave,
  isSaving = false,
  isEnterprise = false,
}) => {
  // Form Header States
  const { isOnline, queueOfflineInvoice } = useOfflineSync();
  const [toast, setToast] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'credit'>('paid');
  const [dueDate, setDueDate] = useState('');
  const [telcoTransactionId, setTelcoTransactionId] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Line Item States
  const [lineItems, setLineItems] = useState<InvoiceLineItemState[]>([
    { product_id: '', quantity: 1, unit_price: 0 }
  ]);

  // Product helper lookup
  const productLookup = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // Calculations
  const calculations = useMemo(() => {
    let grossTotal = 0;
    let totalItems = 0;
    let estimatedCost = 0;

    lineItems.forEach(item => {
      const product = productLookup.get(item.product_id);
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      
      grossTotal += qty * price;
      totalItems += qty;
      
      if (product) {
        estimatedCost += qty * (Number(product.cost_price) || 0);
      }
    });

    const projectedProfit = grossTotal - estimatedCost;

    return {
      grossTotal,
      totalItems,
      estimatedCost,
      projectedProfit,
    };
  }, [lineItems, productLookup]);

  // Add a new line item row
  const addLineItem = () => {
    setLineItems([...lineItems, { product_id: '', quantity: 1, unit_price: 0 }]);
  };

  // Remove a line item row
  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) {
      setLineItems([{ product_id: '', quantity: 1, unit_price: 0 }]);
    } else {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  // Update specific field in a line item row
  const updateLineItem = (index: number, field: keyof InvoiceLineItemState, value: string | number) => {
    const updated = lineItems.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        
        // Auto-populate unit price when product selection changes
        if (field === 'product_id') {
          const selectedProduct = productLookup.get(value as string);
          updatedItem.unit_price = selectedProduct ? selectedProduct.selling_price : 0;
        }
        
        return updatedItem;
      }
      return item;
    });
    setLineItems(updated);
  };

  const clearForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setPaymentStatus('paid');
    setDueDate('');
    setTelcoTransactionId('');
    setExtraNotes('');
    setLineItems([{ product_id: '', quantity: 1, unit_price: 0 }]);
  };

  const handleDictationComplete = (transcript: string) => {
    setFormError(null);
    const text = transcript.toLowerCase().trim();
    
    // Parse voice input (e.g. "Add 3 Jasmine Rice" or "3 Voltic")
    const match = text.match(/(?:add\s+)?(\d+)\s+(.+)/);
    if (match) {
      const qty = parseInt(match[1]) || 1;
      const searchName = match[2].trim();
      
      // Find matching product by name (case-insensitive substring match)
      const foundProduct = products.find(p => 
        p.item_name.toLowerCase().includes(searchName)
      );
      
      if (foundProduct) {
        // Add to line items
        // If the first row is empty, update it. Otherwise add a new row.
        if (lineItems.length === 1 && !lineItems[0].product_id) {
          setLineItems([{
            product_id: foundProduct.id,
            quantity: qty,
            unit_price: foundProduct.selling_price
          }]);
        } else {
          setLineItems([...lineItems, {
            product_id: foundProduct.id,
            quantity: qty,
            unit_price: foundProduct.selling_price
          }]);
        }
        setToast(`Added ${qty} x ${foundProduct.item_name}`);
        setTimeout(() => setToast(null), 3000);
      } else {
        setFormError(`Could not find a product matching "${searchName}"`);
      }
    } else {
      setFormError(`Could not parse voice input: "${transcript}". Try saying "Add 3 Jasmine Rice"`);
    }
  };

  // Form validator and compiler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validations
    if (!customerName.trim()) {
      setFormError('Customer Name is required.');
      return;
    }

    if (paymentStatus === 'credit' && !dueDate) {
      setFormError('Due Date is required for credit sales.');
      return;
    }

    const invalidRow = lineItems.find(item => !item.product_id || item.quantity <= 0);
    if (invalidRow) {
      setFormError('All line items must have a valid product selected and quantity greater than 0.');
      return;
    }

    // Verify stock constraints (soft warning/hard check)
    let stockAlert = false;
    lineItems.forEach(item => {
      const prod = productLookup.get(item.product_id);
      if (prod && item.quantity > prod.stock_remaining) {
        stockAlert = true;
      }
    });

    if (stockAlert) {
      if (!window.confirm('Some items exceed currently available inventory levels. Do you want to save anyway?')) {
        return;
      }
    }

    // Compile values
    const invoiceHeader = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || null,
      payment_status: paymentStatus,
      telco_transaction_id: telcoTransactionId.trim() || null,
      due_date: paymentStatus === 'credit' ? dueDate : null,
      extra_notes: extraNotes.trim() || null,
      total_amount: calculations.grossTotal,
    };

    if (isOnline) {
      if (onSave) {
        onSave(invoiceHeader, lineItems);
      }
    } else {
      // 2. Form Submission Interception (Offline Mode)
      queueOfflineInvoice({ invoiceHeader, lineItems });
      clearForm();
      setToast('Invoice saved locally! Receiva will auto-sync when connection is restored.');
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto font-sans text-[var(--c-text)]">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-[var(--c-border)] pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[var(--c-light)] border border-[var(--c-border)] rounded-lg">
              <Receipt className="w-6 h-6 text-[#22c55e]" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--c-text)]">Billing Desk</h1>
          </div>
          <p className="text-[var(--c-muted)] mt-1">Create invoices, manage inventory deductions, and log client credit balances.</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-500/10 text-[#22c55e] border border-[#22c55e]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-ping"></span>
            Registers Online
          </span>
        </div>
      </div>

      {formError && (
        <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-rose-800">Validation Failure</h3>
            <p className="text-sm text-rose-700 mt-1">{formError}</p>
          </div>
        </div>
      )}

      {/* Grid Layout: Left is Form desk, Right is live receipt preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Form Panel */}
        <form onSubmit={handleSubmit} className="xl:col-span-7 space-y-6">
          {/* Card Container */}
          <div className="bg-[var(--c-white)] border border-[var(--c-border)] rounded-2xl shadow-sm p-6 space-y-6">
            <div className="border-b border-[var(--c-border)] pb-4">
              <h2 className="text-lg font-bold text-[var(--c-text)] flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400" />
                Customer & Payment Header
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--c-muted)] uppercase tracking-wider mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--c-border)] bg-[var(--c-white)] text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--c-muted)] uppercase tracking-wider mb-2">
                  Customer Phone
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +233 24 000 0000"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--c-border)] bg-[var(--c-white)] text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Stylized Payment Status Toggle */}
              <div>
                <label className="block text-xs font-bold text-[var(--c-muted)] uppercase tracking-wider mb-2">
                  Payment Status
                </label>
                <div className="grid grid-cols-2 p-1 bg-[var(--c-light)] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('paid')}
                    className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                      paymentStatus === 'paid'
                        ? 'bg-[var(--c-white)] text-[var(--c-text)] shadow-sm border border-[var(--c-border)]'
                        : 'text-[var(--c-muted)] hover:text-[var(--c-text)]'
                    }`}
                  >
                    Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('credit')}
                    className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                      paymentStatus === 'credit'
                        ? 'bg-[var(--c-white)] text-rose-500 shadow-sm border border-[var(--c-border)]'
                        : 'text-[var(--c-muted)] hover:text-[var(--c-text)]'
                    }`}
                  >
                    Credit / Debt
                  </button>
                </div>
              </div>

              {/* Dynamic Due Date or Momo details */}
              {paymentStatus === 'credit' ? (
                <div className="animate-fadeIn">
                  <label className="block text-xs font-bold text-[var(--c-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-rose-500" />
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-[var(--c-border)] bg-[var(--c-white)] text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all"
                  />
                </div>
              ) : (
                <div className="animate-fadeIn">
                  <label className="block text-xs font-bold text-[var(--c-muted)] uppercase tracking-wider mb-2">
                    Transaction ID (Momo / Bank)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TXN9827419"
                    value={telcoTransactionId}
                    onChange={(e) => setTelcoTransactionId(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-[var(--c-border)] bg-[var(--c-white)] text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all"
                  />
                </div>
              )}
            </div>

            {/* Expandable/Collapsible Notes Accordion */}
            <div className="border border-[var(--c-border)] rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setNotesExpanded(!notesExpanded)}
                className="w-full px-4 py-2 bg-[var(--c-light)] flex items-center justify-between text-left text-sm font-semibold text-[var(--c-text)] hover:bg-[var(--c-light)]/80 transition-colors"
              >
                <span>Internal Notes (Private)</span>
                {notesExpanded ? (
                  <ChevronUp className="w-4 h-4 text-[var(--c-muted)]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--c-muted)]" />
                )}
              </button>
              {notesExpanded && (
                <div className="p-4 border-t border-[var(--c-border)] bg-[var(--c-white)] animate-slideDown">
                  <textarea
                    rows={3}
                    placeholder="Provide any private details about this billing or client credit terms..."
                    value={extraNotes}
                    onChange={(e) => setExtraNotes(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-[var(--c-border)] bg-[var(--c-white)] text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Line Items Card */}
          <div className="bg-[var(--c-white)] border border-[var(--c-border)] rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-[var(--c-border)] pb-4">
              <h2 className="text-lg font-bold text-[var(--c-text)] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[var(--c-muted)]" />
                Dynamic Line Items
              </h2>
              <div className="flex items-center gap-3">
                {isEnterprise && (
                  <VoiceInputTrigger onDictationComplete={handleDictationComplete} />
                )}
                <button
                  type="button"
                  onClick={addLineItem}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#22c55e] hover:text-[#16a34a] bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded-lg border border-[#22c55e]/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Item
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {lineItems.map((item, index) => {
                const selectedProduct = productLookup.get(item.product_id);
                const isOutOfStock = selectedProduct ? item.quantity > selectedProduct.stock_remaining : false;
                const isLowStock = selectedProduct ? selectedProduct.stock_remaining <= selectedProduct.low_stock_threshold : false;

                return (
                  <div 
                    key={index}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 p-5 bg-[var(--c-light)]/50 border border-[var(--c-border)] rounded-xl relative group transition-all duration-200 hover:border-[var(--c-border)]/85"
                  >
                    {/* Product Selection */}
                    <div className="col-span-1 sm:col-span-2 lg:col-span-5">
                      <label className="block text-[10px] font-bold text-[var(--c-muted)] uppercase mb-1.5">
                        Product / Item
                      </label>
                      <select
                        required
                        value={item.product_id}
                        onChange={(e) => updateLineItem(index, 'product_id', e.target.value)}
                        className="w-full px-4 py-2 text-sm bg-[var(--c-white)] text-[var(--c-text)] rounded-lg border border-[var(--c-border)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all"
                      >
                        <option value="" disabled>-- Select a Product --</option>
                        {products.map((prod) => (
                          <option key={prod.id} value={prod.id}>
                            {prod.item_name} (Price: GHS {prod.selling_price} | Stock: {prod.stock_remaining})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity field */}
                    <div className="col-span-1 lg:col-span-2">
                      <label className="block text-[10px] font-bold text-[var(--c-muted)] uppercase mb-1.5">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 text-sm bg-[var(--c-white)] text-[var(--c-text)] rounded-lg border border-[var(--c-border)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all"
                      />
                    </div>

                    {/* Unit price field */}
                    <div className="col-span-1 lg:col-span-2">
                      <label className="block text-[10px] font-bold text-[var(--c-muted)] uppercase mb-1.5">
                        Unit Price (GHS)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-2 text-sm bg-[var(--c-white)] text-[var(--c-text)] rounded-lg border border-[var(--c-border)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all"
                      />
                    </div>

                    {/* Row subtotal */}
                    <div className="col-span-1 lg:col-span-2 flex flex-col justify-between">
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--c-muted)] uppercase mb-1.5">
                          Subtotal
                        </label>
                        <div className="text-sm font-bold text-[var(--c-text)] pt-2">
                          GHS {((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Delete Row Button */}
                    <div className="col-span-1 lg:col-span-1 flex items-end justify-end pb-1.5">
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="p-2 text-[var(--c-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Delete Row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Dynamic warnings based on inventory stock */}
                    {selectedProduct && (
                      <div className="absolute -bottom-2.5 left-4 flex gap-2">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Exceeds Available Stock ({selectedProduct.stock_remaining} left)
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Low stock warning ({selectedProduct.stock_remaining} remaining)
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        {/* Live Invoice Preview Receipt Panel */}
        <div className="xl:col-span-5 space-y-6 xl:sticky xl:top-8">
          {/* Visual Invoice Mockup */}
          <div className="bg-[var(--c-white)] border border-[var(--c-border)] rounded-2xl overflow-hidden shadow-md">
            {/* Header: Charcoal */}
            <div className="bg-gray-800 text-white p-6 relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Receipt className="w-24 h-24 text-white" />
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-extrabold tracking-wider text-green-400">RECEIVA</h3>
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-0.5">Central Billing Desk</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${
                    paymentStatus === 'paid'
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {paymentStatus === 'paid' ? 'PAID' : 'CREDIT DUE'}
                  </span>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Bill To</p>
                  <p className="font-extrabold text-sm text-gray-100 mt-1 truncate">
                    {customerName || 'Pending Customer'}
                  </p>
                  <p className="text-gray-300 mt-0.5">{customerPhone || 'No phone provided'}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Billing Date</p>
                  <p className="font-bold text-gray-100 mt-1">{new Date().toLocaleDateString()}</p>
                  {paymentStatus === 'credit' && dueDate && (
                    <div className="mt-1">
                      <p className="text-rose-400 font-bold uppercase tracking-wider text-[9px]">Due Date</p>
                      <p className="font-extrabold text-rose-300">{new Date(dueDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Invoice Line items receipt view */}
            <div className="p-6 space-y-4">
              <div className="text-xs font-bold text-[var(--c-muted)] uppercase tracking-widest border-b border-[var(--c-border)] pb-2">
                Invoice Summary
              </div>

              <div className="divide-y divide-[var(--c-border)] max-h-56 overflow-y-auto pr-1">
                {lineItems.map((item, index) => {
                  const product = productLookup.get(item.product_id);
                  if (!product) return null;
                  
                  return (
                    <div key={index} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-[var(--c-text)]">{product.item_name}</p>
                        <p className="text-[var(--c-muted)] mt-0.5">
                          {item.quantity} x GHS {item.unit_price.toFixed(2)}
                        </p>
                      </div>
                      <div className="font-extrabold text-[var(--c-text)]">
                        GHS {(item.quantity * item.unit_price).toFixed(2)}
                      </div>
                    </div>
                  );
                })}

                {lineItems.filter(item => item.product_id).length === 0 && (
                  <div className="py-8 text-center text-xs text-[var(--c-muted)] italic">
                    Add line items to generate receipt
                  </div>
                )}
              </div>

              {/* Financial Calculation Block */}
              <div className="border-t border-[var(--c-border)] pt-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs text-[var(--c-muted)]">
                  <span>Total Quantity</span>
                  <span className="font-bold text-[var(--c-text)]">{calculations.totalItems} Items</span>
                </div>
                <div className="flex justify-between items-center text-xs text-[var(--c-muted)]">
                  <span>Gross Subtotal</span>
                  <span className="font-bold text-[var(--c-text)]">GHS {calculations.grossTotal.toFixed(2)}</span>
                </div>

                {/* Optional Smart Momo transaction trace */}
                {paymentStatus === 'paid' && telcoTransactionId && (
                  <div className="flex justify-between items-center text-[10px] bg-[var(--c-light)] p-2 rounded-lg border border-[var(--c-border)] text-[var(--c-muted)]">
                    <span className="font-medium">Momo Transaction ID</span>
                    <span className="font-mono font-bold text-[var(--c-text)]">{telcoTransactionId}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2.5 border-t border-[var(--c-border)] text-base font-extrabold text-[var(--c-text)]">
                  <span>Total Amount</span>
                  <span className="text-[#22c55e]">GHS {calculations.grossTotal.toFixed(2)}</span>
                </div>

                {/* Estimate Profit Margin Badge for Shop Owners */}
                {calculations.projectedProfit > 0 && (
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between text-xs text-green-800 dark:text-green-200">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-[#22c55e]" />
                      <span className="font-bold text-green-700 dark:text-green-300">Projected Net Margin</span>
                    </div>
                    <span className="font-extrabold text-[#22c55e]">
                      GHS {calculations.projectedProfit.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Submission Block */}
            <div className="p-6 bg-[var(--c-light)] border-t border-[var(--c-border)]">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-300 text-white text-sm font-bold rounded-lg transition-all cursor-pointer shadow-md shadow-green-500/10"
              >
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Compiling & Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Save Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 p-4 bg-amber-500 text-white rounded-xl shadow-lg border border-amber-600 flex items-center gap-3 animate-slideIn">
          <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
          <span className="text-xs font-bold">{toast}</span>
        </div>
      )}
    </div>
  );
};
