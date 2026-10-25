// lib/dataroom/server.js -- piezas comunes de las rutas /api/dataroom/*.
//
// Regla de la casa: el navegador NO toca Storage. Todo fichero entra y sale por estas rutas,
// que comprueban (1) que el usuario es miembro, (2) que ve la carpeta, (3) el NDA de la sala,
// (4) si la sala permite descargas, y (5) dejan rastro en audit_log. Si el navegador pudiera
// leer el bucket, cualquiera de esas protecciones se saltaria con una llamada directa.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
export const dra = () => admin.schema('dataroom');

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Contexto autenticado a partir del token del usuario (cuerpo o cabecera Authorization).
export async function getCtx(req) {
  const fromHeader = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const token = (req.body && req.body.access_token) || fromHeader;
  if (!token) throw new HttpError(401, 'sesion requerida');
  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data || !data.user) throw new HttpError(401, 'sesion caducada');
  return { token, user: data.user, userClient, dr: () => userClient.schema('dataroom') };
}

export async function roleIn(orgId, userId) {
  const { data } = await dra().from('memberships').select('role').eq('org_id', orgId).eq('user_id', userId).maybeSingle();
  return data ? data.role : null;
}
export const isAdminRole = (r) => r === 'owner' || r === 'admin';
export const canWriteRole = (r) => !!r && r !== 'viewer';

// Sala visible para el usuario (RLS) + su rol.
export async function loadRoom(ctx, roomId) {
  const { data: room } = await ctx.dr().from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (!room) throw new HttpError(403, 'sin acceso a la sala');
  const role = await roleIn(room.org_id, ctx.user.id);
  return { room, role };
}

// Documento visible para el usuario: RLS de documents ya aplica permisos de carpeta.
export async function loadDoc(ctx, documentId) {
  const { data: visible } = await ctx.dr().from('documents').select('id').eq('id', documentId).maybeSingle();
  if (!visible) throw new HttpError(403, 'sin acceso al documento');
  const { data: doc } = await dra().from('documents').select('*').eq('id', documentId).single();
  const { data: room } = await dra().from('rooms').select('*').eq('id', doc.room_id).single();
  const role = await roleIn(doc.org_id, ctx.user.id);
  return { doc, room, role };
}

// NDA: si la sala lo exige, nadie salvo owner/admin ve contenido sin haberlo aceptado.
export async function requireNda(ctx, room, role) {
  if (!room.nda_required || isAdminRole(role)) return;
  const { data } = await dra().from('nda_acceptances').select('accepted_at').eq('room_id', room.id).eq('user_id', ctx.user.id).maybeSingle();
  if (!data) throw new HttpError(451, 'Debes aceptar el acuerdo de confidencialidad de la sala');
}

export async function audit(row) {
  try { await dra().from('audit_log').insert(row); } catch (_) { /* la auditoria nunca tumba la operacion */ }
}

// Envoltorio de ruta: metodo POST, errores con su codigo y mensaje legible.
export function route(fn) {
  return async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.status(200).json(out || { ok: true });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (!res.headersSent) res.status(status).json({ error: String((e && e.message) || e).slice(0, 400) });
    }
  };
}

export function safeStorageName(name) {
  return String(name || 'documento').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'documento';
}
