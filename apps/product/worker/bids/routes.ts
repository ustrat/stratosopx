import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireRole } from "../auth";
import type { AppEnv } from "../env";
import { audit } from "../orders";
import type { Requirement } from "./recommend";

export const bids = new Hono<AppEnv>();

const CHOICES = ["go", "no_go", "needs_info"] as const;
type Choice = (typeof CHOICES)[number];

bids.get("/bids", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, title, owner, package_name, due_date, recommendation, status, decision, created_at
     FROM bids WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 200`,
  )
    .bind(c.get("user").tenantId)
    .all();
  return c.json({ bids: rows.results });
});

type BidRow = {
  id: string;
  document_id: string | null;
  title: string;
  owner: string | null;
  package_name: string | null;
  due_date: string | null;
  pages: number | null;
  summary: string | null;
  requirements: string;
  scope_matches: string;
  warnings: string;
  recommendation: Choice;
  recommendation_reason: string;
  status: "needs_review" | "decided";
  decision: Choice | null;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

async function loadBid(db: D1Database, tenantId: string, id: string) {
  const b = await db.prepare("SELECT * FROM bids WHERE tenant_id = ? AND id = ?").bind(tenantId, id).first<BidRow>();
  if (!b) throw new HTTPException(404, { message: "Bid not found" });
  return b;
}

bids.get("/bids/:id", async (c) => {
  const user = c.get("user");
  const b = await loadBid(c.env.DB, user.tenantId, c.req.param("id"));
  const doc = b.document_id
    ? await c.env.DB.prepare("SELECT filename, sender, channel, received_at FROM documents WHERE tenant_id = ? AND id = ?")
        .bind(user.tenantId, b.document_id)
        .first()
    : null;
  return c.json({
    ...b,
    requirements: JSON.parse(b.requirements),
    scope_matches: JSON.parse(b.scope_matches),
    warnings: JSON.parse(b.warnings),
    document: doc,
    canDecide: user.role !== "viewer",
  });
});

bids.post("/bids/:id/decision", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin", "approver");
  const { choice, note } = (await c.req.json().catch(() => ({}))) as { choice?: Choice; note?: string };
  if (!choice || !CHOICES.includes(choice)) throw new HTTPException(400, { message: "Choose Go, No-Go or Needs info" });
  const b = await loadBid(c.env.DB, user.tenantId, c.req.param("id"));
  if (b.status === "decided") throw new HTTPException(409, { message: "This bid has already been decided" });
  const trimmed = (note ?? "").trim();
  // Overriding the recommendation needs a recorded reason.
  if (choice !== b.recommendation && !trimmed) {
    throw new HTTPException(422, { message: "Give a reason for overriding the recommendation" });
  }
  const claim = await c.env.DB.prepare(
    "UPDATE bids SET status = 'decided', decision = ?, decision_note = ?, decided_by = ?, decided_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE tenant_id = ? AND id = ? AND status = 'needs_review'",
  )
    .bind(choice, trimmed || null, user.email, user.tenantId, b.id)
    .run();
  if (claim.meta.changes !== 1) throw new HTTPException(409, { message: "Someone else decided this bid first" });
  await audit(c.env.DB, user.tenantId, user.email, "bid.decided", b.id, {
    choice,
    recommendation: b.recommendation,
    override: choice !== b.recommendation,
    note: trimmed || null,
  }).run();
  return c.json({ status: "decided", decision: choice });
});

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralize spreadsheet formulas in untrusted text.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

bids.get("/bids/:id/matrix.csv", async (c) => {
  const user = c.get("user");
  const b = await loadBid(c.env.DB, user.tenantId, c.req.param("id"));
  const reqs = JSON.parse(b.requirements) as Requirement[];
  const header = ["Clause", "Page", "Category", "Requirement", "Mandatory", "Dealbreaker", "Status", "Evidence"];
  const lines = [
    header.map(csvCell).join(","),
    ...reqs.map((r) =>
      [r.clause, r.page, r.category, r.requirement, r.mandatory ? "Yes" : "No", r.dealbreaker ? "Yes" : "No", r.status, r.evidence]
        .map(csvCell)
        .join(","),
    ),
  ];
  const name = b.title.replace(/[^A-Za-z0-9 _-]+/g, "").trim().slice(0, 60) || "bid";
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name} - compliance matrix.csv"`,
    },
  });
});

