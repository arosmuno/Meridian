// Restablecer la verificacion en dos pasos de alguien que ha perdido el movil (owner/admin).
// Borra sus factores TOTP; la proxima vez que entre la vuelve a configurar (si la organizacion la exige).
import { route, getCtx, roleIn, isAdminRole, requireMfa, admin, audit, HttpError } from '../../../lib/dataroom/server';

export default route(async (req) => {
  const ctx = await getCtx(req);
  const { org_id, user_id } = req.body || {};
  if (!org_id || !user_id) throw new HttpError(400, 'org_id y user_id requeridos');
  const myRole = await roleIn(org_id, ctx.user.id);
  if (!isAdminRole(myRole)) throw new HttpError(403, 'Solo owner/admin');
  await requireMfa(ctx, org_id);
  if (user_id === ctx.user.id) throw new HttpError(400, 'Tu propia verificación se gestiona desde tu cuenta');
  const theirRole = await roleIn(org_id, user_id);
  if (!theirRole) throw new HttpError(404, 'No es miembro de la organización');
  if (theirRole === 'owner' || (theirRole === 'admin' && myRole !== 'owner')) throw new HttpError(403, 'No puedes restablecer la verificación de un administrador');
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: user_id });
  if (error) throw error;
  for (const f of (data && data.factors) || []) {
    const { error: dErr } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user_id });
    if (dErr) throw dErr;
  }
  await audit({ org_id, actor: ctx.user.id, action: 'mfa_reset', meta: { user_id } });
  return { ok: true, removed: ((data && data.factors) || []).length };
});
