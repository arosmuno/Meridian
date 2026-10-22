// lib/geminiModels.js -- modelos Flash de Gemini disponibles en la cuenta, descubiertos en vivo.
// Cada modelo tiene su propia cuota gratuita diaria: cuantos mas haya en la lista, mas
// capacidad gratis antes de agotarse. Los retirados desaparecen solos.
let cache = null;
let cachedAt = 0;

const FALLBACK = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

function version(name) {
  const m = name.match(/gemini-(\d+)(?:\.(\d+))?/);
  return m ? Number(m[1]) * 100 + Number(m[2] || 0) : 0;
}

export async function geminiFlashModels() {
  if (cache && Date.now() - cachedAt < 6 * 3600e3) return cache;
  const key = process.env.GEMINI_API_KEY || process.env.Gemini_Api_key;
  if (!key) return [];
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${key}`);
    const j = await r.json();
    const names = ((j && j.models) || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((n) => /^gemini-[\d.]+-flash(-lite)?(-latest)?$/.test(n));
    // Primero los estables mas nuevos; flash antes que flash-lite a igual version.
    names.sort((a, b) => version(b) - version(a) || (a.includes('lite') ? 1 : 0) - (b.includes('lite') ? 1 : 0));
    cache = names.length ? names.slice(0, 6) : FALLBACK;
  } catch (e) {
    cache = FALLBACK;
  }
  cachedAt = Date.now();
  return cache;
}

// Algunos parametros solo existen en ciertas generaciones.
export function thinkingConfigFor(model, budget) {
  return /^gemini-2\.5/.test(model) ? { thinkingConfig: { thinkingBudget: budget } } : {};
}
