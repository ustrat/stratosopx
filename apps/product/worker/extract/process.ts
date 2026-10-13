import { validateOrder, type OrderReview, type Uom } from "@stratosopx/core/orders";
import { analyzeBid, BidRetryLater } from "../bids/process";
import { audit, type TenantRow } from "../orders";
import { extractWithClaude, type Catalog } from "./claude";
import { convert } from "./convert";
import { buildLines, filterModelWarnings, resolveCustomer, resolveShipDate, type CatalogItem, type PriorOrder } from "./draft";

export class RetryLater extends Error {}

type DocRow = {
  id: string;
  pages: number | null;
  tenant_id: string;
  filename: string;
  kind: "order" | "bid";
  state: string;
  r2_key: string | null;
  sender: string | null;
  subject: string | null;
  received_at: string;
  extraction_state: string;
};

const now = () => new Date().toISOString();

function setState(db: D1Database, doc: DocRow, state: string, note: string | null, extra: Record<string, string | null> = {}) {
  const cols = Object.keys(extra);
  return db
    .prepare(
      `UPDATE documents SET extraction_state = ?, extraction_note = ?, extracted_at = ?${cols.map((c) => `, ${c} = ?`).join("")} WHERE tenant_id = ? AND id = ?`,
    )
    .bind(state, note, now(), ...cols.map((c) => extra[c]), doc.tenant_id, doc.id);
}

async function loadCatalog(db: D1Database, tenant: TenantRow) {
  const [customers, items, aliases] = await db.batch([
    db.prepare("SELECT id, name, credit_limit, open_balance FROM erp_customers WHERE tenant_id = ? ORDER BY name").bind(tenant.id),
    db.prepare("SELECT sku, description, sell_uom, uom_options, tier_price, stock FROM erp_items WHERE tenant_id = ? ORDER BY sku").bind(tenant.id),
    db.prepare("SELECT customer_id, customer_part, sku FROM erp_customer_parts WHERE tenant_id = ?").bind(tenant.id),
  ]);
  const customerRows = customers.results as { id: string; name: string; credit_limit: number; open_balance: number }[];
  const itemMap = new Map<string, CatalogItem>();
  for (const r of items.results as { sku: string; description: string; sell_uom: string; uom_options: string; tier_price: number; stock: number }[]) {
    itemMap.set(r.sku, {
      sku: r.sku,
      description: r.description,
      sellUom: r.sell_uom,
      uomOptions: JSON.parse(r.uom_options) as Uom[],
      tierPrice: r.tier_price,
      stock: r.stock,
    });
  }
  const aliasRows = aliases.results as { customer_id: string; customer_part: string; sku: string }[];
  const aliasMap = new Map(aliasRows.map((a) => [`${a.customer_id}|${a.customer_part.toLowerCase()}`, a.sku]));

  const catalog: Catalog = {
    tenantName: tenant.name,
    customers: customerRows.map((c) => ({ id: c.id, name: c.name })),
    items: [...itemMap.values()].map((i) => ({ sku: i.sku, description: i.description, sellUom: i.sellUom, uoms: i.uomOptions.map((u) => u.code) })),
    aliases: aliasRows.map((a) => ({ customerId: a.customer_id, customerPart: a.customer_part, sku: a.sku })),
  };
  return { catalog, customerRows, itemMap, aliasMap };
}

async function loadPrior(db: D1Database, tenantId: string, customerId: string, poNumber: string): Promise<PriorOrder | null> {
  const row = await db
    .prepare(
      "SELECT id, ship_date, sales_order FROM orders WHERE tenant_id = ? AND customer_id = ? AND po_number = ? AND status IN ('approved','written') ORDER BY received_at DESC LIMIT 1",
    )
    .bind(tenantId, customerId, poNumber)
    .first<{ id: string; ship_date: string; sales_order: string | null }>();
  if (!row) return null;
  const lines = await db
    .prepare("SELECT sku, qty FROM order_lines WHERE tenant_id = ? AND order_id = ?")
    .bind(tenantId, row.id)
    .all<{ sku: string; qty: number }>();
  return { id: row.id, shipDate: row.ship_date, salesOrder: row.sales_order, qtyBySku: new Map(lines.results.map((l) => [l.sku, l.qty])) };
}

