# Sightline — AI Visibility Intelligence Platform

See how your brand shows up across **ChatGPT, Claude, Gemini and Perplexity** — and get concrete, ready-to-publish actions to improve it.

**MONITOR → OPTIMIZE → IMPROVE**

| Module | What it does |
| --- | --- |
| **Monitor** | Scans every engine with real buyer prompts; measures mentions, positions, recommendations, citations; Visibility Score + heatmap + competitor benchmark + trending topics |
| **Optimize** | Turns gaps into deliverables: FAQ / blog / comparison / category / location pages, JSON-LD schema, llms.txt, metadata, internal-link plans — in 8 languages, streamed live |
| **Improve** | Week-over-week score trends, engine trends, share-of-voice before/after, completed-action tracking |
| **AI Copilot** | Floating assistant on every page, grounded in your latest scan |
| **Reports** | Markdown/CSV export, print-clean PDF, expiring public share links, weekly email digest (Resend) |
| **Billing** | Free / Starter / Pro plan gating with a stub checkout (PG-ready interface) |

## Stack

Next.js 15 (App Router, TypeScript) · Tailwind CSS v4 · Supabase (Postgres + Auth + RLS) · Poe API (one key → all AI engines) · Recharts · Resend · Vercel

## Quick start

```bash
# 1. Node 22 (see .nvmrc)
nvm use

# 2. Install
pnpm install

# 3. Create a Supabase project (https://supabase.com), then run the schema:
#    Supabase Dashboard → SQL Editor → paste supabase/migrations/0001_init.sql → Run
#    (or: supabase link && supabase db push)

# 4. Configure env
cp .env.example .env.local   # fill in the values below

# 5. Run
pnpm dev                     # http://localhost:3000
```

> **Tip:** In Supabase → Authentication → Providers → Email, disable "Confirm email"
> for frictionless dev signups.

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service_role key (server-only: scans, share pages, demo seed) |
| `POE_API_KEY` | — | https://poe.com/api_key — without it the app runs in **mock mode** (realistic offline data, full workflow works) |
| `RESEND_API_KEY` | — | weekly digests; falls back to console logging |
| `EMAIL_FROM` | — | verified sender for Resend |
| `NEXT_PUBLIC_APP_URL` | — | used in email links |
| `CRON_SECRET` | — | protects `/api/cron/digest` on Vercel |

### Why Poe?

Poe exposes an **OpenAI-compatible endpoint** (`https://api.poe.com/v1`) where the
`model` field selects the underlying engine — `GPT-4o`, `Claude-Sonnet-4.5`,
`Gemini-2.5-Pro`, `Perplexity-Sonar`. One key covers every engine we scan.
Model mapping lives in `src/lib/ai/engines.ts`.

## Demo project

No data yet? On onboarding (or Settings) click **"explore with a demo project"** —
it seeds a complete fictional project (6 weeks of history, a finished scan,
recommendations, sample content) owned by your user, so every screen is populated.

## Architecture

```
src/
├── app/
│   ├── (marketing)/          # landing, pricing (public)
│   ├── (auth)/               # login, signup
│   ├── (app)/                # authed shell: dashboard, monitor, optimize,
│   │                         # improve, reports, billing, settings, onboarding
│   ├── share/[token]/        # public read-only report
│   └── api/                  # scan, generate, assistant, share, billing,
│                             # reports/export, demo, cron/digest
├── lib/
│   ├── ai/                   # AIProvider interface + Poe & mock adapters
│   ├── scan/                 # prompt generation, response analyzer, scoring, runner
│   ├── recommendations/      # gap-based action engine (pure function)
│   ├── content/              # generation prompt templates (9 asset types)
│   ├── reports/ email/ trends/ billing/   # swappable adapters
│   ├── plans.ts              # Free/Starter/Pro limits + gating
│   └── supabase/             # browser / server / admin clients + middleware
└── components/               # ui primitives, charts, sidebar, assistant
```

**Swap points** (adapter pattern, one file each):
- AI provider → `lib/ai/provider.ts` (`getProvider()`)
- Trends source → `lib/trends/index.ts` (mock → SerpAPI/Glimpse/DataForSEO)
- Billing → `lib/billing/provider.ts` (dev stub → Polar.sh, already implemented)
- Email → `lib/email/index.ts` (Resend ↔ console)

**Scoring** (`lib/scan/scoring.ts`): Visibility Score 0–100 =
40% mention rate + 30% recommendation rate + 20% position quality + 10% engine coverage.

## Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel.
2. Add all env vars above (Production + Preview).
3. `vercel.json` already schedules the weekly digest cron (Mon 08:00 UTC);
   set `CRON_SECRET` to protect it.
4. Scans run inside a single serverless invocation (`maxDuration 300` on
   `/api/scan`) — long enough for ~40 engine calls. On the Hobby tier lower
   the active-prompt count if you hit timeouts.

## Database

Schema: `supabase/migrations/0001_init.sql` — 10 tables, every row carries
`user_id` so RLS is uniform (`auth.uid() = user_id`). Public share pages are
rendered server-side with the service-role key, so no public policies exist.

Apply new migrations with `supabase db push` (or paste into the SQL editor).
`0003_prompt_categories_competitor_order.sql` is required for the seven
buyer-intent prompt categories and competitor drag-and-drop ordering.
`0004_sources_teams_lifetime.sql` adds citation sources, live scan progress,
the AppSumo lifetime plan, and workspace members/comments with membership RLS.

## Billing (Polar.sh)

Billing runs on Polar.sh — `lib/billing/polar.ts` creates hosted checkouts
and `/api/webhooks/polar` maps subscription events to plan entitlements.
Until the `POLAR_*` env vars are set (see `.env.example`), the stub provider
flips plans instantly so development stays friction-free.

## Roadmap hooks (intentionally stubbed)

- Consumer-surface collectors per engine (`collection` field in `lib/ai/engines.ts`)
- Real Google Trends source (`lib/trends/index.ts` → SerpAPI/Glimpse/DataForSEO)
- Team collaboration / comments (Pro plan UI flag exists)
