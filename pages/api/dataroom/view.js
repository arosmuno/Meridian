// Vista de un documento: PDF con marca de agua para el visor; Word/Excel/texto como texto
// extraido por pagina u hoja (sin entregar el original). Queda en la auditoria.
import { route, getCtx, rateLimit, loadDoc, requireNda, dra, audit, HttpError } from '../../../lib/dataroom/server';
import { deliver } from '../../../lib/dataroom/delivery';
import { kindOf } from '../../../lib/dataroom/extract';

export const config = { maxDuration: 60 };

export default route(async (req) => {
  const ctx = await getCtx(req);
  const { document_id } = req.body || {};
  if (!document_id) throw new HttpError(400, 'document_id requerido');
  const { doc, room, role } = await loadDoc(ctx, document_id);
  await rateLimit(ctx, 'download');
  await requireNda(ctx, room, role);
  await audit({ org_id: doc.org_id, room_id: doc.room_id, actor: ctx.user.id, action: 'document_view', meta: { document_id: doc.id, name: doc.name } });
  if (kindOf(doc.name, doc.mime) === 'pdf') {
    const out = await deliver({ doc, room, user: ctx.user, download: false });
    return { mode: 'pdf', url: out.url, watermark: room.watermark ? ctx.user.email : null };
  }
  const { data: chunks } = await dra().from('chunks').select('page, idx, content').eq('document_id', doc.id).order('idx').limit(2000);
  const pages = [];
  for (const c of chunks || []) {
    const last = pages[pages.length - 1];
    if (last && last.page === c.page) last.text += '\n' + c.content; else pages.push({ page: c.page, text: c.content });
  }
  return { mode: 'text', pages, watermark: room.watermark ? ctx.user.email : null };
});