export async function processDocument(env: Env, tenantId: string, documentId: string) {
  const db = env.DB;
  const doc = await db.prepare("SELECT * FROM documents WHERE tenant_id = ? AND id = ?").bind(tenantId, documentId).first<DocRow>();
  if (!doc || !["stored", "released"].includes(doc.state) || !doc.r2_key) return;

  // At-least-once delivery: never create a second order for the same document.
  const existing = await db.prepare("SELECT id FROM orders WHERE tenant_id = ? AND document_id = ?").bind(tenantId, doc.id).first<{ id: string }>();
  if (existing) {
    await setState(db, doc, "done", null, { order_id: existing.id }).run();
    return;
  }
  if (doc.kind === "bid") {
    const bid = await db.prepare("SELECT id FROM bids WHERE tenant_id = ? AND document_id = ?").bind(tenantId, doc.id).first<{ id: string }>();
    if (bid) {
      await setState(db, doc, "done", null, { bid_id: bid.id }).run();
      return;
    }
  }

  await setState(db, doc, "running", null).run();
  const tenant = await db.prepare("SELECT * FROM tenants WHERE id = ?").bind(tenantId).first<TenantRow>();
  const obj = await env.DOCS.get(doc.r2_key);
  if (!tenant || !obj) {
    await setState(db, doc, "failed", "The stored file is missing.").run();
    return;
  }

  const bytes = new Uint8Array(await obj.arrayBuffer());

  if (doc.kind === "bid") {
    try {
      const r = await analyzeBid(env, tenant, doc, bytes);
      await db.batch([
        setState(db, doc, r.state, r.note, { bid_id: r.bidId ?? null, extraction_usage: r.usage ?? null }),
        ...(r.state === "not_order" ? [db.prepare("UPDATE documents SET billable = 0 WHERE tenant_id = ? AND id = ?").bind(tenantId, doc.id)] : []),
      ]);
    } catch (err) {
      if (err instanceof BidRetryLater) {
        await setState(db, doc, "queued", err.message).run();
        throw new RetryLater(err.message);
      }
      throw err;
    }
    return;
  }

  const converted = convert(doc.filename, bytes);
  if (!converted.ok) {
    await setState(db, doc, "needs_attention", converted.reason).run();
    return;
  }

  const { catalog, customerRows, itemMap, aliasMap } = await loadCatalog(db, tenant);
  const result = await extractWithClaude(env, catalog, converted.blocks, {
    filename: doc.filename,
    sender: doc.sender,
    subject: doc.subject,
  });
  if (!result.ok) {
    if (result.retryable) {
      await setState(db, doc, "queued", result.reason).run();
      throw new RetryLater(result.reason);
    }
    await setState(db, doc, "failed", result.reason, { extraction_usage: result.usage ? JSON.stringify(result.usage) : null }).run();
    return;
  }

  const ext = result.extraction;
  const record = { extraction: JSON.stringify(ext), extraction_usage: JSON.stringify(result.usage) };
  const needsAttention = (note: string) =>
    db.batch([
      setState(db, doc, "needs_attention", note, record),
      audit(db, tenantId, "agent:extractor", "document.needs_attention", doc.id, { note }),
    ]);

  if (ext.document_type === "not_an_order") {
    await db.batch([
      setState(db, doc, "not_order", "Not a purchase order or change order; nothing was created and it is not billed.", record),
      db.prepare("UPDATE documents SET billable = 0 WHERE tenant_id = ? AND id = ?").bind(tenantId, doc.id),
    ]);
    return;
  }

  const customerId = resolveCustomer(ext, catalog.customers);
  if (!customerId) {
    await needsAttention(`Customer "${ext.customer_name ?? "unknown"}" isn't in the ERP customer list.`);
    return;
  }
  const poNumber = ext.po_number?.trim();
  if (!poNumber) {
    await needsAttention("No PO number found on the document.");
    return;
  }

  let prior: PriorOrder | null = null;
  const warnings: string[] = [];
  if (ext.document_type === "change_order") {
    prior = await loadPrior(db, tenantId, customerId, poNumber);
    if (!prior) warnings.push(`This looks like a change to PO ${poNumber}, but no approved order with that number was found. Treated as a new order.`);
  } else {
    const dup = await db
      .prepare("SELECT title FROM orders WHERE tenant_id = ? AND customer_id = ? AND po_number = ? AND status != 'rejected' LIMIT 1")
      .bind(tenantId, customerId, poNumber)
      .first<{ title: string }>();
    if (dup) {
      await needsAttention(`PO ${poNumber} was already received as order ${dup.title}. If this is a revision, send it as a change order.`);
      return;
    }
  }

  const { lines, warnings: lineWarnings, facts } = buildLines(ext.lines, customerId, itemMap, aliasMap, prior);
  if (!lines.length) {
    await needsAttention("No order lines were found on the document.");
    return;
  }
  const ship = resolveShipDate(ext.ship_date, doc.received_at);
  // Server findings first, then the model's notes that are still open.
  warnings.push(...lineWarnings);
  if (ship.warning) warnings.push(ship.warning);
  warnings.push(...filterModelWarnings(ext.warnings, ext.lines, facts, { shipDateDefaulted: !!ship.warning }));

  const customer = customerRows.find((c) => c.id === customerId)!;
  const orderId = crypto.randomUUID();
  const kind = prior ? "change-order" : "po";
  const review: OrderReview = {
    kind,
    id: orderId,
    title: poNumber,
    poNumber,
    ...(prior ? { salesOrder: prior.salesOrder ?? prior.id } : {}),
    customer: { name: customer.name, id: customer.id, creditLimit: customer.credit_limit, openBalance: customer.open_balance },
    receivedAt: doc.received_at,
    sourceFile: doc.filename,
    channel: "",
    erp: tenant.erp_format,
    shipDate: ship.date,
    ...(prior && prior.shipDate !== ship.date ? { prevShipDate: prior.shipDate } : {}),
    lines,
  };
  const issues = validateOrder(review, lines, ship.date);

  await db.batch([
    db
      .prepare(
        `INSERT INTO orders (id, tenant_id, document_id, kind, title, po_number, sales_order, customer_id, ship_date, prev_ship_date, status, initial_issue_count, received_at, extraction_warnings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'needs_review', ?, ?, ?)`,
      )
      .bind(
        orderId,
        tenantId,
        doc.id,
        kind,
        poNumber,
        poNumber,
        review.salesOrder ?? null,
        customerId,
        ship.date,
        review.prevShipDate ?? null,
        issues.length,
        doc.received_at,
        JSON.stringify(warnings),
      ),
    ...lines.map((l) =>
      db
        .prepare(
          `INSERT INTO order_lines (order_id, tenant_id, n, customer_part, sku, description, match_confidence, qty, uom, unit_price, sell_uom, uom_options, tier_price, stock, prev_qty, prev_unit_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        )
        .bind(
          orderId,
          tenantId,
          l.n,
          l.customerPart,
          l.sku,
          l.description,
          l.matchConfidence,
          l.qty,
          l.uom,
          l.unitPrice,
          l.sellUom,
          JSON.stringify(l.uomOptions),
          l.tierPrice,
          l.stock,
          l.prev?.qty ?? null,
        ),
    ),
    setState(db, doc, "done", null, { ...record, order_id: orderId }),
    audit(db, tenantId, "agent:extractor", "order.created", orderId, {
      document: doc.id,
      po: poNumber,
      kind,
      lines: lines.length,
      issues: issues.length,
    }),
  ]);
}

export async function enqueueExtraction(env: Env, tenantId: string, documentId: string) {
  await env.DB.prepare("UPDATE documents SET extraction_state = 'queued', extraction_note = NULL WHERE tenant_id = ? AND id = ?")
    .bind(tenantId, documentId)
    .run();
  await env.EXTRACT_QUEUE.send({ tenantId, documentId });
}
