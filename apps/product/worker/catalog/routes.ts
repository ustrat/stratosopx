import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireRole } from "../auth";
import type { AppEnv } from "../env";
import { audit } from "../orders";
import { parseCatalog, TEMPLATES, type CatalogKind, type RowError } from "./csv";

// Catalog import: items, customers and customer part aliases from CSV, until a
// real ERP sync replaces it. Preview first (dryRun), then apply in one atomic
// batch. Rows travel as one JSON parameter per statement (json_each), which
// keeps large files within D1's per-query and per-request limits.

export const catalog = new Hono<AppEnv>();

const MAX_BYTES = 5_000_000;
const KINDS: CatalogKind[] = ["items", "customers", "aliases"];

catalog.get("/catalog/summary", async (c) => {
  const t = c.get("user").tenantId;
  const db = c.env.DB;
  const [items, customers, aliases] = await db.batch([
    db.prepare("SELECT COUNT(*) AS n FROM erp_items WHERE tenant_id = ?").bind(t),
    db.prepare("SELECT COUNT(*) AS n FROM erp_customers WHERE tenant_id = ?").bind(t),
    db.prepare("SELECT COUNT(*) AS n FROM erp_customer_parts WHERE tenant_id = ?").bind(t),
  ]);
  const n = (r: D1Result) => (r.results[0] as { n: number }).n;
  return c.json({ items: n(items), customers: n(customers), aliases: n(aliases) });
});

catalog.get("/catalog/customers", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, name, credit_limit, open_balance FROM erp_customers WHERE tenant_id = ? ORDER BY name LIMIT 1000",
  )
    .bind(c.get("user").tenantId)
    .all();
  return c.json({ customers: rows.results });
});

catalog.get("/catalog/aliases", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT customer_id, customer_part, sku FROM erp_customer_parts WHERE tenant_id = ? ORDER BY customer_id, customer_part LIMIT 1000",
  )
    .bind(c.get("user").tenantId)
    .all();
  return c.json({ aliases: rows.results });
});

