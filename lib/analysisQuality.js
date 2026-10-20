// lib/analysisQuality.js -- control de calidad del "Meridian analysis".
// Lo usan el cron (al escribir) y las paginas (al leer, para filas antiguas).

// El analisis no vale si repite el resumen o si es relleno. Devuelve '' si no pasa.
const FILLER = /\b(highlights?|underscores?|demonstrates?|showcases?|dynamic (?:and )?(?:sometimes )?(?:volatile )?(?:nature|landscape)|strategic move|testament to)\b/i;
function words(s) { return new Set((String(s || '').toLowerCase().match(/[a-z0-9]{4,}/g) || [])); }
export function cleanAnalysis(analysis, summary) {
  const a = String(analysis || '').trim();
  if (a.length < 60 || FILLER.test(a)) return '';
  const aw = words(a);
  const sw = words(summary);
  if (!aw.size) return '';
  let inter = 0;
  for (const w of aw) if (sw.has(w)) inter++;
  // Mas del 60% de las palabras del analisis ya estan en el resumen: es un refrito.
  if (sw.size && inter / aw.size > 0.6) return '';
  return a;
}

