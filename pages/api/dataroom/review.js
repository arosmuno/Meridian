// Revision de un modelo Excel de la sala (Meridian Modelling). Se lanza sola al subir un .xlsx;
// esta ruta permite repetirla.
import { route, getCtx, loadDoc, requireNda, admin, HttpError } from '../../../lib/dataroom/server';
import { kindOf } from '../../../lib/dataroom/extract';
import { runReview } from '../../../lib/dataroom/reviewJob';

export const config = { maxDuration: 60 };

export default route(async (req) => {
  const ctx = await getCtx(req);
  const { document_id } = req.body || {};
  if (!document_id) throw new HttpError(400, 'document_id requerido');
  const { doc, room, role } = await loadDoc(ctx, document_id);
  await requireNda(ctx, room, role);
  if (kindOf(doc.name, doc.mime) !== 'xlsx') throw new HttpError(415, 'La revisión de modelos es para archivos .xlsx');
  const { data: file, error } = await admin.storage.from('datarooms').download(doc.storage_path);
  if (error || !file) throw new HttpError(404, 'archivo no encontrado');
  const out = await runReview({ doc, buffer: Buffer.from(await file.arrayBuffer()), userId: ctx.user.id });
  return { review_id: out.id, summary: out.summary, stats: out.stats, findings: out.findings };
});
