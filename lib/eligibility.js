// lib/eligibility.js -- que fila cuenta para las league tables (ver /methodology).
//
// Misma regla en dos sitios: el cron la usa para dejar excluded_reason al guardar, y
// /rankings la vuelve a aplicar al leer, asi un error de clasificacion antiguo no se
// cuela en las tablas aunque la fila siga en la base.

const isNA = (s) => !s || /^\s*n\/?a\s*$/i.test(String(s)) || /unspecified|unknown|potential|interested/i.test(String(s));

// Tiene que haber un verbo de transaccion en el titular.
const TXN = /(acquir|acquisition|\bbuys?\b|\bbought\b|takeover|merger|\bmerges?\b|\bsells?\b|\bsold\b|sale of|\bstake\b|buyout|take[- ]private|\bipo\b|listing|debut|\braises?\b|\braised\b|funding round|\bround\b|refinanc|\bbonds?\b|\bnotes\b|\bloans?\b|facility|financing|\bissue|placement|rights issue|joint venture|\bjv\b|spin-?off|carve-?out|disposal|divest|concurso|chapter 11|restructur|tender offer|completes|closes|agrees? to|deal for|to purchase|purchase of|offer for)/i;

// Rumores, pasos intermedios y cosas que no son una operacion.
const RUMOUR = /\b(weighs|considers|explores|exploring|eyes|in talks|nears|seeks|mulls|could|may|plans? to|aims|preparing|prepares|hires|appoints|reportedly|bid for|rejects|pauses|faces|proposes|backs)\b/i;
const NOT_TXN = /(\bhow\b|\bwhy\b|unravel|approv|safeguard|settlement|co-ceo|initiative|leases? total|disclos|\bseize|jet sale|clients|nearing|record international|revenue|turnover|\bsales\b|profit|dividend|buyback|buy-back|repurchase|shareholders|stadium|contract|awarded|\bgrants?\b(?! thornton)|donat|remuneration|court|ruling|awards against|\bfines?\b|treasury|\bbills\b|redemption|redeem|commercial venture|into stocks|computing capacity|programme|to build|to manage|to invest|investment plan|disburse|advises|demand for|greenlight|\bclears?\b|assets surge|underwriting|builds .{0,20}stake|amidst|crypto|aircraft|to raise|tourism|in-house bank|short-term debt|debt at highest|continues|highway project|motorway|increases (?:its )?stake|\bloses\b|raises (?:its )?stake)/i;
const VALUATION = /valuation|valued at/i;

export function ineligibleReason(d) {
  const h = String(d.headline || '');
  const t = d.type;
  if ((t === 'M&A' || t === 'LBO') && (isNA(d.buyer) || isNA(d.target))) return 'M&A/LBO with no identified acquirer or target';
  if (/rumou?r/i.test(String(d.status || '')) || RUMOUR.test(h)) return 'Rumoured or exploratory, not an announced transaction';
  if (!TXN.test(h) || NOT_TXN.test(h)) return 'Not a transaction';
  if (VALUATION.test(h) && (isNA(d.buyer) || /stake|minority|buys into|invests? in/i.test(h))) return 'Valuation, not a transaction size';
  // Compras de participaciones sin importe en el titular: el valor suele ser la valoracion de la empresa.
  if (/\bstake\b/i.test(h) && !/\d/.test(h)) return 'Valuation, not a transaction size';
  return null;
}

// Colapsa repeticiones de la misma operacion que dedupeDeals no ve porque el modelo
// escribio el objetivo de dos formas ("Warner Bros." / "Warner Bros Discovery") o el
// importe en dos monedas: mismo comprador o mismo objetivo (prefijo) e importe en euros
// a menos de un 20%.
const sig = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
export function collapseSameDeal(rows) {
  const kept = [];
  for (const d of rows) {
    const b = sig(d.buyer).slice(0, 8);
    const t = sig(d.target).slice(0, 8);
    const v = Number(d.value_eur) || 0;
    const dup = kept.some((k) => {
      const kv = Number(k.value_eur) || 0;
      const close = v > 0 && kv > 0 && Math.abs(kv - v) <= 0.2 * Math.max(kv, v);
      const sameT = t.length >= 4 && sig(k.target).slice(0, 8) === t;
      const sameB = b.length >= 4 && sig(k.buyer).slice(0, 8) === b;
      const near = v > 0 && kv > 0 && Math.abs(kv - v) <= 0.03 * Math.max(kv, v);
      return (near && sameB) || close && (sameT || (sameB && sameT) || (sameB && !isNA(d.target) && sig(k.target).includes(t.slice(0, 5))));
    });
    if (!dup) kept.push(d);
  }
  return kept;
}
