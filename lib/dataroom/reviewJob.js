// lib/dataroom/reviewJob.js -- ejecuta la revision de un Excel y la guarda en model_reviews.
import { dra, audit } from './server';
import { reviewWorkbook, plainSummary } from './modelReview';
import { llmComplete } from '../llm';

const SEV = { high: 'grave', medium: 'medio', low: 'menor', info: 'info' };

async function writeSummary(result, docName) {
  const top = result.findings.slice(0, 25).map((f) => `- [${SEV[f.severity]}] ${f.title} en ${f.sheet}!${f.cell || ''}: ${f.detail}`).join('\n');
  const s = result.stats;
  const prompt = `Eres un revisor de modelos financieros con experiencia en banca de inversión. Redacta en español el resumen ejecutivo de la revisión del archivo "${docName}".
Usa SOLO los hallazgos de abajo: no inventes impactos, importes ni causas que no estén ahí. 5 a 8 frases, en prosa, sin viñetas.
Empieza por lo que puede hacer que el modelo dé un resultado incorrecto (errores, checks que no cuadran, valores a mano en filas de fórmulas, enlaces externos), luego lo que dificulta auditarlo, y termina con qué arreglar primero.

Datos: ${s.sheets} hojas, ${s.formulas} fórmulas, ${s.numbers} valores numéricos fijos, ${s.errors} celdas con error.
Hallazgos (${result.findings.length} en total):
${top || '(ninguno)'}`;
  try {
    const t = (await llmComplete({ prompt, maxTokens: 900, temperature: 0.2, fast: true })).trim();
    return t || plainSummary(result);
  } catch (_) {
    return plainSummary(result);
  }
}

export async function runReview({ doc, buffer, userId }) {
  const { data: rev } = await dra().from('model_reviews').insert({
    room_id: doc.room_id, org_id: doc.org_id, document_id: doc.id, status: 'running', created_by: userId,
  }).select().single();
  try {
    const result = await reviewWorkbook(buffer);
    const summary = await writeSummary(result, doc.name);
    await dra().from('model_reviews').update({ status: 'done', summary, stats: result.stats, findings: result.findings }).eq('id', rev.id);
    await audit({ org_id: doc.org_id, room_id: doc.room_id, actor: userId, action: 'model_review', meta: { document_id: doc.id, name: doc.name, findings: result.findings.length } });
    return { id: rev.id, summary, ...result };
  } catch (e) {
    await dra().from('model_reviews').update({ status: 'error', error: String((e && e.message) || e).slice(0, 300) }).eq('id', rev.id);
    throw e;
  }
}
