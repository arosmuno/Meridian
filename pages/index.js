import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import Head from 'next/head';
import AdSlot from '../components/AdSlot';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const TYPE_STYLE = {
  'M&A':             { accent: '#e63946', bg: '#180808' },
  'LBO':             { accent: '#a78bfa', bg: '#0f0a1a' },
  'LevFin':          { accent: '#4a9eff', bg: '#08111f' },
  'Project Finance': { accent: '#22c55e', bg: '#051510' },
  'ECM':             { accent: '#c084fc', bg: '#0d0812' },
  'Restructuring':   { accent: '#f43f5e', bg: '#190610' },
  'Debt Advisory':   { accent: '#f59e0b', bg: '#130d04' },
  'Macro':           { accent: '#38bdf8', bg: '#071520' },
  'Earnings':        { accent: '#fb923c', bg: '#130a04' },
  'Markets':         { accent: '#a3e635', bg: '#091505' },
  'Default':         { accent: '#c9b99a', bg: '#0d0b07' },
};
const STATUS_STYLE = {
  Closed:    { bg: '#041b0d', color: '#4ade80', border: '#15532e' },
  Signed:    { bg: '#080f25', color: '#60a5fa', border: '#1e3a6e' },
  Rumoured:  { bg: '#1a1003', color: '#fbbf24', border: '#78350f' },
  Breaking:  { bg: '#200610', color: '#f87171', border: '#7f1d1d' },
  Published: { bg: '#071520', color: '#38bdf8', border: '#0c4a6e' },
};
const KICKER_MAP = {
  'M&A':'STRATEGIC M&A','LBO':'LEVERAGED BUYOUT','LevFin':'LEVFIN',
  'Project Finance':'PROJECT FINANCE','ECM':'EQUITY CAPITAL MARKETS',
  'Restructuring':'RESTRUCTURING','Debt Advisory':'DEBT ADVISORY',
  'Macro':'MACRO & POLICY','Earnings':'EARNINGS','Markets':'MARKETS',
};
const getStyle = t => TYPE_STYLE[t] || TYPE_STYLE['Default'];
const curSym = c => c === 'USD' ? '$' : c === 'GBP' ? '£' : '€';
const fmt = (n, c='€') => { const v=Number(n); if(!v) return 'N/A'; return v>=1000?`${c}${(v/1000).toFixed(1)}Bn`:`${c}${v}M`; };
// Tipos de mercado/macro: no son operaciones.
const MARKET_TYPES = ['Macro','Earnings','Markets'];
const isNA = (s) => !s || /^n\/?a$/i.test(String(s).trim());
// Un item NO es una operacion real (es mercado/sector) si: es tipo macro/mercado;
// o le falta comprador Y objetivo; o le falta una contraparte y suena a mercado/sector/indice.
const isMarketLike = (d) => {
  if (MARKET_TYPES.includes(d.type) || d.category === 'macro') return true;
  if (isNA(d.buyer) && isNA(d.target)) return true;
  if (isNA(d.buyer) || isNA(d.target)) {
    const bt = `${d.buyer||''} ${d.target||''}`.toLowerCase();
    return /market|sector|industry|\bindex\b|total addressable|overall|economy/.test(bt);
  }
  return false;
};
// Los items de mercado nunca muestran importe de operacion.
// Limpia coletillas de LinkedIn / Google Alerts en titulares (legacy).
const cleanHeadline = (h) => {
  let s = (h || '').replace(/https?:\/\/\S+/gi, ' ').replace(/\blnkd\.in\S*/gi, ' ').replace(/&middot;/gi, ' ')
    .replace(/\bPublicaci[oó]n de\b[\s\S]*$/i, ' ').replace(/\bVer el perfil de\b[\s\S]*$/i, ' ').replace(/on LinkedIn:\s*/i, '');
  const c = s.search(/\s\|\s.*$/); if (c > 25) s = s.slice(0, c);
  return s.replace(/\s{2,}/g, ' ').replace(/[\s|·\-–]+$/, '').trim();
};
// El diario es SIEMPRE en ingles: detecta titulares en espanol para no mostrarlos.
const looksSpanish = (h) => /[ñ¿¡]/.test(h || '') || /\b(millones|adquiere|compra|deuda|cr[eé]dito|pr[eé]stamo|fusi[oó]n|ampliaci[oó]n|accionista|espa[nñ]ola?|empresa|negocio|bolsa|beneficio|salida a bolsa|puja|retrasa|colocar)\b/i.test(h || '');
const enrich = (d, i) => ({ ...d, id:i+1, headline: cleanHeadline(d.headline), value: isMarketLike(d) ? 0 : d.value, ...getStyle(d.type), kicker: KICKER_MAP[d.type]||d.type?.toUpperCase()||'DEAL' });

