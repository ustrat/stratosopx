# StratosOpx

Monorepo for the StratosOpx website and product.

| Path | What | Deploys to |
| --- | --- | --- |
| `apps/web` | Marketing site (Next.js static export) | `stratosopx.com` |
| `apps/product` | The product: React SPA + Hono API on one Cloudflare Worker, D1 database | `app.stratosopx.com` |
| `packages/core` | Shared logic: order validation, ERP payloads, execution controls, ingestion policy, pricing, ERP catalog | — |

## Commands (from the repo root)

```bash
npm install
npm run lint
npm run typecheck
npm run build                         # all workspaces
npm run dev:web                       # website at http://localhost:3000
npm run dev -w @stratosopx/product    # product at http://localhost:5173
```

## Product: local development

```bash
cd apps/product
cp .dev.vars.example .dev.vars                  # AUTH_MODE=dev, set DEV_USER_EMAIL
npm run db:migrate:local
ADMIN_EMAIL=<same email> node scripts/seed.mjs --local
npm run dev
```

`AUTH_MODE=dev` only works on `localhost`. In production, Cloudflare Access sits in front of `app.stratosopx.com`;
the Worker verifies the Access JWT (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` in `wrangler.jsonc`) and only lets in users
who have a row in the `users` table.

### How an order is approved

1. The browser and the Worker run the same checks (`validateOrder`) and payload builder (`erpPayload`) from `packages/core`.
2. The approver resolves or accepts every exception; blocking ones can only be fixed.
3. The Worker recomputes everything, checks the approver's role and the emergency stop, and verifies the payload
   fingerprint matches what the approver saw.
4. The write goes through the ERP adapter with an idempotency key and is read back to verify. Every step is in `audit_log`.

The ERP is currently a mock adapter (`apps/product/worker/erp.ts`) that stores NetSuite-format payloads until a design
partner provides sandbox access.

## Deployment

Pushes to `main` deploy automatically: **Deploy** runs after **CI** passes. Repository secrets:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | Account API token `github-actions-stratosopx-deploy` (expires **October 12, 2027**; create a new one and update the secret before then). Needs Workers Scripts, Workers Routes and **D1 Edit**. |

The product deploy is skipped until `apps/product/wrangler.jsonc` has the real D1 database ID. Each product deploy applies
pending D1 migrations first.

Legal pages: `python -I apps/web/scripts/legal-docx-to-json.py` regenerates them from the .docx drafts in the repo root.

Business documents (PDF, Word, images, `business.txt`) are kept out of the repository by `.gitignore`, and CI fails if one
is committed.
