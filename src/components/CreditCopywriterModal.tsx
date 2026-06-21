import React, { useState, useMemo } from 'react';
import { 
  X, 
  MessageSquare, 
  Copy, 
  Check, 
  Smile, 
  Briefcase, 
  AlertTriangle 
} from 'lucide-react';

interface CreditCopywriterModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer_name: string;
  customer_phone?: string;
  balance_due: number;
  days_overdue: number;
  shopName?: string;
  baseCurrency?: string;
}

type MessageTone = 'friendly' | 'professional' | 'urgent';

export const CreditCopywriterModal: React.FC<CreditCopywriterModalProps> = ({
  isOpen,
  onClose,
  customer_name,
  customer_phone = '',
  balance_due,
  days_overdue,
  shopName = 'Receiva Retailer',
  baseCurrency = 'GHS'
}) => {
  const [tone, setTone] = useState<MessageTone>('friendly');
  const [copied, setCopied] = useState<boolean>(false);

  // 3. Client-Side Copy Templates
  const generatedMessage = useMemo(() => {
    const formattedBalance = Number(balance_due).toFixed(2);
    let messageBody = '';

    switch (tone) {
      case 'friendly':
        messageBody = `Hi ${customer_name}, just a gentle reminder regarding your balance of ${baseCurrency} ${formattedBalance} with us. Hope business is going well!`;
        break;
      case 'professional':
        messageBody = `Dear ${customer_name}, this is a professional reminder regarding the outstanding balance of ${baseCurrency} ${formattedBalance} on your account with ${shopName}. We kindly request that you make arrangements to settle this balance. Thank you for your cooperation.`;
        break;
      case 'urgent':
        messageBody = `Dear ${customer_name}, this is our third reminder that your balance of ${baseCurrency} ${formattedBalance} is now ${days_overdue} days past its agreed date. Please settle today.`;
        break;
    }

    // 4. Integrated Footnote at the absolute end
    return `${messageBody}\n\nGenerated via Receiva — Track your shop sales & profits for free.`;
  }, [tone, customer_name, balance_due, days_overdue, baseCurrency, shopName]);

  if (!isOpen) return null;

  // 5. WhatsApp & Copy handlers
  const handleWhatsAppSend = () => {
    let cleanPhone = customer_phone.replace(/[^0-9]/g, '');
    
    // Auto-prefix local Ghanaian format
    if (cleanPhone.length === 10 && cleanPhone.startsWith('0')) {
      cleanPhone = '233' + cleanPhone.substring(1);
    }

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(generatedMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[CreditCopywriter] Failed to copy message to clipboard:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 z-10 overflow-hidden border border-gray-200 transform transition-all animate-scaleUp">
        {/* Header */}
        <div className="bg-gray-800 text-white p-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-extrabold tracking-tight">Credit Reminder Copywriter</h3>
            <p className="text-xs text-gray-400 mt-1">Draft the perfect reminder tone for {customer_name}</p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 rounded-full bg-gray-700/50 hover:bg-gray-750 text-gray-300 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tone Selector Tabs */}
        <div className="p-6 space-y-6">
          <div>
            <span className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
              Select Message Tone
            </span>
            {/* 2. Tone selection button group */}
            <div className="grid grid-cols-3 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => setTone('friendly')}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
                  tone === 'friendly'
                    ? 'bg-white text-[#22c55e] shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Smile className="w-3.5 h-3.5 text-green-500" />
                😊 Friendly
              </button>

              <button
                type="button"
                onClick={() => setTone('professional')}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
                  tone === 'professional'
                    ? 'bg-white text-[#22c55e] shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                💼 Professional
              </button>

              <button
                type="button"
                onClick={() => setTone('urgent')}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
                  tone === 'urgent'
                    ? 'bg-white text-rose-600 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                🚨 Urgent
              </button>
            </div>
          </div>

          {/* Message Preview Container */}
          <div>
            <span className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Message Preview
            </span>
            <div className="relative">
              <textarea
                readOnly
                value={generatedMessage}
                rows={6}
                className="w-full p-4 pr-12 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none text-gray-700 leading-relaxed whitespace-pre-wrap select-all font-medium"
              />
              <button
                type="button"
                onClick={handleCopyText}
                className="absolute top-3 right-3 p-2 bg-white hover:bg-gray-150 border border-gray-200 text-gray-400 hover:text-gray-700 rounded-lg transition-colors cursor-pointer"
                title="Copy Message Text"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* 5. Mint Green Action Layout Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleWhatsAppSend}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[#22c55e] hover:bg-[#16a34a] text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-md shadow-green-50"
            >
              <MessageSquare className="w-4 h-4" />
              Send via WhatsApp
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              className="flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  Copied Text!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-gray-400" />
                  Copy Message text
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
