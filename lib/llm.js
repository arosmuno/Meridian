// lib/llm.js -- motor de generacion multi-proveedor con failover para no agotar cuota.
// Orden pensado para NO comprometer la calidad de la noticia: primero los modelos de
// Gemini (cada modelo del free tier tiene su PROPIA cuota diaria ~1.500 req/dia, asi que
// usar varios multiplica el limite gratis), y solo como ultimo recurso Groq (proveedor
// gratuito aparte: llama-3.3-70b de alta calidad y, al final, llama-3.1-8b que da 14.400
// req/dia). Ante 429/cuota se pasa al siguiente modelo; ante 503/sobrecarga se reintenta.
//
// Requiere: GEMINI_API_KEY (o Gemini_Api_key). Opcional: GROQ_API_KEY (si falta, se omite
// Groq y funciona solo con Gemini).

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Modelos Gemini en orden de preferencia (calidad + cuota separada por modelo).
const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
// Modelos Groq: primero el potente (calidad), luego el de altisimo volumen como red de seguridad.
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

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
  // 429 en Groq suele ser limite POR MINUTO (RPM/TPM), que se libera en segundos -> reintentable.
  return { ok: false, retriable: r.status === 503 || r.status === 500 || r.status === 429, err: JSON.stringify(data).slice(0, 150) };
}

// Genera texto probando proveedores/modelos en cascada. Devuelve el primer texto valido.
export async function llmComplete({ prompt, maxTokens = 1600, temperature = 0.5 }) {
  const cfg = { maxTokens, temperature };
  let lastErr = '';

  for (const m of GEMINI_MODELS) {
    for (let a = 0; a < 2; a++) {
      const res = await callGemini(m, prompt, cfg);
      if (res.done) break;               // sin clave Gemini -> saltar a Groq
      if (res.ok && res.text) return res.text;
      lastErr = res.err || lastErr;
      if (res.retriable) { await sleep(1300 * (a + 1)); continue; } // 503: reintenta
      break;                             // 429/cuota u otro: siguiente modelo
    }
  }

  if (process.env.GROQ_API_KEY) {
    for (const m of GROQ_MODELS) {
      for (let a = 0; a < 4; a++) {
        const res = await callGroq(m, prompt, cfg);
        if (res.done) break;
        if (res.ok && res.text) return res.text;
        lastErr = res.err || lastErr;
        // Backoff mas largo: el limite por minuto de Groq se libera en unos segundos.
        if (res.retriable) { await sleep(3000 * (a + 1)); continue; }
        break;
      }
    }
  }

  throw new Error('All LLM providers exhausted. Last error: ' + lastErr);
}
