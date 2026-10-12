import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
import { audit } from "../orders";
import { createIntakeRule, RoutingError } from "./email-routing";

// StratosOpx staff only: add customer companies (tenants) and their intake routing.

export const platform = new Hono<AppEnv>();

export async function isPlatformAdmin(db: D1Database, email: string) {
  return !!(await db.prepare("SELECT 1 FROM platform_admins WHERE email = ?").bind(email).first());
}

const requirePlatformAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (!(await isPlatformAdmin(c.env.DB, c.get("user").email))) {
    throw new HTTPException(403, { message: "Platform administrators only" });
  }
  await next();
});

platform.use("/platform/*", requirePlatformAdmin);

// Local parts that must never become a tenant's intake address.
const RESERVED = new Set(["admin", "abuse", "postmaster", "hostmaster", "webmaster", "noreply", "no-reply", "support", "security", "root", "mailer-daemon", "in", "app", "www", "hello", "legal", "privacy", "accessibility"]);

const DEFAULT_CRITERIA = [
  "Customer authorization names the system, environment and action category",
  "Authorization and execution controls passed documented testing",
  "Approvals, monitoring and recovery procedures are operational",
  "Contractual risk allocation and insurance reviewed for this service",
  "Customer-specific risk assessment approved",
  "No open authorization-bypass, cross-tenant or destructive-action findings",
].map((label) => ({ label, done: false }));

platform.get("/platform/tenants", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT t.id, t.name, t.order_plan, t.erp_format, t.intake_address, t.intake_rule_status, t.intake_rule_error, t.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS users,
            (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id) AS orders
     FROM tenants t ORDER BY t.created_at`,
  ).all();
  return c.json({ tenants: rows.results, intakeDomain: c.env.INTAKE_DOMAIN });
});

async function routeTenant(env: Env, tenantId: string, actor: string) {
  const t = await env.DB.prepare("SELECT name, intake_address FROM tenants WHERE id = ?")
    .bind(tenantId)
    .first<{ name: string; intake_address: string | null }>();
  if (!t?.intake_address) throw new HTTPException(409, { message: "This company has no intake address" });
  const address = `${t.intake_address}@${env.INTAKE_DOMAIN}`;
  try {
    const ruleId = await createIntakeRule(env, address, t.name);
    await env.DB.batch([
      env.DB.prepare("UPDATE tenants SET intake_rule_id = ?, intake_rule_status = 'active', intake_rule_error = NULL WHERE id = ?").bind(ruleId, tenantId),
      audit(env.DB, tenantId, actor, "intake.route_created", address, { ruleId }),
    ]);
    return { status: "active" as const, address };
  } catch (err) {
    if (!(err instanceof RoutingError)) throw err;
    await env.DB.prepare("UPDATE tenants SET intake_rule_status = 'failed', intake_rule_error = ? WHERE id = ?").bind(err.message, tenantId).run();
    return { status: "failed" as const, address, error: err.message };
  }
}

platform.post("/platform/tenants", async (c) => {
  const actor = c.get("user").email;
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    plan?: string;
    erpFormat?: string;
    adminEmail?: string;
  };
  const name = (body.name ?? "").trim();
  const slug = (body.slug ?? "").trim().toLowerCase();
  const adminEmail = (body.adminEmail ?? "").trim().toLowerCase();
  const plan = body.plan ?? "essentials";
  const erpFormat = body.erpFormat ?? "NetSuite";

  if (name.length < 2 || name.length > 120) throw new HTTPException(400, { message: "Enter the company name" });
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug)) {
    throw new HTTPException(400, { message: "Intake address: 3 to 32 lowercase letters, digits or hyphens" });
  }
  if (RESERVED.has(slug)) throw new HTTPException(400, { message: `"${slug}" is reserved` });
  if (!["essentials", "growth", "scale"].includes(plan)) throw new HTTPException(400, { message: "Unknown plan" });
  if (!["NetSuite", "SAP B1"].includes(erpFormat)) throw new HTTPException(400, { message: "Unknown ERP format" });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) throw new HTTPException(400, { message: "Enter the first admin's email" });

  const db = c.env.DB;
  if (await db.prepare("SELECT 1 FROM tenants WHERE intake_address = ?").bind(slug).first()) {
    throw new HTTPException(409, { message: `${slug}@${c.env.INTAKE_DOMAIN} is already taken` });
  }
  if (await db.prepare("SELECT 1 FROM users WHERE email = ?").bind(adminEmail).first()) {
    throw new HTTPException(409, { message: `${adminEmail} already belongs to a company` });
  }

  const tenantId = crypto.randomUUID();
  await db.batch([
    db
      .prepare("INSERT INTO tenants (id, name, order_plan, erp_format, launch_criteria, intake_address) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(tenantId, name, plan, erpFormat, JSON.stringify(DEFAULT_CRITERIA), slug),
    db.prepare("INSERT INTO users (id, tenant_id, email, role) VALUES (?, ?, ?, 'admin')").bind(crypto.randomUUID(), tenantId, adminEmail),
    audit(db, tenantId, actor, "tenant.created", tenantId, { name, intake: slug, plan, admin: adminEmail }),
  ]);

  const route = await routeTenant(c.env, tenantId, actor);
  return c.json({ id: tenantId, route }, 201);
});

platform.post("/platform/tenants/:id/route", async (c) => {
  return c.json(await routeTenant(c.env, c.req.param("id"), c.get("user").email));
});
