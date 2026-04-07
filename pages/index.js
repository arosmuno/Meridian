import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import Head from 'next/head';
import AdSlot from '../components/AdSlot';

// ── TRANSLATIONS ──────────────────────────────────────────────────────────────
const T = {
  en: {
    tagline: 'Deals. Capital. Strategy.',
    latestDeals: 'Latest Deals',
    updated: 'Updated',
    refresh: '↻ REFRESH',
    dealBreakdown: 'DEAL BREAKDOWN',
    last30: 'Last 30 days',
    topByValue: 'TOP BY VALUE',
    readFull: 'READ FULL DEAL →',
    value: 'VALUE', type: 'TYPE', sector: 'SECTOR', source: 'SOURCE',
    buyer: 'BUYER', target: 'TARGET', date: 'DATE', advisors: 'ADVISORS',
    analysis: '✦ MERIDIAN ANALYSIS',
    generate: 'GENERATE',
    generating: 'Drafting editorial analysis…',
    translate: 'Translate:',
    region: 'REGION', sectorLabel: 'SECTOR',
    noDeals: 'No deals match this filter.',
    loading: 'LOADING INTELLIGENCE…',
    all: 'ALL',
    langName: 'English',
  },
  es: {
    tagline: 'Operaciones. Capital. Estrategia.',
    latestDeals: 'Últimas Operaciones',
    updated: 'Actualizado',
    refresh: '↻ ACTUALIZAR',
    dealBreakdown: 'DESGLOSE DE OPERACIONES',
    last30: 'Últimos 30 días',
    topByValue: 'TOP POR VALOR',
    readFull: 'VER OPERACIÓN COMPLETA →',
    value: 'VALOR', type: 'TIPO', sector: 'SECTOR', source: 'FUENTE',
    buyer: 'COMPRADOR', target: 'OBJETIVO', date: 'FECHA', advisors: 'ASESORES',
    analysis: '✦ ANÁLISIS MERIDIAN',
    generate: 'GENERAR',
    generating: 'Redactando análisis editorial…',
    translate: 'Traducir:',
    region: 'REGIÓN', sectorLabel: 'SECTOR',
    noDeals: 'No hay operaciones que coincidan con este filtro.',
    loading: 'CARGANDO INTELIGENCIA…',
    all: 'TODOS',
    langName: 'Español',
  },
  fr: {
    tagline: 'Opérations. Capital. Stratégie.',
    latestDeals: 'Dernières Opérations',
    updated: 'Mis à jour',
    refresh: '↻ ACTUALISER',
    dealBreakdown: 'RÉPARTITION DES OPÉRATIONS',
    last30: '30 derniers jours',
    topByValue: 'TOP PAR VALEUR',
    readFull: 'LIRE L\'OPÉRATION COMPLÈTE →',
    value: 'VALEUR', type: 'TYPE', sector: 'SECTEUR', source: 'SOURCE',
    buyer: 'ACHETEUR', target: 'CIBLE', date: 'DATE', advisors: 'CONSEILLERS',
    analysis: '✦ ANALYSE MERIDIAN',
    generate: 'GÉNÉRER',
    generating: 'Rédaction de l\'analyse éditoriale…',
    translate: 'Traduire:',
    region: 'RÉGION', sectorLabel: 'SECTEUR',
    noDeals: 'Aucune opération ne correspond à ce filtre.',
    loading: 'CHARGEMENT EN COURS…',
    all: 'TOUS',
    langName: 'Français',
  },
  de: {
    tagline: 'Deals. Kapital. Strategie.',
    latestDeals: 'Neueste Transaktionen',
    updated: 'Aktualisiert',
    refresh: '↻ AKTUALISIEREN',
    dealBreakdown: 'DEAL-AUFSCHLÜSSELUNG',
    last30: 'Letzte 30 Tage',
    topByValue: 'TOP NACH WERT',
    readFull: 'VOLLSTÄNDIGEN DEAL LESEN →',
    value: 'WERT', type: 'TYP', sector: 'SEKTOR', source: 'QUELLE',
    buyer: 'KÄUFER', target: 'ZIEL', date: 'DATUM', advisors: 'BERATER',
    analysis: '✦ MERIDIAN ANALYSE',
    generate: 'GENERIEREN',
    generating: 'Redaktionelle Analyse wird erstellt…',
    translate: 'Übersetzen:',
    region: 'REGION', sectorLabel: 'SEKTOR',
    noDeals: 'Keine Deals entsprechen diesem Filter.',
    loading: 'INTELLIGENCE WIRD GELADEN…',
    all: 'ALLE',
    langName: 'Deutsch',
  },
};

