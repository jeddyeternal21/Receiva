import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Terminal, 
  Sparkles, 
  AlertCircle, 
  Loader2, 
  Building2, 
  RefreshCw,
  User
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface AiAccountantTerminalProps {
  supabaseUrl?: string;
  shopName?: string;
  aggregatedMetadata?: any;
}

export const AiAccountantTerminal: React.FC<AiAccountantTerminalProps> = ({
  supabaseUrl = 'https://your-supabase-project.supabase.co',
  shopName = 'Receiva Retailer',
  aggregatedMetadata = {
    total_branches: 3,
    total_attendants: 6,
    gross_revenue: 29270.00,
    net_profit: 11070.00,
    outstanding_debt: 4400.00,
    low_stock_alerts: 13
  }
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello! I am your Receiva AI Accountant. I have loaded and aggregated current operational matrices for ${shopName}.\n\nAsk me anything about your store branches (sales volumes, profit margins, active client debt, or inventory stock levels).`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle Query Submit
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userPrompt = input.trim();
    setInput('');
    setError(null);

    // Append user message
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: userPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // 4. Backend Edge Function API Mapping Fetch Request Template
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/ai-accountant-query`;
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${YOUR_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          query: userPrompt,
          metadata: aggregatedMetadata, // Pass aggregated multi-branch stats
          shopName: shopName
        })
      });

      if (!response.ok) {
        throw new Error(`AI Edge Function responded with status ${response.status}`);
      }

      const result = await response.json();
      
      const aiMessage: Message = {
        id: `msg-${Date.now()}-ai`,
        sender: 'ai',
        text: result.answer || 'I completed the analysis, but no report string was returned.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMessage]);

    } catch (err: any) {
      console.warn('[AiAccountant] Edge Function template offline. Processing query locally with mock responses.', err);
      
      // Fallback local mock accounting processor
      await new Promise((resolve) => setTimeout(resolve, 2500)); // Delay to showcase typing animation
      
      const normalizedPrompt = userPrompt.toLowerCase();
      let mockReply = '';

      if (normalizedPrompt.includes('debt') || normalizedPrompt.includes('owe') || normalizedPrompt.includes('debtor')) {
        mockReply = `Based on current branch matrices:\n\n` +
          `*   **Accra Mall Branch** has the highest outstanding debt at **GHS 2,100.00** across 3 active clients.\n` +
          `*   **Adum Kumasi Branch** follows with **GHS 1,450.00**.\n` +
          `*   **Tema Harbour Branch** has **GHS 850.00**.\n\n` +
          `**Total Outstanding Debt:** GHS 4,400.00\n` +
          `**Actionable Recommendation:** Ama Serwaa (Adum Kumasi Branch) is currently 4 days overdue, and Kwame Appiah (Adum Kumasi Branch) is 15 days overdue. We suggest dispatching automated reminders using the Credit Copywriter tool to retrieve GHS 970.50.`;
      } else if (normalizedPrompt.includes('profit') || normalizedPrompt.includes('profitable') || normalizedPrompt.includes('margin')) {
        mockReply = `Consolidated Branch Profitability Rankings:\n\n` +
          `1.  **Accra Mall Branch**: Net Profit **GHS 5,350.00** (Gross: GHS 14,550.00 | Cost: GHS 9,200.00) - *Top Performer*\n` +
          `2.  **Adum Kumasi Branch**: Net Profit **GHS 3,770.00** (Gross: GHS 9,570.00 | Cost: GHS 5,800.00)\n` +
          `3.  **Tema Harbour Branch**: Net Profit **GHS 1,950.00** (Gross: GHS 5,150.00 | Cost: GHS 3,200.00)\n\n` +
          `**Total Enterprise Net Profit:** GHS 11,070.00\n` +
          `**Calculated Gross Margin:** 37.8%\n\n` +
          `Accra Mall remains your most profitable location, contributing 48.3% of your net profits.`;
      } else if (normalizedPrompt.includes('stock') || normalizedPrompt.includes('inventory') || normalizedPrompt.includes('alert')) {
        mockReply = `Inventory Status Report:\n\n` +
          `*   **Adum Kumasi Branch** has **7** items below safety threshold.\n` +
          `*   **Accra Mall Branch** has **4** items below safety threshold.\n` +
          `*   **Tema Harbour Branch** has **2** items below safety threshold.\n\n` +
          `**Critical Warning:** Cooking Oil 1L (Tema Branch) is down to 3 remaining units (threshold is 5). We recommend uploading your wholesale supplier invoice in the Invoice Intake panel to update stock levels.`;
      } else {
        mockReply = `I have reviewed the operational reports for ${shopName}.\n\n` +
          `Operational snapshot:\n` +
          `- Branches: 3 active nodes\n` +
          `- Active Attendants: 6 staff members\n` +
          `- Gross Sales: GHS 29,270.00\n` +
          `- Estimated Net Profit: GHS 11,070.00\n` +
          `- Debt Level: GHS 4,400.00\n` +
          `- Low Stock Alerts: 13 items\n\n` +
          `Please ask me specific questions like: "Which location is most profitable?" or "Any low stock alerts?".`;
      }

      const aiMessage: Message = {
        id: `msg-${Date.now()}-ai`,
        sender: 'ai',
        text: mockReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-sans text-gray-800">
      {/* Terminal Card */}
      <div className="bg-white border border-gray-150 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        {/* Header Block: Dark Charcoal */}
        <div className="bg-gray-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-green-400" />
            <h3 className="text-base font-extrabold tracking-tight">AI Accountant Terminal</h3>
          </div>
          <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-md text-[10px] text-green-400 font-bold">
            <Sparkles className="w-3 h-3 text-green-400" />
            AI Online
          </div>
        </div>

        {/* 1. Conversational Chat Shell Feed */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[350px] bg-slate-50/30">
          {messages.map((msg) => {
            const isAi = msg.sender === 'ai';
            return (
              <div 
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${
                  isAi ? 'self-start mr-auto' : 'self-end ml-auto flex-row-reverse'
                }`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isAi ? 'bg-gray-800 text-white' : 'bg-green-100 text-green-700'
                }`}>
                  {isAi ? <Terminal className="w-4 h-4 text-green-400" /> : <User className="w-4 h-4" />}
                </div>

                {/* Message body */}
                <div className="space-y-1">
                  {/* 5. Monospace Narrative container for AI responses */}
                  <div className={`p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    isAi 
                      ? 'font-mono bg-slate-50 border border-slate-150 text-slate-800 shadow-inner'
                      : 'bg-white border border-gray-150 text-gray-800 shadow-sm font-semibold'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="block text-[9px] text-gray-400 text-right px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {/* 3. Live Loading State typing indicator */}
          {isLoading && (
            <div className="flex gap-3 max-w-[85%] self-start animate-pulse">
              <div className="w-8 h-8 rounded-xl bg-gray-800 text-white flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
              </div>
              <div className="space-y-1">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-bold flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span>The AI Accountant is analyzing branch matrices and compiling your report...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error notifications */}
        {error && (
          <div className="mx-6 my-2 p-2 bg-rose-50 border border-rose-100 rounded-xl text-[10px] text-rose-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* 2. Interactive Query Bar Input Form */}
        <form 
          onSubmit={handleSend}
          className="p-4 bg-white border-t border-gray-150 flex gap-2 items-center"
        >
          <div className="relative flex-1">
            <input
              type="text"
              required
              disabled={isLoading}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your store branches: e.g., Which location has the highest outstanding debt this week?"
              className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-250 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all disabled:bg-gray-100"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 text-white rounded-2xl cursor-pointer transition-colors shadow-sm disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
