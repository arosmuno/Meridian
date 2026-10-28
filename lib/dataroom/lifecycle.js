// lib/dataroom/lifecycle.js -- fin de la operacion y borrado automatico.
//
// Al dar por terminada una operacion la sala pasa a solo lectura y se fija purge_at
// (cierre + retention_days). Todos ven la fecha de borrado; 7 dias y 1 dia antes les llega un
// email; llegada la fecha, el cron borra los archivos de Storage y la sala (todo lo demas cae
// en cascada). Asi una sala terminada no ocupa espacio indefinidamente.
import { admin, dra } from './server';
import { enqueue } from './notify';

const DAY = 86400e3;

async function listAll(prefix) {
  const out = [];
  const { data: entries } = await admin.storage.from('datarooms').list(prefix, { limit: 1000 });
  for (const e of entries || []) {
    const path = `${prefix}/${e.name}`;
    if (e.id) out.push(path); // archivo
    else out.push(...(await listAll(path))); // carpeta
  }
  return out;
}

export async function purgeRoom(room) {
  const files = await listAll(`${room.org_id}/${room.id}`);
  for (let i = 0; i < files.length; i += 100) await admin.storage.from('datarooms').remove(files.slice(i, i + 100));
  const { error } = await dra().from('rooms').delete().eq('id', room.id);
  if (error) throw error;
  return files.length;
}

export async function runLifecycle({ deadline = Date.now() + 30000 } = {}) {
  const { data: rooms } = await dra().from('rooms').select('*').eq('status', 'closed').not('purge_at', 'is', null);
  let warned = 0;
  let purged = 0;
  for (const r of rooms || []) {
    if (Date.now() > deadline) break;
    const left = new Date(r.purge_at).getTime() - Date.now();
    try {
      if (left <= 0) {
        const n = await purgeRoom(r);
        purged++;
        console.log(`[lifecycle] sala ${r.id} (${r.name}) borrada: ${n} archivos`);
        continue;
      }
      const days = Math.ceil(left / DAY);
      const step = days <= 1 ? 1 : days <= 7 ? 7 : 0;
      if (step && (r.purge_warned === 0 || r.purge_warned > step)) {
        await enqueue({ room: r, kind: 'room_purge_warning', everyone: true, payload: { purge_at: r.purge_at, days } });
        await dra().from('rooms').update({ purge_warned: step }).eq('id', r.id);
        warned++;
      }
    } catch (e) {
      console.error('[lifecycle]', r.id, e.message);
    }
  }
  return { warned, purged };
}