// Firma de una entidad: minusculas, sin acentos ni signos, y sin sufijos corporativos
// (group, holdings, inc, corp, plc, ag, ltd, partners, automotive...). Asi "Renk" y
// "Renk Group" colapsan a la misma clave.
const CORP_SUFFIX = /(group|holdings|holding|incorporated|inc|corporation|corp|company|co|sa|plc|ag|gmbh|ltd|limited|llc|lp|partners|automotive|nv|spa|realestate|se|ab|oyj)$/;
function sigPart(s) {
  let x = String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let i = 0; i < 3; i++) { const y = x.replace(CORP_SUFFIX, ''); if (y === x) break; x = y; }
  return x;
}
// Colapsa noticias duplicadas (misma operacion re-titulada por distintas fuentes/pasadas
// del cron). Clave = par buyer|target normalizado y ordenado (tolera intercambio de roles);
// si falta comprador u objetivo, usa un prefijo del titular. Conserva el primero (mas reciente).
function dedupeDeals(arr) {
  const seen = new Set();
  const out = [];
  for (const d of arr) {
    const b = sigPart(d.buyer), t = sigPart(d.target);
    const real = b && b !== 'na' && b.length > 2 && t && t !== 'na' && t.length > 2;
    const key = real
      ? (b < t ? b + '|' + t : t + '|' + b)
      : 'h:' + String(d.headline || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 42);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

// Procesa deals crudos de la API a la forma que renderiza la home (enrich + orden + filtro + dedupe).
// Se usa tanto para el estado inicial (SSR: contenido visible para Google/AdSense) como en loadDeals.
function processDeals(arr) {
  const raw = (arr || []).map(enrich);
  const parseDate = (d) => {
    if (d.deal_date) return new Date(d.deal_date).getTime();
    if (d.date) { const p = new Date(d.date); return isNaN(p) ? 0 : p.getTime(); }
    return 0;
  };
  const sorted = [...raw].sort((a, b) => parseDate(b) - parseDate(a));
  return dedupeDeals(sorted.filter((d) => !looksSpanish(d.headline)));
}

// ── THEMES ────────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    page:     '#08050a',
    bg:       '#0d0d0f',
    bgCard:   '#141418',
    bgHover:  '#1a1a20',
    border:   '#2e2e38',
    borderHi: '#4a4a5a',
    textHi:   '#f0ece4',
    textBody: '#c8c0b4',
    textMid:  '#8a8278',
    textLo:   '#5a5450',
    gold:     '#d4a853',
  },
  light: {
    page:     '#f3f0e8',
    bg:       '#faf8f3',
    bgCard:   '#ffffff',
    bgHover:  '#efece4',
    border:   '#ddd7ca',
    borderHi: '#c3bcab',
    textHi:   '#1c1916',
    textBody: '#403a33',
    textMid:  '#736c61',
    textLo:   '#a59d8f',
    gold:     '#9a7d1e',
  },
};

// Theme context
const ThemeContext = createContext({ C: THEMES.dark, theme: 'dark', toggleTheme: () => {} });
const useTheme = () => useContext(ThemeContext);

// Panel background for hero/modal headers: dark accent panel in dark mode,
// soft accent tint in light mode (so dark deal.bg doesn't clash on light pages).
const panelBg = (deal, theme) => theme === 'light' ? `${deal.accent}14` : deal.bg;

const SOURCE_MODE = {
  live:      { label: 'LIVE · Web Search',  color: '#22c55e' },
  knowledge: { label: 'KNOWLEDGE BASE',     color: '#f59e0b' },
  archive:   { label: 'CURATED ARCHIVE',    color: '#8b7355' },
  db:        { label: 'LIVE · Database',    color: '#22c55e' },
};

// ── COMPONENTS ────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.Signed;
  return (
    <span style={{background:s.bg,color:s.color,border:`1px solid ${s.border}`,padding:'2px 8px',fontSize:10,fontWeight:700,letterSpacing:'.1em',fontFamily:"var(--s)",textTransform:'uppercase',whiteSpace:'nowrap'}}>
      {status==='Breaking'?'⬤ ':''}{status}
    </span>
  );
}

function ModeTag({ mode }) {
  const cfg = SOURCE_MODE[mode] || SOURCE_MODE.archive;
  return (
    <span style={{fontFamily:"var(--s)",fontSize:9,fontWeight:700,letterSpacing:'.1em',color:cfg.color,border:`1px solid ${cfg.color}55`,padding:'2px 8px',textTransform:'uppercase',borderRadius:2}}>
      {cfg.label}
    </span>
  );
}

