import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase";
import { sanitizeTransaction } from "./security/sanitize.js";
import { useOfflineSync } from "./providers/OfflineSyncProvider";
import { InvoiceForm } from "./components/InvoiceForm";
import { CreditBook } from "./components/CreditBook";
import { InvoiceScannerDropzone } from "./components/InvoiceScannerDropzone";
import { ConsolidatedDashboard } from "./components/ConsolidatedDashboard";
import { AiAccountantTerminal } from "./components/AiAccountantTerminal";
import { useBackgroundSync } from "./hooks/useBackgroundSync";
import {
  Home, Wallet, ArrowLeftRight, Receipt, BarChart3, Package,
  Plus, Share2, Check, X, Eye, Clock, Lock, Star, Pencil, Trash2,
  Smartphone, TabletSmartphone, Satellite, Building2, Banknote, Landmark,
  MessageCircle, Gift, FileText, BarChart2, Shield, ChevronDown,
  Menu, LogOut, Upload, Clipboard, AlertTriangle, PartyPopper,
  HandCoins, ArrowUpFromLine, Cog, User, TrendingUp, TrendingDown,
  Mic, MicOff
} from "lucide-react";

// ─── CONSTANTS ────────────────────────────────────────────────
const CATEGORIES = ["Sales","Service fee","Rent","Supplies","Transport","Salary","Utilities","MoMo transfer","Other"];
const FREE_RECEIPT_LIMIT = 5;
const DEV_EMAIL = "jeddyeternal21@gmail.com";
const DEV_EMAIL_ALT = "jedidiah@example.com";
const isDevEmail = (email) => email === DEV_EMAIL || email === DEV_EMAIL_ALT;
const today = () => new Date().toISOString().split("T")[0];
const genId  = () => Math.random().toString(36).slice(2,9);
const genRNo = () => `RCV-${Date.now().toString().slice(-6)}`;
const fmt    = n  => `GH₵ ${Number(n).toLocaleString("en-GH",{minimumFractionDigits:2})}`;

// ─── WALLET PRESETS ───────────────────────────────────────────
const WALLET_ICON_MAP = {
  mtn: Smartphone, telecel: TabletSmartphone, voda: Satellite,
  company: Building2, cash: Banknote, bank: Landmark,
};
const WALLET_PRESETS = [
  { id:"mtn",     label:"MTN MoMo",       color:"#FFCC00", bg:"#fff9e6" },
  { id:"telecel", label:"Telecel Cash",   color:"#E30613", bg:"#ffeaeb" },
  { id:"voda",    label:"Vodafone Cash",  color:"#E30613", bg:"#ffeaeb" },
  { id:"company", label:"Company Account",color:"#F97316", bg:"#fff4ed" },
  { id:"cash",    label:"Cash",           color:"#16a34a", bg:"#f0fdf4" },
  { id:"bank",    label:"Bank Account",   color:"#2563eb", bg:"#eff6ff" },
];
function WalletIcon({ presetId, size=18, color }) {
  const IconComp = WALLET_ICON_MAP[presetId] || Smartphone;
  return <IconComp size={size} color={color} strokeWidth={1.8}/>;
}

// ─── DEMO DATA ────────────────────────────────────────────────
const DEMO_WALLETS = [];
const DEMO_TRANSACTIONS = [];
const DEMO_PRODUCT_CATS = [];

const DEMO_PRODUCTS = [];

const DEMO_BUSINESS = { name:"My Business", owner:"", phone:"", industry:"", plan:"free", logoColor:"#10B981", logoBg:"rgba(16,185,129,0.1)" };

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

function ReceivaLogo({ size = 28, stroke = "#FFFFFF" }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 100 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Smartphone silhouette frame with folded corner */}
      <path
        d="M 25 10 H 70 L 90 30 V 135 A 15 15 0 0 1 75 150 H 25 A 15 15 0 0 1 10 135 V 25 A 15 15 0 0 1 25 10 Z"
        fill="#FBF9F6"
        stroke={stroke}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {/* Fold corner triangle */}
      <path
        d="M 70 10 L 70 20 A 10 10 0 0 0 80 30 L 90 30 Z"
        fill="#C5C8C9"
        stroke={stroke}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* Camera notch / pill */}
      <rect x="38" y="16" width="24" height="6" rx="3" fill="#000000" />
      
      {/* Horizontal data lines / pill outlines on the left */}
      <rect x="18" y="48" width="26" height="7" rx="3.5" stroke="#CCCCCC" strokeWidth="2" fill="none" />
      <rect x="18" y="60" width="26" height="7" rx="3.5" stroke="#CCCCCC" strokeWidth="2" fill="none" />
      <rect x="18" y="72" width="26" height="7" rx="3.5" stroke="#CCCCCC" strokeWidth="2" fill="none" />
      
      {/* Forest Green Quill Body */}
      <path
        d="M 22 75 Q 48 50 82 34 C 70 46 50 64 22 75 Z"
        fill="#045c38"
      />
      {/* Stem / quill line */}
      <path
        d="M 20 78 C 30 70 55 50 84 32"
        stroke="#000000"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      
      {/* Chart baseline at the bottom */}
      <line x1="22" y1="135" x2="78" y2="135" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" />
      
      {/* 4 chart bars */}
      <rect x="28" y="117" width="9" height="18" rx="2" fill="#045c38" />
      <rect x="40" y="103" width="9" height="32" rx="2" fill="#045c38" />
      <rect x="52" y="85" width="9" height="50" rx="2" fill="#045c38" />
      <rect x="64" y="110" width="9" height="25" rx="2" fill="#B91C1C" />
    </svg>
  );
}

// ─── ICON MAPPING (Lucide React) ─────────────────────────────
const LI = {
  home: Home, tx: ArrowLeftRight, receipt: Receipt, wallet: Wallet,
  plus: Plus, share: Share2, check: Check, x: X, report: BarChart3,
  eye: Eye, momo: Clock, box: Package, lock: Lock, star: Star,
  edit: Pencil, trash: Trash2, user: User, settings: Cog,
};
function LIcon({ name, size=18, color, strokeWidth=1.8, style={} }) {
  const Comp = LI[name];
  if (!Comp) return null;
  return <Comp size={size} color={color} strokeWidth={strokeWidth} style={style}/>;
}

// ─── COLORS ──────────────────────────────────────────────────
const C = {
  orange:  "var(--c-orange)",
  orangeD: "var(--c-orangeD)",
  teal:    "var(--c-teal)",
  income:  "var(--c-income)",
  expense: "var(--c-expense)",
  text:    "var(--c-text)",
  muted:   "var(--c-muted)",
  light:   "var(--c-light)",
  border:  "var(--c-border)",
  white:   "var(--c-white)",
  sidebar: "var(--c-sidebar)",
  sidebarBorder: "var(--c-sidebarBorder)",
  navActiveBg: "var(--c-nav-active-bg)",
};

// ─── SHARED UI ────────────────────────────────────────────────
const card  = (extra={}) => ({ background:C.white, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px", ...extra });
const label = { fontSize:12, color:C.muted, marginBottom:5, display:"block", letterSpacing:"0.04em", fontWeight:500 };
const input = { background:C.white, border:`1.5px solid ${C.border}`, borderRadius:8, padding:"10px 14px", color:C.text, fontSize:14, fontFamily:"'Poppins',sans-serif", outline:"none", width:"100%", boxSizing:"border-box", transition:"border-color 0.2s" };
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
      <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:18, color:C.text }}>{title}</div>
      <Btn variant="ghost" size="sm" onClick={onClose} style={{ padding:"6px 10px" }}><LIcon name="x" size={14}/></Btn>
    </div>
  );
}