// ---- Capability library ----

const KINDS = ["certification", "insurance", "bonding", "license", "safety", "staffing", "equipment", "other"];
const OUTCOMES = ["won", "lost", "completed", "in_progress"];
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

bids.get("/capabilities", async (c) => {
  const t = c.get("user").tenantId;
  const [caps, projects] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT id, kind, name, detail, amount, expires_on FROM capabilities WHERE tenant_id = ? ORDER BY kind, name").bind(t),
    c.env.DB.prepare("SELECT id, name, client, year, value, scope, outcome FROM past_projects WHERE tenant_id = ? ORDER BY year DESC, name").bind(t),
  ]);
  return c.json({ capabilities: caps.results, projects: projects.results });
});

bids.post("/capabilities", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = String(b.kind ?? "");
  const name = String(b.name ?? "").trim();
  const detail = String(b.detail ?? "").trim() || null;
  const amount = b.amount === "" || b.amount === null || b.amount === undefined ? null : Number(b.amount);
  const expires = String(b.expiresOn ?? "").trim() || null;
  if (!KINDS.includes(kind)) throw new HTTPException(400, { message: "Choose a type" });
  if (!name || name.length > 200) throw new HTTPException(400, { message: "Enter a name" });
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) throw new HTTPException(400, { message: "Amount must be a number" });
  if (expires && !isDate(expires)) throw new HTTPException(400, { message: "Expiry must be a date" });
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO capabilities (id, tenant_id, kind, name, detail, amount, expires_on) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
      id,
      user.tenantId,
      kind,
      name,
      detail?.slice(0, 500) ?? null,
      amount,
      expires,
    ),
    audit(c.env.DB, user.tenantId, user.email, "capability.added", id, { kind, name }),
  ]);
  return c.json({ id }, 201);
});

bids.delete("/capabilities/:id", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM capabilities WHERE tenant_id = ? AND id = ?").bind(user.tenantId, c.req.param("id")),
    audit(c.env.DB, user.tenantId, user.email, "capability.removed", c.req.param("id")),
  ]);
  return c.json({ removed: true });
});

bids.post("/projects", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  const scope = String(b.scope ?? "").trim();
  const outcome = String(b.outcome ?? "");
  const year = b.year ? Number(b.year) : null;
  const value = b.value === "" || b.value === null || b.value === undefined ? null : Number(b.value);
  if (!name || name.length > 200) throw new HTTPException(400, { message: "Enter the project name" });
  if (!scope) throw new HTTPException(400, { message: "Describe the scope of work" });
  if (!OUTCOMES.includes(outcome)) throw new HTTPException(400, { message: "Choose an outcome" });
  if (year !== null && (!Number.isInteger(year) || year < 1950 || year > 2100)) throw new HTTPException(400, { message: "Year looks wrong" });
  if (value !== null && (!Number.isFinite(value) || value < 0)) throw new HTTPException(400, { message: "Value must be a number" });
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO past_projects (id, tenant_id, name, client, year, value, scope, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(
      id,
      user.tenantId,
      name,
      String(b.client ?? "").trim() || null,
      year,
      value,
      scope.slice(0, 2000),
      outcome,
    ),
    audit(c.env.DB, user.tenantId, user.email, "project.added", id, { name }),
  ]);
  return c.json({ id }, 201);
});

bids.delete("/projects/:id", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM past_projects WHERE tenant_id = ? AND id = ?").bind(user.tenantId, c.req.param("id")),
    audit(c.env.DB, user.tenantId, user.email, "project.removed", c.req.param("id")),
  ]);
  return c.json({ removed: true });
});
