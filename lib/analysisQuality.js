// lib/analysisQuality.js -- control de calidad del "Meridian analysis".
// Lo usan el cron (al escribir) y las paginas (al leer, para filas antiguas).

// El analisis no vale si repite el resumen o si es relleno. Devuelve '' si no pasa.
const FILLER = /\b(highlights?|underscores?|demonstrates?|showcases?|dynamic (?:and )?(?:sometimes )?(?:volatile )?(?:nature|landscape)|strategic move|testament to|suggests? (?:a|an|that|continued|confidence|significant)|indicat(?:es|ing) (?:a|an|continued|confidence|significant)|signals? (?:a|an|continued|confidence|significant)|complex integration|(?:is|was) not a (?:transaction|deal)|no transaction|nothing to analy[sz]e|contains no (?:transaction|deal))\b/i;
function words(s) { return new Set((String(s || '').toLowerCase().match(/[a-z0-9]{4,}/g) || [])); }
export function cleanAnalysis(analysis, summary) {
  const a = String(analysis || '').trim();
  if (a.length < 60) return '';
  // Texto largo (2-3 parrafos): se tolera una muletilla suelta; dos o mas, fuera.
  const long = a.length >= 500;
  const hits = (a.match(new RegExp(FILLER.source, 'gi')) || []).length;
  if (long ? hits > 1 : hits > 0) return '';
  const aw = words(a);
  const sw = words(summary);
  if (!aw.size) return '';
  let inter = 0;
  for (const w of aw) if (sw.has(w)) inter++;
  // Mas del 60% de las palabras del analisis ya estan en el resumen: es un refrito.
  // En un texto largo es normal repetir nombres del resumen; el listón es mas alto.
  if (sw.size && inter / aw.size > (long ? 0.8 : 0.6)) return '';
  return a;
}

