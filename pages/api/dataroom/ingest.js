// Indexado: descarga, extrae texto por pagina/hoja, trocea y embebe por lotes.
// Si el documento es grande y no termina en esta llamada, devuelve el progreso y el cliente
// llama a /api/dataroom/embed para seguir (y el cron lo remata si nadie lo hace).
import { route, getCtx, loadDoc, canWriteIn, admin, dra, HttpError } from '../../../lib/dataroom/server';
import { enqueue } from '../../../lib/dataroom/notify';
import { extractPages, chunkPages, looksScanned, kindOf, contentMatches } from '../../../lib/dataroom/extract';
import { processPending, refreshDocStatus } from '../../../lib/dataroom/embed';
import { runReview } from '../../../lib/dataroom/reviewJob';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } }, maxDuration: 60 };

export default route(async (req) => {
  const started = Date.now();
  const ctx = await getCtx(req);
  // embed=false (subida masiva): solo extrae y trocea; el embebido sigue en segundo plano.
  const { document_id, embed = true } = req.body || {};
  if (!document_id) throw new HttpError(400, 'document_id requerido');
  const { doc, room, access } = await loadDoc(ctx, document_id);
  if (!canWriteIn(access)) throw new HttpError(403, 'sin permiso de escritura');
  const firstTime = !doc.chunk_count;

  try {
    await dra().from('documents').update({ status: 'processing', error: null }).eq('id', doc.id);
    const { data: file, error: dlErr } = await admin.storage.from('datarooms').download(doc.storage_path);
    if (dlErr || !file) throw new Error('el archivo no llegó a subirse; vuelve a subirlo');
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!contentMatches(buffer, kindOf(doc.name, doc.mime))) {
      // El contenido no es lo que dice la extension: se borra el fichero y queda el error.
      await admin.storage.from('datarooms').remove([doc.storage_path]);
      throw new Error('El contenido del archivo no corresponde a su extensión. Por seguridad no se ha guardado.');
    }

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

    // Version nueva: la anterior pasa al historial (deja de salir en el indice, el chat y las busquedas).
    if (doc.replaces_id) await dra().from('documents').update({ superseded_by: doc.id }).eq('id', doc.replaces_id).is('superseded_by', null);
    if (firstTime) {
      await enqueue({
        room, kind: doc.replaces_id ? 'doc_version' : 'doc_new', folderId: doc.folder_id, exclude: ctx.user.id,
        payload: { document_id: doc.id, name: doc.name, version: doc.version, note: doc.version_note || null },
      });
    }

    // Excel: la revision del modelo corre a la vez que el indexado.
    if (kindOf(doc.name, doc.mime) === 'xlsx') {
      try { await runReview({ doc, buffer, userId: ctx.user.id }); } catch (_) { /* la revision tiene su propio estado */ }
    }

    const run = embed === false ? { wait_ms: 0 } : await processPending({ documentId: doc.id, deadline: started + 52000 });
    const progress = await refreshDocStatus(doc.id);
    return { ok: true, ...progress, wait_ms: run.wait_ms };
  } catch (e) {
    await dra().from('documents').update({ status: 'error', error: String((e && e.message) || e).slice(0, 300) }).eq('id', doc.id);
    throw new HttpError(422, String((e && e.message) || e));
  }
});
