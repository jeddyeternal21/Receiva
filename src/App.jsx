import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase";

// ─── CONSTANTS ────────────────────────────────────────────────
const CATEGORIES = ["Sales","Service fee","Rent","Supplies","Transport","Salary","Utilities","MoMo transfer","Other"];
const FREE_RECEIPT_LIMIT = 5;
const today = () => new Date().toISOString().split("T")[0];
const genId  = () => Math.random().toString(36).slice(2,9);
const genRNo = () => `RCV-${Date.now().toString().slice(-6)}`;
const fmt    = n  => `GH₵ ${Number(n).toLocaleString("en-GH",{minimumFractionDigits:2})}`;

// ─── WALLET PRESETS ───────────────────────────────────────────
const WALLET_PRESETS = [
  { id:"mtn",     label:"MTN MoMo",       color:"#FFCC00", bg:"#fff9e6", icon:"📱" },
  { id:"telecel", label:"Telecel Cash",   color:"#E30613", bg:"#ffeaeb", icon:"📲" },
  { id:"voda",    label:"Vodafone Cash",  color:"#E30613", bg:"#ffeaeb", icon:"📡" },
  { id:"company", label:"Company Account",color:"#F97316", bg:"#fff4ed", icon:"🏢" },
  { id:"cash",    label:"Cash",           color:"#16a34a", bg:"#f0fdf4", icon:"💵" },
  { id:"bank",    label:"Bank Account",   color:"#2563eb", bg:"#eff6ff", icon:"🏦" },
];

// ─── DEMO DATA ────────────────────────────────────────────────
const DEMO_WALLETS = [];
const DEMO_TRANSACTIONS = [];
const DEMO_PRODUCT_CATS = [];

const DEMO_PRODUCTS = [];

const DEMO_BUSINESS = { name:"My Business", owner:"", phone:"", industry:"", plan:"free", logoColor:"#F97316", logoBg:"#fff4ed" };

