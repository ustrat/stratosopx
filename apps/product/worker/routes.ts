import { launchCriteriaMet, permissionMatrix, planAllows, automationModes } from "@stratosopx/core/controls";
import { validateOrder } from "@stratosopx/core/orders";
import { orderTiers } from "@stratosopx/core/pricing";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireRole } from "./auth";
import type { AppEnv } from "./env";
import { erpFor } from "./erp";
import { approveOrder, rejectOrder, setWritesPaused, type ApproveInput } from "./execution";
import { getTenant, loadOrder, type OrderRow, type TenantRow } from "./orders";

export const api = new Hono<AppEnv>();

async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }
}

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

function criteria(t: TenantRow) {
  return JSON.parse(t.launch_criteria) as { label: string; done: boolean }[];
}

api.get("/me", async (c) => {
  const user = c.get("user");
  const tenant = await getTenant(c.env.DB, user.tenantId);
  return c.json({ user, tenant: { id: tenant.id, name: tenant.name } });
});

api.get("/overview", async (c) => {
  const db = c.env.DB;
  const user = c.get("user");
  const tenant = await getTenant(db, user.tenantId);
  const since = monthStart();

  const [decided, perDay, received, open] = await db.batch([
    db
      .prepare(
        "SELECT COUNT(*) AS n, SUM(CASE WHEN initial_issue_count = 0 THEN 1 ELSE 0 END) AS clean FROM orders WHERE tenant_id = ? AND status IN ('approved','written') AND decided_at >= ?",
      )
      .bind(tenant.id, since),
    db
      .prepare(
        "SELECT substr(received_at, 1, 10) AS day, COUNT(*) AS n FROM orders WHERE tenant_id = ? AND status != 'rejected' AND received_at >= ? GROUP BY day ORDER BY day",
      )
      .bind(tenant.id, since),
    db
      .prepare(
        "SELECT SUM(CASE WHEN kind = 'po' AND initial_issue_count = 0 THEN 1 ELSE 0 END) AS clean, SUM(CASE WHEN kind = 'change-order' THEN 1 ELSE 0 END) AS change, SUM(CASE WHEN kind = 'po' AND initial_issue_count > 0 THEN 1 ELSE 0 END) AS exception FROM orders WHERE tenant_id = ? AND received_at >= ?",
      )
      .bind(tenant.id, since),
    db
      .prepare("SELECT id FROM orders WHERE tenant_id = ? AND status = 'needs_review' ORDER BY received_at DESC")
      .bind(tenant.id),
  ]);

  const d = (decided.results as { n: number; clean: number | null }[])[0];
  const r = (received.results as { clean: number | null; change: number | null; exception: number | null }[])[0];

  // Live exceptions on every open order.
  const queue = [];
  let openExceptions = 0;
  let blocking = 0;
  for (const { id } of open.results as { id: string }[]) {
    const o = await loadOrder(db, tenant, id);
    if (!o) continue;
    const issues = validateOrder(o.review, o.review.lines, o.review.shipDate);
    openExceptions += issues.length;
    const b = issues.filter((i) => i.severity === "blocking").length;
    blocking += b;
    queue.push({
      id,
      title: o.review.title,
      customer: o.review.customer.name,
      reason: issues[0]?.title ?? "Ready to approve",
      status: b ? "Blocked" : o.review.kind === "change-order" ? "Change order" : issues.length ? "Needs review" : "Ready",
      tone: b ? "danger" : o.review.kind === "change-order" ? "info" : issues.length ? "warning" : "success",
      kind: o.review.kind,
      issues: issues.length,
    });
  }

  const tier = orderTiers.find((t) => t.id === tenant.order_plan)!;
  const used = d?.n ?? 0;
  const now = new Date();
  const daysElapsed = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const projected = Math.round((used / daysElapsed) * daysInMonth);
  const totalReceived = (r?.clean ?? 0) + (r?.change ?? 0) + (r?.exception ?? 0);
  const share = (n: number | null) => (totalReceived ? Math.round(((n ?? 0) / totalReceived) * 100) : 0);
  const crit = criteria(tenant);

  return c.json({
    tenant: { name: tenant.name, writesPaused: !!tenant.writes_paused, automationMode: tenant.automation_mode },
    kpis: {
      processed: used,
      straightThrough: used ? (d?.clean ?? 0) / used : null,
      openExceptions,
      blocking,
      openOrders: queue.length,
    },
    queue: queue.slice(0, 5),
    queueTotal: queue.length,
    volume: (perDay.results as { day: string; n: number }[]).map((x) => ({ day: x.day, n: x.n })),
    routing: { clean: share(r?.clean ?? 0), change: share(r?.change ?? 0), exception: share(r?.exception ?? 0), total: totalReceived },
    usage: {
      plan: tier.name,
      used,
      included: tier.included,
      overage: tier.overage,
      projected,
      projectedOverage: Math.max(0, projected - tier.included),
    },
    launch: { met: crit.filter((x) => x.done).length, total: crit.length },
  });
});