catalog.get("/catalog/template/:kind", (c) => {
  const kind = c.req.param("kind") as CatalogKind;
  if (!KINDS.includes(kind)) throw new HTTPException(404, { message: "Unknown template" });
  return new Response(TEMPLATES[kind], {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="stratosopx-${kind}.csv"` },
  });
});

async function keys(db: D1Database, sql: string, tenantId: string) {
  const r = await db.prepare(sql).bind(tenantId).all<{ k: string }>();
  return new Set(r.results.map((x) => x.k.toLowerCase()));
}

catalog.post("/catalog/import/:kind", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  const kind = c.req.param("kind") as CatalogKind;
  if (!KINDS.includes(kind)) throw new HTTPException(404, { message: "Unknown catalog type" });
  const mode = c.req.query("mode") === "replace" ? "replace" : "upsert";
  const dryRun = c.req.query("dryRun") === "1";

  const text = await c.req.text();
  if (text.length > MAX_BYTES) throw new HTTPException(413, { message: "File is larger than 5 MB" });

  const db = c.env.DB;
  const t = user.tenantId;
  const fail = (errors: RowError[]) =>
    c.json({ ok: false, errorCount: errors.length, errors: errors.slice(0, 100) }, 422);

  const statements: D1PreparedStatement[] = [];
  let total = 0;
  let added = 0;
  let removed = 0;
  let aliasesRemoved = 0;

  if (kind === "items") {
    const { rows, errors } = parseCatalog("items", text);
    if (errors.length) return fail(errors);
    const existing = await keys(db, "SELECT sku AS k FROM erp_items WHERE tenant_id = ?", t);
    const incoming = new Set(rows.map((r) => r.sku.toLowerCase()));
    total = rows.length;
    added = rows.filter((r) => !existing.has(r.sku.toLowerCase())).length;
    if (mode === "replace") {
      removed = [...existing].filter((k) => !incoming.has(k)).length;
      const json = JSON.stringify(rows.map((r) => r.sku));
      aliasesRemoved = (
        await db
          .prepare("SELECT COUNT(*) AS n FROM erp_customer_parts WHERE tenant_id = ? AND sku NOT IN (SELECT value FROM json_each(?))")
          .bind(t, json)
          .first<{ n: number }>()
      )!.n;
      statements.push(
        db.prepare("DELETE FROM erp_customer_parts WHERE tenant_id = ? AND sku NOT IN (SELECT value FROM json_each(?))").bind(t, json),
        db.prepare("DELETE FROM erp_items WHERE tenant_id = ? AND sku NOT IN (SELECT value FROM json_each(?))").bind(t, json),
      );
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO erp_items (tenant_id, sku, description, sell_uom, uom_options, tier_price, stock)
           SELECT ?, json_extract(value, '$.sku'), json_extract(value, '$.description'), json_extract(value, '$.sellUom'),
                  json(json_extract(value, '$.uomOptions')), json_extract(value, '$.tierPrice'), json_extract(value, '$.stock')
           FROM json_each(?) WHERE true
           ON CONFLICT (tenant_id, sku) DO UPDATE SET description = excluded.description, sell_uom = excluded.sell_uom,
             uom_options = excluded.uom_options, tier_price = excluded.tier_price, stock = excluded.stock`,
        )
        .bind(t, JSON.stringify(rows)),
    );
  } else if (kind === "customers") {
    const { rows, errors } = parseCatalog("customers", text);
    if (errors.length) return fail(errors);
    const existing = await keys(db, "SELECT id AS k FROM erp_customers WHERE tenant_id = ?", t);
    const incoming = new Set(rows.map((r) => r.id.toLowerCase()));
    total = rows.length;
    added = rows.filter((r) => !existing.has(r.id.toLowerCase())).length;
    if (mode === "replace") {
      removed = [...existing].filter((k) => !incoming.has(k)).length;
      const json = JSON.stringify(rows.map((r) => r.id));
      aliasesRemoved = (
        await db
          .prepare("SELECT COUNT(*) AS n FROM erp_customer_parts WHERE tenant_id = ? AND customer_id NOT IN (SELECT value FROM json_each(?))")
          .bind(t, json)
          .first<{ n: number }>()
      )!.n;
      statements.push(
        db.prepare("DELETE FROM erp_customer_parts WHERE tenant_id = ? AND customer_id NOT IN (SELECT value FROM json_each(?))").bind(t, json),
        db.prepare("DELETE FROM erp_customers WHERE tenant_id = ? AND id NOT IN (SELECT value FROM json_each(?))").bind(t, json),
      );
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO erp_customers (id, tenant_id, name, credit_limit, open_balance)
           SELECT json_extract(value, '$.id'), ?, json_extract(value, '$.name'), json_extract(value, '$.creditLimit'), json_extract(value, '$.openBalance')
           FROM json_each(?) WHERE true
           ON CONFLICT (tenant_id, id) DO UPDATE SET name = excluded.name, credit_limit = excluded.credit_limit, open_balance = excluded.open_balance`,
        )
        .bind(t, JSON.stringify(rows)),
    );
  } else {
    const { rows, errors } = parseCatalog("aliases", text);
    if (errors.length) return fail(errors);
    // Aliases must point at customers and items that exist (or are in this same tenant's catalog).
    const customers = await keys(db, "SELECT id AS k FROM erp_customers WHERE tenant_id = ?", t);
    const skus = await keys(db, "SELECT sku AS k FROM erp_items WHERE tenant_id = ?", t);
    const refErrors: RowError[] = [];
    rows.forEach((r) => {
      if (!customers.has(r.customerId.toLowerCase())) refErrors.push({ row: r.row, message: `customer_id ${r.customerId} isn't in your customers` });
      if (!skus.has(r.sku.toLowerCase())) refErrors.push({ row: r.row, message: `sku ${r.sku} isn't in your items` });
    });
    if (refErrors.length) return fail(refErrors);
    const existing = await keys(db, "SELECT customer_id || '|' || customer_part AS k FROM erp_customer_parts WHERE tenant_id = ?", t);
    const incoming = new Set(rows.map((r) => `${r.customerId}|${r.customerPart}`.toLowerCase()));
    total = rows.length;
    added = rows.filter((r) => !existing.has(`${r.customerId}|${r.customerPart}`.toLowerCase())).length;
    if (mode === "replace") {
      removed = [...existing].filter((k) => !incoming.has(k)).length;
      statements.push(db.prepare("DELETE FROM erp_customer_parts WHERE tenant_id = ?").bind(t));
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO erp_customer_parts (tenant_id, customer_id, customer_part, sku)
           SELECT ?, json_extract(value, '$.customerId'), json_extract(value, '$.customerPart'), json_extract(value, '$.sku')
           FROM json_each(?) WHERE true
           ON CONFLICT (tenant_id, customer_id, customer_part) DO UPDATE SET sku = excluded.sku`,
        )
        .bind(t, JSON.stringify(rows.map(({ customerId, customerPart, sku }) => ({ customerId, customerPart, sku })))),
    );
  }

  const summary = { kind, mode, total, added, updated: total - added, removed, aliasesRemoved };
  if (dryRun) return c.json({ ok: true, dryRun: true, ...summary });

  // One batch: the import applies completely or not at all.
  await db.batch([...statements, audit(db, t, user.email, "catalog.imported", kind, summary)]);
  return c.json({ ok: true, dryRun: false, ...summary });
});
