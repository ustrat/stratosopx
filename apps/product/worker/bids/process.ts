import { audit, type TenantRow } from "../orders";
import { analyzeWithClaude, packageBlocks, type Library } from "./claude";
import { recommend } from "./recommend";

export class BidRetryLater extends Error {}

type Doc = { id: string; tenant_id: string; filename: string; pages: number | null; received_at: string };

const isDate = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

async function loadLibrary(db: D1Database, tenant: TenantRow): Promise<Library> {
  const [caps, projects] = await db.batch([
    db.prepare("SELECT kind, name, detail, amount, expires_on FROM capabilities WHERE tenant_id = ? ORDER BY kind, name").bind(tenant.id),
    db.prepare("SELECT name, client, year, value, scope, outcome FROM past_projects WHERE tenant_id = ? ORDER BY year DESC").bind(tenant.id),
  ]);
  return {
    tenantName: tenant.name,
    capabilities: (caps.results as { kind: string; name: string; detail: string | null; amount: number | null; expires_on: string | null }[]).map(
      (c) => ({ kind: c.kind, name: c.name, detail: c.detail, amount: c.amount, expiresOn: c.expires_on }),
    ),
    projects: projects.results as Library["projects"],
  };
}

/**
 * Analyze a stored bid package. Returns the document's new extraction state.
 * Throws BidRetryLater on temporary model errors so the queue retries.
 */
export async function analyzeBid(
  env: Env,
  tenant: TenantRow,
  doc: Doc,
  bytes: Uint8Array,
): Promise<{ state: "done" | "not_order" | "needs_attention" | "failed"; note: string | null; bidId?: string; usage?: string }> {
  const db = env.DB;
  const { blocks, skipped } = packageBlocks(doc.filename, bytes);
  if (!blocks.length) return { state: "needs_attention", note: skipped.join("; ") || "Nothing in the package could be read" };

  const library = await loadLibrary(db, tenant);
  const result = await analyzeWithClaude(env, library, blocks, { filename: doc.filename });
  if (!result.ok) {
    if (result.retryable) throw new BidRetryLater(result.reason);
    return { state: "failed", note: result.reason, usage: result.usage ? JSON.stringify(result.usage) : undefined };
  }

  const a = result.analysis;
  const usage = JSON.stringify(result.usage);
  if (!a.is_bid_package) return { state: "not_order", note: "Not a bid or RFP package; nothing was analyzed.", usage };

  const { recommendation, reason } = recommend(a.requirements);
  const warnings = [...a.warnings.map((w) => w.message), ...skipped.map((s) => `Not read: ${s}`)];
  const bidId = crypto.randomUUID();
  const title = a.project_name?.trim() || doc.filename;

  await db.batch([
    db
      .prepare(
        `INSERT INTO bids (id, tenant_id, document_id, title, owner, package_name, due_date, pages, summary, requirements, scope_matches, warnings,
           recommendation, recommendation_reason, usage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        bidId,
        tenant.id,
        doc.id,
        title,
        a.owner,
        a.package_name,
        isDate(a.due_date) ? a.due_date : null,
        doc.pages,
        a.summary,
        JSON.stringify(a.requirements),
        JSON.stringify(a.scope_matches.map((m) => ({ ...m, match: Math.min(1, Math.max(0, m.match)) }))),
        JSON.stringify(warnings),
        recommendation,
        reason,
        usage,
      ),
    audit(db, tenant.id, "agent:bid-analyst", "bid.analyzed", bidId, {
      document: doc.id,
      requirements: a.requirements.length,
      recommendation,
    }),
  ]);
  return { state: "done", note: null, bidId, usage };
}
