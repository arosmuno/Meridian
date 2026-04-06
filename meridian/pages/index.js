import { useState, useEffect, useCallback } from 'react';
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
  'Default':         { accent: '#c9b99a', bg: '#0d0b07' },
};
const STATUS_STYLE = {
  Closed:   { bg: '#041b0d', color: '#4ade80', border: '#15532e' },
  Signed:   { bg: '#080f25', color: '#60a5fa', border: '#1e3a6e' },
  Rumoured: { bg: '#1a1003', color: '#fbbf24', border: '#78350f' },
  Breaking: { bg: '#200610', color: '#f87171', border: '#7f1d1d' },
};
const KICKER_MAP = {
  'M&A':'STRATEGIC M&A','LBO':'LEVERAGED BUYOUT','LevFin':'LEVFIN',
  'Project Finance':'PROJECT FINANCE','ECM':'EQUITY CAPITAL MARKETS',
  'Restructuring':'RESTRUCTURING','Debt Advisory':'DEBT ADVISORY',
};
const getStyle = t => TYPE_STYLE[t] || TYPE_STYLE['Default'];
const curSym = c => c === 'USD' ? '$' : c === 'GBP' ? '£' : '€';
const fmt = (n, c='€') => { const v=Number(n); if(!v) return 'N/A'; return v>=1000?`${c}${(v/1000).toFixed(1)}Bn`:`${c}${v}M`; };
const enrich = (d, i) => ({ ...d, id:i+1, ...getStyle(d.type), kicker: KICKER_MAP[d.type]||d.type?.toUpperCase()||'DEAL' });

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
    <span style={{background:s.bg,color:s.color,border:`1px solid ${s.border}`,padding:'2px 7px',fontSize:10,fontWeight:700,letterSpacing:'.1em',fontFamily:"var(--s)",textTransform:'uppercase',whiteSpace:'nowrap'}}>
      {status==='Breaking'?'⬤ ':''}{status}
    </span>
  );
}

function ModeTag({ mode }) {
  const cfg = SOURCE_MODE[mode] || SOURCE_MODE.archive;
  return (
    <span style={{fontFamily:"var(--s)",fontSize:9,fontWeight:700,letterSpacing:'.1em',color:cfg.color,border:`1px solid ${cfg.color}44`,padding:'1px 6px',textTransform:'uppercase'}}>
      {cfg.label}
    </span>
  );
}

