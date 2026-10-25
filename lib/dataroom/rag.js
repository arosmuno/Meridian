// lib/dataroom/rag.js -- recuperacion + respuesta con citas por pagina.
// La busqueda respeta permisos de carpeta (match_dataroom_chunks recibe el usuario) y usa el
// mismo modelo de embeddings con el que se indexo la sala.
import { admin, dra } from './server';
import { embed } from './embed';
import { llmComplete } from '../llm';

async function roomModels(roomId) {
  const { data } = await dra().from('chunks').select('embed_model').eq('room_id', roomId).not('embed_model', 'is', null).limit(1000);
  return [...new Set((data || []).map((r) => r.embed_model))];
}

export async function retrieve({ roomId, userId, question, k = 8 }) {
  const models = await roomModels(roomId);
  const all = [];
  for (const model of models) {
    const { vectors } = await embed([question], { taskType: 'RETRIEVAL_QUERY', model });
    const { data, error } = await admin.rpc('match_dataroom_chunks', {
      p_room_id: roomId, p_user_id: userId, query_embedding: '[' + vectors[0].join(',') + ']', p_model: model, match_count: k,
    });
    if (error) throw error;
    all.push(...(data || []));
  }
  return all.sort((a, b) => b.similarity - a.similarity).slice(0, k);
}

const cite = (m) => `${m.document_name}${m.page ? (/\.xls[xm]$/i.test(m.document_name) ? `, hoja ${m.page}` : `, p. ${m.page}`) : ''}`;

export async function answer({ room, userId, question, history = [] }) {
  const matches = await retrieve({ roomId: room.id, userId, question });
  if (!matches.length) {
    return { answer: 'No encuentro esa información en los documentos indexados de la sala (o están en carpetas a las que no tienes acceso).', citations: [] };
  }
  const ctx = matches.map((m, i) => `[${i + 1}] (${cite(m)})\n${m.content}`).join('\n\n');
  const prev = history.slice(-6).map((h) => `${h.role === 'user' ? 'Usuario' : 'Analista'}: ${String(h.content).slice(0, 600)}`).join('\n');
  const prompt = `Eres el analista de due diligence de la sala de datos "${room.name}".
Responde SOLO con la información de los extractos. Cita cada dato con [n]. Si algo no está en los extractos, dilo y no lo supongas.
Sé preciso con cifras, fechas, partes y cláusulas. Responde en el idioma de la pregunta, en párrafos cortos, sin relleno.
${prev ? `\nConversación previa:\n${prev}\n` : ''}
Extractos:
${ctx}

Pregunta: ${question}`;
  const text = (await llmComplete({ prompt, maxTokens: 1500, temperature: 0.1, fast: true })).trim();
  // Solo se devuelven las fuentes que la respuesta cita de verdad.
  const used = new Set((text.match(/\[(\d+)\]/g) || []).map((x) => Number(x.slice(1, -1))));
  const citations = matches.map((m, i) => ({ n: i + 1, document_id: m.document_id, document_name: m.document_name, page: m.page, label: cite(m) }))
    .filter((c) => used.size === 0 || used.has(c.n));
  return { answer: text, citations };
}
