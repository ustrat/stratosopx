import { fingerprint } from "@stratosopx/core/controls";
import { erpPayload, validateOrder, type OrderLine } from "@stratosopx/core/orders";
import { HTTPException } from "hono/http-exception";
import { requireRole } from "./auth";
import type { User } from "./env";
import { erpFor } from "./erp";
import { audit, getTenant, loadOrder } from "./orders";

// Execution policy service (Legal & Compliance Plan, section 5). The browser's
// view is never trusted: the server recomputes issues and the payload, checks the
// approver's role and the emergency stop, and only writes the exact payload the
// approver saw (bound by fingerprint).

export type LineEdit = { n: number; qty: number; uom: string; unitPrice: number; sku?: string };

export type ApproveInput = {
  lines: LineEdit[];
  shipDate: string;
  acceptedIssues: string[];
  fingerprint: string;
  note?: string;
};

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

type ItemRow = { sku: string; description: string; sell_uom: string; uom_options: string; tier_price: number; stock: number };

// Quantity, unit and price are editable. A reviewer may also reassign the SKU;
// the item's description, units, contract price and stock then come from the
// ERP catalog, never from the browser, and the match counts as confirmed.
async function applyEdits(db: D1Database, tenantId: string, lines: OrderLine[], edits: LineEdit[]): Promise<OrderLine[]> {
  const out: OrderLine[] = [];
  for (const line of lines) {
    const edit = edits.find((e) => e.n === line.n);
    if (!edit) {
      out.push(line);
      continue;
    }
    let next = line;
    if (edit.sku && edit.sku !== line.sku) {
      const item = await db
        .prepare("SELECT sku, description, sell_uom, uom_options, tier_price, stock FROM erp_items WHERE tenant_id = ? AND sku = ?")
        .bind(tenantId, edit.sku)
        .first<ItemRow>();
      if (!item) throw new HTTPException(400, { message: `SKU ${edit.sku} is not in the catalog` });
      next = {
        ...line,
        sku: item.sku,
        description: item.description,
        sellUom: item.sell_uom,
        uomOptions: JSON.parse(item.uom_options) as OrderLine["uomOptions"],
        tierPrice: item.tier_price,
        stock: item.stock,
        matchConfidence: 1,
      };
    }
    if (!Number.isFinite(edit.qty) || edit.qty < 0) throw new HTTPException(400, { message: `Invalid quantity on line ${line.n}` });
    if (!Number.isFinite(edit.unitPrice) || edit.unitPrice < 0) {
      throw new HTTPException(400, { message: `Invalid unit price on line ${line.n}` });
    }
    if (!next.uomOptions.some((u) => u.code === edit.uom)) {
      throw new HTTPException(400, { message: `Unit ${edit.uom} is not valid for ${next.sku}` });
    }
    out.push({ ...next, qty: edit.qty, uom: edit.uom, unitPrice: edit.unitPrice });
  }
  return out;
}

