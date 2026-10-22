// lib/llm.js -- motor de generacion multi-proveedor con failover para no agotar cuota.
// Orden pensado para NO comprometer la calidad de la noticia: primero los modelos de
// Gemini (cada modelo del free tier tiene su PROPIA cuota diaria ~1.500 req/dia, asi que
// usar varios multiplica el limite gratis), y solo como ultimo recurso Groq (proveedor
// gratuito aparte: llama-3.3-70b de alta calidad y, al final, llama-3.1-8b que da 14.400
// req/dia). Ante 429/cuota se pasa al siguiente modelo; ante 503/sobrecarga se reintenta.
//
// Requiere: GEMINI_API_KEY (o Gemini_Api_key). Opcional: GROQ_API_KEY y, como ultimo
// recurso de pago, ANTHROPIC_API_KEY.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Modelos Gemini en orden de preferencia (calidad + cuota separada por modelo).
const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
// Modelos Groq en orden de preferencia. Groq retira modelos sin aviso (llama-3.1-8b-instant
// ya no existe y tumbaba el fallback entero), asi que la lista se cruza con /models en
// cada invocacion y se salta cualquier modelo que ya no este disponible.
const GROQ_PREFERRED = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
// Anthropic (de pago): desactivado salvo ALLOW_PAID_LLM=1. La arquitectura es gratis.
const ANTHROPIC_MODELS = ['claude-haiku-5-5'];

let groqModelsCache = null;
async function groqModels() {
  if (groqModelsCache) return groqModelsCache;
  const key = process.env.GROQ_API_KEY;
  if (!key) return [];
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: 'Bearer ' + key } });
    const j = await r.json();
    const live = new Set(((j && j.data) || []).filter((m) => m.active !== false).map((m) => m.id));
    if (!live.size) return (groqModelsCache = GROQ_PREFERRED);
    const picked = GROQ_PREFERRED.filter((m) => live.has(m));
    // Si ninguno de los preferidos sigue vivo, usa cualquier llama / gpt-oss de texto disponible.
    if (!picked.length) {
      for (const id of live) if (/llama|gpt-oss/i.test(id) && !/guard|whisper|tts|vision/i.test(id)) picked.push(id);
    }
    return (groqModelsCache = picked.slice(0, 3));
  } catch {
    return (groqModelsCache = GROQ_PREFERRED);
  }
}

async function callAnthropic(model, prompt, cfg) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, done: true };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: Math.max(cfg.maxTokens * 2, 4000), messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.ok) {
    // Haiku 5.5 razona antes de responder y ese razonamiento gasta del mismo cupo: margen amplio
    // arriba; si aun asi se corta sin texto, cuenta como fallo.
    const t = ((data && data.content) || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    if (!t.trim()) return { ok: false, err: 'empty (' + (data && data.stop_reason) + ')' };
    return { ok: true, text: t.trim() };
  }
  return { ok: false, retriable: r.status === 529 || r.status === 503, err: JSON.stringify(data).slice(0, 150) };
}

// Verificacion de hechos: temperatura 0 y Groq primero, para no gastar la cuota gratuita de
// Gemini, que se reserva para la busqueda web.
export const preciseLog = [];
export async function llmPrecise({ prompt, maxTokens = 1400 }) {
  const out = await llmComplete({ prompt, maxTokens, temperature: 0, prefer: 'groq' });
  preciseLog.splice(0, preciseLog.length, 'ok via ' + lastProvider);
  return out;
}

// Anthropic es de pago: solo entra si se activa a proposito con ALLOW_PAID_LLM=1.
const PAID_OK = () => process.env.ALLOW_PAID_LLM === '1' && !!process.env.ANTHROPIC_API_KEY;
let lastProvider = '';

async function callGemini(model, prompt, cfg) {
  const key = process.env.GEMINI_API_KEY || process.env.Gemini_Api_key;
  if (!key) return { ok: false, done: true };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: cfg.temperature, maxOutputTokens: cfg.maxTokens, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.ok) {
    const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    return { ok: true, text: parts.map((p) => p.text).filter(Boolean).join('\n').trim() };
  }
  const code = (data && data.error && data.error.code) || r.status;
  return { ok: false, retriable: code === 503, err: JSON.stringify(data).slice(0, 150) };
}

async function callGroq(model, prompt, cfg) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { ok: false, done: true };
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: cfg.temperature,
      max_tokens: Math.min(cfg.maxTokens, 8000),
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.ok) {
    const t = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    return { ok: true, text: t.trim() };
  }
  // Modelo retirado o inexistente: no reintentar, pasar al siguiente.
  const code = data && data.error && data.error.code;
  if (code === 'model_not_found' || code === 'model_decommissioned') return { ok: false, retriable: false, err: JSON.stringify(data).slice(0, 150) };
  // 429 en Groq suele ser limite POR MINUTO (RPM/TPM), que se libera en segundos -> reintentable.
  return { ok: false, retriable: r.status === 503 || r.status === 500 || r.status === 429, err: JSON.stringify(data).slice(0, 150) };
}

// Genera texto probando proveedores/modelos en cascada. Devuelve el primer texto valido.
// fast=true (peticiones EN VIVO, un usuario esperando): reintentos cortos y acotados (~10s
// peor caso) para no dejar la tarjeta colgada. fast=false (cron en 2o plano): mas paciente.
export async function llmComplete({ prompt, maxTokens = 1600, temperature = 0.5, fast = false, prefer = 'gemini' }) {
  const cfg = { maxTokens, temperature };
  let lastErr = '';
  const gemAttempts = fast ? 1 : 2;   // en fast no reintentamos 503 de Gemini, pasamos ya
  const groqAttempts = fast ? 2 : 4;
  const groqBackoff = fast ? 1500 : 3000;

  async function tryGemini() {
    for (const m of GEMINI_MODELS) {
      for (let a = 0; a < gemAttempts; a++) {
        const res = await callGemini(m, prompt, cfg);
        if (res.done) return null;         // sin clave Gemini
        if (res.ok && res.text) { lastProvider = m; return res.text; }
        lastErr = res.err || lastErr;
        if (res.retriable) { await sleep(1300 * (a + 1)); continue; } // 503: reintenta
        break;                             // 429/cuota u otro: siguiente modelo
      }
    }
    return null;
  }
  async function tryGroq() {
    if (!process.env.GROQ_API_KEY) return null;
    for (const m of await groqModels()) {
      for (let a = 0; a < groqAttempts; a++) {
        const res = await callGroq(m, prompt, cfg);
        if (res.done) return null;
        if (res.ok && res.text) { lastProvider = m; return res.text; }
        lastErr = res.err || lastErr;
        // El limite POR MINUTO de Groq se libera en unos segundos.
        if (res.retriable) { await sleep(groqBackoff * (a + 1)); continue; }
        break;
      }
    }
    return null;
  }

  const order = prefer === 'groq' ? [tryGroq, tryGemini] : [tryGemini, tryGroq];
  for (const f of order) {
    const t = await f();
    if (t) return t;
  }

  if (PAID_OK()) {
    for (const m of ANTHROPIC_MODELS) {
      const res = await callAnthropic(m, prompt, cfg);
      if (res.ok && res.text) { lastProvider = m; return res.text; }
      lastErr = res.err || lastErr;
    }
  }

  throw new Error('All LLM providers exhausted. Last error: ' + lastErr);
}