function HeroDeal({ deal, onClick }) {
  const { C, theme } = useTheme();
  return (
    <div className="hero-deal" onClick={()=>onClick(deal)} style={{background:panelBg(deal,theme),borderBottom:`4px solid ${deal.accent}`,padding:'44px 48px 38px',cursor:'pointer',position:'relative',overflow:'hidden'}}
      onMouseEnter={e=>e.currentTarget.style.opacity='.93'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
      <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse at 80% 0%,${deal.accent}18 0%,transparent 60%)`,pointerEvents:'none'}}/>
      {deal.image_url ? (
        <div style={{width:'100%',height:300,overflow:'hidden',marginBottom:26,border:`1px solid ${C.border}`,position:'relative'}}>
          <img src={deal.image_url} alt="" onError={(e)=>{e.currentTarget.parentElement.style.display='none';}}
            style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
        </div>
      ) : null}
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:14,flexWrap:'wrap'}}>
        <span style={{fontFamily:"var(--s)",fontSize:10,fontWeight:800,letterSpacing:'.2em',color:deal.accent}}>{deal.kicker}</span>
        <StatusBadge status={deal.status}/>
      </div>
      <h2 style={{fontFamily:"var(--d)",fontSize:'clamp(24px,3vw,42px)',fontWeight:800,color:C.textHi,lineHeight:1.15,margin:'0 0 16px',maxWidth:700}}>{deal.headline}</h2>
      <p style={{fontFamily:"var(--r)",fontSize:16,color:C.textBody,lineHeight:1.75,maxWidth:620,margin:'0 0 26px'}}>{deal.summary}</p>
      <div style={{display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}>
        <div>
          <div style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:2}}>VALUE</div>
          <div style={{fontFamily:"var(--d)",fontSize:28,fontWeight:800,color:deal.accent}}>{fmt(deal.value,curSym(deal.currency))}</div>
        </div>
        {[{l:'TYPE',v:deal.type},{l:'SECTOR',v:deal.sector},{l:'SOURCE',v:deal.source}].map((m)=>(
          <div key={m.l} style={{display:'flex',alignItems:'center',gap:20}}>
            <div style={{width:1,height:36,background:C.border}}/>
            <div>
              <div style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:2}}>{m.l}</div>
              <div style={{fontFamily:"var(--s)",fontSize:13,fontWeight:600,color:C.textHi}}>{m.v||'—'}</div>
            </div>
          </div>
        ))}
        <span style={{marginLeft:'auto',fontFamily:"var(--s)",fontSize:11,color:deal.accent,fontWeight:700,letterSpacing:'.06em',borderBottom:`1px solid ${deal.accent}`}}>READ FULL DEAL →</span>
      </div>
    </div>
  );
}

function DealCard({ deal, onClick }) {
  const { C } = useTheme();
  return (
    <div className="card" onClick={()=>onClick(deal)}>
      <div style={{height:3,background:deal.accent}}/>
      {deal.image_url ? (
        <div style={{width:'100%',height:150,overflow:'hidden',background:C.bg}}>
          <img src={deal.image_url} alt="" loading="lazy" onError={(e)=>{e.currentTarget.parentElement.style.display='none';}}
            style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
        </div>
      ) : null}
      <div style={{padding:'18px 22px',flexGrow:1,display:'flex',flexDirection:'column',gap:10}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
          <span style={{fontFamily:"var(--s)",fontSize:9,fontWeight:700,letterSpacing:'.14em',color:deal.accent,textTransform:'uppercase'}}>{deal.kicker}</span>
          <StatusBadge status={deal.status}/>
        </div>
        <h3 style={{fontFamily:"var(--d)",fontSize:17,fontWeight:700,color:C.textHi,lineHeight:1.3,margin:0}}>{deal.headline}</h3>
        <p style={{fontFamily:"var(--r)",fontSize:13,color:C.textBody,lineHeight:1.7,margin:0,flexGrow:1}}>{(deal.summary||'').slice(0,160)}{(deal.summary||'').length>160?'…':''}</p>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',paddingTop:10,borderTop:`1px solid ${C.border}`}}>
          <div>
            <div style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,letterSpacing:'.08em',marginBottom:2}}>VALUE</div>
            <div style={{fontFamily:"var(--d)",fontSize:19,fontWeight:700,color:deal.accent}}>{fmt(deal.value,curSym(deal.currency))}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:"var(--s)",fontSize:10,color:C.textMid,fontWeight:400}}>
              {deal.deal_date ? new Date(deal.deal_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : deal.date}
            </div>
            <div style={{fontFamily:"var(--s)",fontSize:10,color:C.textLo,marginTop:2}}>{deal.sector}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DealModal({ deal, mode, onClose }) {
  const { C, theme } = useTheme();
  const [analysis, setAnalysis] = useState('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const c = curSym(deal.currency);

  const runAnalysis = async () => {
    setLoadingAnalysis(true); setAnalysis('');
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal, lang: 'en', langName: 'English' }),
      });
      const data = await res.json();
      if (data.analysis) setAnalysis(data.analysis);
      else setAnalysis('El análisis no está disponible en este momento.');
    } catch (e) { setAnalysis('El análisis no está disponible en este momento.'); }
    setLoadingAnalysis(false);
  };

  // Auto-generar el análisis al abrir un deal (sin botón)
  useEffect(() => { runAnalysis(); /* eslint-disable-next-line */ }, [deal.headline]);

  return (
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(4,2,6,.92)',zIndex:200,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'28px 16px',backdropFilter:'blur(4px)'}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-inner" style={{background:C.bgCard,border:`1px solid ${C.border}`,maxWidth:780,width:'100%'}}>
        {/* Header */}
        <div className="modal-header" style={{background:panelBg(deal,theme),borderBottom:`3px solid ${deal.accent}`,padding:'32px 40px 28px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontFamily:"var(--s)",fontSize:10,fontWeight:800,letterSpacing:'.2em',color:deal.accent}}>{deal.kicker}</span>
              <StatusBadge status={deal.status}/>
              <ModeTag mode={mode}/>
              {deal.geography && <span style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,border:`1px solid ${C.border}`,padding:'1px 6px'}}>{deal.geography}</span>}
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',color:C.textMid,cursor:'pointer',fontSize:22,lineHeight:1,paddingLeft:16}}>×</button>
          </div>
          <h1 style={{fontFamily:"var(--d)",fontSize:'clamp(20px,2.6vw,30px)',fontWeight:800,color:C.textHi,lineHeight:1.2,margin:0}}>{deal.headline}</h1>
        </div>

        {/* Metrics */}
        <div className="modal-metrics" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',borderBottom:`1px solid ${C.border}`}}>
          {[{l:'VALUE',v:fmt(deal.value,c),big:true},{l:'TYPE',v:deal.type},{l:'SECTOR',v:deal.sector},{l:'BUYER',v:deal.buyer},{l:'TARGET',v:deal.target},{l:'DATE',v:deal.date}].map((m,i)=>(
            <div key={i} style={{padding:'13px 20px',borderRight:i%3!==2?`1px solid ${C.border}`:'none',borderBottom:i<3?`1px solid ${C.border}`:'none'}}>
              <div style={{fontFamily:"var(--s)",fontSize:9,letterSpacing:'.1em',color:C.textMid,marginBottom:4,textTransform:'uppercase'}}>{m.l}</div>
              <div style={{fontFamily:m.big?"var(--d)":"var(--s)",fontSize:m.big?22:13,fontWeight:m.big?700:500,color:m.big?deal.accent:C.textBody}}>{m.v||'N/A'}</div>
            </div>
          ))}
        </div>

        <div className="modal-body" style={{padding:'26px 40px'}}>
          <p style={{fontFamily:"var(--r)",fontSize:15,color:C.textBody,lineHeight:1.9,marginBottom:20}}>{deal.summary}</p>

          {deal.advisor && (
            <div style={{paddingTop:12,borderTop:`1px solid ${C.border}`,marginBottom:22}}>
              <div style={{fontFamily:"var(--s)",fontSize:9,letterSpacing:'.1em',color:C.textMid,marginBottom:5,textTransform:'uppercase'}}>ADVISORS</div>
              <div style={{fontFamily:"var(--s)",fontSize:12,color:C.textBody}}>{deal.advisor}</div>
            </div>
          )}

          <AdSlot slot="3456789012" style={{ marginBottom: 20 }} />

          {/* AI Analysis */}
          <div style={{background:C.bg,border:`1px solid ${C.border}`,padding:'20px 24px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontFamily:"var(--s)",fontSize:10,fontWeight:700,letterSpacing:'.14em',color:deal.accent}}>✦ MERIDIAN ANALYSIS</div>
            </div>
            {loadingAnalysis && <div style={{fontFamily:"var(--r)",fontSize:13,color:C.textMid,fontStyle:'italic'}}>Drafting editorial analysis…</div>}
            {analysis && <p style={{fontFamily:"var(--r)",fontSize:14,color:C.textBody,lineHeight:1.9,margin:0,whiteSpace:'pre-wrap'}}>{analysis}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function Home({ initialDeals = [] }) {
  const [deals, setDeals]         = useState(() => processDeals(initialDeals));
  const [mode, setMode]           = useState('archive');
  const [loading, setLoading]     = useState(true);
  const [section, setSection]     = useState('deals'); // 'deals' | 'markets'
  const [filter, setFilter]       = useState('All');
  const [geoFilter, setGeoFilter] = useState('All');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [selected, setSelected]   = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [q, setQ]                 = useState('');
  const [theme, setTheme]         = useState('light');

  const C = THEMES[theme] || THEMES.dark;

  // Load saved theme on mount (avoids SSR hydration mismatch by defaulting dark)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('meridian_theme_v2');
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch {}
  }, []);

  // Persist theme + expose it to CSS (globals.css uses [data-theme="light"])
  useEffect(() => {
    try { localStorage.setItem('meridian_theme_v2', theme); } catch {}
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  const loadDeals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deals');
      const data = await res.json();
      setDeals(processDeals(data.deals || []));
      setMode(data.source || 'archive');
      setLastUpdated(data.last_updated ? new Date(data.last_updated) : new Date());
    } catch {
      setDeals([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  useEffect(() => {
    const interval = setInterval(loadDeals, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadDeals]);

  const dealItems  = deals.filter(d => !isMarketLike(d));
  const marketItems = deals.filter(d => isMarketLike(d));
  const activeItems = section === 'deals' ? dealItems : marketItems;

  const types = ['All', ...new Set(activeItems.map(d=>d.type).filter(Boolean))];
  const geos  = ['All', 'Europe', 'North America', 'Asia Pacific', 'Latin America', 'Middle East & Africa', 'Global'];
  const sectors = section === 'deals'
    ? ['All', 'Healthcare', 'TMT', 'Infrastructure', 'Energy & Renewables', 'Financial Services', 'Consumer', 'Industrials', 'Real Estate']
    : ['All', 'Macro', 'Financial Services', 'Consumer', 'Industrials', 'Energy & Renewables', 'TMT'];

  const hero = activeItems[0];

  const matchGeo = (deal, geo) => {
    if (geo === 'All') return true;
    const g = (deal.geography || '').toLowerCase();
    if (geo === 'Europe') return g.includes('europ') || g.includes('uk') || g.includes('spain') || g.includes('german') || g.includes('franc') || g.includes('ital');
    if (geo === 'North America') return g.includes('north america') || g.includes('us') || g.includes('united states') || g.includes('canada');
    if (geo === 'Asia Pacific') return g.includes('asia') || g.includes('pacific') || g.includes('china') || g.includes('japan') || g.includes('hong kong');
    if (geo === 'Latin America') return g.includes('latin') || g.includes('latam') || g.includes('brazil') || g.includes('mexico');
    if (geo === 'Middle East & Africa') return g.includes('middle east') || g.includes('africa') || g.includes('mea') || g.includes('gulf');
    if (geo === 'Global') return g.includes('global') || g.includes('international');
    return g.includes(geo.toLowerCase());
  };

  const matchSector = (deal, sec) => {
    if (sec === 'All') return true;
    const s = (deal.sector || '').toLowerCase();
    if (sec === 'TMT') return s.includes('tmt') || s.includes('tech') || s.includes('media') || s.includes('telecom') || s.includes('software') || s.includes('digital');
    if (sec === 'Energy & Renewables') return s.includes('energy') || s.includes('renew') || s.includes('power') || s.includes('solar') || s.includes('wind') || s.includes('oil') || s.includes('gas');
    if (sec === 'Infrastructure') return s.includes('infra') || s.includes('transport') || s.includes('utility') || s.includes('utilities') || s.includes('airport') || s.includes('road');
    if (sec === 'Financial Services') return s.includes('financ') || s.includes('bank') || s.includes('insurance') || s.includes('asset manag');
    return s.includes(sec.toLowerCase());
  };

  const matchSearch = (deal) => {
    if (!q) return true;
    const hay = `${deal.headline||''} ${deal.buyer||''} ${deal.target||''} ${deal.summary||''} ${deal.sector||''}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  };

  const rest = (q ? activeItems : activeItems.slice(1)).filter(d =>
    (filter === 'All' || d.type === filter) &&
    matchSearch(d) &&
    matchGeo(d, geoFilter) &&
    matchSector(d, sectorFilter)
  );
  const totalVol = dealItems.reduce((s,d)=>s+Number(d.value||0),0);

  if (loading && !deals.length) {
    return (
      <div style={{minHeight:'100vh',background:C.page,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24}}>
        <div style={{fontFamily:"var(--s)",fontSize:9,letterSpacing:'.3em',color:C.textMid}}>THE CAPITAL MARKETS INTELLIGENCE REVIEW</div>
        <div style={{fontFamily:"var(--d)",fontSize:72,fontWeight:800,color:C.textHi,letterSpacing:'-.02em'}}>MERIDIAN</div>
        <div style={{fontFamily:"var(--s)",fontSize:11,color:C.textMid,letterSpacing:'.1em'}}>LOADING INTELLIGENCE…</div>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ C, theme, toggleTheme }}>
      <>
      <Head>
        <title>MERIDIAN — M&A & Capital Markets Intelligence</title>
      </Head>

      <div style={{background:C.page,minHeight:'100vh'}}>
        {/* MASTHEAD */}
        <div style={{background:C.bgCard,borderBottom:`3px double ${C.border}`}}>
          <div className="masthead-top" style={{borderBottom:`1px solid ${C.border}`,padding:'6px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
            <span style={{fontFamily:"var(--s)",fontSize:10,color:C.textMid,letterSpacing:'.08em'}}>
              {new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase()}
            </span>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <ModeTag mode={mode}/>
              <span style={{fontFamily:"var(--s)",fontSize:10,color:C.textMid}}>{deals.length} deals · {fmt(totalVol)}</span>
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <button onClick={toggleTheme} title="Cambiar tema claro/oscuro" style={{background:'none',border:`1px solid ${C.border}`,color:C.textMid,padding:'3px 9px',fontSize:13,lineHeight:1,cursor:'pointer'}}
                onMouseEnter={e=>{e.currentTarget.style.color=C.gold;e.currentTarget.style.borderColor=C.gold}} onMouseLeave={e=>{e.currentTarget.style.color=C.textMid;e.currentTarget.style.borderColor=C.border}}>
                {theme === 'dark' ? '☀' : '☾'}
              </button>
              <button onClick={loadDeals} style={{background:'none',border:`1px solid ${C.border}`,color:C.textMid,padding:'3px 10px',fontFamily:"var(--s)",fontSize:10,cursor:'pointer',letterSpacing:'.06em'}}
                onMouseEnter={e=>{e.currentTarget.style.color=C.gold;e.currentTarget.style.borderColor=C.gold}} onMouseLeave={e=>{e.currentTarget.style.color=C.textMid;e.currentTarget.style.borderColor=C.border}}>
                ↻ REFRESH
              </button>
            </div>
          </div>

          <div style={{textAlign:'center',padding:'24px 24px 18px',borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontFamily:"var(--s)",fontSize:9,letterSpacing:'.35em',color:C.textMid,marginBottom:8}}>✦ &nbsp; THE CAPITAL MARKETS INTELLIGENCE REVIEW &nbsp; ✦</div>
            <h1 style={{fontFamily:"var(--d)",fontSize:'clamp(44px,7vw,80px)',fontWeight:800,color:C.textHi,letterSpacing:'-.02em',lineHeight:1,margin:'0 0 6px'}}>MERIDIAN</h1>
            <p style={{fontFamily:"var(--r)",fontSize:12,color:C.textMid,fontStyle:'italic'}}>Deals. Capital. Strategy.</p>
          </div>

          {/* Section nav tabs */}
          <div className="section-tabs" style={{display:'flex',borderBottom:`1px solid ${C.border}`,background:C.bg}}>
            {[
              {id:'deals', label:'DEALS'},
              {id:'markets', label:'MARKETS'},
            ].map(tab=>(
              <button key={tab.id} onClick={()=>{setSection(tab.id);setFilter('All');setGeoFilter('All');setSectorFilter('All');}}
                style={{padding:'12px 28px',background:'none',border:'none',borderBottom:section===tab.id?`3px solid ${C.gold}`:'3px solid transparent',
                  color:section===tab.id?C.gold:C.textMid,fontFamily:"var(--s)",fontSize:12,fontWeight:700,
                  letterSpacing:'.12em',cursor:'pointer',transition:'all .15s'}}>
                {tab.label}
              </button>
            ))}
            <a href="/wrap" style={{padding:'12px 18px',borderBottom:'3px solid transparent',color:C.textMid,fontFamily:"var(--s)",fontSize:12,fontWeight:700,letterSpacing:'.12em',cursor:'pointer',textDecoration:'none',display:'flex',alignItems:'center',marginLeft:'auto'}}>THE WRAP</a>
            <a href="/analysis" style={{padding:'12px 18px',borderBottom:'3px solid transparent',color:C.textMid,fontFamily:"var(--s)",fontSize:12,fontWeight:700,letterSpacing:'.12em',cursor:'pointer',textDecoration:'none',display:'flex',alignItems:'center'}}>ANALYSIS</a>
            <a href="/rankings" style={{padding:'12px 18px',borderBottom:'3px solid transparent',color:C.textMid,fontFamily:"var(--s)",fontSize:12,fontWeight:700,letterSpacing:'.12em',cursor:'pointer',textDecoration:'none',display:'flex',alignItems:'center'}}>RANKINGS</a>
            <a href="/learn" style={{padding:'12px 18px',borderBottom:'3px solid transparent',color:C.gold,fontFamily:"var(--s)",fontSize:12,fontWeight:700,letterSpacing:'.12em',cursor:'pointer',textDecoration:'none',display:'flex',alignItems:'center'}}>LEARN &#8250;</a>
          </div>

          {/* Ad banner */}
          <div style={{padding:'8px 24px',borderBottom:`1px solid ${C.border}`,background:C.bg}}>
            <AdSlot slot="1234567890" format="horizontal" style={{maxWidth:728,margin:'0 auto'}} />
          </div>

          {/* Ticker */}
          <div style={{display:'flex',borderTop:`1px solid ${C.border}`}}>
            <div style={{background:'#e63946',padding:'5px 14px',flexShrink:0,display:'flex',alignItems:'center'}}>
              <span style={{fontFamily:"var(--s)",fontSize:9,fontWeight:800,letterSpacing:'.1em',color:'#fff'}}>LIVE</span>
            </div>
            <div className="ticker-wrap" style={{flex:1,padding:'5px 14px',background:C.bg}}>
              <div className="ticker-inner">
                {[...dealItems,...dealItems].filter(d=>d.value>0).map((d,i)=>(
                  <span key={i} style={{fontFamily:"var(--s)",fontSize:10,color:C.textMid,marginRight:32}}>
                    <span style={{color:C.textBody,fontWeight:600}}>{d.buyer}</span>
                    {' → '}<span style={{color:C.textMid}}>{d.target}</span>
                    {' '}<span style={{color:d.accent,fontWeight:700}}>{fmt(d.value,curSym(d.currency))}</span>
                    <span style={{color:C.border,margin:'0 12px'}}>❙</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="content-area" style={{maxWidth:1200,margin:'0 auto',padding:'0 20px'}}>
          {!q && dealItems.length > 0 && (
            <div className="trending-strip" style={{margin:'0 -20px',borderBottom:`1px solid ${C.border}`,background:C.bgCard,display:'flex',alignItems:'stretch',overflow:'hidden'}}>
              <div style={{background:'#e63946',padding:'0 15px',display:'flex',alignItems:'center',flexShrink:0}}>
                <span style={{fontFamily:"var(--s)",fontSize:9,fontWeight:800,letterSpacing:'.12em',color:'#fff',whiteSpace:'nowrap'}}>&#9733; IN THE NEWS</span>
              </div>
              <div className="trending-scroll" style={{display:'flex',overflowX:'auto',flex:1}}>
                {(() => {
                  const seen = new Set();
                  return [...dealItems].sort((a,b)=>Number(b.value||0)-Number(a.value||0)).filter((d)=>{
                    const k = ((!isNA(d.buyer) ? d.buyer : d.headline) || '').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20);
                    if (seen.has(k)) return false; seen.add(k); return true;
                  }).slice(0,5);
                })().map((d)=>(
                  <div key={d.id} onClick={()=>setSelected(d)} style={{padding:'10px 18px',borderRight:`1px solid ${C.border}`,cursor:'pointer',minWidth:230,maxWidth:300,flexShrink:0,display:'flex',flexDirection:'column',gap:3}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.bgHover} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{fontFamily:"var(--s)",fontSize:8,fontWeight:700,letterSpacing:'.12em',color:d.accent,textTransform:'uppercase'}}>{d.kicker}</span>
                    <span style={{fontFamily:"var(--d)",fontSize:13,fontWeight:700,color:C.textHi,lineHeight:1.25,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{d.headline}</span>
                    {d.value>0 && <span style={{fontFamily:"var(--d)",fontSize:12,fontWeight:700,color:d.accent}}>{fmt(d.value,curSym(d.currency))}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {hero && !q && <div className="hero-wrap" style={{margin:'0 -20px'}}><HeroDeal deal={hero} onClick={setSelected}/></div>}

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 0 10px',borderBottom:`1px solid ${C.border}`,flexWrap:'wrap',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:3,height:16,background:C.gold,display:'block'}}/>
              <span style={{fontFamily:"var(--s)",fontSize:10,fontWeight:700,letterSpacing:'.14em',color:C.gold,textTransform:'uppercase'}}>{section==='deals'?'Latest Deals':'Markets & Macro'}</span>
              {lastUpdated && <span style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid}}>Updated {lastUpdated.toLocaleTimeString('en-GB')}</span>}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar deals…"
                style={{background:C.bg,border:`1px solid ${C.border}`,color:C.textHi,padding:'5px 12px',fontFamily:"var(--s)",fontSize:11,minWidth:200,outline:'none'}} />
              <div className="filter-row" style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {types.map(tp=><button key={tp} className={`pill ${filter===tp?'active':''}`} onClick={()=>setFilter(tp)}>{tp === 'All' ? 'ALL' : tp}</button>)}
              </div>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 0 10px',borderBottom:`1px solid ${C.border}`,flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,letterSpacing:'.1em',textTransform:'uppercase',minWidth:50}}>REGION</span>
              <div className="filter-row" style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {geos.map(g=><button key={g} className={`pill ${geoFilter===g?'active':''}`} onClick={()=>setGeoFilter(g)}>{g === 'All' ? 'ALL' : g}</button>)}
              </div>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0 16px',borderBottom:`2px solid ${C.border}`,flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,letterSpacing:'.1em',textTransform:'uppercase',minWidth:50}}>SECTOR</span>
              <div className="filter-row" style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {sectors.map(sc=><button key={sc} className={`pill ${sectorFilter===sc?'active':''}`} onClick={()=>setSectorFilter(sc)}>{sc === 'All' ? 'ALL' : sc}</button>)}
              </div>
            </div>
          </div>

          <div className="main-grid" style={{display:'grid',gridTemplateColumns:section==='deals'?'1fr 280px':'1fr',gap:24,padding:'18px 0 48px',alignItems:'start'}}>
            <div>
              <div className="cards-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {rest.flatMap((d, i) => {
                  const out = [<DealCard key={d.id} deal={d} onClick={setSelected}/>];
                  // Anuncio in-feed cada 6 tarjetas (ancho completo)
                  if ((i + 1) % 6 === 0 && i < rest.length - 1) {
                    out.push(
                      <div key={`adfeed-${i}`} style={{gridColumn:'1 / -1'}}>
                        <AdSlot slot="2233445566" format="horizontal" />
                      </div>
                    );
                  }
                  return out;
                })}
                {rest.length === 0 && (
                  <div style={{gridColumn:'1/-1',textAlign:'center',padding:'60px 0',fontFamily:"var(--r)",color:C.textMid,fontStyle:'italic'}}>No deals match this filter.</div>
                )}
              </div>
            </div>

            {/* Sidebar — only in deals section */}
            {section === 'deals' && (
            <div className="sidebar" style={{display:'flex',flexDirection:'column',gap:18}}>
              <AdSlot slot="1122334455" format="vertical" style={{minHeight:250}}/>

              {/* Type breakdown - last 30 days */}
              <div style={{background:C.bgCard,border:`1px solid ${C.border}`}}>
                <div style={{borderBottom:`1px solid ${C.border}`,padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{width:3,height:12,background:'#f59e0b',display:'block'}}/>
                    <span style={{fontFamily:"var(--s)",fontSize:9,fontWeight:700,letterSpacing:'.14em',color:C.gold,textTransform:'uppercase'}}>Deal Breakdown</span>
                  </div>
                  <span style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid}}>Last 30 days</span>
                </div>
                {(() => {
                  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30);
                  const recent = deals.filter(d=>{
                    const p = d.deal_date ? new Date(d.deal_date) : new Date(d.date);
                    return !isNaN(p)&&p>=cutoff;
                  });
                  const src = recent.length > 0 ? recent : deals;
                  const counts = src.reduce((a,d)=>{a[d.type]=(a[d.type]||0)+1;return a},{});
                  const total = src.length||1;
                  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([type,count])=>{
                    const s=getStyle(type); const pct=Math.round((count/total)*100);
                    return (
                      <div key={type} style={{padding:'9px 16px',borderBottom:`1px solid ${C.bg}`}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                          <span style={{fontFamily:"var(--s)",fontSize:11,color:C.textBody}}>{type}</span>
                          <span style={{fontFamily:"var(--s)",fontSize:11,color:s.accent,fontWeight:700}}>{count}</span>
                        </div>
                        <div style={{height:2,background:C.border,borderRadius:1}}>
                          <div style={{height:'100%',width:`${pct}%`,background:s.accent,borderRadius:1}}/>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Top 5 by value */}
              <div style={{background:C.bgCard,border:`1px solid ${C.border}`}}>
                <div style={{borderBottom:`1px solid ${C.border}`,padding:'10px 16px',display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{width:3,height:12,background:'#22c55e',display:'block'}}/>
                  <span style={{fontFamily:"var(--s)",fontSize:9,fontWeight:700,letterSpacing:'.14em',color:C.gold,textTransform:'uppercase'}}>Top by Value</span>
                </div>
                {[...deals].sort((a,b)=>Number(b.value||0)-Number(a.value||0)).slice(0,5).map((d,i)=>(
                  <div key={d.id} onClick={()=>setSelected(d)} style={{padding:'11px 16px',borderBottom:`1px solid ${C.bg}`,cursor:'pointer'}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.bgHover} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                      <span style={{fontFamily:"var(--d)",fontSize:16,color:C.border,fontWeight:700,lineHeight:1.1,flexShrink:0}}>0{i+1}</span>
                      <div>
                        <div style={{fontFamily:"var(--s)",fontSize:11,color:C.textHi,fontWeight:600,lineHeight:1.3}}>{d.buyer}</div>
                        <div style={{fontFamily:"var(--s)",fontSize:10,color:C.textMid,marginTop:1}}>{d.target}</div>
                        <div style={{fontFamily:"var(--d)",fontSize:14,fontWeight:700,color:d.accent,marginTop:3}}>{fmt(d.value,curSym(d.currency))}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>

          <AdSlot slot="3344556677" format="horizontal" style={{maxWidth:728,margin:'8px auto 36px'}} />
        </div>
        <div style={{borderTop:`3px double ${C.border}`,background:C.bgCard,padding:'16px 24px',textAlign:'center'}}>
          <div style={{fontFamily:"var(--d)",fontSize:18,color:C.border,letterSpacing:'.15em'}}>MERIDIAN</div>
          <div style={{fontFamily:"var(--s)",fontSize:9,color:C.textLo,marginTop:3,letterSpacing:'.06em'}}>
            M&A · LEVFIN · PROJECT FINANCE · RESTRUCTURING · ECM
          </div>
          <div style={{marginTop:10}}>
            <a href="/wrap" style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,textDecoration:'none',letterSpacing:'.06em',marginRight:16}}>The Wrap</a><a href="/analysis" style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,textDecoration:'none',letterSpacing:'.06em',marginRight:16}}>Analysis</a><a href="/rankings" style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,textDecoration:'none',letterSpacing:'.06em',marginRight:16}}>Rankings</a><a href="/learn" style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,textDecoration:'none',letterSpacing:'.06em'}}>Learn</a>
          </div>
          <div style={{marginTop:6,fontFamily:"var(--s)",fontSize:9,letterSpacing:'.06em',lineHeight:1.9}}>
            <a href="/sector/tmt" style={{color:C.textLo,textDecoration:'none',marginRight:12}}>TMT</a><a href="/sector/healthcare" style={{color:C.textLo,textDecoration:'none',marginRight:12}}>Healthcare</a><a href="/sector/energy-renewables" style={{color:C.textLo,textDecoration:'none',marginRight:12}}>Energy</a><a href="/sector/financial-services" style={{color:C.textLo,textDecoration:'none',marginRight:12}}>Financial Services</a><a href="/sector/industrials" style={{color:C.textLo,textDecoration:'none',marginRight:12}}>Industrials</a><a href="/sector/consumer" style={{color:C.textLo,textDecoration:'none',marginRight:12}}>Consumer</a><a href="/sector/real-estate" style={{color:C.textLo,textDecoration:'none',marginRight:12}}>Real Estate</a><a href="/sector/infrastructure" style={{color:C.textLo,textDecoration:'none'}}>Infrastructure</a>
          </div>
          <div style={{marginTop:8}}>
            <a href="/about" style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,textDecoration:'none',letterSpacing:'.06em',marginRight:16}}>About</a><a href="/contact" style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,textDecoration:'none',letterSpacing:'.06em',marginRight:16}}>Contact</a><a href="/privacidad" style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,textDecoration:'none',letterSpacing:'.06em'}}>Política de privacidad</a>
          </div>
        </div>

        {selected && <DealModal deal={selected} mode={mode} onClose={()=>setSelected(null)}/>}
      </div>
      </>
    </ThemeContext.Provider>
  );
}

// Server-render the latest deals into the initial HTML so Google / AdSense see real
// content (not just the loading shell) on the page that carries ads.
export async function getServerSideProps() {
  let initialDeals = [];
  try {
    const r = await fetch('https://www.meridiancapmarkets.com/api/deals?limit=60');
    if (r.ok) { const j = await r.json(); initialDeals = j.deals || []; }
  } catch (e) {}
  return { props: { initialDeals } };
}