export async function approveOrder(db: D1Database, user: User, orderId: string, input: ApproveInput) {
  requireRole(user, "admin", "approver");
  const tenant = await getTenant(db, user.tenantId);
  if (tenant.writes_paused) throw new HTTPException(409, { message: "ERP writes are paused" });

  const loaded = await loadOrder(db, tenant, orderId);
  if (!loaded) throw new HTTPException(404, { message: "Order not found" });
  if (loaded.row.status !== "needs_review") throw new HTTPException(409, { message: `Order is already ${loaded.row.status}` });
  if (!isDate(input.shipDate)) throw new HTTPException(400, { message: "Invalid ship date" });

  const lines = await applyEdits(db, tenant.id, loaded.review.lines, input.lines ?? []);
  const issues = validateOrder(loaded.review, lines, input.shipDate);
  const accepted = new Set(input.acceptedIssues ?? []);
  const blocking = issues.filter((i) => !i.canAccept && accepted.has(i.key));
  if (blocking.length) throw new HTTPException(422, { message: `Blocking issues cannot be accepted: ${blocking[0].title}` });
  const open = issues.filter((i) => !accepted.has(i.key));
  if (open.length) throw new HTTPException(422, { message: `${open.length} exception(s) still open: ${open[0].title}` });

  const payload = erpPayload({ ...loaded.review, lines }, lines, input.shipDate);
  const fp = fingerprint(payload);
  if (fp !== input.fingerprint) {
    throw new HTTPException(409, { message: "The order changed since you reviewed it. Review the payload and approve again." });
  }

  const approvalId = crypto.randomUUID();
  const idempotencyKey = `${orderId}-${fp}`;
  const updates = lines.map((l) =>
    db
      .prepare(
        `UPDATE order_lines SET qty = ?, uom = ?, unit_price = ?, sku = ?, description = ?, sell_uom = ?, uom_options = ?, tier_price = ?, stock = ?, match_confidence = ?
         WHERE tenant_id = ? AND order_id = ? AND n = ?`,
      )
      .bind(l.qty, l.uom, l.unitPrice, l.sku, l.description, l.sellUom, JSON.stringify(l.uomOptions), l.tierPrice, l.stock, l.matchConfidence, tenant.id, orderId, l.n),
  );

  // Claim the order first so two concurrent approvals cannot both proceed.
  const claim = await db
    .prepare(
      "UPDATE orders SET ship_date = ?, status = 'approved', decided_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE tenant_id = ? AND id = ? AND status = 'needs_review'",
    )
    .bind(input.shipDate, tenant.id, orderId)
    .run();
  if (claim.meta.changes !== 1) throw new HTTPException(409, { message: "Someone else decided this order first" });

  await db.batch([
    ...updates,
    db
      .prepare(
        "INSERT INTO approvals (id, tenant_id, order_id, decision, user_id, note, fingerprint, payload, accepted_issues) VALUES (?, ?, ?, 'approved', ?, ?, ?, ?, ?)",
      )
      .bind(approvalId, tenant.id, orderId, user.id, input.note ?? null, fp, JSON.stringify(payload), JSON.stringify([...accepted])),
    audit(db, tenant.id, user.email, "order.approved", orderId, { fingerprint: fp, acceptedIssues: [...accepted] }),
  ]);

  // Tier 3 action: write the exact approved payload.
  const erp = erpFor(db, tenant);
  try {
    const result = await erp.writeSalesOrder(orderId, payload, idempotencyKey);
    await db.batch([
      db.prepare("UPDATE orders SET status = 'written' WHERE tenant_id = ? AND id = ?").bind(tenant.id, orderId),
      audit(db, tenant.id, "agent:erp-writer", "erp.write", orderId, { erp: erp.name, ...result }),
    ]);
    return { status: "written" as const, fingerprint: fp, idempotencyKey, erp: erp.name, environment: erp.environment };
  } catch (err) {
    await db.batch([
      db.prepare("UPDATE orders SET status = 'failed' WHERE tenant_id = ? AND id = ?").bind(tenant.id, orderId),
      audit(db, tenant.id, "agent:erp-writer", "erp.write_failed", orderId, { error: String(err) }),
    ]);
    throw new HTTPException(502, { message: "The ERP write failed and was logged. Nothing was posted twice." });
  }
}

export async function rejectOrder(db: D1Database, user: User, orderId: string, note?: string) {
  requireRole(user, "admin", "approver");
  const tenant = await getTenant(db, user.tenantId);
  const loaded = await loadOrder(db, tenant, orderId);
  if (!loaded) throw new HTTPException(404, { message: "Order not found" });
  if (loaded.row.status !== "needs_review") throw new HTTPException(409, { message: `Order is already ${loaded.row.status}` });

  const claim = await db
    .prepare(
      "UPDATE orders SET status = 'rejected', decided_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE tenant_id = ? AND id = ? AND status = 'needs_review'",
    )
    .bind(tenant.id, orderId)
    .run();
  if (claim.meta.changes !== 1) throw new HTTPException(409, { message: "Someone else decided this order first" });

  await db.batch([
    db
      .prepare("INSERT INTO approvals (id, tenant_id, order_id, decision, user_id, note) VALUES (?, ?, ?, 'rejected', ?, ?)")
      .bind(crypto.randomUUID(), tenant.id, orderId, user.id, note ?? null),
    audit(db, tenant.id, user.email, "order.rejected", orderId, { note: note ?? null }),
  ]);
  return { status: "rejected" as const };
}

export async function setWritesPaused(db: D1Database, user: User, paused: boolean) {
  requireRole(user, "admin", "approver");
  await db.batch([
    db.prepare("UPDATE tenants SET writes_paused = ? WHERE id = ?").bind(paused ? 1 : 0, user.tenantId),
    audit(db, user.tenantId, user.email, paused ? "writes.paused" : "writes.resumed", null),
  ]);
  return { paused };
}