// ─── GHANA MOMO PARSER ────────────────────────────────────────
function detectNetwork(text) {
  const t = text.toLowerCase();
  if (/telecel\d{10,}/.test(t)||t.includes("telecel cash")||t.includes("telecel play")) return "Telecel";
  if (t.includes("mtn mobile money")||t.includes("transaction id:")||/payment received for ghs/i.test(t)) return "MTN";
  if (t.includes("vodafone")||t.includes("vodacash")) return "Vodafone";
  if (t.includes("airteltigo")) return "AirtelTigo";
  return "MoMo";
}
function verifyTxId(txId, network) {
  if (!txId) return { valid:false, reason:"No transaction ID found" };
  const id = txId.replace(/\D/g,"");
  if (network==="MTN")     return /^\d{11}$/.test(id) ? { valid:true,  reason:`Valid MTN ID · ${id.length} digits ✓` } : { valid:false, reason:`MTN needs 11 digits — got ${id.length}` };
  if (network==="Telecel") return id.length>=10        ? { valid:true,  reason:`Valid Telecel ID · ${id.length} digits ✓` } : { valid:false, reason:`Telecel ID short — got ${id.length}` };
  return { valid:true, reason:`Transaction ID recorded (${id.length} digits)` };
}
function parseGhanaMoMo(text) {
  const raw = text.replace(/\s+/g," ").trim();
  const network = detectNetwork(raw);
  const amtMatch  = raw.match(/GH[SC₵¢]?\s*(\d{1,6}(?:[.,]\d{1,2})?)/i);
  const amount    = amtMatch ? amtMatch[1].replace(",","") : "";
  let txId="";
  const mtnId    = raw.match(/transaction\s*id[:\s]+(\d{8,12})/i);
  const telPfx   = raw.match(/^telecel(\d{10,16})/i);
  if (mtnId) txId=mtnId[1]; else if (telPfx) txId=telPfx[1];
  const dateMatch = raw.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  let date = dateMatch ? dateMatch[1] : today();
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(date)) {
    const p=date.split(/[\/\-]/), yr=p[2].length===2?"20"+p[2]:p[2];
    date=`${yr}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
  }
  const timeMatch = raw.match(/(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2}\s*[APap][Mm])/);
  const time = timeMatch ? timeMatch[1] : "";
  let sender="";
  const mtnS = raw.match(/(?:payment received.*?from|from)\s+([A-Z][A-Z\s]{3,40}?)(?:\s+Current|\s*,|\s*\.)/i);
  const telS = raw.match(/sent to\s+\d+\s+([A-Z][A-Z\s]{3,40}?)\s+on\s+/i);
  const refS = raw.match(/reference:\s+([A-Z][A-Z\s]{3,40}?)(?:\s*,|\s*\.|$)/im);
  if (mtnS) sender=mtnS[1].trim(); else if (telS) sender=telS[1].trim(); else if (refS) sender=refS[1].trim();
  const feeMatch = raw.match(/(?:transaction fee|you were charged|fee)[:\s]+GH[SC₵¢]?\s*(\d+(?:[.,]\d{1,2})?)/i);
  const fee = feeMatch ? feeMatch[1].replace(",","") : "0.00";
  const balMatch = raw.match(/(?:current balance|your telecel cash balance|balance)[:\s]+GH[SC₵¢]?\s*(\d+(?:[.,]\d{1,2})?)/i);
  const balance = balMatch ? balMatch[1].replace(",","") : "";
  const levyMatch = raw.match(/e-levy[^:]*[:\s]+GH[SC₵¢]?\s*(\d+(?:[.,]\d{1,2})?)/i);
  const elevy = levyMatch ? levyMatch[1] : "0.00";
  return { network, amount, txId, date, time, sender, fee, balance, elevy, description:"", category:"Sales", verification:verifyTxId(txId,network) };
}

// ─── ICONS ───────────────────────────────────────────────────
const Icon = ({ d, size=18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);
const IC = {
  home:    "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  tx:      "M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  receipt: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  wallet:  "M21 7H3a2 2 0 00-2 2v10a2 2 0 002 2h18a2 2 0 002-2V9a2 2 0 00-2-2zM16 13a1 1 0 110 2 1 1 0 010-2zM1 7l4-4h14l4 4",
  plus:    "M12 5v14M5 12h14",
  share:   "M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13",
  check:   "M20 6L9 17l-5-5",
  x:       "M18 6L6 18M6 6l12 12",
  report:  "M18 20V10M12 20V4M6 20v-6",
  eye:     "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
  momo:    "M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2",
  box:     "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12",
  lock:    "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4",
  star:    "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
};

// ─── COLORS ──────────────────────────────────────────────────
const C = {
  orange:  "#F97316",
  orangeD: "#ea6a08",
  teal:    "#0BADA8",
  income:  "#0BADA8",
  expense: "#ef4444",
  text:    "#111827",
  muted:   "#6b7280",
  light:   "#f9fafb",
  border:  "#e5e7eb",
  white:   "#ffffff",
  sidebar: "#ffffff",
  sidebarBorder: "#f0f0f0",
};

// ─── SHARED UI ────────────────────────────────────────────────
const card  = (extra={}) => ({ background:C.white, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px", ...extra });
const label = { fontSize:12, color:C.muted, marginBottom:5, display:"block", letterSpacing:"0.04em", fontWeight:500 };
const input = { background:"#f9fafb", border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", color:C.text, fontSize:14, fontFamily:"'Poppins',sans-serif", outline:"none", width:"100%", boxSizing:"border-box", transition:"border-color 0.2s" };
const formRow = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 };

function Btn({ children, onClick, variant="primary", full=false, size="md", href, style={}, disabled=false }) {
  const base = { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7, borderRadius:8, border:"none", cursor:disabled?"not-allowed":"pointer", fontFamily:"'Poppins',sans-serif", fontWeight:500, textDecoration:"none", transition:"all 0.15s", opacity: disabled ? 0.5 : 1, ...(full ? { width:"100%" } : {}), ...(size==="sm" ? { padding:"7px 14px", fontSize:12 } : { padding:"10px 20px", fontSize:14 }), ...style };
  const variants = {
    primary: { background:C.orange, color:"#fff" },
    ghost:   { background:"transparent", color:C.muted, border:`1px solid ${C.border}` },
    teal:    { background:C.teal, color:"#fff" },
    green:   { background:"#16a34a", color:"#fff" },
    wa:      { background:"#25D366", color:"#fff" },
    outline: { background:"transparent", color:C.orange, border:`1px solid ${C.orange}` },
  };
  const s = { ...base, ...variants[variant] };
  if (href) return <a href={href} target="_blank" rel="noreferrer" style={s}>{children}</a>;
  return <button style={s} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Badge({ children, color="#0BADA8", bg }) {
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:500, background: bg || color+"18", color }}>{children}</span>;
}

function Modal({ children, onClose, maxWidth=520 }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }} onClick={onClose}>
      <div style={{ background:C.white, borderRadius:18, padding:"28px 30px", width:"100%", maxWidth, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, color:C.text }}>{title}</div>
      <Btn variant="ghost" size="sm" onClick={onClose} style={{ padding:"6px 10px" }}><Icon d={IC.x} size={14}/></Btn>
    </div>
  );
}

// ─── WALLET PILL ─────────────────────────────────────────────
function WalletPill({ wallet, active, onClick }) {
  const preset = WALLET_PRESETS.find(p=>p.id===wallet.presetId) || WALLET_PRESETS[0];
  return (
    <div onClick={onClick} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px", borderRadius:20, cursor:"pointer", background: active ? preset.color+"18" : "#f3f4f6", border:`1.5px solid ${active ? preset.color : "transparent"}`, transition:"all 0.15s", whiteSpace:"nowrap" }}>
      <span style={{ fontSize:14 }}>{preset.icon}</span>
      <span style={{ fontSize:13, fontWeight:500, color: active ? preset.color : C.muted }}>{wallet.name}</span>
    </div>
  );
}

// ─── NETWORK COLOR MAP ────────────────────────────────────────
const NET_COLOR = { MTN:"#FFCC00", Telecel:"#E30613", Vodafone:"#E30613", AirtelTigo:"#EF3E33", MoMo:C.teal };

// ═══════════════════════════════════════════════════════════════
// LOGIN PAGE
// ═══════════════════════════════════════════════════════════════
function LoginPage({ onLogin, onGuest }) {
  const [tab, setTab]     = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [name, setName]   = useState("");

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <div style={{ minHeight:"100vh", background:"#f9fafb", fontFamily:"'Poppins',sans-serif", display:"flex", flexDirection:"column" }}>

        {/* TOP NAV */}
        <div style={{ padding:"18px 40px", display:"flex", justifyContent:"space-between", alignItems:"center", background:C.white, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:C.text }}>
            Receiva<span style={{ color:C.orange }}>.</span>
          </div>
          <div style={{ fontSize:13, color:C.muted }}>Financial records for Ghana businesses</div>
        </div>

        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 20px" }}>
          <div style={{ width:"100%", maxWidth:980, display:"grid", gridTemplateColumns:"1fr 1fr", gap:48, alignItems:"center" }}>

            {/* LEFT — VALUE PROP */}
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:36, color:C.text, lineHeight:1.1, marginBottom:16 }}>
                Your business records,<br/><span style={{ color:C.orange }}>organised.</span>
              </div>
              <div style={{ fontSize:15, color:C.muted, lineHeight:1.75, marginBottom:28 }}>
                Turn MoMo SMS and payment screenshots into professional receipts. Track income, expenses, and generate monthly reports — all in one place.
              </div>

              {/* FREE TRIAL HIGHLIGHT */}
              <div style={{ background:`linear-gradient(135deg, ${C.orange}18, ${C.orange}08)`, border:`1.5px solid ${C.orange}33`, borderRadius:14, padding:"18px 20px", marginBottom:24 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <span style={{ fontSize:20 }}>🎁</span>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:16, color:C.text }}>Try before you sign up</div>
                </div>
                <div style={{ fontSize:14, color:C.muted, lineHeight:1.65, marginBottom:14 }}>
                  Generate <strong style={{ color:C.orange }}>5 free receipts</strong> right now — no account needed. See exactly how Receiva works before committing.
                </div>
                <Btn variant="outline" onClick={onGuest} full>
                  <Icon d={IC.receipt} size={15}/> Try 5 free receipts →
                </Btn>
              </div>

              {/* PLANS */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { plan:"Free", price:"GH₵ 0", perks:["30 transactions/mo","Basic receipts","MoMo parser","SMS paste"] },
                  { plan:"Pro",  price:"GH₵ 40/mo", perks:["Unlimited transactions","Logo-branded receipts","PDF export","Multi-wallet","Priority support"], highlight:true },
                ].map(p => (
                  <div key={p.plan} style={{ background: p.highlight ? C.orange+"10" : "#f9fafb", border:`1.5px solid ${p.highlight ? C.orange+"44" : C.border}`, borderRadius:12, padding:"14px 16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <span style={{ fontWeight:600, color:C.text, fontSize:14 }}>{p.plan}</span>
                      {p.highlight && <Badge color={C.orange}>Popular</Badge>}
                    </div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:18, color: p.highlight ? C.orange : C.text, marginBottom:8 }}>{p.price}</div>
                    {p.perks.map(pk => (
                      <div key={pk} style={{ fontSize:12, color:C.muted, display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                        <span style={{ color: p.highlight ? C.orange : C.teal }}>✓</span> {pk}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — AUTH FORM */}
            <div style={{ background:C.white, borderRadius:18, padding:"32px 30px", boxShadow:"0 4px 24px rgba(0,0,0,0.08)", border:`1px solid ${C.border}` }}>
              {/* Tab toggle */}
              <div style={{ display:"flex", background:"#f3f4f6", borderRadius:10, padding:3, marginBottom:24 }}>
                {["login","signup"].map(t => (
                  <button key={t} style={{ flex:1, padding:"9px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"'Poppins',sans-serif", fontSize:13, fontWeight:500, background: tab===t ? C.white : "transparent", color: tab===t ? C.text : C.muted, boxShadow: tab===t ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition:"all 0.15s" }} onClick={()=>setTab(t)}>
                    {t==="login" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              {tab==="signup" && (
                <div style={{ marginBottom:14 }}>
                  <label style={label}>Full name</label>
                  <input style={input} placeholder="Your full name" value={name} onChange={e=>setName(e.target.value)}/>
                </div>
              )}
              <div style={{ marginBottom:14 }}>
                <label style={label}>Email address</label>
                <input style={input} type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={label}>Password</label>
                <input style={input} type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)}/>
              </div>
              <Btn variant="primary" full onClick={()=>onLogin({ name: name||email.split("@")[0], email, plan:"free" })}>
                {tab==="login" ? "Sign in to Receiva" : "Create my account"} →
              </Btn>

              <div style={{ textAlign:"center", margin:"16px 0", fontSize:12, color:C.muted }}>or</div>
              <Btn variant="ghost" full onClick={onGuest} style={{ color:C.muted, fontSize:13 }}>
                <Icon d={IC.receipt} size={14}/> Continue with 5 free receipts
              </Btn>

              <div style={{ marginTop:20, padding:"14px", background:"#f9fafb", borderRadius:10, fontSize:12, color:C.muted, textAlign:"center", lineHeight:1.6 }}>
                🔒 Your data is encrypted and never shared. Cancel your plan anytime.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [authState, setAuthState]               = useState("loading");
  const [user, setUser]                         = useState(null);
  const [page, setPage]                         = useState("dashboard");
  const [wallets, setWallets]                   = useState([]);
  const [activeWallet, setActiveWallet]         = useState(null);
  const [transactions, setTransactions]         = useState([]);
  const [business, setBusiness]                 = useState({ name:"My Business", owner:"", phone:"", industry:"", plan:"free", logoColor:"#F97316", logoBg:"#fff4ed" });
  const [guestCount, setGuestCount]             = useState(0);
  const [showAddTx, setShowAddTx]               = useState(false);
  const [showReceipt, setShowReceipt]           = useState(null);
  const [showMoMo, setShowMoMo]                 = useState(false);
  const [showAddWallet, setShowAddWallet]       = useState(false);
  const [showUpgrade, setShowUpgrade]           = useState(false);
  const [dataLoading, setDataLoading]           = useState(false);
  const [dataError, setDataError]               = useState("");
  const [businessId, setBusinessId]             = useState(null);
  const [editingProduct, setEditingProduct]     = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen]     = useState(false);
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [products, setProducts]                 = useState([]);
  const [productCategories, setProductCategories] = useState([]);

  // ── Load all user data from Supabase ──
  const loadUserData = async (userId) => {
    setDataLoading(true);
    try {
      let { data: bizData, error: bizErr } = await supabase.from("businesses").select("*").eq("owner_id", userId).single();
      if (bizErr && bizErr.code === "PGRST116") {
        const { data: newBiz, error: createErr } = await supabase.from("businesses").insert({ owner_id:userId, business_name:"My Business", plan:"free", logo_color:"#F97316", logo_bg:"#fff4ed" }).select().single();
        if (createErr) throw createErr;
        bizData = newBiz;
      } else if (bizErr) throw bizErr;
      setBusinessId(bizData.id);
      const { data: walletData } = await supabase.from("wallets").select("*").eq("business_id", bizData.id).order("created_at",{ascending:true});
      const { data: txData }     = await supabase.from("transactions").select("*").eq("business_id", bizData.id).order("date",{ascending:false});
      const mappedWallets = (walletData||[]).map(w=>({ id:w.id, presetId:w.preset_id, name:w.name, number:w.number||"", balance:0 }));
      const mappedTx      = (txData||[]).map(t=>({ id:t.id, walletId:t.wallet_id, type:t.type, amount:parseFloat(t.amount), category:t.category||"", description:t.description||"", method:t.method||"", date:t.date, momoRef:t.momo_ref||"", receiptNo:t.receipt_no||genRNo() }));
      if (mappedWallets.length === 0) {
        const defaults = [{ preset_id:"mtn", name:"MTN MoMo", number:"", business_id:bizData.id },{ preset_id:"telecel", name:"Telecel Cash", number:"", business_id:bizData.id }];
        const { data: newW } = await supabase.from("wallets").insert(defaults).select();
        mappedWallets.push(...(newW||[]).map(w=>({ id:w.id, presetId:w.preset_id, name:w.name, number:"", balance:0 })));
      }
      setBusiness(b => ({ ...b, name: bizData.business_name || "My Business", logoColor: bizData.logo_color || "#F97316", logoBg: bizData.logo_bg || "#fff4ed", plan: bizData.plan || "free" }));
      setWallets(mappedWallets);
      setTransactions(mappedTx);
      setProducts([]);
      setProductCategories([{ id:"c1", name:"Products", color:"#2563eb" },{ id:"c2", name:"Services", color:"#F97316" }]);
    } catch(err) {
      console.error("loadUserData error:", err);
      setDataError("Could not load your data. Check your connection and refresh.");
    } finally {
      setDataLoading(false);
    }
  };

  // ── Check existing session on app open ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = {
          name:  session.user.user_metadata?.full_name || session.user.email.split("@")[0],
          email: session.user.email,
          plan:  "free",
          id:    session.user.id,
        };
        setUser(u);
        setAuthState("app");
        loadUserData(session.user.id);
      } else {
        setAuthState("login");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = {
          name:  session.user.user_metadata?.full_name || session.user.email.split("@")[0],
          email: session.user.email,
          plan:  "free",
          id:    session.user.id,
        };
        setUser(u);
        setAuthState("app");
        loadUserData(session.user.id);
      } else {
        setUser(null);
        setAuthState("login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = (u) => { setUser(u); setAuthState("app"); if(u.id) loadUserData(u.id); };
  const handleGuest = () => { setWallets([]); setTransactions([]); setAuthState("guest"); };
  const handleSignOut = async () => { await supabase.auth.signOut(); setUser(null); setWallets([]); setTransactions([]); setBusinessId(null); setBusiness({ name:'My Business', owner:'', phone:'', industry:'', plan:'free', logoColor:'#F97316', logoBg:'#fff4ed' }); setAuthState("login"); };

  if (authState === "loading") return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f9fafb", fontFamily:"'Poppins',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:24, color:"#111827", marginBottom:8 }}>Receiva<span style={{ color:"#F97316" }}>.</span></div>
        <div style={{ fontSize:13, color:"#6b7280" }}>Loading...</div>
      </div>
    </div>
  );

  if (authState === "login") return <LoginPage onLogin={handleLogin} onGuest={handleGuest}/>;

  const isGuest    = authState === "guest";
  const isPro      = user?.plan === "pro";
  const txFiltered = activeWallet ? transactions.filter(t=>t.walletId===activeWallet) : transactions;
  const income     = txFiltered.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense    = txFiltered.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const balance    = income - expense;
  const txCap      = isPro ? Infinity : 30;
  const txUsed     = transactions.length;

  const tryGenerateReceipt = (tx) => {
    if (isGuest) {
      if (guestCount >= FREE_RECEIPT_LIMIT) { setAuthState("login"); return; }
      setGuestCount(g=>g+1);
    }
    setShowReceipt(tx);
  };

  const addTransaction = async (tx) => {
    const newReceiptNo = genRNo();
    if (isGuest || !businessId) {
      setTransactions(p=>[{...tx, id:genId(), receiptNo:newReceiptNo}, ...p]);
      setShowAddTx(false); setShowMoMo(false); return;
    }
    const { data, error } = await supabase.from("transactions").insert({ wallet_id:tx.walletId, business_id:businessId, type:tx.type, amount:tx.amount, category:tx.category, description:tx.description, method:tx.method, date:tx.date, momo_ref:tx.momoRef||null, receipt_no:newReceiptNo }).select().single();
    if (error) { console.error(error); alert("Could not save transaction. Please try again."); return; }
    setTransactions(p=>[{ id:data.id, walletId:data.wallet_id, type:data.type, amount:parseFloat(data.amount), category:data.category||"", description:data.description||"", method:data.method||"", date:data.date, momoRef:data.momo_ref||"", receiptNo:data.receipt_no||newReceiptNo }, ...p]);
    setShowAddTx(false); setShowMoMo(false);
  };

  const addWallet = async (w) => {
    if (isGuest || !businessId) { setWallets(p=>[...p,{...w,id:genId(),balance:0}]); setShowAddWallet(false); return; }
    const { data, error } = await supabase.from("wallets").insert({ business_id:businessId, preset_id:w.presetId, name:w.name, number:w.number||null }).select().single();
    if (error) { console.error(error); alert("Could not save wallet."); return; }
    setWallets(p=>[...p,{ id:data.id, presetId:data.preset_id, name:data.name, number:data.number||"", balance:0 }]);
    setShowAddWallet(false);
  };

  const allNav = [
    { key:"dashboard",    label:"Dashboard",   icon:IC.home    },
    { key:"wallets",      label:"Wallets",      icon:IC.wallet  },
    { key:"transactions", label:"Transactions", icon:IC.tx      },
    { key:"receipts",     label:"Receipts",     icon:IC.receipt },
    { key:"reports",      label:"Reports",      icon:IC.report  },
    { key:"products",     label:"Products",     icon:IC.box, children:[
      { key:"product-list",    label:"Product List"    },
      { key:"add-product",     label:"Add New Product" },
      { key:"categories",      label:"Categories"      },
    ]},
  ];

  const isProductPage = ["products","product-list","add-product","categories"].includes(page);

  const NavItem = ({ n, mobile=false, onNavigate }) => {
    if (n.children) {
      const childActive = n.children.some(c=>c.key===page);
      return (
        <div>
          <div onClick={()=>setProductsExpanded(e=>!e)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, padding: mobile?"14px 20px":"11px 20px", cursor:"pointer", fontSize:14, color: childActive ? C.orange : C.muted, background: childActive ? C.orange+"10" : "transparent", borderLeft: mobile?"none":`2px solid ${childActive ? C.orange : "transparent"}`, transition:"all 0.15s", fontWeight: childActive ? 500 : 400 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}><Icon d={n.icon} size={16}/>{n.label}</div>
            <span style={{ fontSize:10, transition:"transform 0.2s", transform: productsExpanded?"rotate(180deg)":"rotate(0)" }}>▼</span>
          </div>
          {productsExpanded && (
            <div style={{ background:"#fafafa", borderLeft: mobile?"none":"2px solid #f0f0f0", marginLeft: mobile?0:20 }}>
              {n.children.map(c=>(
                <div key={c.key} onClick={()=>{ onNavigate(c.key); }} style={{ padding: mobile?"12px 20px 12px 36px":"9px 20px 9px 28px", cursor:"pointer", fontSize:13, color: page===c.key ? C.orange : C.muted, background: page===c.key ? C.orange+"08":"transparent", fontWeight: page===c.key?500:400, transition:"all 0.15s" }}>
                  {c.label}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    const active = page===n.key;
    return (
      <div onClick={()=>onNavigate(n.key)} style={{ display:"flex", alignItems:"center", gap:10, padding: mobile?"14px 20px":"11px 20px", cursor:"pointer", fontSize:14, color: active ? C.orange : C.muted, background: active ? C.orange+"10" : "transparent", borderLeft: mobile?"none":`2px solid ${active ? C.orange : "transparent"}`, transition:"all 0.15s", fontWeight: active ? 500 : 400 }}>
        <Icon d={n.icon} size={16}/>{n.label}
      </div>
    );
  };

  const navigateTo = (key) => { setPage(key); setMobileMenuOpen(false); };

  const currentLabel = () => {
    for (const n of allNav) {
      if (n.key===page) return n.label;
      if (n.children) { const c=n.children.find(c=>c.key===page); if(c) return c.label; }
    }
    return "";
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet"/>
      <style>{`
        body, input, button, select, textarea { font-family: 'Poppins', sans-serif; }
        @media(max-width:768px){
          .desktop-sidebar{display:none!important;}
          .mobile-topbar-title{font-size:16px!important;}
          .wallet-pills{display:none!important;}
          .content-pad{padding:16px!important;}
          .stat-grid{grid-template-columns:1fr 1fr!important;}
          .hamburger-btn{display:flex!important;}
        }
        @media(min-width:769px){
          .hamburger-btn{display:none!important;}
          .mobile-overlay{display:none!important;}
        }
        .mobile-overlay{position:fixed;inset:0;z-index:200;display:flex;}
        .mobile-drawer{width:280px;background:#fff;height:100%;overflow-y:auto;box-shadow:4px 0 24px rgba(0,0,0,0.15);display:flex;flex-direction:column;}
        .mobile-backdrop{flex:1;background:rgba(0,0,0,0.4);}
        .nav-item-hover:hover{background:${C.orange}08;}
      `}</style>

      <div style={{ minHeight:"100vh", background:"#f9fafb", color:C.text, fontFamily:"'Poppins',sans-serif", display:"flex" }}>

        {/* DESKTOP SIDEBAR */}
        <div className="desktop-sidebar" style={{ width:220, background:C.white, borderRight:`1px solid ${C.sidebarBorder}`, display:"flex", flexDirection:"column", padding:"24px 0", flexShrink:0, boxShadow:"2px 0 8px rgba(0,0,0,0.04)" }}>
          <div style={{ padding:"0 20px 22px", borderBottom:`1px solid ${C.border}`, marginBottom:8 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:C.text }}>Receiva<span style={{ color:C.orange }}>.</span></div>
            <div style={{ fontSize:11, color:C.orange, letterSpacing:"0.1em", textTransform:"uppercase", fontStyle:"italic" }}>Financial records</div>
          </div>

          {isGuest && (
            <div style={{ margin:"0 12px 12px", background:C.orange+"12", border:`1px solid ${C.orange}33`, borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.orange, marginBottom:3 }}>Guest mode</div>
              <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>{FREE_RECEIPT_LIMIT - guestCount} free receipts left</div>
              <Btn variant="primary" full size="sm" onClick={()=>setAuthState("login")}>Sign up free →</Btn>
            </div>
          )}

          {allNav.map(n=><NavItem key={n.key} n={n} onNavigate={navigateTo}/>)}

          {/* WhatsApp Support */}
          <div style={{ margin:"12px 12px 0" }}>
            <a href="https://wa.me/233205597508" target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", background:"#25D36614", border:"1px solid #25D36633", borderRadius:10, textDecoration:"none", color:"#166534", fontSize:12, fontWeight:500 }}>
              <span style={{ fontSize:16 }}>💬</span> Chat with support
            </a>
          </div>

          <div style={{ marginTop:"auto", padding:"16px 18px 0" }}>
            {!isPro && (
              <div style={{ background:`linear-gradient(135deg,${C.orange}18,${C.orange}08)`, border:`1px solid ${C.orange}30`, borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
                <div style={{ fontSize:11, color:C.orange, fontWeight:600, marginBottom:2, display:"flex", alignItems:"center", gap:5 }}><Icon d={IC.star} size={11}/> Upgrade to Pro</div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Logo receipts · PDF · More</div>
                <Btn variant="primary" full size="sm" onClick={()=>setShowUpgrade(true)}>Upgrade — GH₵ 40/mo</Btn>
              </div>
            )}
            {!isGuest && (
              <>
                <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>{txUsed} / {isPro ? "∞" : txCap} transactions</div>
                <div style={{ height:4, background:"#f0f0f0", borderRadius:2 }}>
                  <div style={{ height:"100%", width:`${Math.min((txUsed/txCap)*100,100)}%`, background:C.orange, borderRadius:2 }}/>
                </div>
              </>
            )}
          </div>
        </div>

        {/* MOBILE DRAWER OVERLAY */}
        {mobileMenuOpen && (
          <div className="mobile-overlay">
            <div className="mobile-drawer">
              <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color:C.text }}>Receiva<span style={{ color:C.orange }}>.</span></div>
                <button onClick={()=>setMobileMenuOpen(false)} style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:20, color:C.muted, padding:4 }}>✕</button>
              </div>
              {isGuest && (
                <div style={{ margin:"12px 12px 0", background:C.orange+"12", border:`1px solid ${C.orange}33`, borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C.orange, marginBottom:3 }}>Guest mode</div>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>{FREE_RECEIPT_LIMIT - guestCount} free receipts left</div>
                  <Btn variant="primary" full size="sm" onClick={()=>{ setAuthState("login"); setMobileMenuOpen(false); }}>Sign up free →</Btn>
                </div>
              )}
              <div style={{ flex:1, overflowY:"auto" }}>
                {allNav.map(n=><NavItem key={n.key} n={n} mobile onNavigate={navigateTo}/>)}
              </div>
              <div style={{ padding:"16px 12px", borderTop:`1px solid ${C.border}` }}>
                <a href="https://wa.me/233205597508" target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 14px", background:"#25D36614", border:"1px solid #25D36633", borderRadius:10, textDecoration:"none", color:"#166534", fontSize:13, fontWeight:500 }}>
                  <span style={{ fontSize:18 }}>💬</span> Chat with support on WhatsApp
                </a>
              </div>
            </div>
            <div className="mobile-backdrop" onClick={()=>setMobileMenuOpen(false)}/>
          </div>
        )}

        {/* MAIN */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {/* TOPBAR */}
          <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", background:C.white }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              {/* Hamburger */}
              <button className="hamburger-btn" onClick={()=>setMobileMenuOpen(true)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 8px", cursor:"pointer", flexDirection:"column", gap:4, display:"none", alignItems:"center", justifyContent:"center" }}>
                <div style={{ width:18, height:2, background:C.text, borderRadius:1 }}/>
                <div style={{ width:18, height:2, background:C.text, borderRadius:1 }}/>
                <div style={{ width:18, height:2, background:C.text, borderRadius:1 }}/>
              </button>
              <div className="mobile-topbar-title" style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, color:C.text }}>{currentLabel()}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {wallets.length > 0 && (
                <div className="wallet-pills">
                  {wallets.length === 1 ? (
                    <WalletPill wallet={wallets[0]} active={activeWallet===wallets[0].id} onClick={()=>setActiveWallet(activeWallet===wallets[0].id?null:wallets[0].id)}/>
                  ) : (
                    <select
                      value={activeWallet||"all"}
                      onChange={e=>setActiveWallet(e.target.value==="all"?null:e.target.value)}
                      style={{ padding:"7px 32px 7px 12px", borderRadius:20, border:`1.5px solid ${C.border}`, background:activeWallet?C.orange+"12":"#f3f4f6", color:activeWallet?C.orange:C.muted, fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Poppins',sans-serif", outline:"none", appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center" }}
                    >
                      <option value="all">All wallets</option>
                      {wallets.map(w=>{
                        const preset = WALLET_PRESETS.find(p=>p.id===w.presetId)||WALLET_PRESETS[0];
                        return <option key={w.id} value={w.id}>{preset.icon} {w.name}</option>;
                      })}
                    </select>
                  )}
                </div>
              )}
              <a href="https://wa.me/233205597508" target="_blank" rel="noreferrer" title="WhatsApp support" style={{ width:32, height:32, borderRadius:"50%", background:"#25D36618", border:"1.5px solid #25D36644", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, textDecoration:"none" }}>💬</a>
              <div style={{ width:32, height:32, borderRadius:"50%", background:C.orange+"18", border:`1.5px solid ${C.orange}44`, display:"flex", alignItems:"center", justifyContent:"center", color:C.orange, fontSize:13, fontWeight:700 }}>
                {isGuest ? "G" : (user?.name?.[0]?.toUpperCase() || "J")}
              </div>
              {!isGuest && (
                <button onClick={handleSignOut} style={{ fontSize:11, color:C.muted, background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 8px", cursor:"pointer", fontFamily:"'Poppins',sans-serif" }}>
                  Sign out
                </button>
              )}
            </div>
          </div>

          {/* CONTENT */}
          <div className="content-pad" style={{ flex:1, padding:"24px 28px", overflowY:"auto" }}>
            {dataLoading && <div style={{ textAlign:"center", padding:"40px", color:C.muted, fontSize:14 }}>Loading your data...</div>}
            {dataError   && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"14px 18px", marginBottom:16, fontSize:13, color:"#b91c1c" }}>{dataError}</div>}
            {page==="dashboard"    && <Dashboard transactions={txFiltered} income={income} expense={expense} balance={balance} wallets={wallets} activeWallet={activeWallet} business={business} user={user} onAdd={()=>setShowAddTx(true)} onReceipt={tryGenerateReceipt} onMoMo={()=>setShowMoMo(true)} isPro={isPro} isGuest={isGuest} guestLeft={FREE_RECEIPT_LIMIT-guestCount}/>}
            {page==="wallets"      && <Wallets wallets={wallets} transactions={transactions} onAdd={()=>setShowAddWallet(true)} onSelect={setActiveWallet} activeWallet={activeWallet}/>}
            {page==="transactions" && <Transactions transactions={txFiltered} wallets={wallets} onAdd={()=>setShowAddTx(true)} onReceipt={tryGenerateReceipt}/>}
            {page==="receipts"     && <Receipts transactions={txFiltered} wallets={wallets} business={business} onReceipt={tryGenerateReceipt} isPro={isPro} isGuest={isGuest} guestLeft={FREE_RECEIPT_LIMIT-guestCount}/>}
            {page==="reports"      && <Reports transactions={txFiltered} income={income} expense={expense} balance={balance} isPro={isPro} onUpgrade={()=>setShowUpgrade(true)}/>}
            {(page==="products"||page==="product-list") && <ProductList products={products} categories={productCategories} onAdd={()=>navigateTo("add-product")} onEdit={p=>{ setEditingProduct(p); navigateTo("add-product"); }}/>}
            {page==="add-product"  && <AddEditProduct product={editingProduct} categories={productCategories} onSave={p=>{ if(editingProduct){ setProducts(prev=>prev.map(x=>x.id===p.id?p:x)); } else { setProducts(prev=>[...prev,{...p,id:genId()}]); } setEditingProduct(null); navigateTo("product-list"); }} onCancel={()=>{ setEditingProduct(null); navigateTo("product-list"); }}/>}
            {page==="categories"   && <ProductCategories categories={productCategories} products={products} onSave={setProductCategories}/>}
          </div>
        </div>
      </div>

      {showAddTx    && <AddTxModal onClose={()=>setShowAddTx(false)} onSave={addTransaction} wallets={wallets} products={products}/>}
      {showReceipt  && <ReceiptModal tx={showReceipt} business={business} isPro={isPro} onClose={()=>setShowReceipt(null)}/>}
      {showMoMo     && <MoMoModal business={business} wallets={wallets} onClose={()=>setShowMoMo(false)} onSave={addTransaction}/>}
      {showAddWallet&& <AddWalletModal onClose={()=>setShowAddWallet(false)} onSave={addWallet}/>}
      {showUpgrade  && <UpgradeModal onClose={()=>setShowUpgrade(false)}/>}
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────
function Dashboard({ transactions, income, expense, balance, wallets, business, user, onAdd, onReceipt, onMoMo, isPro, isGuest, guestLeft }) {
  const recent = transactions.slice(0,5);
  const statCards = [
    { label:"Total income",   value:fmt(income),   color:C.income  },
    { label:"Total expenses", value:fmt(expense),  color:C.expense },
    { label:"Net balance",    value:fmt(balance),  color: balance>=0 ? "#2563eb" : C.expense },
    { label:"Transactions",   value:transactions.length, color:C.orange },
  ];
  return (
    <div>
      <div style={{ marginBottom:22 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:24, color:C.text, marginBottom:3 }}>Good day, {user?.name?.split(' ')[0] || 'there'} 👋</div>
        <div style={{ fontSize:14, color:C.muted }}>Here's your financial snapshot for May 2026</div>
      </div>

      {/* STATS */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {statCards.map(sc=>(
          <div key={sc.label} style={card({ padding:"16px 18px" })}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>{sc.label}</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:sc.color }}>{sc.value}</div>
          </div>
        ))}
      </div>

      {/* WALLETS SUMMARY */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:16, color:C.text, marginBottom:12 }}>Your wallets</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {wallets.map(w=>{
            const preset = WALLET_PRESETS.find(p=>p.id===w.presetId)||WALLET_PRESETS[0];
            const wTx = transactions.filter(t=>t.walletId===w.id);
            const wBal = wTx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0) - wTx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
            return (
              <div key={w.id} style={{ background:preset.bg, border:`1.5px solid ${preset.color}33`, borderRadius:12, padding:"14px 18px", minWidth:160 }}>
                <div style={{ fontSize:18, marginBottom:4 }}>{preset.icon}</div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:2 }}>{w.name}</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:18, color:preset.color }}>{fmt(wBal)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ display:"flex", gap:10, marginBottom:22 }}>
        <Btn variant="primary" onClick={onAdd}><Icon d={IC.plus} size={15}/> Log transaction</Btn>
        <Btn variant="teal" onClick={onMoMo}><Icon d={IC.momo} size={15}/> Generate Receipt</Btn>
        {isGuest && <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:C.muted }}><Icon d={IC.receipt} size={14}/> {guestLeft} free receipts left</div>}
      </div>

      {/* EMPTY STATE */}
      {wallets.length===0 && (
        <div style={{ textAlign:"center", padding:"48px 20px", background:"#fff", borderRadius:14, border:"1px solid #e5e7eb" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>👋</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, color:"#111827", marginBottom:8 }}>Welcome to Receiva</div>
          <div style={{ fontSize:14, color:"#6b7280", marginBottom:20, maxWidth:340, margin:"0 auto 20px" }}>Start by adding your first wallet — your MTN MoMo, Telecel Cash, or any account you receive payments on.</div>
        </div>
      )}

      {/* RECENT */}
      <div style={card()}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15, color:C.text, marginBottom:14 }}>Recent transactions</div>
        <TxTable transactions={recent} wallets={[]} onReceipt={onReceipt} showWallet/>
      </div>
    </div>
  );
}

// ─── WALLETS PAGE ─────────────────────────────────────────────
function Wallets({ wallets, transactions, onAdd, onSelect, activeWallet }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div style={{ fontSize:14, color:C.muted }}>Manage all your MoMo accounts and wallets in one place</div>
        <Btn variant="primary" onClick={onAdd}><Icon d={IC.plus} size={15}/> Add wallet</Btn>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
        {wallets.map(w=>{
          const preset = WALLET_PRESETS.find(p=>p.id===w.presetId)||WALLET_PRESETS[0];
          const wTx  = transactions.filter(t=>t.walletId===w.id);
          const wInc = wTx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
          const wExp = wTx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
          const wBal = wInc - wExp;
          return (
            <div key={w.id} style={{ background:C.white, border:`1.5px solid ${activeWallet===w.id ? preset.color : C.border}`, borderRadius:16, padding:"20px 22px", cursor:"pointer", transition:"all 0.2s" }} onClick={()=>onSelect(w.id===activeWallet?null:w.id)}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:preset.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{preset.icon}</div>
                <Badge color={preset.color}>{preset.label}</Badge>
              </div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:2 }}>{w.name}</div>
              <div style={{ fontSize:12, color:"#9ca3af", marginBottom:10, fontFamily:"monospace" }}>{w.number}</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:26, color:preset.color, marginBottom:12 }}>{fmt(wBal)}</div>
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1, textAlign:"center", padding:"8px", background:"#f9fafb", borderRadius:8 }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>Income</div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.income }}>{fmt(wInc)}</div>
                </div>
                <div style={{ flex:1, textAlign:"center", padding:"8px", background:"#f9fafb", borderRadius:8 }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>Expense</div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.expense }}>{fmt(wExp)}</div>
                </div>
                <div style={{ flex:1, textAlign:"center", padding:"8px", background:"#f9fafb", borderRadius:8 }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>Txns</div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{wTx.length}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TX TABLE ─────────────────────────────────────────────────
function TxTable({ transactions, wallets, onReceipt, showWallet=false }) {
  if (!transactions.length) return <div style={{ textAlign:"center", padding:"32px", color:C.muted, fontSize:14 }}>No transactions yet</div>;
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns: showWallet ? "1fr 1fr 100px 110px 80px" : "1fr 1fr 100px 110px 80px", padding:"8px 14px", fontSize:11, color:C.muted, letterSpacing:"0.05em", textTransform:"uppercase", borderBottom:`1px solid ${C.border}` }}>
        <span>Description</span><span>Category</span><span>Method</span><span>Amount</span><span>Receipt</span>
      </div>
      {transactions.map(tx=>{
        const wallet = wallets.find ? wallets.find(w=>w.id===tx.walletId) : null;
        const preset = wallet ? WALLET_PRESETS.find(p=>p.id===wallet?.presetId) : null;
        return (
          <div key={tx.id} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 100px 110px 80px", padding:"11px 14px", borderBottom:`1px solid #f9fafb`, alignItems:"center", fontSize:13 }}>
            <div>
              <div style={{ color:C.text, fontWeight:500 }}>{tx.description}</div>
              <div style={{ color:C.muted, fontSize:11, marginTop:1 }}>{tx.date}</div>
            </div>
            <div><Badge color={tx.type==="income" ? C.income : C.expense}>{tx.category}</Badge></div>
            <div style={{ fontSize:12, color:C.muted }}>{tx.method}</div>
            <div style={{ fontWeight:700, color: tx.type==="income" ? C.income : C.expense }}>
              {tx.type==="income" ? "+" : "-"}{fmt(tx.amount)}
            </div>
            <div>
              {tx.type==="income" ? (
                <Btn variant="ghost" size="sm" onClick={()=>onReceipt(tx)} style={{ fontSize:11, padding:"5px 10px" }}>
                  <Icon d={IC.eye} size={12}/> View
                </Btn>
              ) : <span style={{ color:"#d1d5db", fontSize:12 }}>—</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TRANSACTIONS PAGE ────────────────────────────────────────
function Transactions({ transactions, wallets, onAdd, onReceipt }) {
  const [filter, setFilter] = useState("all");
  const shown = filter==="all" ? transactions : transactions.filter(t=>t.type===filter);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div style={{ display:"flex", gap:8 }}>
          {["all","income","expense"].map(f=>(
            <button key={f} style={{ padding:"7px 16px", borderRadius:20, border:`1.5px solid ${filter===f ? C.orange : C.border}`, background: filter===f ? C.orange+"12" : C.white, color: filter===f ? C.orange : C.muted, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Poppins',sans-serif" }} onClick={()=>setFilter(f)}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
        <Btn variant="primary" onClick={onAdd}><Icon d={IC.plus} size={15}/> Add transaction</Btn>
      </div>
      <div style={card({ padding:0, overflow:"hidden" })}>
        <TxTable transactions={shown} wallets={wallets} onReceipt={onReceipt} showWallet/>
      </div>
    </div>
  );
}

// ─── RECEIPTS PAGE ────────────────────────────────────────────
function Receipts({ transactions, wallets, business, onReceipt, isPro, isGuest, guestLeft }) {
  const income = transactions.filter(t=>t.type==="income");
  return (
    <div>
      {isGuest && (
        <div style={{ background:C.orange+"12", border:`1.5px solid ${C.orange}33`, borderRadius:12, padding:"14px 18px", marginBottom:18, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:14, color:C.text }}><strong style={{ color:C.orange }}>{guestLeft} free receipt{guestLeft!==1?"s":""}</strong> remaining. Sign up for 30/month free.</div>
          <Btn variant="primary" size="sm" onClick={()=>{}}>Sign up free</Btn>
        </div>
      )}
      {isPro && (
        <div style={{ background:"#fff4ed", border:`1px solid ${C.orange}33`, borderRadius:12, padding:"12px 16px", marginBottom:18, fontSize:13, color:C.muted }}>
          <strong style={{ color:C.orange }}>Pro:</strong> Receipts are auto-branded with your logo colors.
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
        {income.map(tx=>(
          <div key={tx.id} style={card({ cursor:"pointer" })} onClick={()=>onReceipt(tx)}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <Badge color={C.teal}>Receipt</Badge>
              <span style={{ fontSize:11, color:C.muted }}>{tx.date}</span>
            </div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:C.income, marginBottom:4 }}>{fmt(tx.amount)}</div>
            <div style={{ fontSize:13, color:C.text, marginBottom:8 }}>{tx.description}</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:11, color:C.muted, fontFamily:"monospace" }}>{tx.receiptNo}</span>
              <Btn variant="outline" size="sm"><Icon d={IC.receipt} size={12}/> Generate</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── REPORTS PAGE ─────────────────────────────────────────────
function Reports({ transactions, income, expense, balance, isPro, onUpgrade }) {
  const byCat = transactions.reduce((a,t)=>{ if(!a[t.category])a[t.category]={i:0,e:0}; a[t.category][t.type==="income"?"i":"e"]+=t.amount; return a; },{});
  const maxCat = Math.max(1,...Object.values(byCat).map(c=>c.i+c.e));
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[[fmt(income),"Income",C.income],[fmt(expense),"Expenses",C.expense],[fmt(balance),"Net profit",balance>=0?"#2563eb":C.expense],[income>0?Math.round((balance/income)*100)+"%":"0%","Margin",C.orange]].map(([v,l,c])=>(
          <div key={l} style={card({ padding:"16px 18px" })}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:5 }}>{l}</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:c }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <div style={card()}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15, color:C.text, marginBottom:14 }}>By category</div>
          {Object.entries(byCat).map(([cat,vals])=>(
            <div key={cat} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5 }}>
                <span style={{ color:C.text }}>{cat}</span>
                <span style={{ color:C.muted }}>{fmt(vals.i-vals.e)}</span>
              </div>
              <div style={{ height:6, background:"#f3f4f6", borderRadius:3 }}>
                <div style={{ height:"100%", width:`${((vals.i+vals.e)/maxCat)*100}%`, background: vals.i>vals.e ? C.income : C.expense, borderRadius:3 }}/>
              </div>
            </div>
          ))}
        </div>
        <div style={card()}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15, color:C.text, marginBottom:14 }}>PDF Export & Tax Report</div>
          {isPro ? (
            <div style={{ fontSize:14, color:C.muted }}>✓ Your monthly PDF report is ready to download.</div>
          ) : (
            <div style={{ background:"#fff4ed", border:`1px solid ${C.orange}33`, borderRadius:10, padding:"16px" }}>
              <div style={{ fontSize:14, color:C.text, marginBottom:6 }}><Icon d={IC.lock} size={14}/> Pro feature</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>PDF export, GRA-ready tax breakdown, and advanced payroll tracking.</div>
              <Btn variant="primary" full onClick={onUpgrade}>Upgrade — GH₵ 40/mo</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ADD TRANSACTION MODAL ────────────────────────────────────
function AddTxModal({ onClose, onSave, wallets }) {
  const [form, setForm] = useState({ type:"income", amount:"", category:"", description:"", walletId: wallets[0]?.id||"", date:today(), momoRef:"" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const valid = form.amount && form.category && form.description && form.walletId;
  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Log transaction" onClose={onClose}/>
      <div style={{ display:"flex", gap:8, marginBottom:18 }}>
        {["income","expense"].map(t=>(
          <button key={t} style={{ flex:1, padding:"9px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"'Poppins',sans-serif", fontSize:14, fontWeight:500, background: form.type===t ? (t==="income"?C.income+"18":C.expense+"15") : "#f3f4f6", color: form.type===t ? (t==="income"?C.income:C.expense) : C.muted }} onClick={()=>set("type",t)}>
            {t==="income"?"💰 Income":"📤 Expense"}
          </button>
        ))}
      </div>
      <div style={{ marginBottom:12 }}>
        <label style={label}>Wallet</label>
        <select style={input} value={form.walletId} onChange={e=>set("walletId",e.target.value)}>
          {wallets.map(w=><option key={w.id} value={w.id}>{WALLET_PRESETS.find(p=>p.id===w.presetId)?.icon} {w.name}</option>)}
        </select>
      </div>
      <div style={formRow}>
        <div><label style={label}>Amount (GH₵)</label><input style={input} type="number" placeholder="0.00" value={form.amount} onChange={e=>set("amount",e.target.value)}/></div>
        <div><label style={label}>Date</label><input style={input} type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></div>
      </div>
      <div style={{ marginBottom:12 }}>
        <label style={label}>Category</label>
        <select style={input} value={form.category} onChange={e=>set("category",e.target.value)}>
          <option value="">Select category</option>
          {CATEGORIES.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ marginBottom:12 }}><label style={label}>Description</label><input style={input} placeholder="e.g. iPhone cases x3" value={form.description} onChange={e=>set("description",e.target.value)}/></div>
      <div style={{ marginBottom:16 }}><label style={label}>MoMo reference (optional)</label><input style={input} placeholder="e.g. 80993550724" value={form.momoRef} onChange={e=>set("momoRef",e.target.value)}/></div>
      <Btn variant="primary" full disabled={!valid} onClick={()=>valid&&onSave({...form,amount:parseFloat(form.amount),method:wallets.find(w=>w.id===form.walletId)?.name||"MoMo"})}>
        <Icon d={IC.check} size={15}/> Save transaction
      </Btn>
    </Modal>
  );
}

// ─── RECEIPT MODAL ────────────────────────────────────────────
function ReceiptModal({ tx, business, isPro, onClose }) {
  const rNo = useRef(genRNo()).current;
  const accentColor = isPro ? (business.logoColor||C.orange) : "#1B5F8C";
  const accentBg    = isPro ? (business.logoBg||"#fff4ed")   : "#f0f7ff";
  const waText = `Receipt from ${business.name}\n--------------------------\nReceipt No: ${tx.receiptNo||rNo}\nDate: ${tx.date}\nDescription: ${tx.description}\nAmount: GH₵ ${tx.amount}\nPayment: ${tx.method}${tx.momoRef?`\nMoMo Ref: ${tx.momoRef}`:""}\n--------------------------\nPowered by Receiva`;
  return (
    <Modal onClose={onClose} maxWidth={460}>
      <ModalHeader title="Receipt" onClose={onClose}/>
      {isPro && <div style={{ background:C.orange+"12", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:12, color:C.orange, fontWeight:500 }}>⭐ Pro — branded with your logo colors</div>}
      {/* RECEIPT CARD */}
      <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:14, padding:"26px 28px", marginBottom:16 }}>
        <div style={{ borderBottom:`2px solid ${accentColor}`, paddingBottom:14, marginBottom:16 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color:accentColor }}>{business.name}</div>
          {isPro && <div style={{ fontSize:11, color:C.muted, marginTop:2, fontStyle:"italic" }}>Official Receipt · Pro</div>}
          {!isPro && <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Official Receipt</div>}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:18, fontSize:12, color:C.muted }}>
          <div><strong style={{ color:C.text }}>No:</strong> {tx.receiptNo||rNo}</div>
          <div><strong style={{ color:C.text }}>Date:</strong> {tx.date}</div>
        </div>
        <div style={{ background:accentBg, borderRadius:8, padding:"12px 14px", marginBottom:16 }}>
          <div style={{ fontWeight:500, color:C.text, marginBottom:3 }}>{tx.description}</div>
          <div style={{ fontSize:12, color:C.muted }}>{tx.category} · {tx.method}</div>
          {tx.momoRef && <div style={{ fontSize:11, color:accentColor, marginTop:4, fontFamily:"monospace" }}>Ref: {tx.momoRef}</div>}
        </div>
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ color:C.muted, fontSize:14 }}>Total paid</span>
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:24, color:accentColor }}>{fmt(tx.amount)}</span>
        </div>
        <div style={{ marginTop:16, textAlign:"center", fontSize:10, color:"#d1d5db", borderTop:`1px solid #f3f4f6`, paddingTop:10 }}>
          Thank you for your business · Powered by Receiva{isPro?" Pro":""}
        </div>
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <Btn variant="wa" href={`https://wa.me/?text=${encodeURIComponent(waText)}`} style={{ flex:1 }}>
          <Icon d={IC.share} size={14}/> WhatsApp
        </Btn>
        <Btn variant={isPro?"primary":"ghost"} style={{ flex:1 }} onClick={()=>!isPro&&alert("PDF export is a Pro feature. Upgrade to download receipts as PDF.")}>
          <Icon d={IC.share} size={14}/> {isPro?"Download PDF":"PDF (Pro)"}
        </Btn>
      </div>
    </Modal>
  );
}

