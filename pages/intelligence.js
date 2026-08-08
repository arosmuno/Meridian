import { useState } from 'react';
import Head from 'next/head';
import Layout, { PageHero } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { dedupeDeals } from '../lib/dedupe';

const MARKET_TYPES = ['Macro', 'Earnings', 'Markets'];
const isNA = (s) => !s || /^n\/?a$/i.test(String(s).trim());
const sym = (c) => (c === 'USD' ? '$' : c === 'GBP' ? '£' : '€');

function fmt(v, c) {
  const n = Number(v);
  if (!n) return '—';
  return n >= 1000 ? sym(c) + (n / 1000).toFixed(1) + 'bn' : sym(c) + Math.round(n) + 'm';
}

function fmtDate(d) {
  if (!d) return '';
  const p = new Date(d);
  if (isNaN(p)) return '';
  return p.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// The record is published in English only. Anything the pipeline failed to
// translate is withheld rather than shown half-translated.
const looksSpanish = (h) => /[ñ¿¡]/.test(h || '')
  || /\b(millones|adquiere|compra|deuda|crédito|préstamo|fusión|ampliación|accionista|española?|empresa|negocio|bolsa|beneficio|salida a bolsa|puja|retrasa|colocar|inversión|acuerdo|venta)\b/i.test(h || '');

export async function getServerSideProps(ctx) {
  try { ctx.res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900'); } catch (e) {}
  let rows = [];
  try {
    const { data } = await supabase
      .from('deals')
      .select('id,headline,summary,buyer,target,value,currency,type,sector,geography,status,date,deal_date,source,source_url,category')
      .order('deal_date', { ascending: false, nullsFirst: false })
      .order('fetched_at', { ascending: false })
      .limit(160);
    rows = data || [];
  } catch (e) {}

  const clean = rows
    .filter((d) => d.headline && d.source_url && !looksSpanish(d.headline))
    .map((d) => ({
      id: d.id,
      headline: d.headline,
      summary: d.summary || '',
      buyer: isNA(d.buyer) ? '' : d.buyer,
      target: isNA(d.target) ? '' : d.target,
      value: MARKET_TYPES.includes(d.type) || d.category === 'macro' ? 0 : Number(d.value) || 0,
      currency: d.currency || 'EUR',
      type: d.type || 'M&A',
      sector: d.sector || '',
      status: d.status || '',
      date: fmtDate(d.deal_date) || d.date || '',
      source: d.source || '',
      source_url: d.source_url,
    }));

  return { props: { deals: dedupeDeals(clean) } };
}

export default function Intelligence({ deals }) {
  const [filter, setFilter] = useState('All');
  const [open, setOpen] = useState(null);

  const types = ['All', ...Array.from(new Set(deals.map((d) => d.type).filter(Boolean)))];
  const shown = filter === 'All' ? deals : deals.filter((d) => d.type === filter);

  return (
    <>
      <Head>
        <title>Market Intelligence &mdash; European deal record | Meridian</title>
        <meta name="description" content="An independent record of European M&A, buyout, leveraged finance and project finance activity, compiled from public sources and linked to the original publication." />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/intelligence" />
      </Head>
      <Layout>
        <PageHero
          eyebrow="Market Intelligence"
          title="The European deal record."
          sub="An independent, continuously updated record of M&A, buyout, leveraged finance, ECM and project finance activity, compiled from public sources, each entry linked to its original publication."
        />

        <section className="sec tight">
          <div className="wrap">
            <div className="filters">
              {types.map((t) => (
                <button key={t} className={filter === t ? 'chip on' : 'chip'} onClick={() => { setFilter(t); setOpen(null); }}>{t}</button>
              ))}
            </div>

            {shown.length === 0 ? (
              <div className="empty">
                <h2 className="h3">Nothing to show under this filter.</h2>
                <p className="body" style={{ marginTop: 12, fontSize: 15 }}>
                  The record only publishes entries that can be traced to a named public source.
                  When nothing qualifies, it stays empty rather than being filled.
                </p>
              </div>
            ) : shown.map((d) => {
              const isOpen = open === d.id;
              return (
                <div key={d.id} className="row" onClick={() => setOpen(isOpen ? null : d.id)}>
                  <div className="row-meta">
                    <span className="row-type">{d.type}</span>
                    {d.date}
                  </div>
                  <div>
                    <h2 className="row-h">{d.headline}</h2>
                    <div className="row-party">
                      {d.buyer && d.target ? `${d.buyer} → ${d.target}` : (d.buyer || d.target || d.sector)}
                      {d.sector && (d.buyer || d.target) ? ` · ${d.sector}` : ''}
                      {d.status ? ` · ${d.status}` : ''}
                    </div>
                  </div>
                  <div className="row-val">{fmt(d.value, d.currency)}</div>
                  {isOpen && (
                    <div className="row-body">
                      {d.summary}
                      <br />
                      <a className="row-src" href={d.source_url} target="_blank" rel="noopener noreferrer nofollow" onClick={(e) => e.stopPropagation()}>
                        Read the original at {d.source} &rarr;
                      </a>
                    </div>
                  )}
                </div>
              );
            })}

            <p className="small" style={{ marginTop: 44, maxWidth: '72ch' }}>
              Entries are structured from published headlines and are not original reporting. Values are as
              stated in the source and are not converted between currencies. This record covers reported
              transactions only and is not exhaustive. It is not investment advice. If you spot an error,
              tell us and we will correct or remove the entry.
            </p>
          </div>
        </section>
      </Layout>
    </>
  );
}
