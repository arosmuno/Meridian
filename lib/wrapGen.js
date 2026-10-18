// lib/wrapGen.js
// DESACTIVADO. Ya no se genera "The Wrap" automaticamente.
//
// Esta funcion llamaba a Gemini una vez al dia para escribir un "resumen editorial"
// del dealmaking de la jornada, y lo cacheaba en site_cache. Era el tercer generador
// del sitio (junto al fallback de fetchDeals y al de api/analysis), y producia
// exactamente el tipo de contenido por el que AdSense rechazo meridiancapmarkets.com:
// comentario automatico, a escala, sin nadie detras.
//
// The Wrap ahora se escribe a mano y se lee de la tabla `wraps` (ver pages/wrap.js).
// Se mantiene este modulo como stub para no romper imports antiguos.

export async function getOrGenerateWrap() {
  return { wrap: null, label: '', count: 0, disabled: true };
}

export default getOrGenerateWrap;
