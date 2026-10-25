// Indexado: descarga, extrae texto por pagina/hoja, trocea y embebe por lotes.
// Si el documento es grande y no termina en esta llamada, devuelve el progreso y el cliente
// llama a /api/dataroom/embed para seguir (y el cron lo remata si nadie lo hace).
import { route, getCtx, loadDoc, canWriteRole, admin, dra, HttpError } from '../../../lib/dataroom/server';
import { extractPages, chunkPages, looksScanned, kindOf } from '../../../lib/dataroom/extract';
import { processPending, refreshDocStatus } from '../../../lib/dataroom/embed';
import { runReview } from '../../../lib/dataroom/reviewJob';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } }, maxDuration: 60 };

export default route(async (req) => {
  const started = Date.now();
  const ctx = await getCtx(req);
  const { document_id } = req.body || {};
  if (!document_id) throw new HttpError(400, 'document_id requerido');
  const { doc, role } = await loadDoc(ctx, document_id);
  if (!canWriteRole(role)) throw new HttpError(403, 'sin permiso de escritura');

  try {
    await dra().from('documents').update({ status: 'processing', error: null }).eq('id', doc.id);
    const { data: file, error: dlErr } = await admin.storage.from('datarooms').download(doc.storage_path);
    if (dlErr || !file) throw new Error('el archivo no llegó a subirse; vuelve a subirlo');
    const buffer = Buffer.from(await file.arrayBuffer());

    const pages = await extractPages(buffer, doc.name, doc.mime);
    if (kindOf(doc.name, doc.mime) === 'pdf' && looksScanned(pages)) {
      throw new Error('PDF sin texto (parece escaneado). Súbelo con OCR aplicado para poder buscar en él.');
    }
    const chunks = chunkPages(pages);
    if (!chunks.length) throw new Error('no hay texto que indexar');

    await dra().from('chunks').delete().eq('document_id', doc.id);
    const rows = chunks.map((c, idx) => ({ document_id: doc.id, room_id: doc.room_id, org_id: doc.org_id, idx, page: c.page, content: c.content }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await dra().from('chunks').insert(rows.slice(i, i + 500));
      if (error) throw error;
    }
    await dra().from('documents').update({ status: 'indexing', pages: pages.length, chunk_count: rows.length, embedded_count: 0 }).eq('id', doc.id);

    // Excel: la revision del modelo corre a la vez que el indexado.
    if (kindOf(doc.name, doc.mime) === 'xlsx') {
      try { await runReview({ doc, buffer, userId: ctx.user.id }); } catch (_) { /* la revision tiene su propio estado */ }
    }

    await processPending({ documentId: doc.id, deadline: started + 52000 });
    const progress = await refreshDocStatus(doc.id);
    return { ok: true, ...progress };
  } catch (e) {
    await dra().from('documents').update({ status: 'error', error: String((e && e.message) || e).slice(0, 300) }).eq('id', doc.id);
    throw new HttpError(422, String((e && e.message) || e));
  }
});