// ─── ADD WALLET MODAL ─────────────────────────────────────────
function AddWalletModal({ onClose, onSave }) {
  const [presetId, setPresetId] = useState("mtn");
  const [name, setName]         = useState("");
  const [number, setNumber]     = useState("");
  const preset = WALLET_PRESETS.find(p=>p.id===presetId);
  return (
    <Modal onClose={onClose} maxWidth={460}>
      <ModalHeader title="Add wallet" onClose={onClose}/>
      <div style={{ marginBottom:14 }}>
        <label style={label}>Wallet type</label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          {WALLET_PRESETS.map(p=>(
            <div key={p.id} onClick={()=>setPresetId(p.id)} style={{ border:`1.5px solid ${presetId===p.id ? p.color : C.border}`, borderRadius:10, padding:"10px 8px", cursor:"pointer", textAlign:"center", background: presetId===p.id ? p.bg : C.white }}>
              <div style={{ fontSize:20, marginBottom:3 }}>{p.icon}</div>
              <div style={{ fontSize:11, fontWeight:500, color: presetId===p.id ? p.color : C.muted }}>{p.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom:12 }}><label style={label}>Wallet name (optional)</label><input style={input} placeholder={preset?.label} value={name} onChange={e=>setName(e.target.value)}/></div>
      <div style={{ marginBottom:18 }}><label style={label}>Phone / account number</label><input style={input} placeholder="e.g. 0592040012" value={number} onChange={e=>setNumber(e.target.value)}/></div>
      <Btn variant="primary" full onClick={()=>onSave({ presetId, name:name||preset?.label, number })}>
        <Icon d={IC.check} size={15}/> Add wallet
      </Btn>
    </Modal>
  );
}

// ─── BULK SMS SPLITTER ────────────────────────────────────────
// Splits a big blob of pasted MoMo messages into individual ones
function splitMoMoMessages(raw) {
  // Split on known network message boundaries
  const boundaries = [
    /(?=Payment received for GHS)/gi,
    /(?=telecel\d{10,})/gi,
    /(?=Confirmed\.\s*GHS)/gi,
    /(?=You have received GHS)/gi,
    /(?=MTN MoMo:)/gi,
    /(?=GHS[\d.]+ has been)/gi,
  ];

  let chunks = [raw];
  boundaries.forEach(rx => {
    chunks = chunks.flatMap(c => c.split(rx));
  });

  // Also split on double newlines as a fallback
  chunks = chunks.flatMap(c => c.includes("\n\n") ? c.split(/\n\n+/) : [c]);

  return chunks
    .map(c => c.trim())
    .filter(c => c.length > 20 && /GHS?\s*[\d.]+/i.test(c));
}

// ─── MOMO MODAL ───────────────────────────────────────────────
function MoMoModal({ business, wallets, onClose, onSave }) {
  const [step, setStep]         = useState(1); // 1=paste, 2=review, 3=done
  const [raw, setRaw]           = useState("");
  const [items, setItems]       = useState([]); // array of parsed+editable tx objects
  const [walletId, setWalletId] = useState(wallets[0]?.id || "");
  const [saving, setSaving]     = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const BULK_SAMPLE = [
    `Payment received for GHS 9.00 from JEDIDIAH OFORI OPARE Current Balance: GHS 9.09 . Available Balance: GHS 9.09. Reference: JEDIDIAH OFORI OPARE ,233205597508,5 from VODAFONE. Transaction ID: 80993550724. TRANSACTION FEE: 0.00`,
    `telecel0000012482388464 Confirmed. GHS12.00 sent to 0592040012 JEDIDIAH OFORI OPARE on MTN MOBILE MONEY on 2026-03-24 at 17:48:34. Your Telecel Cash balance is GHS0.35. You were charged GHS0.00. Your E-levy charge is GHS0.00. Reference: B. Sendi k3k3`,
    `Payment received for GHS 250.00 from ABENA SERWAH Current Balance: GHS 450.09. Reference: ABENA SERWAH,0244567890. Transaction ID: 91823746502. TRANSACTION FEE: 0.00`,
  ].join("\n\n");

  const handleParse = () => {
    const chunks = splitMoMoMessages(raw);
    if (chunks.length === 0) {
      alert("No MoMo messages detected. Make sure you paste actual MoMo SMS text.");
      return;
    }
    const parsed = chunks.map((chunk, i) => ({
      _id: genId(),
      _raw: chunk,
      _included: true,
      ...parseGhanaMoMo(chunk),
    }));
    setItems(parsed);
    setStep(2);
  };

  const updateItem = (id, key, val) => {
    setItems(prev => prev.map(it => it._id === id ? { ...it, [key]: val } : it));
  };

  const toggleItem = (id) => {
    setItems(prev => prev.map(it => it._id === id ? { ...it, _included: !it._included } : it));
  };

  const handleSaveAll = () => {
    setSaving(true);
    const toSave = items.filter(it => it._included && it.amount);
    toSave.forEach(it => {
      onSave({
        type:        "income",
        amount:      parseFloat(it.amount),
        category:    it.category || "Sales",
        description: it.description || `Payment from ${it.sender || "customer"}`,
        method:      it.network + " MoMo",
        date:        it.date,
        momoRef:     it.txId,
        walletId,
      });
    });
    setSavedCount(toSave.length);
    setStep(3);
    setSaving(false);
  };

  const included  = items.filter(it => it._included);
  const totalAmt  = included.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
  const missingDesc = included.filter(it => !it.description).length;

  return (
    <Modal onClose={onClose} maxWidth={680}>
      <ModalHeader title="Generate Receipt" onClose={onClose} />

      {/* STEP INDICATOR */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:20 }}>
        {[["1","Paste SMS"],["2","Review & Edit"],["3","Saved"]].map(([n,l],i)=>{
          const active = step === i+1;
          const done   = step > i+1;
          return (
            <div key={n} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, background: done ? "#16a34a" : active ? C.orange : "#f3f4f6", color: done||active ? "#fff" : C.muted }}>
                {done ? "✓" : n}
              </div>
              <span style={{ fontSize:12, color: active ? C.text : C.muted, fontWeight: active ? 500 : 400 }}>{l}</span>
              {i < 2 && <div style={{ width:24, height:1, background:C.border }}/>}
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: PASTE ── */}
      {step === 1 && (
        <>
          <div style={{ background:"#f9fafb", border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:500, color:C.text, marginBottom:4 }}>💡 How it works</div>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.7 }}>
              Copy all your MoMo messages from your phone — one or many — and paste them here together. Receiva will automatically split, parse, and let you review each one before saving.
            </div>
          </div>

          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <button style={{ padding:"6px 12px", borderRadius:8, border:`1px solid rgba(255,204,0,0.4)`, background:"rgba(255,204,0,0.08)", color:"#b45309", fontSize:12, cursor:"pointer", fontFamily:"'Poppins',sans-serif" }} onClick={()=>setRaw(BULK_SAMPLE)}>
              Load 3-message sample
            </button>
            <button style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:12, cursor:"pointer", fontFamily:"'Poppins',sans-serif" }} onClick={()=>setRaw("")}>
              Clear
            </button>
          </div>

          <label style={label}>Paste all your MoMo messages here</label>
          <textarea
            style={{ ...input, minHeight:160, resize:"vertical", fontFamily:"monospace", fontSize:12, lineHeight:1.8, marginBottom:14 }}
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder={"Paste one or many MoMo SMS messages here — all at once is fine.\n\nExample:\nPayment received for GHS 9.00 from JEDIDIAH...\n\ntelecel000... Confirmed. GHS12.00 sent to..."}
          />

          <div style={{ marginBottom:16 }}>
            <label style={label}>Which wallet received these payments?</label>
            <select style={input} value={walletId} onChange={e => setWalletId(e.target.value)}>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>
                  {WALLET_PRESETS.find(p => p.id === w.presetId)?.icon} {w.name}
                </option>
              ))}
            </select>
          </div>

          <Btn variant="primary" full disabled={!raw.trim()} onClick={handleParse}>
            <Icon d={IC.receipt} size={15}/> Parse messages →
          </Btn>
        </>
      )}

      {/* ── STEP 2: REVIEW ── */}
      {step === 2 && (
        <>
          {/* SUMMARY BAR */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
            <div style={{ background:"#f9fafb", border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>Messages found</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color:C.text }}>{items.length}</div>
            </div>
            <div style={{ background:C.income+"08", border:`1px solid ${C.income}22`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>Total to save</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color:C.income }}>{fmt(totalAmt)}</div>
            </div>
            <div style={{ background: missingDesc > 0 ? "#fff7ed" : "#f0fdf4", border:`1px solid ${missingDesc>0?C.orange+"44":"#86efac"}`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>Need description</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color: missingDesc>0 ? C.orange : "#16a34a" }}>{missingDesc}</div>
            </div>
          </div>

          {missingDesc > 0 && (
            <div style={{ background:"#fff7ed", border:`1px solid ${C.orange}33`, borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:13, color:C.orange }}>
              ⚠️ Add descriptions to the highlighted transactions before saving — this helps you track what each payment was for.
            </div>
          )}

          {/* TRANSACTION CARDS */}
          <div style={{ maxHeight:420, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, marginBottom:16, paddingRight:4 }}>
            {items.map((it, idx) => (
              <BulkTxCard
                key={it._id}
                item={it}
                index={idx}
                onChange={(k,v) => updateItem(it._id, k, v)}
                onToggle={() => toggleItem(it._id)}
              />
            ))}
          </div>

          {/* ACTIONS */}
          <div style={{ display:"flex", gap:10, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
            <Btn variant="ghost" onClick={() => setStep(1)}>← Back</Btn>
            <Btn
              variant="primary"
              full
              disabled={saving || included.length === 0}
              onClick={handleSaveAll}
            >
              <Icon d={IC.check} size={15}/>
              Save {included.length} transaction{included.length !== 1 ? "s" : ""} ({fmt(totalAmt)})
            </Btn>
          </div>
        </>
      )}

      {/* ── STEP 3: DONE ── */}
      {step === 3 && (
        <div style={{ textAlign:"center", padding:"32px 20px" }}>
          <div style={{ fontSize:52, marginBottom:16 }}>🎉</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:24, color:C.text, marginBottom:8 }}>
            {savedCount} transaction{savedCount !== 1 ? "s" : ""} saved!
          </div>
          <div style={{ fontSize:14, color:C.muted, marginBottom:24 }}>
            {fmt(totalAmt)} has been recorded to your{" "}
            <strong style={{ color:C.text }}>{wallets.find(w=>w.id===walletId)?.name}</strong> wallet.
          </div>

          {/* RECEIPT PREVIEW for all saved */}
          <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:12, padding:"14px 16px", marginBottom:20, fontFamily:"monospace", fontSize:11, whiteSpace:"pre-wrap", color:"#166534", lineHeight:1.9, textAlign:"left" }}>
            {`*Bulk Import Receipt — ${business.name}*\n` +
             `━━━━━━━━━━━━━━━\n` +
             items.filter(it=>it._included&&it.amount).map((it,i)=>
               `${i+1}. GH₵ ${it.amount} — ${it.description||"Payment"} (${it.network}) · ${it.date}`
             ).join("\n") +
             `\n━━━━━━━━━━━━━━━\nTotal: GH₵ ${totalAmt.toFixed(2)}\nPowered by Receiva`}
          </div>

          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <Btn variant="wa" href={`https://wa.me/?text=${encodeURIComponent(
              `*Bulk Import — ${business.name}*\n━━━━━━━━━━━━━━━\n` +
              items.filter(it=>it._included&&it.amount).map((it,i)=>`${i+1}. GH₵${it.amount} — ${it.description||"Payment"} (${it.network}) · ${it.date}`).join("\n") +
              `\n━━━━━━━━━━━━━━━\nTotal: GH₵${totalAmt.toFixed(2)}\nPowered by Receiva`
            )}`}>
              <Icon d={IC.share} size={14}/> Share summary
            </Btn>
            <Btn variant="primary" onClick={onClose}>
              View transactions →
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── BULK TX CARD (individual review card) ────────────────────
function BulkTxCard({ item, index, onChange, onToggle }) {
  const [expanded, setExpanded] = useState(true);
  const netCol = NET_COLOR[item.network] || C.teal;
  const hasDesc = item.description.trim().length > 0;

  return (
    <div style={{
      border: `1.5px solid ${item._included ? (hasDesc ? C.border : C.orange+"66") : "#e5e7eb88"}`,
      borderRadius: 12,
      overflow: "hidden",
      opacity: item._included ? 1 : 0.5,
      transition: "all 0.2s",
    }}>
      {/* CARD HEADER */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background: item._included ? "#f9fafb" : "#f3f4f6", cursor:"pointer" }} onClick={() => setExpanded(e => !e)}>
        {/* Checkbox */}
        <div
          onClick={e => { e.stopPropagation(); onToggle(); }}
          style={{ width:18, height:18, borderRadius:4, border:`1.5px solid ${item._included ? C.orange : C.border}`, background: item._included ? C.orange : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer" }}
        >
          {item._included && <span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>✓</span>}
        </div>

        {/* Network badge */}
        <span style={{ background: netCol+"18", color: netCol, border:`1px solid ${netCol}33`, borderRadius:20, padding:"2px 9px", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>
          {item.network}
        </span>

        {/* Amount */}
        <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, color:C.income }}>
          GH₵ {item.amount || "?"}
        </span>

        {/* Description preview */}
        <span style={{ flex:1, fontSize:12, color: hasDesc ? C.text : C.orange, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {hasDesc ? item.description : "⚠ Add description"}
        </span>

        {/* Date */}
        <span style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>{item.date}</span>

        {/* Expand toggle */}
        <span style={{ color:C.muted, fontSize:12 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {/* CARD BODY - editable fields */}
      {expanded && item._included && (
        <div style={{ padding:"12px 14px", background:C.white, borderTop:`1px solid ${C.border}` }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div>
              <label style={{ ...label, fontSize:11 }}>Description <span style={{ color:C.expense }}>*</span></label>
              <input
                style={{ ...input, fontSize:13, padding:"8px 12px", borderColor: !hasDesc ? C.orange+"88" : C.border }}
                placeholder="What was this payment for?"
                value={item.description}
                onChange={e => onChange("description", e.target.value)}
              />
            </div>
            <div>
              <label style={{ ...label, fontSize:11 }}>Category</label>
              <select style={{ ...input, fontSize:13, padding:"8px 12px" }} value={item.category} onChange={e => onChange("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            <div>
              <label style={{ ...label, fontSize:11 }}>Amount (GH₵)</label>
              <input style={{ ...input, fontSize:13, padding:"8px 12px" }} value={item.amount} onChange={e => onChange("amount", e.target.value)} />
            </div>
            <div>
              <label style={{ ...label, fontSize:11 }}>Sender</label>
              <input style={{ ...input, fontSize:13, padding:"8px 12px" }} value={item.sender} onChange={e => onChange("sender", e.target.value)} placeholder="Customer name" />
            </div>
            <div>
              <label style={{ ...label, fontSize:11 }}>Tx ID</label>
              <input style={{ ...input, fontSize:13, padding:"8px 12px", fontFamily:"monospace" }} value={item.txId} onChange={e => onChange("txId", e.target.value)} />
            </div>
          </div>
          {/* Verification badge */}
          <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:11, color: item.verification?.valid ? "#16a34a" : C.orange, background: item.verification?.valid ? "#f0fdf4" : "#fff7ed", border:`1px solid ${item.verification?.valid?"#86efac":C.orange+"44"}`, borderRadius:20, padding:"2px 8px" }}>
              {item.verification?.valid ? "✓" : "⚠"} {item.verification?.reason}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── UPGRADE MODAL ────────────────────────────────────────────
function UpgradeModal({ onClose }) {
  return (
    <Modal onClose={onClose} maxWidth={440}>
      <ModalHeader title="Upgrade to Pro" onClose={onClose}/>
      <div style={{ textAlign:"center", marginBottom:20 }}>
        <div style={{ fontSize:36, marginBottom:8 }}>⭐</div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:28, color:C.orange }}>GH₵ 40 / month</div>
        <div style={{ fontSize:14, color:C.muted, marginTop:4 }}>Everything you need to run a professional business</div>
      </div>
      {[["Logo-branded receipts","Your company colors on every receipt"],["Unlimited transactions","No monthly cap, ever"],["PDF export","Download receipts and reports"],["Multi-wallet","MTN, Telecel, company account — all in one"],["Tax-ready reports","GRA-friendly monthly summaries"],["Priority support","WhatsApp support within 2 hours"]].map(([t,d])=>(
        <div key={t} style={{ display:"flex", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}`, alignItems:"flex-start" }}>
          <span style={{ color:C.orange, fontWeight:700, marginTop:1 }}>✓</span>
          <div><div style={{ fontSize:14, fontWeight:500, color:C.text }}>{t}</div><div style={{ fontSize:12, color:C.muted }}>{d}</div></div>
        </div>
      ))}
      <Btn variant="primary" full style={{ marginTop:20 }} onClick={()=>alert("Payment coming soon! Contact us on WhatsApp: 0592040012")}>
        Upgrade now — GH₵ 40/mo
      </Btn>
      <div style={{ textAlign:"center", fontSize:12, color:C.muted, marginTop:10 }}>Cancel anytime · No hidden fees</div>
    </Modal>
  );
}

// ─── PRODUCT LIST ─────────────────────────────────────────────
function ProductList({ products, categories, onAdd, onEdit }) {
  const [search, setSearch]     = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat    = catFilter === "all" || p.categoryId === catFilter;
    return matchSearch && matchCat;
  });

  const margin = p => p.costPrice > 0 ? Math.round(((p.sellPrice - p.costPrice) / p.sellPrice) * 100) : null;

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:20, color:C.text }}>Products</div>
          <div style={{ fontSize:13, color:C.muted }}>{products.length} products · {products.filter(p=>p.type==="service").length} services</div>
        </div>
        <Btn variant="primary" onClick={onAdd}><Icon d={IC.plus} size={15}/> Add product</Btn>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input style={{ ...input, maxWidth:260, fontSize:13 }} placeholder="Search by name or SKU..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          <button onClick={()=>setCatFilter("all")} style={{ padding:"7px 14px", borderRadius:20, border:`1.5px solid ${catFilter==="all"?C.orange:C.border}`, background:catFilter==="all"?C.orange+"12":"transparent", color:catFilter==="all"?C.orange:C.muted, fontSize:12, cursor:"pointer", fontFamily:"'Poppins',sans-serif" }}>All</button>
          {categories.map(c=>(
            <button key={c.id} onClick={()=>setCatFilter(c.id)} style={{ padding:"7px 14px", borderRadius:20, border:`1.5px solid ${catFilter===c.id?c.color:C.border}`, background:catFilter===c.id?c.color+"12":"transparent", color:catFilter===c.id?c.color:C.muted, fontSize:12, cursor:"pointer", fontFamily:"'Poppins',sans-serif" }}>{c.name}</button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          ["Total products", products.filter(p=>p.type==="product").length, C.teal],
          ["Services",       products.filter(p=>p.type==="service").length, C.orange],
          ["Low stock",      products.filter(p=>p.trackStock&&p.stock<10).length, "#ef4444"],
          ["Avg margin",     products.filter(p=>p.costPrice>0).length > 0 ? Math.round(products.filter(p=>p.costPrice>0).reduce((s,p)=>s+(((p.sellPrice-p.costPrice)/p.sellPrice)*100),0)/products.filter(p=>p.costPrice>0).length)+"%":"N/A", "#2563eb"],
        ].map(([l,v,c])=>(
          <div key={l} style={card({ padding:"14px 16px" })}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>{l}</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={card({ padding:0, overflow:"hidden" })}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 80px", padding:"10px 16px", fontSize:11, color:C.muted, letterSpacing:"0.05em", textTransform:"uppercase", borderBottom:`1px solid ${C.border}` }}>
          <span>Product</span><span>Category</span><span>Cost</span><span>Price</span><span>Stock</span><span>Action</span>
        </div>
        {filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px", color:C.muted, fontSize:14 }}>No products found</div>
        )}
        {filtered.map(p => {
          const cat = categories.find(c=>c.id===p.categoryId);
          const mg  = margin(p);
          return (
            <div key={p.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 80px", padding:"12px 16px", borderBottom:`1px solid #f9fafb`, alignItems:"center", fontSize:13 }}>
              <div>
                <div style={{ fontWeight:500, color:C.text }}>{p.name}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>SKU: {p.sku} · <span style={{ color: p.type==="service"?C.orange:C.teal, fontWeight:500 }}>{p.type==="service"?"Service":"Product"}</span></div>
              </div>
              <div><span style={{ background:cat?cat.color+"14":"#f3f4f6", color:cat?.color||C.muted, padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:500 }}>{cat?.name||"—"}</span></div>
              <div style={{ color:C.muted }}>{p.costPrice > 0 ? fmt(p.costPrice) : "—"}</div>
              <div>
                <div style={{ fontWeight:600, color:C.income }}>{fmt(p.sellPrice)}</div>
                {mg !== null && <div style={{ fontSize:10, color:"#16a34a" }}>{mg}% margin</div>}
              </div>
              <div>
                {p.trackStock ? (
                  <span style={{ fontWeight:600, color: p.stock < 10 ? "#ef4444" : C.text }}>{p.stock} units</span>
                ) : (
                  <span style={{ color:C.muted, fontSize:12 }}>Service</span>
                )}
              </div>
              <div>
                <Btn variant="ghost" size="sm" onClick={()=>onEdit(p)} style={{ fontSize:11, padding:"5px 10px" }}>Edit</Btn>
              </div>
            </div>
          );
        })}
      </div>

      {/* CSV note */}
      <div style={{ marginTop:14, fontSize:12, color:C.muted, textAlign:"center" }}>
        Bulk CSV import coming soon — you'll be able to upload a spreadsheet of all your products at once.
      </div>
    </div>
  );
}

// ─── ADD/EDIT PRODUCT FORM ────────────────────────────────────
function AddEditProduct({ product, categories, onSave, onCancel }) {
  const isEdit = !!product;
  const [form, setForm] = useState(product || {
    name:"", sku:"", categoryId:"", type:"product",
    costPrice:"", sellPrice:"", taxRate:"0",
    trackStock:true, stock:"0", description:""
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const valid = form.name && form.sellPrice && form.categoryId;

  const margin = form.costPrice && form.sellPrice
    ? Math.round(((parseFloat(form.sellPrice)-parseFloat(form.costPrice))/parseFloat(form.sellPrice))*100)
    : null;

  return (
    <div style={{ maxWidth:640 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <button onClick={onCancel} style={{ background:"transparent", border:"none", cursor:"pointer", color:C.muted, fontSize:13, fontFamily:"'Poppins',sans-serif" }}>← Back</button>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:20, color:C.text }}>{isEdit?"Edit product":"Add new product"}</div>
      </div>

      <div style={card()}>
        {/* Type toggle */}
        <div style={{ marginBottom:18 }}>
          <label style={label}>Product type</label>
          <div style={{ display:"flex", gap:8 }}>
            {["product","service"].map(t=>(
              <button key={t} style={{ flex:1, padding:"10px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"'Poppins',sans-serif", fontSize:13, fontWeight:500, background: form.type===t ? C.orange+"18":C.light, color: form.type===t ? C.orange : C.muted, border:`1.5px solid ${form.type===t?C.orange+"44":C.border}` }} onClick={()=>{ set("type",t); if(t==="service") set("trackStock",false); else set("trackStock",true); }}>
                {t==="product" ? "📦 Physical product" : "⚙️ Service"}
              </button>
            ))}
          </div>
          {form.type==="service" && <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>Services don't track inventory but can be added to transactions and receipts.</div>}
        </div>

        <div style={formRow}>
          <div>
            <label style={label}>Product name <span style={{ color:"#ef4444" }}>*</span></label>
            <input style={input} placeholder="e.g. iPhone Case" value={form.name} onChange={e=>set("name",e.target.value)}/>
          </div>
          <div>
            <label style={label}>SKU / Code</label>
            <input style={input} placeholder="e.g. IC-001" value={form.sku} onChange={e=>set("sku",e.target.value)}/>
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={label}>Category <span style={{ color:"#ef4444" }}>*</span></label>
          <select style={input} value={form.categoryId} onChange={e=>set("categoryId",e.target.value)}>
            <option value="">Select category</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div style={formRow}>
          <div>
            <label style={label}>Cost price (GH₵)</label>
            <input style={input} type="number" placeholder="0.00" value={form.costPrice} onChange={e=>set("costPrice",e.target.value)}/>
            <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>What you paid for it</div>
          </div>
          <div>
            <label style={label}>Selling price (GH₵) <span style={{ color:"#ef4444" }}>*</span></label>
            <input style={input} type="number" placeholder="0.00" value={form.sellPrice} onChange={e=>set("sellPrice",e.target.value)}/>
            <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>What you charge customers</div>
          </div>
        </div>

        {/* Margin preview */}
        {margin !== null && (
          <div style={{ background: margin>30?"#f0fdf4":margin>10?"#fff7ed":"#fef2f2", border:`1px solid ${margin>30?"#86efac":margin>10?C.orange+"44":"#fca5a5"}`, borderRadius:8, padding:"10px 14px", marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:13, color:C.text }}>Profit per unit</span>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:16, color: margin>30?"#16a34a":margin>10?C.orange:"#ef4444" }}>{fmt(parseFloat(form.sellPrice)-parseFloat(form.costPrice))}</div>
              <div style={{ fontSize:11, color:C.muted }}>{margin}% margin</div>
            </div>
          </div>
        )}

        <div style={formRow}>
          <div>
            <label style={label}>Tax rate (%)</label>
            <input style={input} type="number" placeholder="0" value={form.taxRate} onChange={e=>set("taxRate",e.target.value)}/>
          </div>
          {form.type==="product" && (
            <div>
              <label style={label}>Current stock</label>
              <input style={input} type="number" placeholder="0" value={form.stock} onChange={e=>set("stock",e.target.value)} disabled={!form.trackStock}/>
            </div>
          )}
        </div>

        {form.type==="product" && (
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div onClick={()=>set("trackStock",!form.trackStock)} style={{ width:40, height:22, borderRadius:20, background: form.trackStock?C.orange:"#d1d5db", position:"relative", cursor:"pointer", transition:"background 0.2s" }}>
              <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left: form.trackStock?20:2, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }}/>
            </div>
            <span style={{ fontSize:13, color:C.text }}>Track inventory / stock levels</span>
          </div>
        )}

        <div style={{ marginBottom:18 }}>
          <label style={label}>Description</label>
          <textarea style={{ ...input, minHeight:80, resize:"vertical" }} placeholder="Short description of this product or service..." value={form.description} onChange={e=>set("description",e.target.value)}/>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant="primary" full disabled={!valid} onClick={()=>valid&&onSave({ ...form, costPrice:parseFloat(form.costPrice)||0, sellPrice:parseFloat(form.sellPrice)||0, taxRate:parseFloat(form.taxRate)||0, stock:parseInt(form.stock)||0 })}>
            <Icon d={IC.check} size={15}/> {isEdit?"Save changes":"Add product"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT CATEGORIES ───────────────────────────────────────
function ProductCategories({ categories, products, onSave }) {
  const [cats, setCats]     = useState(categories);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#F97316");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const addCat = () => {
    if (!newName.trim()) return;
    const updated = [...cats, { id:genId(), name:newName.trim(), color:newColor }];
    setCats(updated); onSave(updated); setNewName(""); setNewColor("#F97316");
  };

  const deleteCat = (id) => {
    const inUse = products.some(p=>p.categoryId===id);
    if (inUse) { alert("This category is in use by one or more products. Reassign them first."); return; }
    const updated = cats.filter(c=>c.id!==id);
    setCats(updated); onSave(updated);
  };

  const saveEdit = (id) => {
    const updated = cats.map(c=>c.id===id?{...c,name:editName}:c);
    setCats(updated); onSave(updated); setEditId(null);
  };

  return (
    <div style={{ maxWidth:520 }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:20, color:C.text, marginBottom:20 }}>Categories</div>

      {/* Add new */}
      <div style={card({ marginBottom:20 })}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:600, fontSize:14, color:C.text, marginBottom:14 }}>Add new category</div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <input style={{ ...input, flex:1 }} placeholder="Category name" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCat()}/>
          <input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)} style={{ width:40, height:40, border:`1px solid ${C.border}`, borderRadius:8, padding:2, cursor:"pointer" }}/>
          <Btn variant="primary" onClick={addCat} disabled={!newName.trim()}><Icon d={IC.plus} size={15}/> Add</Btn>
        </div>
      </div>

      {/* List */}
      <div style={card({ padding:0, overflow:"hidden" })}>
        {cats.map((c,i) => {
          const count = products.filter(p=>p.categoryId===c.id).length;
          return (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderBottom: i<cats.length-1?`1px solid ${C.border}`:"none" }}>
              <div style={{ width:12, height:12, borderRadius:"50%", background:c.color, flexShrink:0 }}/>
              {editId===c.id ? (
                <input style={{ ...input, flex:1, padding:"6px 10px", fontSize:13 }} value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEdit(c.id)} autoFocus/>
              ) : (
                <div style={{ flex:1, fontSize:14, color:C.text, fontWeight:500 }}>{c.name}</div>
              )}
              <div style={{ fontSize:12, color:C.muted }}>{count} product{count!==1?"s":""}</div>
              {editId===c.id ? (
                <div style={{ display:"flex", gap:6 }}>
                  <Btn variant="primary" size="sm" onClick={()=>saveEdit(c.id)}>Save</Btn>
                  <Btn variant="ghost" size="sm" onClick={()=>setEditId(null)}>Cancel</Btn>
                </div>
              ) : (
                <div style={{ display:"flex", gap:6 }}>
                  <Btn variant="ghost" size="sm" onClick={()=>{ setEditId(c.id); setEditName(c.name); }}>Edit</Btn>
                  <Btn variant="ghost" size="sm" onClick={()=>deleteCat(c.id)} style={{ color:"#ef4444", borderColor:"#fca5a5" }}>Delete</Btn>
                </div>
              )}
            </div>
          );
        })}
        {cats.length === 0 && <div style={{ textAlign:"center", padding:"32px", color:C.muted, fontSize:14 }}>No categories yet</div>}
      </div>
    </div>
  );
}