// ─── WALLET PILL ─────────────────────────────────────────────
function WalletPill({ wallet, active, onClick }) {
  const preset = WALLET_PRESETS.find(p=>p.id===wallet.presetId) || WALLET_PRESETS[0];
  return (
    <div onClick={onClick} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px", borderRadius:20, cursor:"pointer", background: active ? preset.color+"18" : "var(--c-light)", border:`1.5px solid ${active ? preset.color : "var(--c-border)"}`, transition:"all 0.15s", whiteSpace:"nowrap" }}>
      <WalletIcon presetId={wallet.presetId} size={14} color={active ? preset.color : undefined}/>
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
  const [tab, setTab]         = useState("login");
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [name, setName]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // ── Brute-force protection ──
  const [failCount, setFailCount]   = useState(0);
  const [lockUntil, setLockUntil]   = useState(null);
  const [lockRemaining, setLockRemaining] = useState(0);

  useEffect(() => {
    if (!lockUntil) return;
    const tick = setInterval(() => {
      const left = Math.ceil((lockUntil - Date.now()) / 1000);
      if (left <= 0) { setLockUntil(null); setLockRemaining(0); clearInterval(tick); }
      else setLockRemaining(left);
    }, 1000);
    return () => clearInterval(tick);
  }, [lockUntil]);

  const isLocked = lockUntil && Date.now() < lockUntil;

  const handleAuth = async () => {
    if (isLocked) { setError(`Too many attempts. Try again in ${lockRemaining}s.`); return; }
    if (!email || !pass) { setError("Please enter your email and password."); return; }
    if (pass.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    try {
      if (tab === "signup") {
        const { data, error: e } = await supabase.auth.signUp({ email, password:pass, options:{ data:{ full_name: name||email.split("@")[0] } } });
        if (e) { setError(e.message); return; }
        if (data.session) { setFailCount(0); onLogin({ name:name||email.split("@")[0], email, plan:"free", id:data.user.id }); return; }
        if (data.user && !data.session) { setError(""); alert("Account created! Check your email for a confirmation link, then sign in."); setTab("login"); return; }
      } else {
        const { data, error: e } = await supabase.auth.signInWithPassword({ email, password:pass });
        if (e) {
          const newFails = failCount + 1;
          setFailCount(newFails);
          if (newFails >= 10) {
            setLockUntil(Date.now() + 5 * 60 * 1000); setLockRemaining(300);
            setError("Account locked for 5 minutes. Too many failed attempts.");
          } else if (newFails >= 5) {
            setLockUntil(Date.now() + 60 * 1000); setLockRemaining(60);
            setError("Too many failed attempts. Try again in 60 seconds.");
          } else {
            setError(e.message.includes("Invalid login") ? "Wrong email or password." : e.message);
          }
          return;
        }
        if (data.user) { setFailCount(0); onLogin({ name:data.user.user_metadata?.full_name||email.split("@")[0], email, plan:"free", id:data.user.id }); }
      }
    } catch(err) {
      setError("Something went wrong. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter") handleAuth(); };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`
        * { font-family: 'Poppins', sans-serif; box-sizing: border-box; }
        body { margin: 0; background: #121214; }
        .login-page { min-height: 100vh; display: flex; flex-direction: column; background: #121214; }
        .login-nav { padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; background: #1E2025; border-bottom: 1px solid #2e3036; }
        .login-body { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 20px 16px 40px; overflow-y: auto; }
        .login-inner { width: 100%; max-width: 420px; }
        .hero { text-align: center; margin-bottom: 24px; }
        .badge-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); border-radius: 20px; padding: 5px 12px; font-size: 11px; color: #10B981; font-weight: 500; margin-bottom: 12px; }
        .hero-title { font-size: clamp(22px, 6vw, 28px); font-weight: 600; color: #FFFFFF; line-height: 1.25; margin-bottom: 8px; }
        .hero-sub { font-size: 13px; color: #94A3B8; line-height: 1.7; max-width: 300px; margin: 0 auto; }
        .auth-card { background: #1E2025; border-radius: 20px; padding: 22px 18px; box-shadow: 0 4px 24px rgba(0,0,0,0.15); border: 1px solid #2e3036; margin-bottom: 14px; }
        .tab-row { display: flex; background: #121214; border-radius: 10px; padding: 3px; margin-bottom: 18px; }
        .tab-btn { flex: 1; padding: 10px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.15s; }
        .tab-btn.active { background: #1E2025; color: #FFFFFF; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
        .tab-btn.inactive { background: transparent; color: #94A3B8; }
        .field { margin-bottom: 12px; }
        .field label { display: block; font-size: 11px; color: #94A3B8; font-weight: 500; margin-bottom: 5px; letter-spacing: 0.04em; }
        .field input { width: 100%; padding: 12px 14px; border: 1px solid #2e3036; border-radius: 10px; font-size: 16px; outline: none; background: #121214; color: #FFFFFF; transition: border-color 0.2s; }
        .field input:focus { border-color: rgba(16,185,129,0.5); background: #121214; }
        .err-box { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 13px; color: #b91c1c; }
        .btn-main { width: 100%; padding: 14px; background: #10B981; color: #fff; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .btn-main:hover { background: #059669; }
        .btn-main:disabled { opacity: 0.6; cursor: not-allowed; }
        .divider { display: flex; align-items: center; gap: 10px; margin: 14px 0; }
        .divider span { font-size: 12px; color: #94A3B8; }
        .divider-line { flex: 1; height: 1px; background: #2e3036; }
        .btn-ghost { width: 100%; padding: 12px; background: transparent; border: 1.5px solid #2e3036; border-radius: 10px; font-size: 13px; color: #94A3B8; cursor: pointer; transition: all 0.15s; }
        .btn-ghost:hover { border-color: #10B981; color: #10B981; background: rgba(16,185,129,0.04); }
        .features-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px; }
        .feat-card { background: #1E2025; border: 1px solid #2e3036; border-radius: 12px; padding: 12px 8px; text-align: center; }
        .plans-row { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; -webkit-overflow-scrolling: touch; }
        .plan-card { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 14px; padding: 14px; min-width: 140px; flex-shrink: 0; position: relative; }
        .plan-card.hot { background: rgba(16, 185, 129, 0.06); border-color: rgba(16, 185, 129, 0.4); }
        .popular-tag { position: absolute; top: -9px; left: 50%; transform: translateX(-50%); background: #10B981; color: #fff; font-size: 9px; font-weight: 700; padding: 2px 10px; border-radius: 20px; white-space: nowrap; }
        .footer-note { text-align: center; margin-top: 14px; font-size: 11px; color: #94A3B8; }
      `}</style>

      <div className="login-page">
        {/* NAV */}
        <div className="login-nav">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ReceivaLogo size={28} />
            <div style={{ fontWeight:700, fontSize:20, color:"#FFFFFF", fontFamily: "'Poppins', sans-serif" }}>Receiva</div>
          </div>
          <div style={{ fontSize:11, color:"#94A3B8" }}>Financial records for Ghana</div>
        </div>

        <div className="login-body">
          <div className="login-inner">
            {/* HERO */}
            <div className="hero">
              <div className="badge-pill"><Shield size={14} strokeWidth={1.8} style={{marginRight:4}}/> Built for Ghana businesses</div>
              <div className="hero-title">Your business records,<br/><span style={{ color:"#10B981" }}>organised.</span></div>
              <div className="hero-sub">Turn MoMo SMS into professional receipts. Track income and expenses in one place.</div>
            </div>

            {/* AUTH CARD */}
            <div className="auth-card">
              <div className="tab-row">
                {["login","signup"].map(t=>(
                  <button key={t} className={`tab-btn ${tab===t?"active":"inactive"}`} onClick={()=>{ setTab(t); setError(""); }}>
                    {t==="login" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              {tab==="signup" && (
                <div className="field">
                  <label>Full name</label>
                  <input placeholder="Your full name" value={name} onChange={e=>setName(e.target.value)} onKeyDown={handleKey}/>
                </div>
              )}
              <div className="field">
                <label>Email address</label>
                <input type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={handleKey}/>
              </div>
              <div className="field" style={{ marginBottom: error ? 10 : 16 }}>
                <label>Password</label>
                <input type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={handleKey}/>
              </div>

              {error && <div className="err-box">{error}</div>}

              <button className="btn-main" onClick={handleAuth} disabled={loading}>
                {loading ? "Please wait..." : tab==="login" ? "Sign in →" : "Create account →"}
              </button>

              <div className="divider">
                <div className="divider-line"/><span>or</span><div className="divider-line"/>
              </div>

              <button className="btn-ghost" onClick={onGuest}>
                <Gift size={16} strokeWidth={1.8} style={{marginRight:6}}/> Try 5 free receipts — no signup needed
              </button>
            </div>

            {/* FEATURES */}
            <div className="features-row">
              {[[Receipt,"Receipts","Instant"],[Smartphone,"MoMo","Parser"],[BarChart2,"Reports","Monthly"]].map(([IconComp,title,sub])=>(
                <div key={title} className="feat-card">
                  <div style={{ marginBottom:4, color: "#10B981" }}><IconComp size={22} strokeWidth={1.8}/></div>
                  <div style={{ fontSize:12, fontWeight:500, color:"#FFFFFF" }}>{title}</div>
                  <div style={{ fontSize:10, color:"#94A3B8" }}>{sub}</div>
                </div>
              ))}
            </div>

            <div className="footer-note"><Lock size={12} strokeWidth={1.8} style={{marginRight:4,verticalAlign:"middle"}}/> Encrypted · Cancel anytime · Ghana-built</div>
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
  useBackgroundSync();
  const [authState, setAuthState]               = useState("loading");
  const [user, setUser]                         = useState(null);
  const [page, setPage]                         = useState("dashboard");
  const [darkMode, setDarkMode]                 = useState(() => localStorage.getItem("darkMode") === "true");

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("darkMode", "true");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("darkMode", "false");
    }
  }, [darkMode]);

  const [wallets, setWallets]                   = useState([]);
  const [activeWallet, setActiveWallet]         = useState(null);
  const [transactions, setTransactions]         = useState([]);
  const [business, setBusiness]                 = useState({ name:"My Business", owner:"", phone:"", industry:"", plan:"free", logoColor:"#10B981", logoBg:"rgba(16,185,129,0.1)" });
  const [guestCount, setGuestCount]             = useState(0);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showReceipt, setShowReceipt]           = useState(null);
  const [showAddWallet, setShowAddWallet]       = useState(false);
  const [showUpgrade, setShowUpgrade]           = useState(false);
  const [dataLoading, setDataLoading]           = useState(false);
  const [dataError, setDataError]               = useState("");
  const [businessId, setBusinessId]             = useState(null);
  const [editingProduct, setEditingProduct]     = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen]     = useState(false);
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [products, setProducts]                 = useState([]);
  const [invoices, setInvoices]                 = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [showEditTransaction, setShowEditTransaction] = useState(null);
  const [voidedReceipts, setVoidedReceipts] = useState(new Set());
  const [deletedTransactions, setDeletedTransactions] = useState([]);

  // ── Load all user data from Supabase ──
  const loadUserData = async (userId, userEmail = null) => {
    setDataLoading(true);
    try {
      if (!userEmail) {
        const { data: { session } } = await supabase.auth.getSession();
        userEmail = session?.user?.email;
      }
      const isDev = isDevEmail(userEmail);

      let { data: bizData, error: bizErr } = await supabase.from("businesses").select("*").eq("owner_id", userId).single();
      if (bizErr && bizErr.code === "PGRST116") {
        const { data: newBiz, error: createErr } = await supabase.from("businesses").insert({ owner_id:userId, business_name:"My Business", plan: isDev ? "enterprise" : "free", logo_color:"#10B981", logo_bg:"rgba(16,185,129,0.1)" }).select().single();
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
      setBusiness(b => ({ ...b, name: bizData.business_name || "My Business", logoColor: bizData.logo_color || "#10B981", logoBg: bizData.logo_bg || "rgba(16,185,129,0.1)", plan: isDev ? "enterprise" : (bizData.plan || "free") }));
      setWallets(mappedWallets);
      setTransactions(mappedTx);
      // Resolve shopId
      let shopId = null;
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("shop_id, role")
          .eq("id", userId)
          .single();

        const dbRole = profileData?.role || "owner";
        const finalRole = isDev ? "owner" : dbRole;
        setUser(u => u ? { ...u, role: finalRole, plan: isDev ? "enterprise" : u.plan } : null);

        if (profileData && profileData.shop_id) {
          shopId = profileData.shop_id;
        } else {
          const { data: existingShops } = await supabase.from("shops").select("id").limit(1);
          if (existingShops && existingShops.length > 0) {
            shopId = existingShops[0].id;
          } else {
            const { data: newShop } = await supabase
              .from("shops")
              .insert({ name: bizData.business_name || "My Business", current_tier: isDev ? "enterprise" : "free" })
              .select()
              .single();
            if (newShop) shopId = newShop.id;
          }

          if (shopId) {
            await supabase.from("profiles").upsert({
              id: userId,
              full_name: bizData.business_name || "Owner",
              role: finalRole,
              shop_id: shopId
            });
          }
        }
      } catch (profileErr) {
        console.warn("Could not fetch/setup profiles and shops:", profileErr);
      }

      if (shopId) {
        const { data: prodData } = await supabase
          .from("products")
          .select("*")
          .eq("shop_id", shopId)
          .order("item_name", { ascending: true });
        
        const { data: invoiceData } = await supabase
          .from("invoices")
          .select("*")
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false });

        setProducts(prodData || []);
        setInvoices(invoiceData || []);
      } else {
        setProducts([]);
        setInvoices([]);
      }
      
      setProductCategories([{ id:"c1", name:"Products", color:"#2563eb" },{ id:"c2", name:"Services", color:"#10B981" }]);
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
        const isDev = isDevEmail(session.user.email);
        const u = {
          name:  session.user.user_metadata?.full_name || session.user.email.split("@")[0],
          email: session.user.email,
          plan:  isDev ? "enterprise" : "free",
          role:  isDev ? "owner" : "attendant",
          id:    session.user.id,
        };
        setUser(u);
        setAuthState("app");
        loadUserData(session.user.id, session.user.email);
      } else {
        setAuthState("login");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const isDev = isDevEmail(session.user.email);
        const u = {
          name:  session.user.user_metadata?.full_name || session.user.email.split("@")[0],
          email: session.user.email,
          plan:  isDev ? "enterprise" : "free",
          role:  isDev ? "owner" : "attendant",
          id:    session.user.id,
        };
        setUser(u);
        setAuthState("app");
        loadUserData(session.user.id, session.user.email);
      } else {
        setUser(null);
        setAuthState("login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = (u) => {
    const isDev = isDevEmail(u.email);
    const updatedU = {
      ...u,
      plan: isDev ? "enterprise" : u.plan,
      role: isDev ? "owner" : u.role
    };
    setUser(updatedU);
    setAuthState("app");
    if(u.id) loadUserData(u.id, u.email);
  };
  const handleGuest = () => { setWallets([]); setTransactions([]); setAuthState("guest"); };
  const handleSignOut = async () => { await supabase.auth.signOut(); setUser(null); setWallets([]); setTransactions([]); setBusinessId(null); setBusiness({ name:'My Business', owner:'', phone:'', industry:'', plan:'free', logoColor:'#10B981', logoBg:'rgba(16,185,129,0.1)' }); setAuthState("login"); };

  if (authState === "loading") return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#121214", fontFamily:"'Poppins',sans-serif" }}>
      <div style={{ textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
        <ReceivaLogo size={48} />
        <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:24, color:"#FFFFFF" }}>Receiva</div>
        <div style={{ fontSize:13, color:"#94A3B8" }}>Loading...</div>
      </div>
    </div>
  );

  if (authState === "login") return <LoginPage onLogin={handleLogin} onGuest={handleGuest}/>;

  const isGuest    = authState === "guest";
  const isPro      = user?.plan === "pro" || business?.plan === "pro" || business?.plan === "growth" || business?.plan === "business" || business?.plan === "enterprise" || isDevEmail(user?.email);
  const txFiltered = activeWallet ? transactions.filter(t=>t.walletId===activeWallet) : transactions;
  const income     = txFiltered.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense    = txFiltered.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const balance    = income - expense;
  const txCap      = (business?.plan === "pro" || business?.plan === "enterprise") ? Infinity :
                     business?.plan === "business" ? 1750 :
                     business?.plan === "growth" ? 1000 : 60;
  const txUsed     = transactions.length;

  const tryGenerateReceipt = (tx) => {
    if (isGuest) {
      if (guestCount >= FREE_RECEIPT_LIMIT) { setAuthState("login"); return; }
      setGuestCount(g=>g+1);
    }
    setShowReceipt(tx);
  };

  const handleSaveInvoice = async (invoiceHeader, lineItems) => {
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("shop_id")
        .eq("id", user.id)
        .single();
      
      const shopId = profileData?.shop_id;
      if (!shopId) {
        throw new Error("No branch/shop profile assigned to your account.");
      }

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          shop_id: shopId,
          customer_name: invoiceHeader.customer_name,
          customer_phone: invoiceHeader.customer_phone,
          total_amount: invoiceHeader.total_amount,
          payment_status: invoiceHeader.payment_status,
          telco_transaction_id: invoiceHeader.telco_transaction_id,
          due_date: invoiceHeader.due_date,
          extra_notes: invoiceHeader.extra_notes,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;
      if (!invoiceData) throw new Error('Invoice insertion succeeded but returned no row ID.');

      const dbInvoiceId = invoiceData.id;

      const lineItemsPayload = lineItems.map((line) => ({
        invoice_id: dbInvoiceId,
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price: line.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(lineItemsPayload);

      if (itemsError) {
        await supabase.from('invoices').delete().eq('id', dbInvoiceId);
        throw itemsError;
      }

      alert('Invoice saved successfully to database!');
      if (user?.id) {
        loadUserData(user.id);
      }
    } catch (err) {
      console.error('Failed to save invoice:', err);
      alert('Failed to save invoice: ' + err.message);
    }
  };

  const handleConfirmIntake = async (ocrResult) => {
    if (isGuest) {
      setProducts(prev => prev.map(p => {
        const matchingOcr = ocrResult.items.find(item => item.item_name.toLowerCase() === p.item_name.toLowerCase());
        if (matchingOcr) {
          return { ...p, stock_remaining: (p.stock_remaining || 0) + matchingOcr.quantity };
        }
        return p;
      }));
    } else {
      try {
        for (const item of ocrResult.items) {
          const matched = products.find(p => p.item_name.toLowerCase() === item.item_name.toLowerCase());
          if (matched) {
            const { error } = await supabase
              .from('products')
              .update({ stock_remaining: (matched.stock_remaining || 0) + item.quantity })
              .eq('id', matched.id);
            if (error) throw error;
          }
        }
        alert('Stock Intake Confirmed! Inventory records updated successfully.');
        if (user?.id) loadUserData(user.id);
      } catch (err) {
        console.error('Failed to update stock from OCR:', err);
        alert('Failed to update stock levels: ' + err.message);
      }
    }
  };

  const addTransaction = async (rawTx) => {
    let tx;
    try { tx = sanitizeTransaction(rawTx); } catch (e) { alert(e.message); return; }
    const newReceiptNo = genRNo();
    if (isGuest || !businessId) {
      setTransactions(p=>[{...tx, id:genId(), receiptNo:newReceiptNo}, ...p]);
      setShowRecordPayment(false); return;
    }
    const { data, error } = await supabase.from("transactions").insert({ wallet_id:tx.walletId, business_id:businessId, type:tx.type, amount:tx.amount, category:tx.category, description:tx.description, method:tx.method, date:tx.date, momo_ref:tx.momoRef||null, receipt_no:newReceiptNo }).select().single();
    if (error) { console.error(error); alert("Could not save transaction. Please try again."); return; }
    setTransactions(p=>[{ id:data.id, walletId:data.wallet_id, type:data.type, amount:parseFloat(data.amount), category:data.category||"", description:data.description||"", method:data.method||"", date:data.date, momoRef:data.momo_ref||"", receiptNo:data.receipt_no||newReceiptNo }, ...p]);
    setShowRecordPayment(false);
  };

  const updateTransaction = async (rawTx) => {
    let tx;
    try { tx = sanitizeTransaction(rawTx); } catch (e) { alert(e.message); return; }
    if (isGuest || !businessId) {
      setTransactions(p => p.map(t => t.id === tx.id ? tx : t));
      setShowEditTransaction(null);
      return;
    }
    const { error } = await supabase.from("transactions").update({
      wallet_id: tx.walletId, type: tx.type, amount: tx.amount,
      category: tx.category, description: tx.description,
      method: tx.method, date: tx.date, momo_ref: tx.momoRef || null
    }).eq("id", tx.id);
    if (error) { console.error(error); alert("Could not update transaction."); return; }
    setTransactions(p => p.map(t => t.id === tx.id ? tx : t));
    setShowEditTransaction(null);
  };

  const deleteTransaction = async (tx) => {
    if (isGuest || !businessId) {
      setTransactions(p => p.filter(t => t.id !== tx.id));
      setDeletedTransactions(prev => [...prev, { ...tx, _deleted: true }]);
      if (tx.receiptNo) setVoidedReceipts(prev => new Set(prev).add(tx.receiptNo));
      setShowEditTransaction(null);
      return;
    }
    const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
    if (error) { console.error(error); alert("Could not delete transaction."); return; }
    setTransactions(p => p.filter(t => t.id !== tx.id));
    setDeletedTransactions(prev => [...prev, { ...tx, _deleted: true }]);
    if (tx.receiptNo) setVoidedReceipts(prev => new Set(prev).add(tx.receiptNo));
    setShowEditTransaction(null);
  };

  const addWallet = async (w) => {
    const walletLimit = (business?.plan === "pro" || business?.plan === "enterprise") ? Infinity :
                        business?.plan === "business" ? 5 :
                        business?.plan === "growth" ? 4 : 2;
    if (wallets.length >= walletLimit) {
      alert(`Your current plan (${(business.plan||'free').toUpperCase()}) only supports up to ${walletLimit} wallets. Please upgrade your subscription on the Reports page to add more.`);
      return;
    }
    if (isGuest || !businessId) { setWallets(p=>[...p,{...w,id:genId(),balance:0}]); setShowAddWallet(false); return; }
    const { data, error } = await supabase.from("wallets").insert({ business_id:businessId, preset_id:w.presetId, name:w.name, number:w.number||null }).select().single();
    if (error) { console.error(error); alert("Could not save wallet."); return; }
    setWallets(p=>[...p,{ id:data.id, presetId:data.preset_id, name:data.name, number:data.number||"", balance:0 }]);
    setShowAddWallet(false);
  };

  const isEnterprise = business?.plan === "enterprise" || isDevEmail(user?.email);

  const allNav = [
    { key:"dashboard",    label:"Dashboard",   icon:"home"    },
    { key:"wallets",      label:"Wallets",      icon:"wallet"  },
    { key:"transactions", label:"Transactions", icon:"tx"      },
    { key:"receipts",     label:"Receipts",     icon:"receipt" },
    { key:"reports",      label:"Reports",      icon:"report"  },
    { key:"products",     label:"Products",     icon:"box", children:[
      { key:"product-list",    label:"Product List"    },
      { key:"add-product",     label:"Add New Product" },
      { key:"categories",      label:"Categories"      },
    ]},
    { key:"profile",      label:"Profile",      icon:"user"    },
    ...(isEnterprise ? [
      { key:"billing",      label:"Billing Desk", icon:"receipt" },
      { key:"ledger",       label:"Credit Book",  icon:"wallet" },
      { key:"intake",       label:"OCR Intake",   icon:"box" },
      { key:"console",      label:"Enterprise",   icon:"report" },
      { key:"terminal",     label:"AI Accountant",icon:"settings" }
    ] : []),
    { key:"settings",     label:"Settings",     icon:"settings" },
  ];

  const isProductPage = ["products","product-list","add-product","categories"].includes(page);

  const NavItem = ({ n, mobile=false, onNavigate }) => {
    if (n.children) {
      const childActive = n.children.some(c=>c.key===page);
      return (
        <div>
          <div onClick={()=>setProductsExpanded(e=>!e)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, padding: mobile?"14px 20px":"11px 20px", cursor:"pointer", fontSize:14, color: childActive ? C.text : C.muted, background: childActive ? C.navActiveBg : "transparent", borderLeft: mobile?"none":`2px solid ${childActive ? C.text : "transparent"}`, transition:"all 0.15s", fontWeight: childActive ? 500 : 400 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}><LIcon name={n.icon} size={16}/>{n.label}</div>
            <ChevronDown size={12} style={{ transition:"transform 0.2s", transform: productsExpanded?"rotate(180deg)":"rotate(0)" }}/>
          </div>
          {productsExpanded && (
            <div style={{ background:"var(--c-light)", borderLeft: mobile?"none":"2px solid var(--c-border)", marginLeft: mobile?0:20 }}>
              {n.children.map(c=>(
                <div key={c.key} onClick={()=>{ onNavigate(c.key); }} style={{ padding: mobile?"12px 20px 12px 36px":"9px 20px 9px 28px", cursor:"pointer", fontSize:13, color: page===c.key ? C.text : C.muted, background: page===c.key ? C.navActiveBg :"transparent", fontWeight: page===c.key?500:400, transition:"all 0.15s" }}>
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
      <div onClick={()=>onNavigate(n.key)} style={{ display:"flex", alignItems:"center", gap:10, padding: mobile?"14px 20px":"11px 20px", cursor:"pointer", fontSize:14, color: active ? C.text : C.muted, background: active ? C.navActiveBg : "transparent", borderLeft: mobile?"none":`2px solid ${active ? C.text : "transparent"}`, transition:"all 0.15s", fontWeight: active ? 500 : 400 }}>
        <LIcon name={n.icon} size={16}/>{n.label}
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
      <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet"/>
      <style>{`
        :root {
          --c-orange: #10B981;
          --c-orangeD: #059669;
          --c-teal: #10B981;
          --c-income: #10B981;
          --c-expense: #ef4444;
          --c-text: #121214;
          --c-muted: #64748B;
          --c-light: #F3F4F6;
          --c-border: #E2E8F0;
          --c-white: #FFFFFF;
          --c-sidebar: #FFFFFF;
          --c-sidebarBorder: #E2E8F0;
          --c-nav-active-bg: rgba(18, 18, 20, 0.06);
        }
        body {
          background-color: var(--c-light) !important;
        }
        body.dark-mode {
          --c-orange: #10B981;
          --c-orangeD: #059669;
          --c-teal: #10B981;
          --c-income: #10B981;
          --c-expense: #ef4444;
          --c-text: #FFFFFF;
          --c-muted: #94A3B8;
          --c-light: #121214;
          --c-border: #2e3036;
          --c-white: #1E2025;
          --c-sidebar: #1E2025;
          --c-sidebarBorder: #2e3036;
          --c-nav-active-bg: rgba(255, 255, 255, 0.08);
          background-color: #121214 !important;
        }
        body, input, button, select, textarea { font-family: 'Poppins', sans-serif; transition: background-color 0.2s, border-color 0.2s, color 0.2s; }
        @media(max-width:768px){
          .desktop-sidebar{display:none!important;}
          .mobile-topbar-title{font-size:16px!important;}
          .wallet-pills{display:none!important;}
          .content-pad{padding:16px!important;}
          .stat-grid{grid-template-columns:1fr 1fr!important;}
          .hamburger-btn{display:flex!important;}
          
          .wallets-header-container {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            text-align: left;
          }
          .wallets-header-container button {
            width: 100% !important;
          }
        }
        @media(min-width:769px){
          .hamburger-btn{display:none!important;}
          .mobile-overlay{display:none!important;}
        }
        .mobile-overlay{position:fixed;inset:0;z-index:200;display:flex;}
        .mobile-drawer{width:280px;background:var(--c-white);height:100%;overflow-y:auto;box-shadow:4px 0 24px rgba(0,0,0,0.15);display:flex;flex-direction:column;}
        .mobile-backdrop{flex:1;background:rgba(0,0,0,0.4);}
        .nav-item-hover:hover{background:${C.orange}08;}
        
        /* Dark Mode overrides for raw components */
        body.dark-mode .auth-card,
        body.dark-mode .plan-card,
        body.dark-mode .feat-card {
          background: #1E2025 !important;
          border-color: #2e3036 !important;
        }
        body.dark-mode .tab-row {
          background: #121214 !important;
        }
        body.dark-mode .tab-btn.active {
          background: #1E2025 !important;
          color: #FFFFFF !important;
        }
        body.dark-mode input,
        body.dark-mode textarea,
        body.dark-mode select {
          background: #121214 !important;
          border-color: #2e3036 !important;
          color: #FFFFFF !important;
        }
        body.dark-mode .mobile-bottom-nav {
          background: #1E2025 !important;
          border-top-color: #2e3036 !important;
        }
        body.dark-mode .mobile-topbar {
          background: #1E2025 !important;
          border-bottom-color: #2e3036 !important;
        }
      `}</style>

      <div style={{ minHeight:"100vh", background:C.light, color:C.text, fontFamily:"'Poppins',sans-serif", display:"flex" }}>

        {/* DESKTOP SIDEBAR */}
        <div className="desktop-sidebar" style={{ width:220, background:C.white, borderRight:`1px solid ${C.sidebarBorder}`, display:"flex", flexDirection:"column", padding:"24px 0", flexShrink:0, boxShadow:"2px 0 8px rgba(0,0,0,0.04)" }}>
          <div style={{ padding:"0 20px 22px", borderBottom:`1px solid ${C.border}`, marginBottom:8, display: "flex", alignItems: "center", gap: 8 }}>
            <ReceivaLogo size={28} stroke={C.text} />
            <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:22, color:C.text }}>Receiva</div>
          </div>
          <div style={{ padding:"0 20px", marginBottom:14 }}>
            <div style={{ fontSize:11, color:"#94A3B8", letterSpacing:"0.1em", textTransform:"uppercase", fontStyle:"italic" }}>Financial records</div>
          </div>

          {isGuest && (
            <div style={{ margin:"0 12px 12px", background:"var(--c-light)", border:`1.5px solid ${C.border}`, borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:3 }}>Guest mode</div>
              <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>{FREE_RECEIPT_LIMIT - guestCount} free receipts left</div>
              <Btn variant="primary" full size="sm" onClick={()=>setAuthState("login")}><ArrowUpFromLine size={13}/> Sign up free</Btn>
            </div>
          )}

          {allNav.map(n=><NavItem key={n.key} n={n} onNavigate={navigateTo}/>)}

          {/* WhatsApp Support */}
          <div style={{ margin:"12px 12px 0" }}>
            <a href="https://wa.me/233205597508" target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", background:"#25D36614", border:"1px solid #25D36633", borderRadius:10, textDecoration:"none", color:"#25D366", fontSize:12, fontWeight:500 }}>
              <MessageCircle size={16} strokeWidth={1.8}/> Chat with support
            </a>
          </div>

          <div style={{ marginTop:"auto", padding:"16px 18px 0" }}>
            {!isPro && (
              <div style={{ background:"rgba(16, 185, 129, 0.04)", border:`1px solid rgba(16, 185, 129, 0.20)`, borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
                <div style={{ fontSize:11, color:"#10B981", fontWeight:600, marginBottom:2, display:"flex", alignItems:"center", gap:5 }}><LIcon name="star" size={11}/> Upgrade to Pro</div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>Logo receipts · PDF · More</div>
                <Btn variant="primary" full size="sm" onClick={()=>setShowUpgrade(true)}>Upgrade — GH₵ 23/mo</Btn>
              </div>
            )}
            {!isGuest && (
              <>
                <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>{txUsed} / {isPro ? "∞" : txCap} transactions</div>
                <div style={{ height:4, background:C.border, borderRadius:2 }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ReceivaLogo size={24} stroke={C.text} />
                  <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:20, color:C.text }}>Receiva</div>
                </div>
                <button onClick={()=>setMobileMenuOpen(false)} style={{ background:"transparent", border:"none", cursor:"pointer", color:C.muted, padding:4 }}><X size={20}/></button>
              </div>
              {isGuest && (
                <div style={{ margin:"12px 12px 0", background:"var(--c-light)", border:`1.5px solid ${C.border}`, borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:3 }}>Guest mode</div>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>{FREE_RECEIPT_LIMIT - guestCount} free receipts left</div>
                  <Btn variant="primary" full size="sm" onClick={()=>{ setAuthState("login"); setMobileMenuOpen(false); }}><ArrowUpFromLine size={13}/> Sign up free</Btn>
                </div>
              )}
              <div style={{ flex:1, overflowY:"auto" }}>
                {allNav.map(n=><NavItem key={n.key} n={n} mobile onNavigate={navigateTo}/>)}
              </div>
              <div style={{ padding:"16px 12px", borderTop:`1px solid ${C.border}` }}>
                <a href="https://wa.me/233205597508" target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 14px", background:"#25D36614", border:"1px solid #25D36633", borderRadius:10, textDecoration:"none", color:"#166534", fontSize:13, fontWeight:500 }}>
                  <MessageCircle size={18} strokeWidth={1.8}/> Chat with support on WhatsApp
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
              <button className="hamburger-btn" onClick={()=>setMobileMenuOpen(true)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 8px", cursor:"pointer", display:"none", alignItems:"center", justifyContent:"center" }}>
                <Menu size={18} color={C.text}/>
              </button>
              <div className="mobile-topbar-title" style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:18, color:C.text }}>{currentLabel()}</div>
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
                      style={{ padding:"7px 32px 7px 12px", borderRadius:20, border:`1.5px solid ${C.border}`, background:activeWallet?"var(--c-nav-active-bg)":"var(--c-light)", color:C.text, fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Poppins',sans-serif", outline:"none", appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center" }}
                    >
                      <option value="all">All wallets</option>
                      {wallets.map(w=>{
                        const preset = WALLET_PRESETS.find(p=>p.id===w.presetId)||WALLET_PRESETS[0];
                        return <option key={w.id} value={w.id}>{preset.label} — {w.name}</option>;
                      })}
                    </select>
                  )}
                </div>
              )}
              <a href="https://wa.me/233205597508" target="_blank" rel="noreferrer" title="WhatsApp support" style={{ width:32, height:32, borderRadius:"50%", background:"#25D36618", border:"1.5px solid #25D36644", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none" }}><MessageCircle size={15} color="#25D366" strokeWidth={1.8}/></a>
              <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--c-nav-active-bg)", border:`1.5px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", color:C.text, fontSize:13, fontWeight:700 }}>
                {isGuest ? <User size={14}/> : (user?.name?.[0]?.toUpperCase() || <User size={14}/>)}
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
             {page==="dashboard"    && <Dashboard transactions={txFiltered} income={income} expense={expense} balance={balance} wallets={wallets} activeWallet={activeWallet} business={business} user={user} onAdd={()=>setShowRecordPayment(true)} onReceipt={tryGenerateReceipt} onEdit={setShowEditTransaction} isPro={isPro} isGuest={isGuest} guestLeft={FREE_RECEIPT_LIMIT-guestCount}/>}
            {page==="wallets"      && <Wallets wallets={wallets} transactions={transactions} onAdd={()=>setShowAddWallet(true)} onSelect={setActiveWallet} activeWallet={activeWallet}/>}
            {page==="transactions" && <Transactions transactions={txFiltered} wallets={wallets} onAdd={()=>setShowRecordPayment(true)} onReceipt={tryGenerateReceipt} onEdit={setShowEditTransaction}/>}
            {page==="receipts"     && <Receipts transactions={txFiltered} wallets={wallets} business={business} onReceipt={tryGenerateReceipt} isPro={isPro} isGuest={isGuest} guestLeft={FREE_RECEIPT_LIMIT-guestCount} voidedReceipts={voidedReceipts} deletedTransactions={deletedTransactions}/>}
            {page==="reports"      && <Reports transactions={txFiltered} income={income} expense={expense} balance={balance} isPro={isPro} onUpgrade={()=>setShowUpgrade(true)} business={business} setBusiness={setBusiness} isGuest={isGuest} businessId={businessId}/>}
            {(page==="products"||page==="product-list") && <ProductList products={products} categories={productCategories} onAdd={()=>navigateTo("add-product")} onEdit={p=>{ setEditingProduct(p); navigateTo("add-product"); }}/>}
            {page==="add-product"  && <AddEditProduct product={editingProduct} categories={productCategories} onSave={p=>{ if(editingProduct){ setProducts(prev=>prev.map(x=>x.id===p.id?p:x)); } else { setProducts(prev=>[...prev,{...p,id:genId()}]); } setEditingProduct(null); navigateTo("product-list"); }} onCancel={()=>{ setEditingProduct(null); navigateTo("product-list"); }}/>}
            {page==="categories"   && <ProductCategories categories={productCategories} products={products} onSave={setProductCategories}/>}
            {page==="profile"      && <Profile user={user} business={business} setBusiness={setBusiness} isGuest={isGuest} businessId={businessId} onSignOut={handleSignOut}/>}
            {page==="settings"     && <Settings user={user} business={business} setBusiness={setBusiness} isGuest={isGuest} businessId={businessId} transactions={transactions} darkMode={darkMode} setDarkMode={setDarkMode}/>}
            {page==="billing"      && <InvoiceForm products={products} onSave={handleSaveInvoice} isEnterprise={isEnterprise} />}
            {page==="ledger"       && <CreditBook invoices={invoices} shopName={business.name} />}
            {page==="intake"       && <InvoiceScannerDropzone onConfirmIntake={handleConfirmIntake} supabaseUrl={import.meta.env.VITE_SUPABASE_URL} />}
            {page==="console"      && <ConsolidatedDashboard invoices={invoices} products={products} />}
            {page==="terminal"     && <AiAccountantTerminal shopName={business.name} supabaseUrl={import.meta.env.VITE_SUPABASE_URL} />}
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div className="mobile-bottom-nav">
        {[
          { key:"dashboard", label:"Dashboard", IconComp:Home },
          { key:"reports", label:"Reports", IconComp:BarChart3 },
          { key:"add", label:"Quick-add", IconComp:Plus },
          { key:"profile", label:"Profile", IconComp:User },
        ].map(n=>(
          <div key={n.key} onClick={()=>{ if(n.key==="add"){ setShowRecordPayment(true); } else { navigateTo(n.key); setMobileMenuOpen(false); } }} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, cursor:"pointer", padding:"6px 0", flex:1, color: n.key==="add" ? "#10B981" : page===n.key ? C.text : C.muted, transition:"color 0.15s" }}>
            <n.IconComp size={20} strokeWidth={page===n.key || n.key==="add" ? 2 : 1.5}/>
            <span style={{ fontSize:10, fontWeight: page===n.key ? 600 : 400 }}>{n.label}</span>
          </div>
        ))}
      </div>

      {showRecordPayment && <RecordPaymentModal onClose={()=>setShowRecordPayment(false)} onSave={addTransaction} wallets={wallets} business={business}/>}
      {showReceipt  && <ReceiptModal tx={showReceipt} business={business} isPro={isPro} onClose={()=>setShowReceipt(null)} isVoided={voidedReceipts.has(showReceipt.receiptNo)}/>}
      {showEditTransaction && <EditTransactionModal tx={showEditTransaction} onClose={()=>setShowEditTransaction(null)} onSave={updateTransaction} onDelete={deleteTransaction} wallets={wallets}/>}
      
      {showAddWallet&& <AddWalletModal onClose={()=>setShowAddWallet(false)} onSave={addWallet}/>}
      {showUpgrade  && <UpgradeModal onClose={()=>setShowUpgrade(false)}/>}
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────
function Dashboard({ transactions, income, expense, balance, wallets, business, user, onAdd, onReceipt, onEdit, isPro, isGuest, guestLeft }) {
  const { isOnline } = useOfflineSync();
  const recent = transactions.slice(0,5);
  const hasTx = transactions.length > 0;
  
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");

  const recognitionRef = useRef(null);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Speech recognition not supported in this browser.");
      return;
    }
    
    setTranscript("");
    setInterimTranscript("");
    setVoiceError("");
    setIsListening(true);

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event) => {
        let final = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + " ";
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (final) {
          setTranscript(prev => prev + final);
        }
        setInterimTranscript(interim);
      };

      rec.onerror = (event) => {
        console.error("Speech recognition error", event);
        setVoiceError(`Error: ${event.error}`);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error(err);
      setVoiceError("Failed to initialize speech recognition.");
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);
  const statCards = [
    { label:"Total Income",   value:fmt(income),   color:C.income  },
    { label:"Total Expenses", value:fmt(expense),  color:C.expense },
    { label:"Net Balance",    value:fmt(balance),  color: balance>=0 ? "#10B981" : C.expense },
    { label:"Transactions",   value:transactions.length, color:C.text },
  ];

  // ── Aggregate monthly data for charts ──
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug"];
  const barMonths = ["Jan","Feb","Mar","Apr","May","Jun"];
  const monthlyRev = new Array(8).fill(0);
  const monthlyExp = new Array(8).fill(0);
  transactions.forEach(t => {
    const d = new Date(t.date);
    const mi = d.getMonth();
    if (mi < 8) {
      if (t.type === "income") monthlyRev[mi] += t.amount;
      else monthlyExp[mi] += t.amount;
    }
  });
  const lineMaxVal = hasTx ? Math.max(1, ...monthlyRev, ...monthlyExp) : 25000;
  const barMaxVal  = hasTx ? Math.max(1, ...monthlyRev.slice(0,6), ...monthlyExp.slice(0,6)) : 2500000;

  // Y-axis helpers
  const lineYLabels = ["25,00k","20,00k","15,00k","10,00k","5,00k"];
  const lineYValues = [25000,20000,15000,10000,5000];
  const barYLabels  = ["2500k","2000k","1500k","1000k","500k"];
  const barYValues  = [2500000,2000000,1500000,1000000,500000];

  // SVG layout constants
  const svgW = 520, svgH = 260;
  const padL = 56, padR = 16, padT = 16, padB = 40;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const toLineY = (v) => padT + plotH - (v / (lineYValues[0] || 1)) * plotH;
  const toLineX = (i) => padL + (i / (months.length - 1)) * plotW;

  const lineRevPoints = months.map((_,i) => `${toLineX(i)},${toLineY(hasTx ? monthlyRev[i] : 0)}`).join(" ");
  const lineExpPoints = months.map((_,i) => `${toLineX(i)},${toLineY(hasTx ? monthlyExp[i] : 0)}`).join(" ");

  // Bar chart layout
  const bSvgW = 520, bSvgH = 260;
  const bPadL = 56, bPadR = 16, bPadT = 16, bPadB = 40;
  const bPlotW = bSvgW - bPadL - bPadR;
  const bPlotH = bSvgH - bPadT - bPadB;
  const bGroupW = bPlotW / barMonths.length;
  const barW = bGroupW * 0.28;
  const barGap = 4;

  const toBarY = (v) => bPadT + bPlotH - (v / (barYValues[0] || 1)) * bPlotH;

  // Tab style helper
  const tabStyle = (active) => ({
    padding: "3px 10px", fontSize: 10, fontWeight: active ? 600 : 400,
    color: active ? "#FFFFFF" : C.muted, background: active ? "rgba(255, 255, 255, 0.08)" : "transparent",
    borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "'Poppins',sans-serif",
    letterSpacing: "0.03em"
  });

  return (
    <>
      {/* ── DESKTOP DASHBOARD ── */}
      <div className="desktop-only">
        {/* HEADER */}
        <div style={{ marginBottom:22 }}>
          {isOnline ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between transition-all duration-300">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Good morning, {user?.name?.split(' ')[0] || 'Jedidiah'}! Let's make today profitable.</h2>
                <p className="text-sm text-gray-500 mt-1">Here's your store's financial snapshot.</p>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Live Sync Active
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-250 rounded-2xl p-6 shadow-sm flex items-start gap-4 transition-all duration-300 animate-pulse">
              <div className="p-2 bg-amber-500 text-white rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-amber-900">You are currently offline</h2>
                <p className="text-sm text-amber-700 mt-1">
                  Receiva is saving your sales safely to local memory and will auto-sync when connection returns.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* STATS CARDS */}
        <div className="dash-stats-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:22 }}>
          {statCards.map(sc=>(
            <div key={sc.label} style={card({ padding:"18px 20px" })}>
              <div style={{ fontSize:12, color:C.muted, marginBottom:6, letterSpacing:"0.03em", textTransform:"uppercase", fontWeight:500 }}>{sc.label}</div>
              <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:24, color:sc.color }}>{sc.value}</div>
            </div>
          ))}
        </div>

        {/* CHARTS ROW */}
        <div className="dash-charts-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:22 }}>
          {/* ── LEFT: P&L Line Chart ── */}
          <div style={card({ padding:"18px 20px" })}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:14, color:C.text, letterSpacing:"0.04em", textTransform:"uppercase" }}>P&L Unit Analytics</div>
              <div style={{ display:"flex", gap:2 }}>
                <button style={tabStyle(true)}>YEAR</button>
                <button style={tabStyle(false)}>Month</button>
                <button style={tabStyle(false)}>2001</button>
              </div>
            </div>
            <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ display:"block" }}>
              {/* Grid lines */}
              {lineYValues.map((v, i) => {
                const y = toLineY(v);
                return <g key={i}>
                  <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke={C.border} strokeWidth="0.7" strokeDasharray="4 3"/>
                  <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill={C.muted} fontFamily="'Poppins',sans-serif">{lineYLabels[i]}</text>
                </g>;
              })}
              {/* Baseline */}
              <line x1={padL} y1={padT + plotH} x2={svgW - padR} y2={padT + plotH} stroke={C.border} strokeWidth="1"/>
              {/* X-axis labels */}
              {months.map((m,i) => (
                <text key={m} x={toLineX(i)} y={svgH - 10} textAnchor="middle" fontSize="10" fill={C.muted} fontFamily="'Poppins',sans-serif">{m}</text>
              ))}
              {/* Revenue line */}
              <polyline points={lineRevPoints} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              {/* Expense line */}
              <polyline points={lineExpPoints} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              {/* Data dots - Revenue */}
              {months.map((_,i) => (
                <circle key={"rv"+i} cx={toLineX(i)} cy={toLineY(hasTx ? monthlyRev[i] : 0)} r="3.5" fill="#10B981" stroke={C.white} strokeWidth="1.5"/>
              ))}
              {/* Data dots - Expense */}
              {months.map((_,i) => (
                <circle key={"ex"+i} cx={toLineX(i)} cy={toLineY(hasTx ? monthlyExp[i] : 0)} r="3.5" fill="#ef4444" stroke={C.white} strokeWidth="1.5"/>
              ))}
            </svg>
            {/* Legend */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:20, marginTop:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.muted }}>
                <span style={{ display:"inline-block", width:18, height:3, borderRadius:2, background:"#10B981" }}/>Revenue
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.muted }}>
                <span style={{ display:"inline-block", width:18, height:3, borderRadius:2, background:"#ef4444" }}/>Expenses
              </div>
            </div>
          </div>

          {/* ── RIGHT: Bar Chart ── */}
          <div style={card({ padding:"18px 20px" })}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:14, color:C.text, letterSpacing:"0.04em", textTransform:"uppercase" }}>Unit Average Revenue</div>
            </div>
            <svg viewBox={`0 0 ${bSvgW} ${bSvgH}`} width="100%" style={{ display:"block" }}>
              {/* Grid lines */}
              {barYValues.map((v, i) => {
                const y = toBarY(v);
                return <g key={i}>
                  <line x1={bPadL} y1={y} x2={bSvgW - bPadR} y2={y} stroke={C.border} strokeWidth="0.7" strokeDasharray="4 3"/>
                  <text x={bPadL - 8} y={y + 4} textAnchor="end" fontSize="10" fill={C.muted} fontFamily="'Poppins',sans-serif">{barYLabels[i]}</text>
                </g>;
              })}
              {/* Baseline */}
              <line x1={bPadL} y1={bPadT + bPlotH} x2={bSvgW - bPadR} y2={bPadT + bPlotH} stroke={C.border} strokeWidth="1"/>
              {/* X-axis labels */}
              {barMonths.map((m,i) => (
                <text key={m} x={bPadL + bGroupW * i + bGroupW / 2} y={bSvgH - 10} textAnchor="middle" fontSize="10" fill={C.muted} fontFamily="'Poppins',sans-serif">{m}</text>
              ))}
              {/* Bars */}
              {barMonths.map((_,i) => {
                const cx = bPadL + bGroupW * i + bGroupW / 2;
                const revH = hasTx ? (monthlyRev[i] / barYValues[0]) * bPlotH : 0;
                const expH = hasTx ? (monthlyExp[i] / barYValues[0]) * bPlotH : 0;
                return <g key={i}>
                  <rect x={cx - barW - barGap / 2} y={bPadT + bPlotH - revH} width={barW} height={Math.max(revH, 0)} rx="3" fill="#10B981" opacity="0.85"/>
                  <rect x={cx + barGap / 2} y={bPadT + bPlotH - expH} width={barW} height={Math.max(expH, 0)} rx="3" fill="#ef4444" opacity="0.85"/>
                </g>;
              })}
            </svg>
            {/* Legend */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:20, marginTop:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.muted }}>
                <span style={{ display:"inline-block", width:12, height:12, borderRadius:3, background:"#10B981", opacity:0.85 }}/>Revenue
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.muted }}>
                <span style={{ display:"inline-block", width:12, height:12, borderRadius:3, background:"#ef4444", opacity:0.85 }}/>Expenses
              </div>
            </div>
          </div>
        </div>

        {/* WELCOME / EMPTY STATE */}
        {wallets.length===0 && (
          <div style={{ ...card({ padding:"48px 20px", marginBottom:22 }), textAlign:"center" }}>
            <div style={{ marginBottom:12 }}><HandCoins size={40} color="#94A3B8"/></div>
            <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:18, color:C.text, marginBottom:8 }}>Welcome to Receiva</div>
            <div style={{ fontSize:14, color:"#94A3B8", maxWidth:340, margin:"0 auto 20px" }}>Start by adding your first wallet — your MTN MoMo, Telecel Cash, or any account you receive payments on.</div>
          </div>
        )}

        {/* QUICK ACTIONS */}
        <div style={{ display:"flex", gap:10, marginBottom:22 }}>
          <Btn variant="primary" onClick={onAdd}><LIcon name="plus" size={15}/> Record Payment</Btn>
          {isGuest && <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:C.muted }}><LIcon name="receipt" size={14}/> {guestLeft} free receipts left</div>}
        </div>

        {/* RECENT TRANSACTIONS */}
        <div style={card()}>
          <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:15, color:C.text, marginBottom:14 }}>Recent transactions</div>
          <TxTable transactions={recent} wallets={[]} onReceipt={onReceipt} onEdit={onEdit} showWallet/>
        </div>
      </div>

      {/* ── MOBILE DASHBOARD ── */}
      <div className="mobile-only">
        {/* Mobile Header with Receiva Logo */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ReceivaLogo size={24} stroke={C.text} />
            <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:22, color:C.text }}>Receiva</div>
          </div>
          {isGuest && (
            <div style={{ background:"rgba(255,255,255,0.04)", border:"1.5px solid #2e3036", borderRadius:20, padding:"4px 12px", fontSize:11, color:"#FFFFFF", fontWeight:600 }}>
              Guest mode
            </div>
          )}
        </div>

        {!isOnline && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 shadow-sm flex items-start gap-3 transition-all duration-300 animate-pulse">
            <div className="p-1.5 bg-amber-500 text-white rounded-xl flex-shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-amber-900">You are currently offline</h2>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Receiva is saving your sales safely to local memory and will auto-sync when connection returns.
              </p>
            </div>
          </div>
        )}

        {/* Mobile Guest Mode Card */}
        {isGuest && (
          <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:"16px", marginBottom:20, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <div style={{ background:"var(--c-nav-active-bg)", borderRadius:8, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", color:C.text }}><User size={16}/></div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:C.text }}>Guest Session</div>
                <div style={{ fontSize:11, color:C.muted }}>{guestLeft} free receipts remaining</div>
              </div>
            </div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:14, lineHeight:1.5 }}>
              Your transactions are currently saved in your browser storage. Create a free account to secure them.
            </div>
            {/* Center the large green button */}
            <div style={{ textAlign:"center" }}>
              <button onClick={onAdd} style={{ width:"100%", padding:"12px", background:"#10B981", color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer", transition:"background 0.2s" }} onMouseOver={e=>e.currentTarget.style.background="#059669"} onMouseOut={e=>e.currentTarget.style.background="#10B981"}>
                Try 5 free receipts — no signup needed
              </button>
            </div>
          </div>
        )}

        {/* Crisp Cards for summary data points */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
          {statCards.map(sc=>(
            <div key={sc.label} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:14, padding:"12px 14px", boxShadow:"0 2px 6px rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:4, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.03em" }}>{sc.label}</div>
              <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:18, color:sc.color }}>{sc.value}</div>
            </div>
          ))}
        </div>

        {/* Stacked Transactions Cards */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:14, color:C.text, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.03em" }}>Recent Transactions</div>
          {recent.length === 0 ? (
            <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:"32px 16px", textAlign:"center" }}>
              <div style={{ marginBottom:10 }}><HandCoins size={32} color="#94A3B8"/></div>
              <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:4 }}>Welcome to Receiva</div>
              <div style={{ fontSize:12, color:"#94A3B8", maxWidth:240, margin:"0 auto" }}>Record your first payment to see transaction summary cards here.</div>
            </div>
          ) : (
            <TxTable transactions={recent} wallets={[]} onReceipt={onReceipt} onEdit={onEdit} showWallet/>
          )}
        </div>
      </div>

      {/* Permanent Developer Admin Bypass Mic FAB */}
      {isDevEmail(user?.email) && (
        <button
          onClick={() => {
            setVoiceModalOpen(true);
            startListening();
          }}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            color: '#FFFFFF',
            border: 'none',
            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            transition: 'transform 0.2s, background-color 0.2s',
          }}
          title="Developer Voice Dictation Terminal"
        >
          <Mic size={28} />
        </button>
      )}

      {/* Web Speech Transcription Modal */}
      {voiceModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <div
            style={{
              background: 'var(--c-white)',
              border: '1px solid var(--c-border)',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '480px',
              padding: '24px',
              color: 'var(--c-text)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <button
              onClick={() => {
                stopListening();
                setVoiceModalOpen(false);
              }}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: 'var(--c-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--c-text)' }}>
              Voice Dictation Terminal
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--c-muted)', marginBottom: '24px' }}>
              Speak naturally. The speech engine will transcribe your voice in real time.
            </p>

            {/* Pulsing Mic and Waves */}
            <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              {isListening && (
                <>
                  <div className="absolute inset-0 rounded-full bg-[#22c55e]/15 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute inset-2 rounded-full bg-[#22c55e]/25 animate-ping" style={{ animationDuration: '1.5s' }} />
                </>
              )}
              <button
                onClick={isListening ? stopListening : startListening}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: isListening ? '#EF4444' : '#22c55e',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                  boxShadow: isListening ? '0 0 20px rgba(239, 68, 68, 0.4)' : '0 0 20px rgba(34, 197, 94, 0.4)',
                  transition: 'all 0.3s',
                }}
              >
                {isListening ? <MicOff size={36} /> : <Mic size={36} />}
              </button>
            </div>

            <div style={{ fontSize: '14px', fontWeight: 600, color: isListening ? '#22c55e' : '#EF4444', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isListening ? "Listening..." : "Paused"}
            </div>

            {voiceError && (
              <div style={{ color: '#EF4444', fontSize: '12px', background: 'rgba(239, 68, 68, 0.15)', padding: '10px 14px', borderRadius: '8px', width: '100%', marginBottom: '16px' }}>
                {voiceError}
              </div>
            )}

            {/* Live transcription display */}
            <div
              style={{
                width: '100%',
                background: 'var(--c-light)',
                border: '1px solid var(--c-border)',
                borderRadius: '8px',
                padding: '16px',
                minHeight: '120px',
                maxHeight: '180px',
                overflowY: 'auto',
                textAlign: 'left',
                fontSize: '14px',
                lineHeight: '1.6',
                color: 'var(--c-text)',
                marginBottom: '20px',
              }}
            >
              {transcript || interimTranscript ? (
                <>
                  <span style={{ color: 'var(--c-text)' }}>{transcript}</span>
                  <span style={{ color: 'var(--c-muted)', fontStyle: 'italic' }}>{interimTranscript}</span>
                </>
              ) : (
                <span style={{ color: 'var(--c-muted)', fontStyle: 'italic' }}>Waiting for speech...</span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                onClick={() => {
                  setTranscript("");
                  setInterimTranscript("");
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--c-light)',
                  border: '1px solid var(--c-border)',
                  color: 'var(--c-text)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
              <button
                onClick={() => {
                  stopListening();
                  setVoiceModalOpen(false);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#22c55e',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── WALLETS PAGE ─────────────────────────────────────────────
function Wallets({ wallets, transactions, onAdd, onSelect, activeWallet }) {
  return (
    <div>
      <div className="wallets-header-container" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:20 }}>
        <div className="desc" style={{ fontSize:14, color:C.muted }}>Manage all your MoMo accounts and wallets in one place</div>
        <Btn variant="primary" style={{ flexShrink:0 }} onClick={onAdd}><LIcon name="plus" size={15}/> Add wallet</Btn>
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
              <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:600, fontSize:26, color:preset.color, marginBottom:12 }}>{fmt(wBal)}</div>
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1, textAlign:"center", padding:"8px", background:C.light, borderRadius:8 }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>Income</div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.income }}>{fmt(wInc)}</div>
                </div>
                <div style={{ flex:1, textAlign:"center", padding:"8px", background:C.light, borderRadius:8 }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>Expense</div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.expense }}>{fmt(wExp)}</div>
                </div>
                <div style={{ flex:1, textAlign:"center", padding:"8px", background:C.light, borderRadius:8 }}>
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
function TxTable({ transactions, wallets, onReceipt, onEdit, showWallet=false }) {
  if (!transactions.length) return <div style={{ textAlign:"center", padding:"32px", color:C.muted, fontSize:14 }}>No transactions yet</div>;
  return (
    <div>
      {/* DESKTOP TABLE */}
      <div className="desktop-only">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 90px 110px 120px", padding:"8px 14px", fontSize:11, color:C.muted, letterSpacing:"0.05em", textTransform:"uppercase", borderBottom:`1px solid ${C.border}` }}>
          <span>Description</span><span>Category</span><span>Method</span><span>Amount</span><span>Actions</span>
        </div>
        {transactions.map(tx=>{
          const wallet = wallets.find ? wallets.find(w=>w.id===tx.walletId) : null;
          const preset = wallet ? WALLET_PRESETS.find(p=>p.id===wallet?.presetId) : null;
          return (
            <div key={tx.id} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 90px 110px 120px", padding:"11px 14px", borderBottom:`1px solid ${C.border}`, alignItems:"center", fontSize:13 }}>
              <div>
                <div style={{ color:C.text, fontWeight:500 }}>{tx.description}</div>
                <div style={{ color:C.muted, fontSize:11, marginTop:1 }}>{tx.date}</div>
              </div>
              <div><Badge color={tx.type==="income" ? C.income : C.expense}>{tx.category}</Badge></div>
              <div style={{ fontSize:12, color:C.muted }}>{tx.method}</div>
              <div style={{ fontWeight:700, color: tx.type==="income" ? C.income : C.expense }}>
                {tx.type==="income" ? "+" : "-"}{fmt(tx.amount)}
              </div>
              <div style={{ display:"flex", gap:4 }}>
                {onEdit && <Btn variant="ghost" size="sm" onClick={()=>onEdit(tx)} style={{ fontSize:11, padding:"5px 8px" }}><LIcon name="edit" size={12}/> Edit</Btn>}
                {tx.type==="income" && <Btn variant="ghost" size="sm" onClick={()=>onReceipt(tx)} style={{ fontSize:11, padding:"5px 8px" }}><LIcon name="eye" size={12}/></Btn>}
              </div>
            </div>
          );
        })}
      </div>

      {/* MOBILE STACKED CARDS */}
      <div className="mobile-only">
        {transactions.map(tx=>{
          const isIncome = tx.type === "income";
          const amountColor = isIncome ? C.income : C.expense;
          const IconComp = isIncome ? TrendingUp : TrendingDown;
          return (
            <div key={tx.id} style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:10, border:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", boxShadow:"0 2px 6px rgba(0,0,0,0.02)" }} onClick={() => onEdit && onEdit(tx)}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{tx.description}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{tx.date} • {tx.category} • {tx.method}</div>
              </div>
              <div style={{ textAlign:"right", display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:14, fontWeight:700, color:amountColor }}>
                  {isIncome ? "+" : "-"}{fmt(tx.amount)}
                </span>
                <IconComp size={15} color={amountColor}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TRANSACTIONS PAGE ────────────────────────────────────────
function Transactions({ transactions, wallets, onAdd, onReceipt, onEdit }) {
  const [filter, setFilter] = useState("all");
  const shown = filter==="all" ? transactions : transactions.filter(t=>t.type===filter);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:8 }}>
          {["all","income","expense"].map(f=>(
            <button key={f} style={{ padding:"7px 16px", borderRadius:20, border:`1.5px solid ${filter===f ? C.orange : C.border}`, background: filter===f ? C.orange+"12" : C.white, color: filter===f ? C.orange : C.muted, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Poppins',sans-serif" }} onClick={()=>setFilter(f)}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
        <div className="desktop-only">
          <Btn variant="primary" onClick={onAdd}><LIcon name="plus" size={15}/> Record Payment</Btn>
        </div>
        <div className="mobile-only" style={{ width:"100%" }}>
          <Btn variant="primary" full onClick={onAdd}><LIcon name="plus" size={15}/> Record Payment</Btn>
        </div>
      </div>
      <div style={card({ padding:0, overflow:"hidden" })}>
        <TxTable transactions={shown} wallets={wallets} onReceipt={onReceipt} onEdit={onEdit} showWallet/>
      </div>
    </div>
  );
}

// ─── RECEIPTS PAGE ────────────────────────────────────────────
function Receipts({ transactions, wallets, business, onReceipt, isPro, isGuest, guestLeft, voidedReceipts, deletedTransactions }) {
  const income = transactions.filter(t=>t.type==="income");
  const voidedIncome = (deletedTransactions||[]).filter(t=>t.type==="income");
  const allReceipts = [...income, ...voidedIncome];
  return (
    <div>
      {isGuest && (
        <div style={{ background:C.orange+"12", border:`1.5px solid ${C.orange}33`, borderRadius:12, padding:"14px 18px", marginBottom:18, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:14, color:C.text }}><strong style={{ color:C.orange }}>{guestLeft} free receipt{guestLeft!==1?"s":""}</strong> remaining. Sign up for 60/month free.</div>
          <Btn variant="primary" size="sm" onClick={()=>{}}>Sign up free</Btn>
        </div>
      )}
      {isPro && (
        <div style={{ background:"#fff4ed", border:`1px solid ${C.orange}33`, borderRadius:12, padding:"12px 16px", marginBottom:18, fontSize:13, color:C.muted }}>
          <strong style={{ color:C.orange }}>Pro:</strong> Receipts are auto-branded with your logo colors.
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
        {allReceipts.map(tx=>{
          const isVoid = voidedReceipts && voidedReceipts.has(tx.receiptNo);
          return (
          <div key={tx.id} style={{ ...card({ cursor:"pointer" }), position:"relative", overflow:"hidden", opacity:isVoid?0.75:1 }} onClick={()=>onReceipt(tx)}>
            {isVoid && <div style={{ position:"absolute", top:12, right:-28, background:"#ef4444", color:"#fff", fontSize:10, fontWeight:700, padding:"2px 32px", transform:"rotate(35deg)", letterSpacing:1, zIndex:1 }}>VOID</div>}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <Badge color={isVoid?"#ef4444":C.teal}>{isVoid?"Voided":"Receipt"}</Badge>
              <span style={{ fontSize:11, color:C.muted }}>{tx.date}</span>
            </div>
            <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:600, fontSize:22, color:isVoid?"#9ca3af":C.income, marginBottom:4, textDecoration:isVoid?"line-through":"none" }}>{fmt(tx.amount)}</div>
            <div style={{ fontSize:13, color:isVoid?"#9ca3af":C.text, marginBottom:8 }}>{tx.description}</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:11, color:C.muted, fontFamily:"monospace" }}>{tx.receiptNo}</span>
              {isVoid ? <Badge color="#ef4444">Deleted</Badge> : <Btn variant="outline" size="sm"><LIcon name="receipt" size={12}/> Generate</Btn>}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── REPORTS PAGE ─────────────────────────────────────────────
function Reports({ transactions, income, expense, balance, isPro, onUpgrade, business, setBusiness, isGuest, businessId }) {
  const byCat = transactions.reduce((a,t)=>{ if(!a[t.category])a[t.category]={i:0,e:0}; a[t.category][t.type==="income"?"i":"e"]+=t.amount; return a; },{});
  const maxCat = Math.max(1,...Object.values(byCat).map(c=>c.i+c.e));

  const handleSelectPlan = async (selectedPlan) => {
    if (isGuest) {
      setBusiness(b => ({ ...b, plan: selectedPlan }));
      alert(`Plan updated to ${selectedPlan.toUpperCase()} locally in guest mode!`);
      return;
    }
    try {
      const { error } = await supabase
        .from("businesses")
        .update({ plan: selectedPlan })
        .eq("id", businessId);
      if (error) throw error;
      setBusiness(b => ({ ...b, plan: selectedPlan }));
      alert(`Successfully upgraded to the ${selectedPlan.toUpperCase()} plan!`);
    } catch (err) {
      console.error(err);
      alert("Failed to update plan. Check your internet connection.");
    }
  };

  return (
    <div>
      <div className="dash-stats-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[[fmt(income),"Income",C.income],[fmt(expense),"Expenses",C.expense],[fmt(balance),"Net profit",balance>=0?"#2563eb":C.expense],[income>0?Math.round((balance/income)*100)+"%":"0%","Margin",C.orange]].map(([v,l,c])=>(
          <div key={l} style={card({ padding:"16px 18px" })}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:5 }}>{l}</div>
            <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:600, fontSize:22, color:c }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="dash-charts-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <div style={card()}>
          <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:15, color:C.text, marginBottom:14 }}>By category</div>
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
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={card()}>
            <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:15, color:C.text, marginBottom:14 }}>PDF Export & Tax Report</div>
            {isPro ? (
              <div style={{ fontSize:14, color:C.muted, display:"flex", alignItems:"center", gap:6 }}><Check size={14} color="#16a34a"/> Your monthly PDF report is ready to download.</div>
            ) : (
              <div style={{ background:"rgba(16, 185, 129, 0.08)", border:"1px solid rgba(16, 185, 129, 0.20)", borderRadius:10, padding:"16px" }}>
                <div style={{ fontSize:14, color:C.text, marginBottom:6, display:"flex", alignItems:"center", gap:6 }}><LIcon name="lock" size={14}/> Pro feature</div>
                <div style={{ fontSize:13, color:C.muted }}>PDF export, GRA-ready tax breakdown, and advanced payroll tracking.</div>
              </div>
            )}
          </div>
          <PlanSlider currentPlan={business.plan} onSelectPlan={handleSelectPlan}/>
        </div>
      </div>
    </div>
  );
}

// ─── ADD TRANSACTION MODAL ────────────────────────────────────
// ─── RECORD PAYMENT MODAL ────────────────────────────────────
function RecordPaymentModal({ onClose, onSave, wallets, business }) {
  const [mode, setMode]   = useState(null); // null=choose, "manual", "paste"
  const [step, setStep]   = useState(1);

  // Manual form state
  const [form, setForm]   = useState({ type:"income", amount:"", category:"", description:"", walletId:wallets[0]?.id||"", date:today(), momoRef:"" });
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));
  const validManual = form.amount && form.category && form.description && form.walletId;

  // Paste state
  const [raw, setRaw]         = useState("");
  const [items, setItems]     = useState([]);
  const [walletId, setWalletId] = useState(wallets[0]?.id||"");
  const [saving, setSaving]   = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const MTN_SAMPLE = `Payment received for GHS 9.00 from JEDIDIAH OFORI OPARE Current Balance: GHS 9.09. Reference: JEDIDIAH OFORI OPARE ,233205597508,5 from VODAFONE. Transaction ID: 80993550724. TRANSACTION FEE: 0.00`;
  const TEL_SAMPLE = `telecel0000012482388464 Confirmed. GHS12.00 sent to 0592040012 JEDIDIAH OFORI OPARE on MTN MOBILE MONEY on 2026-03-24 at 17:48:34. Your Telecel Cash balance is GHS0.35. You were charged GHS0.00. E-levy: GHS0.00. Reference: B. Sendi`;

  const handleParse = () => {
    const chunks = splitMoMoMessages(raw);
    if (!chunks.length) { alert("No MoMo messages detected. Make sure you paste actual MoMo SMS text."); return; }
    setItems(chunks.map(chunk => ({ _id:genId(), _raw:chunk, _included:true, ...parseGhanaMoMo(chunk) })));
    setStep(2);
  };

  const updateItem  = (id,k,v) => setItems(p=>p.map(it=>it._id===id?{...it,[k]:v}:it));
  const toggleItem  = (id)     => setItems(p=>p.map(it=>it._id===id?{...it,_included:!it._included}:it));
  const included    = items.filter(it=>it._included);
  const totalAmt    = included.reduce((s,it)=>s+(parseFloat(it.amount)||0),0);
  const missingDesc = included.filter(it=>!it.description).length;

  const handleSaveAll = () => {
    setSaving(true);
    included.forEach(it => {
      if (!it.amount) return;
      onSave({ type:"income", amount:parseFloat(it.amount), category:it.category||"Sales", description:it.description||`Payment from ${it.sender||"customer"}`, method:it.network+" MoMo", date:it.date, momoRef:it.txId, walletId });
    });
    setSavedCount(included.length);
    setStep(3);
    setSaving(false);
  };

  const modeBtn = (id, icon, title, sub) => (
    <div onClick={()=>{ setMode(id); setStep(1); }} style={{ flex:1, border:`1.5px solid ${mode===id?C.orange:C.border}`, background:mode===id?C.orange+"08":C.light, borderRadius:14, padding:"20px 14px", cursor:"pointer", textAlign:"center", transition:"all 0.15s" }}>
      <div style={{ fontSize:28, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:3 }}>{title}</div>
      <div style={{ fontSize:12, color:C.muted, lineHeight:1.5 }}>{sub}</div>
    </div>
  );

  return (
    <Modal onClose={onClose} maxWidth={580}>
      <ModalHeader title="Record Payment" onClose={onClose}/>

      {/* MODE CHOOSER */}
      {!mode && (
        <>
          <div style={{ fontSize:14, color:C.muted, marginBottom:20 }}>How would you like to record this payment?</div>
          <div style={{ display:"flex", gap:12, marginBottom:8 }}>
            {modeBtn("manual",<Pencil size={28} strokeWidth={1.5}/>,"Enter manually","Type in the amount, category and details yourself")}
            {modeBtn("paste",<Clipboard size={28} strokeWidth={1.5}/>,"Paste MoMo SMS","Paste one or many MTN / Telecel messages")}
          </div>
        </>
      )}

      {/* ── MANUAL MODE ── */}
      {mode==="manual" && (
        <>
          <div style={{ display:"flex", gap:8, marginBottom:18 }}>
            {["income","expense"].map(t=>(
              <button key={t} style={{ flex:1, padding:"10px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"'Poppins',sans-serif", fontSize:14, fontWeight:500, background:form.type===t?(t==="income"?C.income+"18":C.expense+"15"):"#f3f4f6", color:form.type===t?(t==="income"?C.income:C.expense):C.muted }} onClick={()=>setF("type",t)}>
                {t==="income"?<><HandCoins size={14} style={{marginRight:4}}/> Income</>:<><Upload size={14} style={{marginRight:4}}/> Expense</>}
              </button>
            ))}
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={label}>Wallet</label>
            <select style={input} value={form.walletId} onChange={e=>setF("walletId",e.target.value)}>
              {wallets.map(w=><option key={w.id} value={w.id}>{WALLET_PRESETS.find(p=>p.id===w.presetId)?.label} — {w.name}</option>)}
            </select>
          </div>
          <div style={formRow}>
            <div><label style={label}>Amount (GH₵)</label><input style={input} type="number" placeholder="0.00" value={form.amount} onChange={e=>setF("amount",e.target.value)}/></div>
            <div><label style={label}>Date</label><input style={input} type="date" value={form.date} onChange={e=>setF("date",e.target.value)}/></div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={label}>Category</label>
            <select style={input} value={form.category} onChange={e=>setF("category",e.target.value)}>
              <option value="">Select category</option>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:12 }}><label style={label}>Description</label><input style={input} placeholder="e.g. iPhone cases x3" value={form.description} onChange={e=>setF("description",e.target.value)}/></div>
          <div style={{ marginBottom:16 }}><label style={label}>MoMo reference (optional)</label><input style={input} placeholder="e.g. 80993550724" value={form.momoRef} onChange={e=>setF("momoRef",e.target.value)}/></div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn variant="ghost" onClick={()=>setMode(null)}>← Back</Btn>
            <Btn variant="primary" full disabled={!validManual} onClick={()=>validManual&&onSave({...form,amount:parseFloat(form.amount),method:wallets.find(w=>w.id===form.walletId)?.name||"MoMo"})}>
              <LIcon name="check" size={15}/> Save payment
            </Btn>
          </div>
        </>
      )}

      {/* ── PASTE MODE — STEP 1: input ── */}
      {mode==="paste" && step===1 && (
        <>
          <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>Paste one or many MTN · Telecel · Vodafone messages — all at once is fine.</div>
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <button style={{ padding:"6px 12px", borderRadius:8, border:"1px solid rgba(255,204,0,0.4)", background:"rgba(255,204,0,0.08)", color:"#b45309", fontSize:12, cursor:"pointer", fontFamily:"'Poppins',sans-serif" }} onClick={()=>setRaw(MTN_SAMPLE)}>MTN sample</button>
            <button style={{ padding:"6px 12px", borderRadius:8, border:"1px solid rgba(227,6,19,0.2)", background:"rgba(227,6,19,0.06)", color:"#b91c1c", fontSize:12, cursor:"pointer", fontFamily:"'Poppins',sans-serif" }} onClick={()=>setRaw(TEL_SAMPLE)}>Telecel sample</button>
            <button style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:12, cursor:"pointer", fontFamily:"'Poppins',sans-serif" }} onClick={()=>setRaw("")}>Clear</button>
          </div>
          <textarea style={{ ...input, minHeight:130, resize:"vertical", fontFamily:"monospace", fontSize:12, lineHeight:1.8, marginBottom:12 }} value={raw} onChange={e=>setRaw(e.target.value)} placeholder={"Paste your MoMo messages here — one or many...\n\nPayment received for GHS 9.00 from JOHN...\n\ntelecel000... Confirmed. GHS12.00 sent to..."}/>
          <div style={{ marginBottom:16 }}>
            <label style={label}>Which wallet received these payments?</label>
            <select style={input} value={walletId} onChange={e=>setWalletId(e.target.value)}>
              {wallets.map(w=><option key={w.id} value={w.id}>{WALLET_PRESETS.find(p=>p.id===w.presetId)?.label} — {w.name}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn variant="ghost" onClick={()=>setMode(null)}>← Back</Btn>
            <Btn variant="primary" full disabled={!raw.trim()} onClick={handleParse}><LIcon name="receipt" size={15}/> Parse messages</Btn>
          </div>
        </>
      )}

      {/* ── PASTE MODE — STEP 2: review ── */}
      {mode==="paste" && step===2 && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
            {[[items.length,"Found",C.text],[fmt(totalAmt),"Total",C.income],[missingDesc,"Need desc",missingDesc>0?C.orange:"#16a34a"]].map(([v,l,c])=>(
              <div key={l} style={{ background:C.light, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>{l}</div>
                <div style={{ fontWeight:700, fontSize:18, color:c }}>{v}</div>
              </div>
            ))}
          </div>
          {missingDesc>0 && <div style={{ background:"#fff7ed", border:`1px solid ${C.orange}33`, borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:13, color:C.orange, display:"flex", alignItems:"center", gap:6 }}><AlertTriangle size={14}/> Add descriptions to highlighted items before saving.</div>}
          <div style={{ maxHeight:380, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
            {items.map((it,idx)=><BulkTxCard key={it._id} item={it} index={idx} onChange={(k,v)=>updateItem(it._id,k,v)} onToggle={()=>toggleItem(it._id)}/>)}
          </div>
          <div style={{ display:"flex", gap:10, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
            <Btn variant="ghost" onClick={()=>setStep(1)}>← Back</Btn>
            <Btn variant="primary" full disabled={saving||included.length===0} onClick={handleSaveAll}>
              <LIcon name="check" size={15}/> Save {included.length} payment{included.length!==1?"s":""} ({fmt(totalAmt)})
            </Btn>
          </div>
        </>
      )}

      {/* ── PASTE MODE — STEP 3: done ── */}
      {mode==="paste" && step===3 && (
        <div style={{ textAlign:"center", padding:"32px 20px" }}>
          <div style={{ marginBottom:14 }}><PartyPopper size={48} color={C.orange} strokeWidth={1.5}/></div>
          <div style={{ fontWeight:700, fontSize:20, color:C.text, marginBottom:8 }}>{savedCount} payment{savedCount!==1?"s":""} saved!</div>
          <div style={{ fontSize:14, color:C.muted, marginBottom:24 }}>{fmt(totalAmt)} recorded to your {wallets.find(w=>w.id===walletId)?.name} wallet.</div>
          <Btn variant="primary" onClick={onClose}>Done →</Btn>
        </div>
      )}
    </Modal>
  );
}

// ─── RECEIPT MODAL ────────────────────────────────────────────
function ReceiptModal({ tx, business, isPro, onClose, isVoided }) {
  const rNo = useRef(genRNo()).current;
  const accentColor = isPro ? (business.logoColor||"#1B4332") : "#1B4332";
  const accentBg    = isPro ? (business.logoBg||"rgba(27, 67, 50, 0.08)")   : "rgba(27, 67, 50, 0.08)";
  const waText = `Receipt from ${business.name}\n--------------------------\nReceipt No: ${tx.receiptNo||rNo}\nDate: ${tx.date}\nDescription: ${tx.description}\nAmount: GH₵ ${tx.amount}\nPayment: ${tx.method}${tx.momoRef?`\nMoMo Ref: ${tx.momoRef}`:""}\n--------------------------\nPowered by Receiva`;
  return (
    <Modal onClose={onClose} maxWidth={460}>
      <ModalHeader title="Receipt" onClose={onClose}/>
      {isPro && <div style={{ background:"rgba(16, 185, 129, 0.1)", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:12, color:"#10B981", fontWeight:500, display:"flex", alignItems:"center", gap:6 }}><Star size={14} fill="#10B981"/> Pro — branded with your logo colors</div>}
      {/* RECEIPT CARD */}
      <div style={{ background:"#FDFBF7", border:`1px solid ${isVoided?"#fca5a5":"#E2E8F0"}`, borderRadius:14, padding:"26px 28px", marginBottom:16, position:"relative", overflow:"hidden" }}>
        {isVoided && <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%) rotate(-30deg)", fontSize:48, fontWeight:900, color:"rgba(239,68,68,0.18)", letterSpacing:8, textTransform:"uppercase", whiteSpace:"nowrap", pointerEvents:"none", zIndex:1, fontFamily:"'Poppins',sans-serif" }}>VOIDED</div>}
        <div style={{ borderBottom:`2px solid ${accentColor}`, paddingBottom:14, marginBottom:16 }}>
          <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:600, fontSize:20, color:accentColor }}>{business.name}</div>
          {isPro && <div style={{ fontSize:11, color:"#64748B", marginTop:2, fontStyle:"italic" }}>Official Receipt · Pro</div>}
          {!isPro && <div style={{ fontSize:11, color:"#64748B", marginTop:2 }}>Official Receipt</div>}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:18, fontSize:12, color:"#64748B" }}>
          <div><strong style={{ color:"#121214" }}>No:</strong> {tx.receiptNo||rNo}</div>
          <div><strong style={{ color:"#121214" }}>Date:</strong> {tx.date}</div>
        </div>
        <div style={{ background:accentBg, borderRadius:8, padding:"12px 14px", marginBottom:16 }}>
          <div style={{ fontWeight:500, color:"#121214", marginBottom:3 }}>{tx.description}</div>
          <div style={{ fontSize:12, color:"#64748B" }}>{tx.category} · {tx.method}</div>
          {tx.momoRef && <div style={{ fontSize:11, color:accentColor, marginTop:4, fontFamily:"monospace" }}>Ref: {tx.momoRef}</div>}
        </div>
        <div style={{ borderTop:"1px solid #E2E8F0", paddingTop:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ color:"#64748B", fontSize:14 }}>Total paid</span>
          <span style={{ fontFamily:"'Poppins',sans-serif", fontWeight:600, fontSize:24, color:accentColor }}>{fmt(tx.amount)}</span>
        </div>
        <div style={{ marginTop:16, textAlign:"center", fontSize:10, color:"#9ca3af", borderTop:"1px solid #E2E8F0", paddingTop:10 }}>
          {localStorage.getItem("settings_receipt_msg") || "Thank you for your business!"}
          {localStorage.getItem("settings_powered_by") !== "false" && ` · Powered by Receiva${isPro ? " Pro" : ""}`}
        </div>
      </div>
      {isVoided && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:13, color:"#b91c1c", textAlign:"center", fontWeight:500, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><AlertTriangle size={14}/> This transaction has been deleted — receipt is voided</div>}
      <div style={{ display:"flex", gap:10, opacity:isVoided?0.5:1, pointerEvents:isVoided?"none":"auto" }}>
        <Btn variant="wa" href={`https://wa.me/?text=${encodeURIComponent(waText)}`} style={{ flex:1 }}>
          <LIcon name="share" size={14}/> WhatsApp
        </Btn>
        <Btn variant={isPro?"primary":"ghost"} style={{ flex:1 }} onClick={()=>!isPro&&alert("PDF export is a Pro feature. Upgrade to download receipts as PDF.")}>
          <LIcon name="share" size={14}/> {isPro?"Download PDF":"PDF (Pro)"}
        </Btn>
      </div>
    </Modal>
  );
}

// ─── EDIT TRANSACTION MODAL ──────────────────────────────────────────
function EditTransactionModal({ tx, onClose, onSave, onDelete, wallets }) {
  const [form, setForm] = useState({ type:tx.type, amount:String(tx.amount), category:tx.category, description:tx.description, walletId:tx.walletId, date:tx.date, momoRef:tx.momoRef||"" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));
  const valid = form.amount && form.category && form.description && form.walletId;

  const handleSave = () => { if(!valid) return; onSave({ ...tx, type:form.type, amount:parseFloat(form.amount), category:form.category, description:form.description, walletId:form.walletId, date:form.date, momoRef:form.momoRef, method:wallets.find(w=>w.id===form.walletId)?.name||"MoMo" }); };
  const handleDelete = () => { setDeleting(true); onDelete(tx); };

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <ModalHeader title="Edit Transaction" onClose={onClose}/>

      {/* Type toggle */}
      <div style={{ display:"flex", gap:8, marginBottom:18 }}>
        {["income","expense"].map(t=>(
          <button key={t} style={{ flex:1, padding:"10px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"'Poppins',sans-serif", fontSize:14, fontWeight:500, background:form.type===t?(t==="income"?C.income+"18":C.expense+"15"):"#f3f4f6", color:form.type===t?(t==="income"?C.income:C.expense):C.muted }} onClick={()=>setF("type",t)}>
            {t==="income"?<><HandCoins size={14} style={{marginRight:4}}/> Income</>:<><Upload size={14} style={{marginRight:4}}/> Expense</>}
          </button>
        ))}
      </div>

      {/* Wallet */}
      <div style={{ marginBottom:12 }}>
        <label style={label}>Wallet</label>
        <select style={input} value={form.walletId} onChange={e=>setF("walletId",e.target.value)}>
          {wallets.map(w=><option key={w.id} value={w.id}>{WALLET_PRESETS.find(p=>p.id===w.presetId)?.label} — {w.name}</option>)}
        </select>
      </div>

      {/* Amount + Date */}
      <div style={formRow}>
        <div><label style={label}>Amount (GH₵)</label><input style={input} type="number" placeholder="0.00" value={form.amount} onChange={e=>setF("amount",e.target.value)}/></div>
        <div><label style={label}>Date</label><input style={input} type="date" value={form.date} onChange={e=>setF("date",e.target.value)}/></div>
      </div>

      {/* Category */}
      <div style={{ marginBottom:12 }}>
        <label style={label}>Category</label>
        <select style={input} value={form.category} onChange={e=>setF("category",e.target.value)}>
          <option value="">Select category</option>
          {CATEGORIES.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Description */}
      <div style={{ marginBottom:12 }}><label style={label}>Description</label><input style={input} placeholder="e.g. iPhone cases x3" value={form.description} onChange={e=>setF("description",e.target.value)}/></div>

      {/* MoMo ref */}
      <div style={{ marginBottom:16 }}><label style={label}>MoMo reference (optional)</label><input style={input} placeholder="e.g. 80993550724" value={form.momoRef} onChange={e=>setF("momoRef",e.target.value)}/></div>

      {/* Save button */}
      <div style={{ display:"flex", gap:10, marginBottom:20 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" full disabled={!valid} onClick={handleSave}>
          <LIcon name="check" size={15}/> Save changes
        </Btn>
      </div>

      {/* ─── Danger zone — delete ─── */}
      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
        {!confirmDelete ? (
          <button onClick={()=>setConfirmDelete(true)} style={{ display:"flex", alignItems:"center", gap:6, background:"transparent", border:"1px solid #fca5a5", borderRadius:8, padding:"8px 14px", color:"#ef4444", fontSize:13, cursor:"pointer", fontFamily:"'Poppins',sans-serif", fontWeight:500, width:"100%", justifyContent:"center", transition:"all 0.15s" }}>
            <LIcon name="trash" size={13}/> Delete this transaction
          </button>
        ) : (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"14px 16px" }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#b91c1c", marginBottom:6 }}>Are you sure?</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:12 }}>This transaction will be permanently deleted. If a receipt was generated, it will be marked as voided.</div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn variant="ghost" onClick={()=>setConfirmDelete(false)} style={{ flex:1 }}>Cancel</Btn>
              <button onClick={handleDelete} disabled={deleting} style={{ flex:1, padding:"9px 16px", background:"#ef4444", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor:deleting?"not-allowed":"pointer", fontFamily:"'Poppins',sans-serif", opacity:deleting?0.6:1 }}>
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        )}
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
              <div style={{ marginBottom:3 }}><WalletIcon presetId={p.id} size={20} color={presetId===p.id ? p.color : undefined}/></div>
              <div style={{ fontSize:11, fontWeight:500, color: presetId===p.id ? p.color : C.muted }}>{p.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom:12 }}><label style={label}>Wallet name (optional)</label><input style={input} placeholder={preset?.label} value={name} onChange={e=>setName(e.target.value)}/></div>
      <div style={{ marginBottom:18 }}><label style={label}>Phone / account number</label><input style={input} placeholder="e.g. 0592040012" value={number} onChange={e=>setNumber(e.target.value)}/></div>
      <Btn variant="primary" full onClick={()=>onSave({ presetId, name:name||preset?.label, number })}>
        <LIcon name="check" size={15}/> Add wallet
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

// ─── UPGRADE MODAL ────────────────────────────────────────────
function UpgradeModal({ onClose }) {
  return (
    <Modal onClose={onClose} maxWidth={440}>
      <ModalHeader title="Upgrade to Pro" onClose={onClose}/>
      <div style={{ textAlign:"center", marginBottom:20 }}>
        <div style={{ marginBottom:8 }}><Star size={36} color={C.orange} fill={C.orange} strokeWidth={1.5}/></div>
        <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:600, fontSize:28, color:C.orange }}>GH₵ 23 / month</div>
        <div style={{ fontSize:14, color:C.muted, marginTop:4 }}>Everything you need to run a professional business</div>
      </div>
      {[["Logo-branded receipts","Your company colors on every receipt"],["Unlimited transactions","No monthly cap, ever"],["PDF export","Download receipts and reports"],["Multi-wallet","MTN, Telecel, company account — all in one"],["Tax-ready reports","GRA-friendly monthly summaries"],["Priority support","WhatsApp support within 2 hours"]].map(([t,d])=>(
        <div key={t} style={{ display:"flex", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}`, alignItems:"flex-start" }}>
          <Check size={14} color={C.orange} strokeWidth={2.5} style={{marginTop:1, flexShrink:0}}/>
          <div><div style={{ fontSize:14, fontWeight:500, color:C.text }}>{t}</div><div style={{ fontSize:12, color:C.muted }}>{d}</div></div>
        </div>
      ))}
      <Btn variant="primary" full style={{ marginTop:20 }} onClick={()=>alert("Payment coming soon! Contact us on WhatsApp: 0592040012")}>
        Upgrade now — GH₵ 23/mo
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
          <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:20, color:C.text }}>Products</div>
          <div style={{ fontSize:13, color:C.muted }}>{products.length} products · {products.filter(p=>p.type==="service").length} services</div>
        </div>
        <Btn variant="primary" onClick={onAdd}><LIcon name="plus" size={15}/> Add product</Btn>
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
      <div className="dash-stats-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          ["Total products", products.filter(p=>p.type==="product").length, C.teal],
          ["Services",       products.filter(p=>p.type==="service").length, C.orange],
          ["Low stock",      products.filter(p=>p.trackStock&&p.stock<10).length, "#ef4444"],
          ["Avg margin",     products.filter(p=>p.costPrice>0).length > 0 ? Math.round(products.filter(p=>p.costPrice>0).reduce((s,p)=>s+(((p.sellPrice-p.costPrice)/p.sellPrice)*100),0)/products.filter(p=>p.costPrice>0).length)+"%":"N/A", "#2563eb"],
        ].map(([l,v,c])=>(
          <div key={l} style={card({ padding:"14px 16px" })}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>{l}</div>
            <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:600, fontSize:22, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={card({ padding:0, overflow:"hidden" })}>
        {/* DESKTOP TABLE */}
        <div className="desktop-only">
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
              <div key={p.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 80px", padding:"12px 16px", borderBottom:`1px solid ${C.border}`, alignItems:"center", fontSize:13 }}>
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

        {/* MOBILE STACKED CARDS */}
        <div className="mobile-only" style={{ padding: "12px 16px" }}>
          {filtered.length === 0 && (
            <div style={{ textAlign:"center", padding:"40px", color:C.muted, fontSize:14 }}>No products found</div>
          )}
          {filtered.map(p => {
            const cat = categories.find(c=>c.id===p.categoryId);
            const mg  = margin(p);
            return (
              <div key={p.id} style={{ background:C.white, border:`1.5px solid ${C.border}`, borderRadius:14, padding:"14px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center", boxShadow:"0 2px 6px rgba(0,0,0,0.01)" }}>
                <div>
                  <div style={{ fontWeight:600, color:C.text, fontSize:14 }}>{p.name}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>SKU: {p.sku} · <span style={{ color: p.type==="service"?C.orange:C.teal, fontWeight:500 }}>{p.type==="service"?"Service":"Product"}</span></div>
                  {cat && (
                    <div style={{ marginTop:6 }}>
                      <span style={{ background:cat.color+"14", color:cat.color, padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:500 }}>{cat.name}</span>
                    </div>
                  )}
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:700, color:C.income, fontSize:14 }}>{fmt(p.sellPrice)}</div>
                  {p.costPrice > 0 && <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Cost: {fmt(p.costPrice)}</div>}
                  {p.trackStock ? (
                    <div style={{ fontSize:11, fontWeight:600, color: p.stock < 10 ? "#ef4444" : "#16a34a", marginTop:2 }}>{p.stock} units</div>
                  ) : (
                    <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Service</div>
                  )}
                  <div style={{ marginTop:8 }}>
                    <Btn variant="ghost" size="sm" onClick={()=>onEdit(p)} style={{ fontSize:11, padding:"4px 10px" }}>Edit</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
        <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:20, color:C.text }}>{isEdit?"Edit product":"Add new product"}</div>
      </div>

      <div style={card()}>
        {/* Type toggle */}
        <div style={{ marginBottom:18 }}>
          <label style={label}>Product type</label>
          <div style={{ display:"flex", gap:8 }}>
            {["product","service"].map(t=>(
              <button key={t} style={{ flex:1, padding:"10px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"'Poppins',sans-serif", fontSize:13, fontWeight:500, background: form.type===t ? C.orange+"18":C.light, color: form.type===t ? C.orange : C.muted, border:`1.5px solid ${form.type===t?C.orange+"44":C.border}` }} onClick={()=>{ set("type",t); if(t==="service") set("trackStock",false); else set("trackStock",true); }}>
                {t==="product" ? <><Package size={14} style={{marginRight:4}}/> Physical product</> : <><Cog size={14} style={{marginRight:4}}/> Service</>}
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
              <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:16, color: margin>30?"#16a34a":margin>10?C.orange:"#ef4444" }}>{fmt(parseFloat(form.sellPrice)-parseFloat(form.costPrice))}</div>
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
            <LIcon name="check" size={15}/> {isEdit?"Save changes":"Add product"}
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
  const [newColor, setNewColor] = useState("#10B981");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const addCat = () => {
    if (!newName.trim()) return;
    const updated = [...cats, { id:genId(), name:newName.trim(), color:newColor }];
    setCats(updated); onSave(updated); setNewName(""); setNewColor("#10B981");
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
      <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:20, color:C.text, marginBottom:20 }}>Categories</div>

      {/* Add new */}
      <div style={card({ marginBottom:20 })}>
        <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:600, fontSize:14, color:C.text, marginBottom:14 }}>Add new category</div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <input style={{ ...input, flex:1 }} placeholder="Category name" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCat()}/>
          <input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)} style={{ width:40, height:40, border:`1px solid ${C.border}`, borderRadius:8, padding:2, cursor:"pointer" }}/>
          <Btn variant="primary" onClick={addCat} disabled={!newName.trim()}><LIcon name="plus" size={15}/> Add</Btn>
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

// ─── SUBSCRIPTION PLANS SLIDER ─────────────────────────────────
function PlanSlider({ currentPlan, onSelectPlan }) {
  const plans = [
    { id: "free", name: "Free Tier", price: 0, cap: 60, wallets: 2, perks: ["60 receipts / mo cap", "Basic Receipts", "MoMo Parser", "Max 2 Wallets"] },
    { id: "growth", name: "Growth Plan", price: 23, cap: 1000, wallets: 4, perks: ["1,000 receipts / mo", "PDF Report Export", "Max 4 Wallets", "Branded Receipt Colors", "Priority WhatsApp Support"] },
    { id: "business", name: "Business Plan", price: 39, cap: 1750, wallets: 5, perks: ["1,750 receipts / mo", "PDF + GRA Tax Reports", "Max 5 Wallets", "Branded Receipt Colors", "CSV Data Export", "Priority Support"] },
    { id: "pro", name: "Pro / Unlimited", price: 59, cap: "Unlimited", wallets: "Unlimited", perks: ["Unlimited Receipts / mo", "PDF + GRA Tax Reports", "Unlimited Wallets", "Branded Receipt Colors", "CSV Data Export", "Custom Logo Branding", "Dedicated WhatsApp Manager"] }
  ];

  const [activeIndex, setActiveIndex] = useState(() => {
    const idx = plans.findIndex(p => p.id === currentPlan);
    return idx >= 0 ? idx : 0;
  });

  const next = () => setActiveIndex(prev => (prev + 1) % plans.length);
  const prev = () => setActiveIndex(prev => (prev - 1 + plans.length) % plans.length);

  const activePlan = plans[activeIndex];

  return (
    <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px", position:"relative" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:15, color:C.text }}>Subscription Plans</div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={prev} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.text, borderRadius:6, width:28, height:28, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>&larr;</button>
          <button onClick={next} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.text, borderRadius:6, width:28, height:28, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>&rarr;</button>
        </div>
      </div>

      <div style={{ minHeight:210, position:"relative", overflow:"hidden" }}>
        <div style={{ background: activePlan.id === currentPlan ? "rgba(16, 185, 129, 0.05)" : "transparent", border: `1.5px solid ${activePlan.id === currentPlan ? C.orange : C.border}`, borderRadius:12, padding:"16px", position:"relative" }}>
          {activePlan.id === currentPlan && (
            <span style={{ position:"absolute", top:-10, left:20, background:C.orange, color:"#fff", fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:10 }}>ACTIVE PLAN</span>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
            <div style={{ fontWeight:600, fontSize:16, color:C.text }}>{activePlan.name}</div>
            <div style={{ fontWeight:700, fontSize:20, color:C.orange }}>GH₵ {activePlan.price}<span style={{ fontSize:11, fontWeight:400, color:C.muted }}>/mo</span></div>
          </div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>Limit: {activePlan.cap} transactions · {activePlan.wallets} wallets</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 10px", marginBottom:14 }}>
            {activePlan.perks.map(p => (
              <div key={p} style={{ fontSize:11, color:C.text, display:"flex", alignItems:"center", gap:4 }}>
                <Check size={11} color={C.teal} strokeWidth={2.5}/> {p}
              </div>
            ))}
          </div>
          <Btn variant={activePlan.id === currentPlan ? "ghost" : "primary"} full size="sm" onClick={() => onSelectPlan(activePlan.id)} disabled={activePlan.id === currentPlan}>
            {activePlan.id === currentPlan ? "Current Plan" : `Choose ${activePlan.name}`}
          </Btn>
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:12 }}>
        {plans.map((p, idx) => (
          <div key={p.id} onClick={() => setActiveIndex(idx)} style={{ width:8, height:8, borderRadius:"50%", background: idx === activeIndex ? C.orange : C.border, cursor:"pointer" }}/>
        ))}
      </div>
    </div>
  );
}

// ─── PROFILE PAGE ─────────────────────────────────────────────
function Profile({ user, business, setBusiness, isGuest, businessId, onSignOut }) {
  const [bizName, setBizName] = useState(business.name || "");
  const [bizPhone, setBizPhone] = useState(() => localStorage.getItem("profile_phone") || "");
  const [bizIndustry, setBizIndustry] = useState(() => localStorage.getItem("profile_industry") || "");
  const [logoColor, setLogoColor] = useState(business.logoColor || "#10B981");
  const [logoBg, setLogoBg] = useState(business.logoBg || "rgba(16,185,129,0.1)");
  const [saving, setSaving] = useState(false);

  const colors = [
    { label: "Green (Default)", color: "#10B981", bg: "rgba(16,185,129,0.1)" },
    { label: "Teal", color: "#0BADA8", bg: "#f0fdfa" },
    { label: "Blue", color: "#2563eb", bg: "#eff6ff" },
    { label: "Forest Green", color: "#1B4332", bg: "rgba(27, 67, 50, 0.08)" },
    { label: "Purple", color: "#7c3aed", bg: "#f5f3ff" }
  ];

  const handleSave = async () => {
    setSaving(true);
    localStorage.setItem("profile_phone", bizPhone);
    localStorage.setItem("profile_industry", bizIndustry);

    if (isGuest) {
      setBusiness(b => ({ ...b, name: bizName, logoColor, logoBg }));
      setSaving(false);
      alert("Profile updated locally in guest mode!");
      return;
    }

    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          business_name: bizName,
          logo_color: logoColor,
          logo_bg: logoBg
        })
        .eq("id", businessId);

      if (error) throw error;
      setBusiness(b => ({ ...b, name: bizName, logoColor, logoBg }));
      alert("Business profile updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to update business profile. Please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth:540, margin:"0 auto" }}>
      <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:20, color:C.text, marginBottom:20 }}>My Profile</div>
      
      <div style={card({ marginBottom:20 })}>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:16 }}>
          <div style={{ width:60, height:60, borderRadius:30, background:"rgba(16,185,129,0.15)", color:"#10B981", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:600 }}>
            {user?.name ? user.name[0].toUpperCase() : "U"}
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:600, color:C.text }}>{user?.name || "Guest User"}</div>
            <div style={{ fontSize:13, color:C.muted }}>{user?.email || "No email linked"}</div>
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.light, padding:"10px 14px", borderRadius:10 }}>
          <span style={{ fontSize:12, color:C.muted, fontWeight:500 }}>ACTIVE SUBSCRIPTION</span>
          <span style={{ fontSize:12, fontWeight:700, color:C.orange, textTransform:"uppercase" }}>{(business.plan||'free')} Plan</span>
        </div>
      </div>

      <div style={card({ marginBottom:20 })}>
        <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:600, fontSize:15, color:C.text, marginBottom:14 }}>Business Settings</div>
        
        <div style={{ marginBottom:12 }}>
          <label style={label}>Business Name</label>
          <input style={input} value={bizName} onChange={e => setBizName(e.target.value)} placeholder="e.g. Opare Enterprises"/>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
          <div>
            <label style={label}>Phone Number</label>
            <input style={input} value={bizPhone} onChange={e => setBizPhone(e.target.value)} placeholder="e.g. 0592040012"/>
          </div>
          <div>
            <label style={label}>Industry</label>
            <input style={input} value={bizIndustry} onChange={e => setBizIndustry(e.target.value)} placeholder="e.g. Retail, Services"/>
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={label}>Receipt Theme Colors (Pro Features)</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginTop:6 }}>
            {colors.map(c => {
              const active = logoColor === c.color;
              return (
                <div key={c.color} onClick={() => { setLogoColor(c.color); setLogoBg(c.bg); }} style={{ border:`2px solid ${active ? C.orange : "transparent"}`, borderRadius:10, padding:4, cursor:"pointer" }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:c.color, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:12, fontWeight:700 }}>
                    {active && "✓"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Btn variant="primary" full onClick={handleSave} disabled={saving}>
          <LIcon name="check" size={15}/> {saving ? "Saving changes..." : "Save changes"}
        </Btn>
      </div>

      {!isGuest && (
        <div style={{ textAlign:"center" }}>
          <button onClick={onSignOut} style={{ background:"transparent", border:`1px solid ${C.border}`, color:"#ef4444", borderRadius:10, padding:"10px 20px", fontSize:13, fontWeight:500, cursor:"pointer", transition:"all 0.2s" }} onMouseOver={e=>e.currentTarget.style.background="#fef2f2"} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
            <LIcon name="trash" size={14} style={{ marginRight:6, verticalAlign:"middle" }}/> Sign Out Account
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────
function Settings({ user, business, setBusiness, isGuest, businessId, transactions, darkMode, setDarkMode }) {
  const [defaultMsg, setDefaultMsg] = useState(() => localStorage.getItem("settings_receipt_msg") || "Thank you for your business!");
  const [taxRate, setTaxRate] = useState(() => localStorage.getItem("settings_default_tax") || "0");
  const [showPoweredBy, setShowPoweredBy] = useState(() => localStorage.getItem("settings_powered_by") !== "false");
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

  const handleSave = () => {
    localStorage.setItem("settings_receipt_msg", defaultMsg);
    localStorage.setItem("settings_default_tax", taxRate);
    localStorage.setItem("settings_powered_by", showPoweredBy ? "true" : "false");
    alert("Settings saved successfully!");
  };

  const handleExportCSV = () => {
    if (!transactions || transactions.length === 0) {
      alert("No transaction records available to export.");
      return;
    }
    const headers = ["Receipt No", "Date", "Wallet ID", "Type", "Amount (GHS)", "Category", "Description", "Momo Ref"];
    const rows = transactions.map(t => [
      t.receiptNo,
      t.date,
      t.walletId,
      t.type,
      t.amount,
      t.category,
      t.description,
      t.momoRef
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `receiva_transactions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdatePlan = async (newPlan) => {
    if (isGuest || !businessId) {
      setBusiness(prev => ({ ...prev, plan: newPlan }));
      alert(`Plan updated locally to ${newPlan.toUpperCase()}!`);
      return;
    }

    setIsUpdatingPlan(true);
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("shop_id")
        .eq("id", user.id)
        .single();
      
      const shopId = profileData?.shop_id;
      if (shopId) {
        const { error: shopError } = await supabase
          .from("shops")
          .update({ current_tier: newPlan })
          .eq("id", shopId);
        
        if (shopError) throw shopError;
      }

      const { error: bizError } = await supabase
        .from("businesses")
        .update({ plan: newPlan })
        .eq("id", businessId);

      if (bizError) throw bizError;

      setBusiness(prev => ({ ...prev, plan: newPlan }));
      alert(`Subscription successfully updated to ${newPlan.toUpperCase()}!`);
    } catch (err) {
      console.error("Failed to update plan:", err);
      alert("Failed to update subscription plan: " + err.message);
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const currentPlan = business.plan || 'free';

  const planOptions = [
    {
      id: 'freelancer',
      name: 'Freelancer',
      price: 'GHS 23',
      features: [
        'Single User Access',
        'Basic Sales Logging',
        'Digital Receipts (Branded)',
        'GRA-friendly monthly summaries'
      ]
    },
    {
      id: 'business',
      name: 'Business',
      price: 'GHS 45',
      features: [
        'Multi-user Attendant accounts',
        'Inventory Stock Tracking & Alerts',
        'Momo & Multi-Wallet Support',
        'PDF Export & Reports'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'GHS 89',
      features: [
        'Multi-Branch Tracking',
        'Bulletproof Attendant Lockouts',
        'Deep Financial Analytics',
        '"The AI Accountant" Natural Language Chat',
        'Automated Credit Recovery Copywriter'
      ]
    }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 font-sans">
      <div className="text-center md:text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-950">App Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage your business details, preferences, and subscription tier.</p>
      </div>

      {/* Subscription Grid Card (Full Width) */}
      <div className="bg-white border border-gray-150 rounded-3xl shadow-sm p-6 md:p-8 space-y-6">
        <div>
          <h3 className="text-lg font-extrabold text-gray-950 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            Subscription Plan
          </h3>
          <p className="text-xs text-gray-500 mt-1">Scale your store branches and capabilities with our tiered subscription levels.</p>
        </div>

        {/* Responsive Plans List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {planOptions.map((plan) => {
            const isActive = currentPlan === plan.id;
            const isEnterprise = plan.id === 'enterprise';

            return (
              <div 
                key={plan.id}
                className={`bg-white border rounded-2xl p-6 flex flex-col justify-between transition-all relative overflow-hidden ${
                  isActive 
                    ? 'border-green-500 shadow-md ring-1 ring-green-500/20' 
                    : 'border-gray-150 hover:border-gray-250 shadow-sm'
                }`}
              >
                {/* Active Tag */}
                {isActive && (
                  <div className="absolute top-0 right-0 bg-green-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                    Current Plan
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-extrabold text-gray-950">{plan.name}</h4>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-2xl font-black text-gray-950">{plan.price}</span>
                      <span className="text-xs text-gray-400 font-semibold">/ month</span>
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  <ul className="space-y-2.5 text-xs text-gray-600">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex gap-2 items-start">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="leading-tight">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6 mt-auto">
                  <button
                    type="button"
                    disabled={isActive || isUpdatingPlan}
                    onClick={() => handleUpdatePlan(plan.id)}
                    className={`w-full py-2.5 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      isActive
                        ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                        : isEnterprise
                          ? 'bg-gray-900 hover:bg-gray-800 text-white shadow-sm'
                          : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-250 shadow-sm'
                    } disabled:opacity-50`}
                  >
                    {isActive ? 'Active Plan' : isUpdatingPlan ? 'Updating...' : `Select ${plan.name}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Col: Receipt Preferences & Appearance */}
        <div className="space-y-8">
          {/* Appearance card */}
          <div className="bg-white border border-gray-150 rounded-3xl shadow-sm p-6 space-y-4">
            <h3 className="text-base font-extrabold text-gray-950">Appearance</h3>
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div>
                <span className="block text-xs font-bold text-gray-850">Dark Theme</span>
                <span className="text-[10px] text-gray-455">Toggle dark theme for night recording</span>
              </div>
              <div 
                onClick={() => setDarkMode(!darkMode)} 
                className={`w-12 h-6 rounded-full p-0.5 cursor-pointer transition-colors duration-200 ease-in-out ${
                  darkMode ? 'bg-green-500' : 'bg-gray-200'
                }`}
              >
                <div 
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out ${
                    darkMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Receipt preferences card */}
          <div className="bg-white border border-gray-150 rounded-3xl shadow-sm p-6 space-y-4">
            <h3 className="text-base font-extrabold text-gray-950">Receipt Preferences</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Default Thank-You Note
                </label>
                <textarea 
                  rows={2}
                  className="w-full px-4 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all bg-gray-50"
                  value={defaultMsg} 
                  onChange={e => setDefaultMsg(e.target.value)} 
                  placeholder="Message shown at footer of receipts"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Default Tax Rate (%)
                  </label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all bg-gray-50"
                    value={taxRate} 
                    onChange={e => setTaxRate(e.target.value)} 
                    placeholder="e.g. 5"
                  />
                </div>
                
                <div className="flex flex-col justify-end">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Signature Branding
                  </label>
                  <div className="flex items-center gap-2 bg-gray-50 p-2 px-3 rounded-xl border border-gray-100 h-[38px]">
                    <div 
                      onClick={() => setShowPoweredBy(!showPoweredBy)} 
                      className={`w-9 h-5 rounded-full p-0.5 cursor-pointer transition-colors duration-200 ease-in-out ${
                        showPoweredBy ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    >
                      <div 
                        className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out ${
                          showPoweredBy ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] text-gray-605 font-bold">Show "Powered by Receiva"</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSave}
                className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-green-50"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Data Portability & Version Info */}
        <div className="space-y-8">
          <div className="bg-white border border-gray-150 rounded-3xl shadow-sm p-6 space-y-4">
            <h3 className="text-base font-extrabold text-gray-950">Data Portability</h3>
            <p className="text-xs text-gray-505 leading-relaxed">
              Export all transactions saved in this account as a clean, standardized CSV file for spreadsheets and tax software.
            </p>
            <button
              type="button"
              onClick={handleExportCSV}
              className="w-full py-2.5 px-4 border border-gray-250 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Export Data as CSV
            </button>
          </div>

          <div className="text-center text-[10px] text-gray-400 space-y-1 py-4">
            <div className="font-bold">Receiva Pro App · Version 1.2.0</div>
            <div>Vercel Sandbox · Supabase Cloud Connected</div>
          </div>
        </div>
      </div>
    </div>
  );
}

