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
  return { token, aal: aalOf(token), user: data.user, userClient, dr: () => userClient.schema('dataroom') };
}

// Nivel de la sesion: aal2 si ha entrado con el codigo de verificacion en dos pasos. El token ya
// lo ha validado Supabase (getUser), aqui solo se lee.
function aalOf(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).aal || 'aal1'; } catch (_) { return 'aal1'; }
}
export const MFA_MSG = 'Esta organización exige verificación en dos pasos: entra con tu código.';
export async function requireMfa(ctx, orgId) {
  if (ctx.aal === 'aal2') return;
  const { data } = await dra().from('orgs').select('require_mfa').eq('id', orgId).maybeSingle();
  if (data && data.require_mfa) throw new HttpError(403, MFA_MSG);
}

// Limites de uso por persona, para que nadie (ni un script con una sesion robada) agote las cuotas
// gratuitas de IA o descargue la sala entera a lo bruto. Si la base de datos falla, no bloquea.
const LIMITS = {
  chat: [[600, 30], [86400, 300]],
  qa_draft: [[600, 20]],
  upload: [[3600, 800]],
  download: [[600, 1500]],
  upgrade: [[600, 30]],
};
export async function rateLimit(ctx, bucket) {
  for (const [win, max] of LIMITS[bucket] || []) {
    const { data, error } = await admin.rpc('dataroom_rate_hit', { p_user: ctx.user.id, p_bucket: `${bucket}:${win}`, p_window_s: win, p_max: max });
    if (!error && data === false) {
      throw new HttpError(429, win >= 86400 ? 'Has llegado al límite diario de este uso. Vuelve a intentarlo mañana.' : 'Demasiadas peticiones seguidas. Espera unos minutos y vuelve a intentarlo.');
    }
  }
}

export async function roleIn(orgId, userId) {
  const { data } = await dra().from('memberships').select('role').eq('org_id', orgId).eq('user_id', userId).maybeSingle();
  return data ? data.role : null;
}
export const isAdminRole = (r) => r === 'owner' || r === 'admin';
export const canWriteRole = (r) => !!r && r !== 'viewer';

// Acceso del usuario a la sala: rol, si es del equipo vendedor o postor (y de que grupo) y si la
// sala esta abierta para el (cerrada o caducada solo la ven owner/admin).
export async function roomAccess(roomId, userId) {
  const { data, error } = await admin.rpc('dataroom_room_access', { p_room: roomId, p_user: userId });
  if (error) throw error;
  return (data && data[0]) || null;
}
const CLOSED_MSG = { closed: 'La sala está cerrada.', expired: 'Tu acceso a esta sala ha caducado.', no_group: 'No tienes acceso a esta sala.' };
export const READ_ONLY_MSG = 'La operación está terminada: la sala es de solo lectura.';
function assertOpen(access) {
  if (!access || !access.visible) throw new HttpError(403, 'sin acceso a la sala');
  if (!access.open) throw new HttpError(403, CLOSED_MSG[access.reason] || 'sin acceso a la sala');
}
// Escribir (subir, preguntar, responder): cualquier equipo con rol distinto de lectura, mientras la
// operacion siga en curso (una sala terminada es de solo lectura hasta que se borra).
export const canWriteIn = (access) => !!access && canWriteRole(access.role) && access.reason !== 'closed';
// Mismo equipo: null es el equipo organizador (miembros de la organizacion sin grupo).
export const sameTeam = (a, b) => (a || null) === (b || null);

// Sala visible para el usuario (RLS) + su acceso.
export async function loadRoom(ctx, roomId) {
  const { data: room } = await ctx.dr().from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (!room) {
    // Puede que la sala exista pero la RLS la oculte por falta del segundo paso: mensaje claro.
    const { data: r } = await dra().from('rooms').select('org_id').eq('id', roomId).maybeSingle();
    if (r) await requireMfa(ctx, r.org_id);
    throw new HttpError(403, 'sin acceso a la sala');
  }
  await requireMfa(ctx, room.org_id);
  const access = await roomAccess(room.id, ctx.user.id);
  assertOpen(access);
  return { room, role: access.role, access };
}

// Documento visible para el usuario: RLS de documents ya aplica permisos de carpeta y sala abierta.
export async function loadDoc(ctx, documentId) {
  const { data: visible } = await ctx.dr().from('documents').select('id').eq('id', documentId).maybeSingle();
  if (!visible) {
    const { data: d } = await dra().from('documents').select('org_id').eq('id', documentId).maybeSingle();
    if (d) await requireMfa(ctx, d.org_id);
    throw new HttpError(403, 'sin acceso al documento');
  }
  const { data: doc } = await dra().from('documents').select('*').eq('id', documentId).single();
  const { data: room } = await dra().from('rooms').select('*').eq('id', doc.room_id).single();
  await requireMfa(ctx, room.org_id);
  const access = await roomAccess(room.id, ctx.user.id);
  assertOpen(access);
  return { doc, room, role: access.role, access };
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
