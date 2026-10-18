# MERIDIAN — Deployment Guide (Mobile-Friendly)
## No terminal needed. Do everything from your phone browser.

---

## STEP 1 — Create GitHub Repository (5 min)

1. Go to **github.com** on your phone
2. Tap **+** → **New repository**
3. Name it `meridian`
4. Set to **Public**
5. Tap **Create repository**
6. Upload all these files using GitHub's web editor:
   - Tap **Add file** → **Upload files** for each folder
   - Create folders by typing `pages/api/deals.js` in the filename field (GitHub creates the folder automatically)

---

## STEP 2 — Set Up Supabase (10 min)

1. Go to **supabase.com** → **New project**
2. Choose a name (`meridian`) and a strong password
3. Once created, go to **SQL Editor**
4. Copy the contents of `supabase-schema.sql` and run it
5. Go to **Settings → API**, copy:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → this is your `SUPABASE_SERVICE_ROLE_KEY`

---

## STEP 3 — Get Anthropic API Key (5 min)

1. Go to **console.anthropic.com**
2. **API Keys** → **Create Key**
3. Copy it — this is your `ANTHROPIC_API_KEY`

---

## STEP 4 — Deploy on Vercel (10 min)

1. Go to **vercel.com** → **New Project**
2. Import your GitHub repository (`meridian`)
3. In **Environment Variables**, add ALL of these:

   | Variable | Value |
   |----------|-------|
   | `ANTHROPIC_API_KEY` | Your Anthropic key |
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
   | `CRON_SECRET` | Any random string (e.g. `meridian-cron-2026`) |
   | `NEXT_PUBLIC_ADSENSE_ID` | Leave blank for now |

4. Tap **Deploy**
5. Vercel gives you a free URL like `meridian.vercel.app`

---

## STEP 5 — Trigger First Deal Fetch (2 min)

After deploy, trigger the cron manually once to populate the database:

Go to: `https://meridian.vercel.app/api/cron`  
Add header: `Authorization: Bearer meridian-cron-2026`

Or just visit the site — it will show fallback deals until the cron runs.

The cron runs automatically every 10 minutes after that.

> **Note:** Vercel cron jobs require the **Pro plan ($20/month)** for intervals under 1 day.
> On the free plan, the cron runs **once daily**.
> Alternative: use **cron-job.org** (free) to call `/api/cron` every 10 minutes.

---

## STEP 6 — Custom Domain (optional, 15 min)

1. Buy a domain on **namecheap.com** (~$15/year). Good options:
   - `meridian.finance`
   - `getmeridian.co`
   - `meridianintel.com`
2. In Vercel → **Domains** → add your domain
3. Follow the DNS instructions (update nameservers on Namecheap)

---

## STEP 7 — iPhone PWA (2 min, works immediately)

Users can install MERIDIAN on their iPhone home screen:
1. Visit the site in **Safari**
2. Tap the **Share** button
3. Tap **Add to Home Screen**
4. It opens like a native app (full screen, no browser bar)

No App Store needed for this.

---

## STEP 8 — Google AdSense (apply when you have traffic)

1. Go to **adsense.google.com**
2. Apply with your site URL
3. Google reviews in 1-3 days
4. Once approved, you get a publisher ID like `ca-pub-1234567890123456`
5. Add it to Vercel environment variables as `NEXT_PUBLIC_ADSENSE_ID`
6. Redeploy — ads appear automatically in the 3 slots already built in:
   - **Leaderboard** banner under the masthead
   - **In-feed** ad every 4 deal cards
   - **Sidebar** vertical ad
   - **Modal** ad inside each deal view

---

## Architecture Overview

```
Vercel Cron (every 10 min)
    ↓
/api/cron → Claude API (web search)
    ↓
Supabase DB (stores deals)
    ↑
/api/deals ← Frontend (Next.js)
    ↓
User sees live deals + AdSense ads
```

---

## Revenue Model

| Source | When | Est. CPM |
|--------|------|----------|
| Google AdSense | From day 1 | $2-5 |
| Carbon Ads | 1k+ daily visitors | $20-50 |
| Direct sponsors (law firms, banks) | 10k+ monthly | Negotiate |

Finance audience CPMs are 3-5x general consumer rates.
