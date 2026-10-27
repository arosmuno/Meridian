// lib/dataroom/rag.js -- analista de due diligence sobre los documentos de la sala.
//
// 1. Planifica: reescribe la pregunta (resolviendo el contexto de la conversacion) y genera
//    varias busquedas en espanol e ingles + palabras clave exactas (cifras, nombres, metricas).
// 2. Recupera con busqueda hibrida (vectores + texto completo) respetando permisos de carpeta,
//    fusiona por ranking y anade los trozos vecinos de los mejores resultados.
// 3. Responde con el modelo Flash completo y razonamiento, citando cada dato con [n].
import { admin, dra } from './server';
import { embed } from './embed';
import { llmComplete, llmLastProvider } from '../llm';

const MAX_CONTEXT_CHARS = 28000;

async function roomModels(roomId) {
  const { data } = await dra().from('chunks').select('embed_model').eq('room_id', roomId).not('embed_model', 'is', null).limit(1000);
  return [...new Set((data || []).map((r) => r.embed_model))];
}

const isSheet = (name) => /\.xls[xm]$/i.test(String(name || ''));
const cite = (m) => `${m.document_name}${m.page ? (isSheet(m.document_name) ? `, hoja ${m.page}` : `, p. ${m.page}`) : ''}`;

function parseJson(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (_) { return null; }
}

