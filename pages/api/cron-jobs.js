// pages/api/cron-jobs.js -- daily CAREERS ingest.
//
// ONE cron, not two. If ingestion were split across two invocations, each would
// pass only its own hashes to increment_missed_cycles, so every listing from the
// OTHER half would score an absence every single day -- and expire_stale_jobs()
// would wipe the whole board every 3 days. A cycle must see the full feed.
//
// Runs at 06:07, not 06:00: the deals cron fires on */30, which lands exactly on
// :00 and :30. Overlapping those is how the 429s happened.
//
// Costs zero Anthropic tokens: every source is an ATS JSON API.

import { supabaseAdmin as supabase } from '../../lib/supabase';
import { fetchAllJobs, upsertJobs } from '../../lib/fetchJobs';

export const config = { maxDuration: 60 };

// supabaseAdmin is the service-role client. RLS grants SELECT to anon only, so
// with the anon key every insert fails with 42501 and the run happily reports 0 new.

export default async function handler(req, res) {
  // Vercel Cron signs its requests; a manual run needs the secret.
  const auth = req.headers.authorization;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const hasSecret = process.env.CRON_SECRET && auth === 'Bearer ' + process.env.CRON_SECRET;
  if (!isVercelCron && !hasSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Idempotency lock. If a run is retried while the first is still going, two
  // concurrent ingests race on the same rows. The (job_name, run_date) PK makes
  // the second insert fail, so the retry exits without touching anything.
  const { error: lockErr } = await supabase
    .from('cron_runs')
    .insert({ job_name: 'jobs', run_date: today });

  if (lockErr && !req.query.force) {
    console.log('[cron-jobs] already ran today, skipping');
    return res.status(200).json({ skipped: true, reason: 'already ran today' });
  }

  try {
    // Vercel kills background work once you respond, so everything must finish
    // BEFORE res.json(). Learned the hard way on the deals cron.
    const { jobs, healthyFirms } = await fetchAllJobs();
    const { upserted } = await upsertJobs(supabase, jobs, healthyFirms);

    // Expiry sweep. Pure SQL, no tokens. Without it nothing ever expires.
    //
    // The deal cross-reference (link_jobs_to_deals) is deliberately NOT called.
    // The idea was 'this firm just worked that deal, and is now hiring for it'.
    // In practice deals.advisor is far too sparse, and the handful of matches that
    // survived the quality gates ALL pointed at the same deal, repeated across 19
    // cards. A connection that is true but useless is still noise. The SQL function
    // stays in the DB for when advisor coverage is good enough to switch it back on.
    const { data: expired } = await supabase.rpc('expire_stale_jobs');

    const result = {
      fetched: jobs.length,
      upserted,
      healthyFirms: healthyFirms.length,
      expired: (expired && expired[0] && expired[0].expired_count) || 0,
    };

    await supabase.from('cron_runs')
      .update({ finished_at: new Date().toISOString(), result })
      .eq('job_name', 'jobs').eq('run_date', today);

    console.log('[cron-jobs] OK', result);
    return res.status(200).json(result);
  } catch (e) {
    console.error('[cron-jobs] failed:', e);
    // Release the lock so today can be retried.
    await supabase.from('cron_runs').delete().eq('job_name', 'jobs').eq('run_date', today);
    return res.status(500).json({ error: e.message });
  }
}
