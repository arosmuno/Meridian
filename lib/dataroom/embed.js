// lib/dataroom/embed.js -- embeddings multilingues (Gemini, free tier) y procesado por lotes.
//
// Antes: gte-small dentro de una Edge Function. Era solo ingles (con contratos en espanol la
// busqueda fallaba) y embebia todos los trozos en una sola invocacion (un PDF de 100+ paginas
// se pasaba de tiempo). Ahora: los chunks se guardan sin embedding y se procesan por lotes de
// hasta 100 con reanudacion; si una llamada no termina, sigue la siguiente o el cron.
import { dra } from './server';

const KEY = () => process.env.GEMINI_API_KEY || process.env.Gemini_Api_key;
// text-embedding-004 ya no existe en la API (404); gemini-embedding-001 es multilingue.
const MODELS = ['gemini-embedding-001'];
// Free tier: ~30k tokens/minuto. Cada peticion va acotada por caracteres (no por numero de
// trozos): un Excel lleno de cifras tokeniza mucho peor que un contrato.
const MAX_CHARS_PER_CALL = 18000;
const MAX_ITEMS_PER_CALL = 40;
export const DIM = 768;
let workingModel = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalize(v) {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  return v.map((x) => x / n);
}

async function callBatch(model, texts, taskType) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${KEY()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: texts.map((t) => ({
        model: `models/${model}`,
        content: { parts: [{ text: String(t).slice(0, 8000) }] },
        taskType,
        outputDimensionality: DIM,
      })),
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(`embeddings ${model} ${r.status}: ${JSON.stringify(j).slice(0, 160)}`);
    e.status = r.status;
    const info = ((j.error && j.error.details) || []).find((d) => d.retryDelay);
    e.retryMs = info ? Math.ceil(parseFloat(info.retryDelay) * 1000) : 20000;
    throw e;
  }
  const vecs = (j.embeddings || []).map((e) => normalize(e.values || []));
  if (vecs.length !== texts.length || vecs.some((v) => v.length !== DIM)) throw new Error('respuesta de embeddings incompleta');
  return vecs;
}

// Devuelve { model, vectors }. Si se pasa model, usa ese (consultas: mismo modelo que el indice).
// Si se acaba la cuota por minuto, espera lo que pide Google mientras quepa en el plazo; si no
// cabe, lanza un error con rateLimited=true para que el llamador lo deje para la siguiente vuelta.
export async function embed(texts, { taskType = 'RETRIEVAL_DOCUMENT', model = null, deadline = Date.now() + 20000 } = {}) {
  if (!KEY()) throw new Error('falta GEMINI_API_KEY');
  const order = model ? [model] : workingModel ? [workingModel, ...MODELS.filter((m) => m !== workingModel)] : MODELS;
  let last = null;
  for (const m of order) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const vectors = await callBatch(m, texts, taskType);
        if (!model) workingModel = m;
        return { model: m, vectors };
      } catch (e) {
        last = e;
        if (e.status === 429 || e.status === 503) {
          const wait = Math.max(e.retryMs || 0, 2000 * (attempt + 1));
          if (Date.now() + wait > deadline) { e.rateLimited = true; throw e; }
          await sleep(wait);
          continue;
        }
        break; // 404 / 400: modelo no disponible para esta clave -> el siguiente
      }
    }
  }
  if (last && (last.status === 429 || last.status === 503)) last.rateLimited = true;
  throw last || new Error('sin modelo de embeddings disponible');
}

// Parte la lista en grupos que respetan el limite de caracteres por peticion.
function takeBatch(rows) {
  const out = [];
  let chars = 0;
  for (const r of rows) {
    const n = Math.min(String(r.content).length, 8000);
    if (out.length && (chars + n > MAX_CHARS_PER_CALL || out.length >= MAX_ITEMS_PER_CALL)) break;
    out.push(r);
    chars += n;
  }
  return out;
}

const toPg = (v) => '[' + v.map((x) => x.toFixed(6)).join(',') + ']';

// Procesa chunks pendientes (de un documento o de toda la base) hasta el plazo dado.
// Nunca marca error por cuota: devuelve wait_ms y el cliente/cron sigue despues.
export async function processPending({ documentId = null, deadline = Date.now() + 40000, batch = MAX_ITEMS_PER_CALL } = {}) {
  let processed = 0;
  let waitMs = 0;
  const touched = new Set();
  while (Date.now() < deadline - 6000) {
    let q = dra().from('chunks').select('id, document_id, room_id, org_id, idx, page, content').is('embedding', null).order('idx').limit(batch);
    if (documentId) q = q.eq('document_id', documentId);
    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows || !rows.length) break;
    const part = takeBatch(rows);
    let res;
    try {
      res = await embed(part.map((r) => r.content), { deadline: deadline - 6000 });
    } catch (e) {
      if (e.rateLimited) { waitMs = e.retryMs || 20000; break; }
      throw e;
    }
    const { model, vectors } = res;
    const upd = part.map((r, i) => ({ ...r, embedding: toPg(vectors[i]), embed_model: model }));
    const { error: uErr } = await dra().from('chunks').upsert(upd, { onConflict: 'id' });
    if (uErr) throw uErr;
    processed += part.length;
    part.forEach((r) => touched.add(r.document_id));
  }
  for (const id of touched) await refreshDocStatus(id);
  if (documentId) await refreshDocStatus(documentId);
  return { processed, wait_ms: waitMs };
}

export async function refreshDocStatus(documentId) {
  const total = await count(documentId, false);
  const done = await count(documentId, true);
  const patch = { chunk_count: total, embedded_count: done };
  if (total > 0 && done >= total) { patch.status = 'ready'; patch.error = null; }
  else if (total > 0) patch.status = 'indexing';
  await dra().from('documents').update(patch).eq('id', documentId);
  return { total, done };
}

async function count(documentId, embedded) {
  let q = dra().from('chunks').select('id', { count: 'exact', head: true }).eq('document_id', documentId);
  q = embedded ? q.not('embedding', 'is', null) : q;
  const { count: n } = await q;
  return n || 0;
}
