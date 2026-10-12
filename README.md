# StratosOpx

Marketing site and Order & Bid Command Center for StratosOpx.

## Run

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # static export to ./out
npm run lint
npm run preview   # build, then serve ./out locally with Wrangler
npm run deploy    # build, then deploy to Cloudflare Workers
```

## Routes

| Route | What it is |
| --- | --- |
| `/` | Marketing home: hero, brand concept, the two agents, demo CTA |
| `/pricing` | Published tiers for both agents, ROI calculator, bundles, services |
| `/integrations` | ERP catalog grouped by integration pattern, with filters |
| `/integrations/policy` | Document integration & ingestion policy (draft) |
| `/dashboard` | Command Center overview: KPIs, routing map, review queue, plan usage, execution controls |
| `/dashboard/review` | Review queue list |
| `/dashboard/review/<id>` | Human-in-the-loop review: PO / change-order lines with live exceptions and payload-bound approval, or RFP compliance matrix with Go / No-Go |
| `/dashboard/erp-sync` | ERP connections and inbound document screening |
| `/dashboard/settings` | Automation mode, permission matrix, launch acceptance, emergency stop |
| `/dashboard/<section>` | Placeholders for Orders, Change orders, Bids & RFPs, Agents |

## Source layout

- `src/app/globals.css` — design tokens and all styles
- `src/components/` — `Logo`, `Icon`, `DotWave`, `site/`, `dashboard/`, `review/`, `pricing/`, `integrations/`
- `src/lib/pricing.ts` — list prices and tier math
- `src/lib/controls.ts` — action-risk tiers, permission matrix, launch criteria, payload fingerprint
- `src/lib/erp-catalog.ts` — ERP systems and integration groups
- `src/lib/ingestion-policy.ts` — ingestion limits, `screenDocument()` and the policy text (one source for both)
- `src/lib/review.ts` — order validation (`validateOrder`) and ERP payload builder (`erpPayload`)
- `src/lib/data.ts`, `src/lib/plan.ts` — **sample data**; replace with real API calls

## Deployment

The site is a static export (`output: "export"` in `next.config.ts`) served by an assets-only Cloudflare Worker
(`wrangler.jsonc`). Security headers and caching rules are in `public/_headers`. Server-only Next.js features
(server actions, route handlers, rewrites, image optimization) are unavailable in this mode.

Business documents (PDF, Word, images, `business.txt`) are kept out of the repository by `.gitignore`.
