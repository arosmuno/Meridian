// lib/dedupe.js -- colapsa noticias duplicadas (la MISMA operacion re-titulada por
// distintas fuentes o pasadas del cron). Dos vias:
//  (1) par buyer|target normalizado identico (sin acentos/signos ni sufijos corporativos,
//      orden-independiente para tolerar intercambio de roles);
//  (2) fuerte solape de palabras significativas del titular (>=3 comunes y Jaccard >=0.5),
//      que captura casos como "Napa" vs "Genuine Parts' Napa Unit".
// Conserva el primero de cada grupo (llama ya ordenado por fecha desc para quedarte el mas nuevo).

const CORP_SUFFIX = /(group|holdings|holding|incorporated|inc|corporation|corp|company|co|sa|plc|ag|gmbh|ltd|limited|llc|lp|partners|automotive|nv|spa|realestate|se|ab|oyj)$/;
export function sigPart(s) {
  let x = String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let i = 0; i < 3; i++) { const y = x.replace(CORP_SUFFIX, ''); if (y === x) break; x = y; }
  return x;
}

const STOP = new Set(['the','for','and','with','from','bid','bids','cash','deal','deals','billion','million','unit','group','plc','inc','corp','to','in','of','on','as','an','reportedly','approximately','new','stake','talks','buy','buys','acquires','acquire','acquisition','maker','firm','company','over','its','into','has','make','makes','said','after','amid','valued','submits','attracts','launches','launch','sells','sell','than','more','defence','defense']);
export function tokenize(d) {
  const s = ((d.buyer || '') + ' ' + (d.target || '') + ' ' + (d.headline || '')).toLowerCase();
  const set = new Set();
  (s.match(/[a-z0-9]+/g) || []).forEach((w) => { if (w.length >= 3 && !STOP.has(w)) set.add(w); });
  return set;
}

export function dedupeDeals(arr) {
  const kept = [];
  const meta = [];
  const seenKeys = new Set();
  const isNA = (s) => !s || /^n\/?a$/i.test(String(s).trim());
  const numVal = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  for (const d of (arr || [])) {
    // Precise structured keys: same deal if same buyer+target, or same target+value+currency.
    const structKeys = [];
    if (!isNA(d.buyer) && !isNA(d.target)) structKeys.push('bt:' + sigPart(d.buyer) + '|' + sigPart(d.target));
    if (!isNA(d.target) && numVal(d.value) > 0) structKeys.push('tv:' + sigPart(d.target) + '|' + numVal(d.value) + '|' + String(d.currency || '').toLowerCase());
    if (structKeys.some((k) => seenKeys.has(k))) continue;
    // Fuzzy fallback: buyer|target signature match, or high headline-token overlap.
    const key = sigPart(d.buyer) + '|' + sigPart(d.target);
    const tk = tokenize(d);
    let dup = false;
    for (let i = 0; i < meta.length; i++) {
      if (meta[i].key && key !== '|' && meta[i].key === key) { dup = true; break; }
      let inter = 0;
      for (const x of tk) if (meta[i].tk.has(x)) inter++;
      const denom = Math.min(tk.size, meta[i].tk.size) || 1;
      if (tk.size >= 4 && inter / denom >= 0.6) { dup = true; break; }
    }
    if (dup) continue;
    kept.push(d);
    meta.push({ key, tk });
    structKeys.forEach((k) => seenKeys.add(k));
  }
  return kept;
}
