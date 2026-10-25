// Continua el embebido de un documento grande (lo llama el cliente mientras quede trabajo).
import { route, getCtx, loadDoc, HttpError } from '../../../lib/dataroom/server';
import { processPending, refreshDocStatus } from '../../../lib/dataroom/embed';

export const config = { maxDuration: 60 };

export default route(async (req) => {
  const started = Date.now();
  const ctx = await getCtx(req);
  const { document_id } = req.body || {};
  if (!document_id) throw new HttpError(400, 'document_id requerido');
  const { doc } = await loadDoc(ctx, document_id);
  await processPending({ documentId: doc.id, deadline: started + 52000 });
  return { ok: true, ...(await refreshDocStatus(doc.id)) };
});
