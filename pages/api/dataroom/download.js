// Descarga: bloqueada si la sala es de solo consulta (salvo owner/admin); los PDF salen con
// marca de agua si la sala la tiene activada. Enlace firmado de 5 minutos + auditoria.
import { route, getCtx, loadDoc, requireNda, isAdminRole, audit, HttpError } from '../../../lib/dataroom/server';
import { deliver } from '../../../lib/dataroom/delivery';

export const config = { maxDuration: 60 };

export default route(async (req) => {
  const ctx = await getCtx(req);
  // original=true: solo owner/admin, para el archivo final de la sala (sin marca de agua).
  const { document_id, original = false } = req.body || {};
  if (!document_id) throw new HttpError(400, 'document_id requerido');
  const { doc, room, role } = await loadDoc(ctx, document_id);
  await requireNda(ctx, room, role);
  if (!room.allow_download && !isAdminRole(role)) throw new HttpError(403, 'Esta sala es de solo consulta: las descargas están desactivadas');
  const raw = !!original && isAdminRole(role);
  const out = await deliver({ doc, room: raw ? { ...room, watermark: false } : room, user: ctx.user, download: true });
  await audit({ org_id: doc.org_id, room_id: doc.room_id, actor: ctx.user.id, action: 'document_download', meta: { document_id: doc.id, name: doc.name, watermarked: out.watermarked, ...(raw ? { archive: true } : {}) } });
  return { url: out.url, watermarked: out.watermarked };
});
