// lib/dataroom/embed.js -- embeddings multilingues (Gemini, free tier) y procesado por lotes.
//
// Antes: gte-small dentro de una Edge Function. Era solo ingles (con contratos en espanol la
// busqueda fallaba) y embebia todos los trozos en una sola invocacion (un PDF de 100+ paginas
// se pasaba de tiempo). Ahora: los chunks se guardan sin embedding y se procesan por lotes de
// hasta 100 con reanudacion; si una llamada no termina, sigue la siguiente o el cron.
import { dra } from './server';

const KEY = () => process.env.GEMINI_API_KEY || process.env.Gemini_Api_key;
const MODELS = ['gemini-embedding-001', 'text-embedding-004'];
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
    throw e;
  }
  const vecs = (j.embeddings || []).map((e) => normalize(e.values || []));
  if (vecs.length !== texts.length || vecs.some((v) => v.length !== DIM)) throw new Error('respuesta de embeddings incompleta');
  return vecs;
}

// Devuelve { model, vectors }. Si se pasa model, usa ese (consultas: mismo modelo que el indice).
export async function embed(texts, { taskType = 'RETRIEVAL_DOCUMENT', model = null } = {}) {
  if (!KEY()) throw new Error('falta GEMINI_API_KEY');
  const order = model ? [model] : workingModel ? [workingModel, ...MODELS.filter((m) => m !== workingModel)] : MODELS;
  let last = null;
  for (const m of order) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const vectors = await callBatch(m, texts, taskType);
        if (!model) workingModel = m;
        return { model: m, vectors };
      } catch (e) {
        last = e;
        if (e.status === 429 || e.status === 503) { await sleep(1500 * (attempt + 1)); continue; }
        break; // 404 / 400: modelo no disponible para esta clave -> el siguiente
      }
    }
  }
  throw last || new Error('sin modelo de embeddings disponible');
}

const toPg = (v) => '[' + v.map((x) => x.toFixed(6)).join(',') + ']';

// Procesa chunks pendientes (de un documento o de toda la base) hasta el plazo dado.
export async function processPending({ documentId = null, deadline = Date.now() + 40000, batch = 64 } = {}) {
  let processed = 0;
  const touched = new Set();
  while (Date.now() < deadline - 6000) {
    let q = dra().from('chunks').select('id, document_id, room_id, org_id, idx, page, content').is('embedding', null).order('idx').limit(batch);
    if (documentId) q = q.eq('document_id', documentId);
    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows || !rows.length) break;
    const { model, vectors } = await embed(rows.map((r) => r.content));
    const upd = rows.map((r, i) => ({ ...r, embedding: toPg(vectors[i]), embed_model: model }));
    const { error: uErr } = await dra().from('chunks').upsert(upd, { onConflict: 'id' });
    if (uErr) throw uErr;
    processed += rows.length;
    rows.forEach((r) => touched.add(r.document_id));
  }
  for (const id of touched) await refreshDocStatus(id);
  if (documentId) await refreshDocStatus(documentId);
  return { processed };
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
