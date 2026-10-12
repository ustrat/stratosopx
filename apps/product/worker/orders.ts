import type { OrderLine, OrderReview, Uom } from "@stratosopx/core/orders";

// Row shapes as stored in D1.

export type TenantRow = {
  id: string;
  name: string;
  order_plan: "essentials" | "growth" | "scale";
  automation_mode: "assist" | "rule-based" | "policy";
  writes_paused: number;
  erp_format: "NetSuite" | "SAP B1";
  erp_connection: "mock";
  launch_criteria: string;
};

export type OrderRow = {
  id: string;
  tenant_id: string;
  document_id: string | null;
  kind: "po" | "change-order";
  title: string;
  po_number: string;
  sales_order: string | null;
  customer_id: string;
  ship_date: string;
  prev_ship_date: string | null;
  status: "needs_review" | "approved" | "rejected" | "written" | "failed";
  initial_issue_count: number;
  received_at: string;
  decided_at: string | null;
};

type LineRow = {
  n: number;
  customer_part: string;
  sku: string;
  description: string;
  match_confidence: number;
  qty: number;
  uom: string;
  unit_price: number;
  sell_uom: string;
  uom_options: string;
  tier_price: number;
  stock: number;
  prev_qty: number | null;
  prev_unit_price: number | null;
};

type CustomerRow = { id: string; name: string; credit_limit: number; open_balance: number };

export type LoadedOrder = {
  row: OrderRow;
  review: OrderReview;
  source: { filename: string | null; channel: string | null; sender: string | null };
};

export async function getTenant(db: D1Database, tenantId: string) {
  const t = await db.prepare("SELECT * FROM tenants WHERE id = ?").bind(tenantId).first<TenantRow>();
  if (!t) throw new Error(`tenant ${tenantId} missing`);
  return t;
}

function toLine(r: LineRow): OrderLine {
  const prev: OrderLine["prev"] = {};
  if (r.prev_qty !== null) prev.qty = r.prev_qty;
  if (r.prev_unit_price !== null) prev.unitPrice = r.prev_unit_price;
  return {
    n: r.n,
    customerPart: r.customer_part,
    sku: r.sku,
    description: r.description,
    matchConfidence: r.match_confidence,
    qty: r.qty,
    uom: r.uom,
    unitPrice: r.unit_price,
    sellUom: r.sell_uom,
    uomOptions: JSON.parse(r.uom_options) as Uom[],
    tierPrice: r.tier_price,
    stock: r.stock,
    ...(Object.keys(prev).length ? { prev } : {}),
  };
}

export async function loadOrder(db: D1Database, tenant: TenantRow, orderId: string): Promise<LoadedOrder | null> {
  const row = await db
    .prepare("SELECT * FROM orders WHERE tenant_id = ? AND id = ?")
    .bind(tenant.id, orderId)
    .first<OrderRow>();
  if (!row) return null;

  const [lines, customer, doc] = await db.batch([
    db.prepare("SELECT * FROM order_lines WHERE tenant_id = ? AND order_id = ? ORDER BY n").bind(tenant.id, orderId),
    db.prepare("SELECT * FROM erp_customers WHERE tenant_id = ? AND id = ?").bind(tenant.id, row.customer_id),
    db
      .prepare("SELECT filename, channel, sender FROM documents WHERE tenant_id = ? AND id = ?")
      .bind(tenant.id, row.document_id ?? ""),
  ]);
  const c = (customer.results as CustomerRow[])[0];
  const d = (doc.results as { filename: string; channel: string; sender: string | null }[])[0];

  const review: OrderReview = {
    kind: row.kind,
    id: row.id,
    title: row.title,
    poNumber: row.po_number,
    ...(row.sales_order ? { salesOrder: row.sales_order } : {}),
    customer: {
      name: c?.name ?? row.customer_id,
      id: row.customer_id,
      creditLimit: c?.credit_limit ?? 0,
      openBalance: c?.open_balance ?? 0,
    },
    receivedAt: row.received_at,
    sourceFile: d?.filename ?? "",
    channel: d?.channel ?? "",
    erp: tenant.erp_format,
    shipDate: row.ship_date,
    ...(row.prev_ship_date ? { prevShipDate: row.prev_ship_date } : {}),
    lines: (lines.results as LineRow[]).map(toLine),
  };

  return { row, review, source: { filename: d?.filename ?? null, channel: d?.channel ?? null, sender: d?.sender ?? null } };
}

export function audit(
  db: D1Database,
  tenantId: string,
  actor: string,
  action: string,
  target: string | null,
  detail: Record<string, unknown> = {},
) {
  return db
    .prepare("INSERT INTO audit_log (tenant_id, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)")
    .bind(tenantId, actor, action, target, JSON.stringify(detail));
}
