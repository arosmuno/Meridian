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
  for (const d of (arr || [])) {
    const b = sigPart(d.buyer), t = sigPart(d.target);
    const real = b && b !== 'na' && b.length > 2 && t && t !== 'na' && t.length > 2;
    const key = real ? (b < t ? b + '|' + t : t + '|' + b) : null;
    const tk = tokenize(d);
    let dup = false;
    for (let i = 0; i < meta.length; i++) {
      if (key && meta[i].key === key) { dup = true; break; }
      let inter = 0;
      for (const x of tk) if (meta[i].tk.has(x)) inter++;
      const uni = tk.size + meta[i].tk.size - inter;
      if (inter >= 3 && uni > 0 && inter / uni >= 0.5) { dup = true; break; }
    }
    if (dup) continue;
    kept.push(d);
    meta.push({ key, tk });
  }
  return kept;
}