const LANG_FULL = { en: 'English', es: 'Spanish', fr: 'French', de: 'German' };

// Global language context
const LangContext = createContext('en');
const useLang = () => useContext(LangContext);

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
const enrich = (d, i) => ({ ...d, id:i+1, ...getStyle(d.type), kicker: KICKER_MAP[d.type]||d.type?.toUpperCase()||'DEAL' });

// High-contrast color tokens (match globals.css)
const C = {
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
};

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
  const c = curSym(deal.currency);
  return (
    <div onClick={()=>onClick(deal)} style={{background:deal.bg,borderBottom:`4px solid ${deal.accent}`,padding:'44px 48px 38px',cursor:'pointer',position:'relative',overflow:'hidden'}}
      onMouseEnter={e=>e.currentTarget.style.opacity='.93'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
      <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse at 80% 0%,${deal.accent}18 0%,transparent 60%)`,pointerEvents:'none'}}/>
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:14,flexWrap:'wrap'}}>
        <span style={{fontFamily:"var(--s)",fontSize:10,fontWeight:800,letterSpacing:'.2em',color:deal.accent}}>{deal.kicker}</span>
        <StatusBadge status={deal.status}/>
      </div>
      <h2 style={{fontFamily:"var(--d)",fontSize:'clamp(24px,3vw,42px)',fontWeight:800,color:C.textHi,lineHeight:1.15,margin:'0 0 16px',maxWidth:700}}>{deal.headline}</h2>
      <p style={{fontFamily:"var(--r)",fontSize:16,color:C.textBody,lineHeight:1.75,maxWidth:620,margin:'0 0 26px'}}>{deal.summary}</p>
      <div style={{display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}>
        <div>
          <div style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:2}}>VALUE</div>
          <div style={{fontFamily:"var(--d)",fontSize:28,fontWeight:800,color:deal.accent}}>{fmt(deal.value,c)}</div>
        </div>
        {[{l:'Type',v:deal.type},{l:'Sector',v:deal.sector},{l:'Source',v:deal.source}].map((m,i)=>(
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

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const mins = Math.floor((now - date) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function DealCard({ deal, onClick }) {
  const c = curSym(deal.currency);
  return (
    <div className="card" onClick={()=>onClick(deal)}>
      <div style={{height:3,background:deal.accent}}/>
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
            <div style={{fontFamily:"var(--d)",fontSize:19,fontWeight:700,color:deal.accent}}>{fmt(deal.value,c)}</div>
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
  const lang = useLang();
  const t = T[lang];
  const [analysis, setAnalysis] = useState('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [translatedHeadline, setTranslatedHeadline] = useState(null);
  const [translatedSummary, setTranslatedSummary] = useState(null);
  const [translatingContent, setTranslatingContent] = useState(false);
  const c = curSym(deal.currency);

  // Auto-translate content when language is not English
  useEffect(() => {
    setAnalysis('');
    if (lang === 'en') {
      setTranslatedHeadline(null);
      setTranslatedSummary(null);
      return;
    }
    setTranslatingContent(true);
    // Translate headline + summary together, separated by |||
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `${deal.headline}\n|||\n${deal.summary}`, lang }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.translated) {
          const parts = d.translated.split('|||');
          setTranslatedHeadline(parts[0]?.trim() || null);
          setTranslatedSummary(parts[1]?.trim() || null);
        }
      })
      .catch(() => { setTranslatedHeadline(null); setTranslatedSummary(null); })
      .finally(() => setTranslatingContent(false));
  }, [lang, deal.headline]);

  const runAnalysis = async () => {
    setLoadingAnalysis(true); setAnalysis('');
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal, lang, langName: LANG_FULL[lang] }),
      });
      const data = await res.json();
      if (data.analysis) setAnalysis(data.analysis);
      else if (data.error) setAnalysis(`Error: ${data.error}`);
      else setAnalysis('Unavailable.');
    } catch (e) { setAnalysis(`Error: ${e.message}`); }
    setLoadingAnalysis(false);
  };

  const displaySummary = translatedSummary || deal.summary;

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(4,2,6,.92)',zIndex:200,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'28px 16px',backdropFilter:'blur(4px)'}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.bgCard,border:`1px solid ${C.border}`,maxWidth:780,width:'100%'}}>
        {/* Header */}
        <div style={{background:deal.bg,borderBottom:`3px solid ${deal.accent}`,padding:'32px 40px 28px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontFamily:"var(--s)",fontSize:10,fontWeight:800,letterSpacing:'.2em',color:deal.accent}}>{deal.kicker}</span>
              <StatusBadge status={deal.status}/>
              <ModeTag mode={mode}/>
              {deal.geography && <span style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,border:`1px solid ${C.border}`,padding:'1px 6px'}}>{deal.geography}</span>}
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',color:C.textMid,cursor:'pointer',fontSize:22,lineHeight:1,paddingLeft:16}}>×</button>
          </div>
          <h1 style={{fontFamily:"var(--d)",fontSize:'clamp(20px,2.6vw,30px)',fontWeight:800,color:C.textHi,lineHeight:1.2,margin:0}}>
            {translatingContent ? deal.headline : (translatedHeadline || deal.headline)}
          </h1>
        </div>

        {/* Metrics */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',borderBottom:`1px solid ${C.border}`}}>
          {[{l:t.value,v:fmt(deal.value,c),big:true},{l:t.type,v:deal.type},{l:t.sector,v:deal.sector},{l:t.buyer,v:deal.buyer},{l:t.target,v:deal.target},{l:t.date,v:deal.date}].map((m,i)=>(
            <div key={i} style={{padding:'13px 20px',borderRight:i%3!==2?`1px solid ${C.border}`:'none',borderBottom:i<3?`1px solid ${C.border}`:'none'}}>
              <div style={{fontFamily:"var(--s)",fontSize:9,letterSpacing:'.1em',color:C.textMid,marginBottom:4,textTransform:'uppercase'}}>{m.l}</div>
              <div style={{fontFamily:m.big?"var(--d)":"var(--s)",fontSize:m.big?22:13,fontWeight:m.big?700:500,color:m.big?deal.accent:C.textBody}}>{m.v||'N/A'}</div>
            </div>
          ))}
        </div>

        <div style={{padding:'26px 40px'}}>
          {/* Summary */}
          {translatingContent && <p style={{fontFamily:"var(--r)",fontSize:15,color:C.textMid,lineHeight:1.9,marginBottom:20,fontStyle:'italic'}}>Translating…</p>}
          {!translatingContent && <p style={{fontFamily:"var(--r)",fontSize:15,color:C.textBody,lineHeight:1.9,marginBottom:20}}>{displaySummary}</p>}

          {deal.advisor && (
            <div style={{paddingTop:12,borderTop:`1px solid ${C.border}`,marginBottom:22}}>
              <div style={{fontFamily:"var(--s)",fontSize:9,letterSpacing:'.1em',color:C.textMid,marginBottom:5,textTransform:'uppercase'}}>{t.advisors}</div>
              <div style={{fontFamily:"var(--s)",fontSize:12,color:C.textBody}}>{deal.advisor}</div>
            </div>
          )}

          <AdSlot slot="3456789012" style={{ marginBottom: 20 }} />

          {/* AI Analysis */}
          <div style={{background:C.bg,border:`1px solid ${C.border}`,padding:'20px 24px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:analysis||loadingAnalysis?14:0}}>
              <div style={{fontFamily:"var(--s)",fontSize:10,fontWeight:700,letterSpacing:'.14em',color:deal.accent}}>{t.analysis}</div>
              {!analysis&&!loadingAnalysis&&<button onClick={runAnalysis} style={{background:deal.accent,color:C.bg,border:'none',padding:'6px 14px',fontFamily:"var(--s)",fontSize:11,fontWeight:700,cursor:'pointer',letterSpacing:'.08em'}}>{t.generate}</button>}
            </div>
            {loadingAnalysis && <div style={{fontFamily:"var(--r)",fontSize:13,color:C.textMid,fontStyle:'italic'}}>{t.generating}</div>}
            {analysis && <p style={{fontFamily:"var(--r)",fontSize:14,color:C.textBody,lineHeight:1.9,margin:0}}>{analysis}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [deals, setDeals]     = useState([]);
  const [mode, setMode]       = useState('archive');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('All');
  const [geoFilter, setGeoFilter] = useState('All');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [lang, setLang]       = useState('en');

  const loadDeals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deals');
      const data = await res.json();
      const raw = (data.deals || []).map(enrich);

      // Sort: Breaking always first, then by real deal date (most recent first)
      const parseDate = (d) => {
        if (d.deal_date) return new Date(d.deal_date).getTime();
        if (d.date) { const p = new Date(d.date); return isNaN(p) ? 0 : p.getTime(); }
        return 0;
      };
      const breaking = raw.filter(d => d.status === 'Breaking').sort((a,b) => parseDate(b) - parseDate(a));
      const rest = raw.filter(d => d.status !== 'Breaking').sort((a,b) => parseDate(b) - parseDate(a));

      setDeals([...breaking, ...rest]);
      setMode(data.source || 'archive');
      setLastUpdated(data.last_updated ? new Date(data.last_updated) : new Date());
    } catch {
      setDeals([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  // Auto-refresh every 10 minutes on the frontend too
  useEffect(() => {
    const interval = setInterval(loadDeals, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadDeals]);

  const types = ['All', ...new Set(deals.map(d=>d.type).filter(Boolean))];
  const geos = ['All', 'Europe', 'North America', 'Asia Pacific', 'Latin America', 'Middle East & Africa', 'Global'];
  const sectors = ['All', 'Healthcare', 'TMT', 'Infrastructure', 'Energy & Renewables', 'Financial Services', 'Consumer', 'Industrials', 'Real Estate', 'Macro'];
  const hero = deals[0];

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

  const rest = deals.slice(1).filter(d =>
    (filter === 'All' || d.type === filter) &&
    matchGeo(d, geoFilter) &&
    matchSector(d, sectorFilter)
  );
  const totalVol = deals.reduce((s,d)=>s+Number(d.value||0),0);

  const t = T[lang];

  if (loading) {
    return (
      <div style={{minHeight:'100vh',background:'#08050a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24}}>
        <div style={{fontFamily:"var(--s)",fontSize:9,letterSpacing:'.3em',color:'#3a2e20'}}>THE CAPITAL MARKETS INTELLIGENCE REVIEW</div>
        <div style={{fontFamily:"var(--d)",fontSize:72,fontWeight:800,color:'#f7f2e8',letterSpacing:'-.02em'}}>MERIDIAN</div>
        <div style={{fontFamily:"var(--s)",fontSize:11,color:'#4a3a25',letterSpacing:'.1em'}}>{t.loading}</div>
      </div>
    );
  }

  return (
    <LangContext.Provider value={lang}>
      <>
      <Head>
        <title>MERIDIAN — M&A & Capital Markets Intelligence</title>
      </Head>

      <div style={{background:'#08050a',minHeight:'100vh'}}>
        {/* MASTHEAD */}
        <div style={{background:C.bgCard,borderBottom:`3px double ${C.border}`}}>
          <div style={{borderBottom:`1px solid ${C.border}`,padding:'6px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
            <span style={{fontFamily:"var(--s)",fontSize:10,color:C.textMid,letterSpacing:'.08em'}}>
              {new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase()}
            </span>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <ModeTag mode={mode}/>
              <span style={{fontFamily:"var(--s)",fontSize:10,color:C.textMid}}>{deals.length} deals · {fmt(totalVol)}</span>
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              {/* Language selector */}
              {['en','es','fr','de'].map(l=>(
                <button key={l} onClick={()=>setLang(l)}
                  style={{background:lang===l?C.gold:'transparent',color:lang===l?C.bg:C.textMid,border:`1px solid ${lang===l?C.gold:C.border}`,padding:'3px 9px',fontFamily:"var(--s)",fontSize:10,fontWeight:700,cursor:'pointer',letterSpacing:'.06em',transition:'all .15s',textTransform:'uppercase'}}>
                  {l}
                </button>
              ))}
              <div style={{width:1,height:14,background:C.border,margin:'0 4px'}}/>
              <button onClick={loadDeals} style={{background:'none',border:`1px solid ${C.border}`,color:C.textMid,padding:'3px 10px',fontFamily:"var(--s)",fontSize:10,cursor:'pointer',letterSpacing:'.06em',transition:'all .15s'}}
                onMouseEnter={e=>{e.target.style.color=C.gold;e.target.style.borderColor=C.gold}} onMouseLeave={e=>{e.target.style.color=C.textMid;e.target.style.borderColor=C.border}}>
                {t.refresh}
              </button>
            </div>
          </div>

          <div style={{textAlign:'center',padding:'24px 24px 18px',borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontFamily:"var(--s)",fontSize:9,letterSpacing:'.35em',color:C.textMid,marginBottom:8}}>✦ &nbsp; THE CAPITAL MARKETS INTELLIGENCE REVIEW &nbsp; ✦</div>
            <h1 style={{fontFamily:"var(--d)",fontSize:'clamp(44px,7vw,80px)',fontWeight:800,color:C.textHi,letterSpacing:'-.02em',lineHeight:1,margin:'0 0 6px'}}>MERIDIAN</h1>
            <p style={{fontFamily:"var(--r)",fontSize:12,color:C.textMid,fontStyle:'italic'}}>{t.tagline}</p>
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
                {[...deals,...deals].map((d,i)=>(
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
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px'}}>
          {hero && <div style={{margin:'0 -20px'}}><HeroDeal deal={hero} onClick={setSelected}/></div>}

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 0 10px',borderBottom:`1px solid ${C.border}`,flexWrap:'wrap',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:3,height:16,background:C.gold,display:'block'}}/>
              <span style={{fontFamily:"var(--s)",fontSize:10,fontWeight:700,letterSpacing:'.14em',color:C.gold,textTransform:'uppercase'}}>{t.latestDeals}</span>
              {lastUpdated && <span style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid}}>{t.updated} {lastUpdated.toLocaleTimeString('en-GB')}</span>}
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {types.map(tp=><button key={tp} className={`pill ${filter===tp?'active':''}`} onClick={()=>setFilter(tp)}>{tp === 'All' ? t.all : tp}</button>)}
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 0 10px',borderBottom:`1px solid ${C.border}`,flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,letterSpacing:'.1em',textTransform:'uppercase',minWidth:50}}>{t.region}</span>
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {geos.map(g=><button key={g} className={`pill ${geoFilter===g?'active':''}`} onClick={()=>setGeoFilter(g)}>{g === 'All' ? t.all : g}</button>)}
              </div>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0 16px',borderBottom:`2px solid ${C.border}`,flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontFamily:"var(--s)",fontSize:9,color:C.textMid,letterSpacing:'.1em',textTransform:'uppercase',minWidth:50}}>{t.sectorLabel}</span>
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {sectors.map(sc=><button key={sc} className={`pill ${sectorFilter===sc?'active':''}`} onClick={()=>setSectorFilter(sc)}>{sc === 'All' ? t.all : sc}</button>)}
              </div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:24,padding:'18px 0 48px',alignItems:'start'}}>
            <div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {rest.map((d,i) => (
                  <DealCard key={d.id} deal={d} onClick={setSelected}/>
                ))}
                {rest.length === 0 && (
                  <div style={{gridColumn:'1/-1',textAlign:'center',padding:'60px 0',fontFamily:"var(--r)",color:'#3a2e20',fontStyle:'italic'}}>{t.noDeals}</div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div style={{display:'flex',flexDirection:'column',gap:18}}>
              {/* Sidebar ad */}
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
                  <span style={{fontFamily:"var(--s)",fontSize:9,fontWeight:700,letterSpacing:'.14em',color:C.gold,textTransform:'uppercase'}}>{t.topByValue}</span>
                </div>
                {[...deals].sort((a,b)=>Number(b.value||0)-Number(a.value||0)).slice(0,5).map((d,i)=>(
                  <div key={d.id} onClick={()=>setSelected(d)} style={{padding:'11px 16px',borderBottom:`1px solid ${C.bg}`,cursor:'pointer',transition:'background .1s'}}
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
          </div>
        </div>

        {/* Footer */}
        <div style={{borderTop:`3px double ${C.border}`,background:C.bgCard,padding:'16px 24px',textAlign:'center'}}>
          <div style={{fontFamily:"var(--d)",fontSize:18,color:C.border,letterSpacing:'.15em'}}>MERIDIAN</div>
          <div style={{fontFamily:"var(--s)",fontSize:9,color:C.textLo,marginTop:3,letterSpacing:'.06em'}}>
            M&A · LEVFIN · PROJECT FINANCE · RESTRUCTURING · ECM
          </div>
        </div>

        {selected && <DealModal deal={selected} mode={mode} onClose={()=>setSelected(null)}/>}
      </div>
      </>
    </LangContext.Provider>
  );
}