function HeroDeal({ deal, onClick }) {
  const c = curSym(deal.currency);
  return (
    <div onClick={()=>onClick(deal)} style={{background:deal.bg,borderBottom:`4px solid ${deal.accent}`,padding:'44px 48px 38px',cursor:'pointer',position:'relative',overflow:'hidden'}}
      onMouseEnter={e=>e.currentTarget.style.opacity='.93'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
      <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse at 80% 0%,${deal.accent}12 0%,transparent 60%)`,pointerEvents:'none'}}/>
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:14,flexWrap:'wrap'}}>
        <span style={{fontFamily:"var(--s)",fontSize:10,fontWeight:800,letterSpacing:'.2em',color:deal.accent}}>{deal.kicker}</span>
        <StatusBadge status={deal.status}/>
      </div>
      <h2 style={{fontFamily:"var(--d)",fontSize:'clamp(24px,3vw,42px)',fontWeight:800,color:'#f7f2e8',lineHeight:1.15,margin:'0 0 16px',maxWidth:700}}>{deal.headline}</h2>
      <p style={{fontFamily:"var(--r)",fontSize:15,color:'#7a6b52',lineHeight:1.72,maxWidth:600,margin:'0 0 26px'}}>{deal.summary}</p>
      <div style={{display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}>
        <div>
          <div style={{fontFamily:"var(--s)",fontSize:9,color:'#4a3a25',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:2}}>VALUE</div>
          <div style={{fontFamily:"var(--d)",fontSize:28,fontWeight:800,color:deal.accent}}>{fmt(deal.value,c)}</div>
        </div>
        {[{l:'Type',v:deal.type},{l:'Sector',v:deal.sector},{l:'Source',v:deal.source}].map((m,i)=>[
          <div key={`d${i}`} style={{width:1,height:36,background:'#2a2218'}}/>,
          <div key={m.l}><div style={{fontFamily:"var(--s)",fontSize:9,color:'#4a3a25',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:2}}>{m.l}</div><div style={{fontFamily:"var(--s)",fontSize:13,fontWeight:500,color:'#c9b99a'}}>{m.v||'—'}</div></div>
        ])}
        <span style={{marginLeft:'auto',fontFamily:"var(--s)",fontSize:11,color:deal.accent,fontWeight:700,letterSpacing:'.06em',borderBottom:`1px solid ${deal.accent}`}}>READ FULL DEAL →</span>
      </div>
    </div>
  );
}

function DealCard({ deal, onClick }) {
  const c = curSym(deal.currency);
  return (
    <div className="card" onClick={()=>onClick(deal)}>
      <div style={{height:3,background:deal.accent}}/>
      <div style={{padding:'16px 20px',flexGrow:1,display:'flex',flexDirection:'column',gap:9}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
          <span style={{fontFamily:"var(--s)",fontSize:9,fontWeight:700,letterSpacing:'.14em',color:deal.accent,textTransform:'uppercase'}}>{deal.kicker}</span>
          <StatusBadge status={deal.status}/>
        </div>
        <h3 style={{fontFamily:"var(--d)",fontSize:16,fontWeight:700,color:'#f7f2e8',lineHeight:1.3,margin:0}}>{deal.headline}</h3>
        <p style={{fontFamily:"var(--r)",fontSize:12,color:'#5a4e38',lineHeight:1.65,margin:0,flexGrow:1}}>{(deal.summary||'').slice(0,150)}{(deal.summary||'').length>150?'…':''}</p>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',paddingTop:10,borderTop:'1px solid #160e08'}}>
          <div>
            <div style={{fontFamily:"var(--s)",fontSize:9,color:'#3a2e20'}}>VALUE</div>
            <div style={{fontFamily:"var(--d)",fontSize:18,fontWeight:700,color:deal.accent}}>{fmt(deal.value,c)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:"var(--s)",fontSize:10,color:'#4a3a25'}}>{deal.date}</div>
            <div style={{fontFamily:"var(--s)",fontSize:10,color:'#3a2e20',marginTop:2}}>{deal.sector}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DealModal({ deal, mode, onClose }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const c = curSym(deal.currency);

  const runAnalysis = async () => {
    setLoading(true); setAnalysis('');
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal }),
      });
      const data = await res.json();
      setAnalysis(data.analysis || 'Unavailable.');
    } catch { setAnalysis('Analysis could not be generated.'); }
    setLoading(false);
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(4,2,6,.92)',zIndex:200,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'28px 16px',backdropFilter:'blur(4px)'}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#0a0808',border:'1px solid #2a2218',maxWidth:780,width:'100%'}}>
        <div style={{background:deal.bg,borderBottom:`3px solid ${deal.accent}`,padding:'32px 40px 28px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontFamily:"var(--s)",fontSize:10,fontWeight:800,letterSpacing:'.2em',color:deal.accent}}>{deal.kicker}</span>
              <StatusBadge status={deal.status}/><ModeTag mode={mode}/>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',color:'#5a4e38',cursor:'pointer',fontSize:22,lineHeight:1,paddingLeft:16}}>×</button>
          </div>
          <h1 style={{fontFamily:"var(--d)",fontSize:'clamp(20px,2.6vw,30px)',fontWeight:800,color:'#f7f2e8',lineHeight:1.2,margin:0}}>{deal.headline}</h1>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',borderBottom:'1px solid #1a1610'}}>
          {[{l:'Value',v:fmt(deal.value,c),big:true},{l:'Type',v:deal.type},{l:'Sector',v:deal.sector},{l:'Buyer',v:deal.buyer},{l:'Target',v:deal.target},{l:'Date',v:deal.date}].map((m,i)=>(
            <div key={i} style={{padding:'13px 20px',borderRight:i%3!==2?'1px solid #1a1610':'none',borderBottom:i<3?'1px solid #1a1610':'none'}}>
              <div style={{fontFamily:"var(--s)",fontSize:9,letterSpacing:'.1em',color:'#3a2e20',marginBottom:4,textTransform:'uppercase'}}>{m.l}</div>
              <div style={{fontFamily:m.big?"var(--d)":"var(--s)",fontSize:m.big?22:12,fontWeight:m.big?700:500,color:m.big?deal.accent:'#c9b99a'}}>{m.v||'N/A'}</div>
            </div>
          ))}
        </div>
        <div style={{padding:'26px 40px'}}>
          <p style={{fontFamily:"var(--r)",fontSize:15,color:'#b0a080',lineHeight:1.85,marginBottom:20}}>{deal.summary}</p>
          {deal.advisor&&<div style={{paddingTop:12,borderTop:'1px solid #1a1610',marginBottom:22}}>
            <div style={{fontFamily:"var(--s)",fontSize:9,letterSpacing:'.1em',color:'#3a2e20',marginBottom:5,textTransform:'uppercase'}}>Advisors</div>
            <div style={{fontFamily:"var(--s)",fontSize:12,color:'#5a4e38'}}>{deal.advisor}</div>
          </div>}
          {/* Ad inside modal */}
          <AdSlot slot="3456789012" style={{ marginBottom: 20 }} />
          <div style={{background:'#0d0a06',border:'1px solid #2a2218',padding:'20px 24px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:analysis||loading?14:0}}>
              <div style={{fontFamily:"var(--s)",fontSize:10,fontWeight:700,letterSpacing:'.14em',color:deal.accent}}>✦ MERIDIAN ANALYSIS</div>
              {!analysis&&!loading&&<button onClick={runAnalysis} style={{background:deal.accent,color:'#08050a',border:'none',padding:'6px 14px',fontFamily:"var(--s)",fontSize:11,fontWeight:700,cursor:'pointer',letterSpacing:'.08em'}}>GENERATE</button>}
            </div>
            {loading&&<div style={{fontFamily:"var(--r)",fontSize:13,color:'#4a3a25',fontStyle:'italic'}}>Drafting editorial analysis…</div>}
            {analysis&&<p style={{fontFamily:"var(--r)",fontSize:14,color:'#b0a080',lineHeight:1.85,margin:0}}>{analysis}</p>}
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
  const [selected, setSelected] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deals');
      const data = await res.json();
      setDeals((data.deals || []).map(enrich));
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
  const hero = deals[0];
  const rest = deals.slice(1).filter(d => filter==='All' || d.type===filter);
  const totalVol = deals.reduce((s,d)=>s+Number(d.value||0),0);

  if (loading) {
    return (
      <div style={{minHeight:'100vh',background:'#08050a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24}}>
        <div style={{fontFamily:"var(--s)",fontSize:9,letterSpacing:'.3em',color:'#3a2e20'}}>THE CAPITAL MARKETS INTELLIGENCE REVIEW</div>
        <div style={{fontFamily:"var(--d)",fontSize:72,fontWeight:800,color:'#f7f2e8',letterSpacing:'-.02em'}}>MERIDIAN</div>
        <div style={{fontFamily:"var(--s)",fontSize:11,color:'#4a3a25',letterSpacing:'.1em'}}>LOADING INTELLIGENCE…</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>MERIDIAN — M&A & Capital Markets Intelligence</title>
      </Head>

      <div style={{background:'#08050a',minHeight:'100vh'}}>
        {/* MASTHEAD */}
        <div style={{background:'#0a0808',borderBottom:'3px double #3a2e20'}}>
          <div style={{borderBottom:'1px solid #160e08',padding:'5px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
            <span style={{fontFamily:"var(--s)",fontSize:10,color:'#3a2e20',letterSpacing:'.08em'}}>
              {new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase()}
            </span>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <ModeTag mode={mode}/>
              <span style={{fontFamily:"var(--s)",fontSize:10,color:'#4a3a25'}}>{deals.length} deals · {fmt(totalVol)}</span>
            </div>
            <button onClick={loadDeals} style={{background:'none',border:'1px solid #2a2218',color:'#4a3a25',padding:'3px 10px',fontFamily:"var(--s)",fontSize:10,cursor:'pointer',letterSpacing:'.06em'}}>
              ↻ REFRESH
            </button>
          </div>

          <div style={{textAlign:'center',padding:'22px 24px 16px',borderBottom:'1px solid #160e08'}}>
            <div style={{fontFamily:"var(--s)",fontSize:9,letterSpacing:'.35em',color:'#3a2e20',marginBottom:8}}>✦ &nbsp; THE CAPITAL MARKETS INTELLIGENCE REVIEW &nbsp; ✦</div>
            <h1 style={{fontFamily:"var(--d)",fontSize:'clamp(44px,7vw,80px)',fontWeight:800,color:'#f7f2e8',letterSpacing:'-.02em',lineHeight:1,margin:'0 0 6px'}}>MERIDIAN</h1>
            <p style={{fontFamily:"var(--r)",fontSize:11,color:'#3a2e20',fontStyle:'italic'}}>Deals. Capital. Strategy.</p>
          </div>

          {/* Ad banner — leaderboard */}
          <div style={{padding:'8px 24px',borderBottom:'1px solid #160e08',background:'#0d0a06'}}>
            <AdSlot slot="1234567890" format="horizontal" style={{maxWidth:728,margin:'0 auto'}} />
          </div>

          {/* Ticker */}
          <div style={{display:'flex',borderTop:'1px solid #160e08'}}>
            <div style={{background:'#e63946',padding:'5px 12px',flexShrink:0,display:'flex',alignItems:'center'}}>
              <span style={{fontFamily:"var(--s)",fontSize:9,fontWeight:800,letterSpacing:'.1em',color:'#fff'}}>LIVE</span>
            </div>
            <div className="ticker-wrap" style={{flex:1,padding:'5px 14px'}}>
              <div className="ticker-inner">
                {[...deals,...deals].map((d,i)=>(
                  <span key={i} style={{fontFamily:"var(--s)",fontSize:10,color:'#5a4e38',marginRight:32}}>
                    <span style={{color:'#c9b99a',fontWeight:600}}>{d.buyer}</span>
                    {' → '}<span style={{color:'#8b7355'}}>{d.target}</span>
                    {' '}<span style={{color:d.accent,fontWeight:700}}>{fmt(d.value,curSym(d.currency))}</span>
                    <span style={{color:'#2a2218',margin:'0 12px'}}>❙</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px'}}>
          {hero && <div style={{margin:'0 -20px'}}><HeroDeal deal={hero} onClick={setSelected}/></div>}

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 0 12px',borderBottom:'2px solid #1a1610',flexWrap:'wrap',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:3,height:16,background:'#c9b99a',display:'block'}}/>
              <span style={{fontFamily:"var(--s)",fontSize:10,fontWeight:700,letterSpacing:'.14em',color:'#c9b99a',textTransform:'uppercase'}}>Latest Deals</span>
              {lastUpdated && <span style={{fontFamily:"var(--s)",fontSize:9,color:'#3a2e20'}}>Updated {lastUpdated.toLocaleTimeString('en-GB')}</span>}
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {types.map(t=><button key={t} className={`pill ${filter===t?'active':''}`} onClick={()=>setFilter(t)}>{t}</button>)}
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:24,padding:'18px 0 48px',alignItems:'start'}}>
            <div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {rest.map((d,i) => [
                  <DealCard key={d.id} deal={d} onClick={setSelected}/>,
                  // Ad every 4 cards
                  i > 0 && i % 4 === 3 && (
                    <div key={`ad-${i}`} style={{gridColumn:'1/-1'}}>
                      <AdSlot slot="9876543210" format="fluid" />
                    </div>
                  )
                ])}
              </div>
            </div>

            {/* Sidebar */}
            <div style={{display:'flex',flexDirection:'column',gap:18}}>
              {/* Sidebar ad */}
              <AdSlot slot="1122334455" format="vertical" style={{minHeight:250}}/>

              {/* Type breakdown */}
              <div style={{background:'#0a0808',border:'1px solid #1a1610'}}>
                <div style={{borderBottom:'1px solid #1a1610',padding:'10px 16px',display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{width:3,height:12,background:'#f59e0b',display:'block'}}/>
                  <span style={{fontFamily:"var(--s)",fontSize:9,fontWeight:700,letterSpacing:'.14em',color:'#c9b99a',textTransform:'uppercase'}}>Deal Breakdown</span>
                </div>
                {Object.entries(deals.reduce((a,d)=>{a[d.type]=(a[d.type]||0)+1;return a},{})).sort((a,b)=>b[1]-a[1]).map(([type,count])=>{
                  const s=getStyle(type); const pct=Math.round((count/deals.length)*100);
                  return (
                    <div key={type} style={{padding:'9px 16px',borderBottom:'1px solid #0e0a08'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                        <span style={{fontFamily:"var(--s)",fontSize:11,color:'#6b5e45'}}>{type}</span>
                        <span style={{fontFamily:"var(--s)",fontSize:11,color:s.accent,fontWeight:600}}>{count}</span>
                      </div>
                      <div style={{height:2,background:'#1a1610',borderRadius:1}}>
                        <div style={{height:'100%',width:`${pct}%`,background:s.accent,borderRadius:1}}/>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top 5 by value */}
              <div style={{background:'#0a0808',border:'1px solid #1a1610'}}>
                <div style={{borderBottom:'1px solid #1a1610',padding:'10px 16px',display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{width:3,height:12,background:'#22c55e',display:'block'}}/>
                  <span style={{fontFamily:"var(--s)",fontSize:9,fontWeight:700,letterSpacing:'.14em',color:'#c9b99a',textTransform:'uppercase'}}>Top by Value</span>
                </div>
                {[...deals].sort((a,b)=>Number(b.value||0)-Number(a.value||0)).slice(0,5).map((d,i)=>(
                  <div key={d.id} onClick={()=>setSelected(d)} style={{padding:'11px 16px',borderBottom:'1px solid #0e0a08',cursor:'pointer',transition:'background .1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#110e08'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                      <span style={{fontFamily:"var(--d)",fontSize:16,color:'#2a2218',fontWeight:700,lineHeight:1.1,flexShrink:0}}>0{i+1}</span>
                      <div>
                        <div style={{fontFamily:"var(--s)",fontSize:11,color:'#b0a080',fontWeight:600,lineHeight:1.3}}>{d.buyer}</div>
                        <div style={{fontFamily:"var(--s)",fontSize:10,color:'#3a2e20',marginTop:1}}>{d.target}</div>
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
        <div style={{borderTop:'3px double #1a1610',background:'#0a0808',padding:'16px 24px',textAlign:'center'}}>
          <div style={{fontFamily:"var(--d)",fontSize:16,color:'#2a2218',letterSpacing:'.15em'}}>MERIDIAN</div>
          <div style={{fontFamily:"var(--s)",fontSize:9,color:'#1a1610',marginTop:3,letterSpacing:'.06em'}}>
            M&A · LEVFIN · PROJECT FINANCE · RESTRUCTURING · ECM
          </div>
        </div>

        {selected && <DealModal deal={selected} mode={mode} onClose={()=>setSelected(null)}/>}
      </div>
    </>
  );
}