// Reescritura de la pregunta + busquedas. Si el LLM falla, se busca con la pregunta tal cual.
async function plan({ question, history, catalog }) {
  const prev = history.slice(-6).map((h) => `${h.role === 'user' ? 'Usuario' : 'Analista'}: ${String(h.content).slice(0, 400)}`).join('\n');
  const prompt = `Preparas búsquedas en la sala de datos de una operación (M&A / financiación).
Documentos disponibles: ${catalog.map((d) => d.name).join('; ').slice(0, 1500)}
${prev ? `Conversación previa:\n${prev}\n` : ''}Pregunta nueva: ${question}

Devuelve SOLO un JSON:
{"standalone": "la pregunta reescrita para que se entienda sin la conversación",
 "queries": ["3 o 4 búsquedas semánticas distintas, mezclando español e inglés y los términos que usaría el propio documento (p. ej. EBITDA, net debt, change of control, covenant, capex, IRR)"],
 "keywords": ["5-10 términos exactos para búsqueda literal: cifras, años, nombres propios, siglas, nombres de pestañas"]}`;
  try {
    const out = parseJson(await llmComplete({ prompt, maxTokens: 500, temperature: 0, fast: true, timeoutMs: 6000, deadline: Date.now() + 7000 }));
    if (out && Array.isArray(out.queries) && out.queries.length) {
      return {
        standalone: String(out.standalone || question).slice(0, 500),
        queries: [String(out.standalone || question), ...out.queries.map(String)].slice(0, 5),
        keywords: (Array.isArray(out.keywords) ? out.keywords : []).map((k) => String(k).replace(/["()]/g, ' ').replace(/^[-\s]+/, '').trim()).filter((k) => k.length > 1).slice(0, 10),
      };
    }
  } catch (_) { /* sin plan: busqueda directa */ }
  return { standalone: question, queries: [question], keywords: [] };
}

const kwQuery = (keywords) => [...new Set(keywords
  .map((k) => String(k).replace(/["'¿?¡!(),;:]/g, ' ').replace(/^[-\s]+/, '').trim())
  .filter((k) => k.length > 1 && !/^(or|and|not)$/i.test(k)))]
  .map((k) => (/\s/.test(k) ? `"${k}"` : k)).join(' OR ');

const ZERO = '[' + new Array(768).fill(0).join(',') + ']';

export async function retrieve({ roomId, userId, queries, keywords = [], k = 16, log = () => {} }) {
  const models = await roomModels(roomId);
  const ranked = new Map();
  for (const model of models) {
    // Si la cuota de embeddings esta agotada (p. ej. mientras se indexa un Excel grande), no se
    // espera: se busca solo por texto completo con las palabras clave y las propias consultas.
    let vectors = null;
    try {
      ({ vectors } = await embed(queries, { taskType: 'RETRIEVAL_QUERY', model, deadline: Date.now() + 5000 }));
    } catch (e) {
      log('embed fallback: ' + String(e.message).slice(0, 80));
    }
    const kwAll = kwQuery([...keywords, ...queries.flatMap((q) => q.split(/\s+/).filter((w) => w.length > 4))].slice(0, 30));
    const calls = vectors
      ? vectors.map((v, i) => ({ emb: '[' + v.join(',') + ']', m: model, kw: i === 0 ? kwQuery(keywords) : '' }))
      : [{ emb: ZERO, m: '__none__', kw: kwAll }];
    const results = await Promise.all(calls.map((c) => admin.rpc('search_dataroom_chunks', {
      p_room_id: roomId, p_user_id: userId, query_embedding: c.emb, p_model: c.m, p_keywords: c.kw, match_count: vectors ? 12 : 20,
    })));
    for (const { data, error } of results) {
      if (error) throw error;
      (data || []).forEach((row, rank) => {
        const prev = ranked.get(row.id);
        const s = 1 / (40 + rank) + (row.score || 0);
        ranked.set(row.id, prev ? { ...prev, rrf: prev.rrf + s } : { ...row, rrf: s });
      });
    }
  }
  const top = [...ranked.values()].sort((a, b) => b.rrf - a.rrf).slice(0, k);
  return withNeighbours(top);
}

// Anade el trozo anterior y el siguiente de los mejores resultados (una clausula o una tabla
// suelen partirse entre dos trozos) y agrupa por documento en orden de lectura.
async function withNeighbours(top) {
  const want = new Map();
  top.slice(0, 6).forEach((m) => {
    [m.idx - 1, m.idx + 1].forEach((i) => { if (i >= 0) want.set(`${m.document_id}:${i}`, { document_id: m.document_id, idx: i }); });
  });
  top.forEach((m) => want.delete(`${m.document_id}:${m.idx}`));
  const extra = [];
  const byDoc = {};
  for (const w of want.values()) (byDoc[w.document_id] = byDoc[w.document_id] || []).push(w.idx);
  await Promise.all(Object.entries(byDoc).map(async ([docId, idxs]) => {
    const { data } = await dra().from('chunks').select('id, document_id, idx, page, content').eq('document_id', docId).in('idx', idxs);
    const name = (top.find((t) => t.document_id === docId) || {}).document_name;
    (data || []).forEach((c) => extra.push({ ...c, document_name: name, rrf: 0 }));
  }));
  const all = [...top, ...extra];
  // Fusiona trozos consecutivos del mismo documento en un solo extracto.
  const docsOrder = [...new Set(top.map((m) => m.document_id))];
  const groups = [];
  for (const docId of docsOrder) {
    const parts = all.filter((m) => m.document_id === docId).sort((a, b) => a.idx - b.idx);
    let cur = null;
    for (const p of parts) {
      if (cur && p.idx === cur.lastIdx + 1 && p.page === cur.page) {
        cur.content += '\n' + p.content;
        cur.lastIdx = p.idx;
        cur.rrf = Math.max(cur.rrf, p.rrf);
      } else {
        if (cur) groups.push(cur);
        cur = { document_id: p.document_id, document_name: p.document_name, page: p.page, content: p.content, lastIdx: p.idx, rrf: p.rrf };
      }
    }
    if (cur) groups.push(cur);
  }
  groups.sort((a, b) => b.rrf - a.rrf);
  // Llena el presupuesto por orden de relevancia; un bloque demasiado largo se recorta en vez
  // de dejar fuera todo lo demas.
  const out = [];
  let chars = 0;
  for (const g of groups) {
    const room = MAX_CONTEXT_CHARS - chars;
    if (room < 1500) break;
    const content = g.content.length > Math.min(room, 9000) ? g.content.slice(0, Math.min(room, 9000)) + '\n[…]' : g.content;
    out.push({ ...g, content });
    chars += content.length;
  }
  return out;
}

async function catalogFor(roomId, userId) {
  const { data } = await admin.rpc('dataroom_visible_docs', { p_room_id: roomId, p_user_id: userId });
  const docs = data || [];
  const ids = docs.filter((d) => isSheet(d.name)).map((d) => d.id);
  let reviews = [];
  if (ids.length) {
    const { data: r } = await dra().from('model_reviews').select('document_id, summary, created_at').in('document_id', ids).eq('status', 'done').order('created_at', { ascending: false });
    reviews = r || [];
  }
  return docs.map((d) => ({ ...d, review: (reviews.find((r) => r.document_id === d.id) || {}).summary || null }));
}

// deadline: momento limite para tener la respuesta (la ruta tiene 60 s en Vercel).
export async function answer({ room, userId, question, history = [], deadline = Date.now() + 50000 }) {
  const t0 = Date.now();
  const marks = [];
  const log = (m) => marks.push(`${m} @${Date.now() - t0}ms`);
  const catalog = await catalogFor(room.id, userId);
  const p = await plan({ question, history, catalog });
  log('plan');
  const matches = await retrieve({ roomId: room.id, userId, queries: p.queries, keywords: p.keywords, log });
  log(`retrieve ${matches.length}`);
  if (!matches.length) {
    return { answer: 'No encuentro esa información en los documentos indexados de la sala (o están en carpetas a las que no tienes acceso).', citations: [] };
  }
  const ctx = matches.map((m, i) => `[${i + 1}] (${cite(m)})\n${m.content}`).join('\n\n---\n\n');
  const prev = history.slice(-8).map((h) => `${h.role === 'user' ? 'Usuario' : 'Analista'}: ${String(h.content).slice(0, 1200)}`).join('\n\n');
  const cat = catalog.map((d) => `- ${d.name}${d.pages ? ` (${d.pages} ${isSheet(d.name) ? 'hojas' : 'págs.'})` : ''}${d.status !== 'ready' ? ' [sin indexar]' : ''}${d.review ? `\n  Revisión automática del modelo: ${String(d.review).slice(0, 500)}` : ''}`).join('\n');

  const prompt = `Eres un analista senior de M&A y financiación estructurada haciendo due diligence en la sala de datos "${room.name}". Escribes para un banquero o inversor que va a tomar decisiones con tu respuesta.

DOCUMENTOS DE LA SALA (a los que tiene acceso este usuario):
${cat}

CÓMO LEER LOS EXTRACTOS
- Los Excel vienen como filas "F12: etiqueta | valor | valor…" (F = número de fila). La cabecera de la hoja (años, escenarios, unidades) se repite al inicio del extracto: úsala para saber a qué columna corresponde cada cifra.
- Los porcentajes de Excel ya vienen como "10%". Si ves una fracción suelta junto a una etiqueta con (%), p. ej. "IRR (%) | 0.1", es 10%, no 0,1%. Ante la duda, interpreta la cifra de la forma coherente con el resto del modelo y dilo.
- Un mismo dato puede aparecer en varios documentos: si no coinciden, señálalo.

CÓMO RESPONDER
1. Empieza con la respuesta directa en 1-3 frases, con las cifras clave.
2. Después, el análisis que aporte valor de verdad: cifras relevantes (tabla en markdown si comparas años, escenarios o documentos), cálculos que hagas tú (crecimientos, márgenes, ratios, múltiplos, apalancamiento, cobertura) mostrando de dónde salen, y qué implica para un comprador o financiador.
3. Señala riesgos, incoherencias o banderas rojas que veas en los extractos.
4. Si falta información para responder del todo, dilo claramente y propone la pregunta concreta que haría al vendedor en el Q&A.
- Cita cada dato con [n]. Solo puedes afirmar lo que está en los extractos o en el catálogo; tus cálculos deben partir de cifras citadas. Nunca inventes cifras.
- Responde en el idioma de la pregunta. Markdown sencillo: **negritas**, viñetas y tablas; sin títulos con #. Sin relleno ni repeticiones; extensión proporcional a la pregunta.
${prev ? `\nCONVERSACIÓN PREVIA\n${prev}\n` : ''}
EXTRACTOS
${ctx}

PREGUNTA: ${question}${p.standalone && p.standalone !== question ? `\n(Interpretación: ${p.standalone})` : ''}`;

  let text;
  try {
    text = (await llmComplete({ prompt, maxTokens: 2500, temperature: 0.2, quality: true, thinking: 2048, timeoutMs: 20000, deadline })).trim();
  } finally {
    log('answer ' + llmLastProvider());
    console.log('[dataroom chat]', marks.join(' | '), 'ctx', ctx.length);
  }
  const used = new Set((text.match(/\[(\d+)\]/g) || []).map((x) => Number(x.slice(1, -1))));
  const citations = matches.map((m, i) => ({ n: i + 1, document_id: m.document_id, document_name: m.document_name, page: m.page, label: cite(m) }))
    .filter((c) => used.size === 0 || used.has(c.n));
  return { answer: text, citations, standalone: p.standalone };
}