api.get("/orders", async (c) => {
  const user = c.get("user");
  const filter = c.req.query("status") ?? "open";
  const where =
    filter === "open" ? "status = 'needs_review'" : filter === "decided" ? "status != 'needs_review'" : "1 = 1";
  const rows = await c.env.DB.prepare(
    `SELECT o.id, o.title, o.kind, o.status, o.received_at, o.decided_at, o.po_number, c.name AS customer
     FROM orders o LEFT JOIN erp_customers c ON c.tenant_id = o.tenant_id AND c.id = o.customer_id
     WHERE o.tenant_id = ? AND ${where} ORDER BY o.received_at DESC LIMIT 200`,
  )
    .bind(user.tenantId)
    .all<Pick<OrderRow, "id" | "title" | "kind" | "status" | "received_at" | "decided_at" | "po_number"> & { customer: string }>();
  return c.json({ orders: rows.results });
});

api.get("/orders/:id", async (c) => {
  const db = c.env.DB;
  const user = c.get("user");
  const tenant = await getTenant(db, user.tenantId);
  const o = await loadOrder(db, tenant, c.req.param("id"));
  if (!o) throw new HTTPException(404, { message: "Order not found" });

  const decision = await db
    .prepare(
      `SELECT a.decision, a.note, a.fingerprint, a.created_at, u.email AS approver
       FROM approvals a JOIN users u ON u.id = a.user_id
       WHERE a.tenant_id = ? AND a.order_id = ? ORDER BY a.created_at DESC LIMIT 1`,
    )
    .bind(tenant.id, o.row.id)
    .first();
  const erp = erpFor(db, tenant);

  return c.json({
    order: o.review,
    status: o.row.status,
    source: o.source,
    decision,
    erp: { name: erp.name, environment: erp.environment, format: tenant.erp_format },
    writesPaused: !!tenant.writes_paused,
    canApprove: user.role !== "viewer",
  });
});

api.post("/orders/:id/approve", async (c) => {
  const input = await body<ApproveInput>(c.req.raw);
  return c.json(await approveOrder(c.env.DB, c.get("user"), c.req.param("id"), input));
});

api.post("/orders/:id/reject", async (c) => {
  const { note } = await body<{ note?: string }>(c.req.raw);
  return c.json(await rejectOrder(c.env.DB, c.get("user"), c.req.param("id"), note));
});

api.get("/controls", async (c) => {
  const tenant = await getTenant(c.env.DB, c.get("user").tenantId);
  const crit = criteria(tenant);
  const met = launchCriteriaMet(crit);
  return c.json({
    writesPaused: !!tenant.writes_paused,
    automationMode: tenant.automation_mode,
    orderPlan: tenant.order_plan,
    launchCriteria: crit,
    modes: automationModes.map((m) => ({
      ...m,
      inPlan: planAllows(tenant.order_plan, m.minTier),
      locked: m.id !== "assist" && (!planAllows(tenant.order_plan, m.minTier) || !met),
    })),
    permissionMatrix,
  });
});

api.put("/controls/writes", async (c) => {
  const { paused } = await body<{ paused: boolean }>(c.req.raw);
  if (typeof paused !== "boolean") throw new HTTPException(400, { message: "paused must be true or false" });
  return c.json(await setWritesPaused(c.env.DB, c.get("user"), paused));
});

api.put("/controls/mode", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  const { mode } = await body<{ mode: TenantRow["automation_mode"] }>(c.req.raw);
  const tenant = await getTenant(c.env.DB, user.tenantId);
  const target = automationModes.find((m) => m.id === mode);
  if (!target) throw new HTTPException(400, { message: "Unknown automation mode" });
  if (mode !== "assist") {
    if (!planAllows(tenant.order_plan, target.minTier)) throw new HTTPException(403, { message: "Not included in your plan" });
    if (!launchCriteriaMet(criteria(tenant))) {
      throw new HTTPException(403, { message: "Auto-post stays locked until launch acceptance is complete" });
    }
  }
  await c.env.DB.prepare("UPDATE tenants SET automation_mode = ? WHERE id = ?").bind(mode, tenant.id).run();
  return c.json({ mode });
});

api.get("/documents", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, filename, kind, size_bytes, pages, sender, channel, outcome, reasons, billable, received_at FROM documents WHERE tenant_id = ? ORDER BY received_at DESC LIMIT 100",
  )
    .bind(c.get("user").tenantId)
    .all();
  return c.json({ documents: rows.results.map((d) => ({ ...d, reasons: JSON.parse(String(d.reasons)) })) });
});

api.get("/audit", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  const rows = await c.env.DB.prepare(
    "SELECT actor, action, target, detail, created_at FROM audit_log WHERE tenant_id = ? ORDER BY id DESC LIMIT 100",
  )
    .bind(user.tenantId)
    .all();
  return c.json({ entries: rows.results.map((e) => ({ ...e, detail: JSON.parse(String(e.detail)) })) });
});
