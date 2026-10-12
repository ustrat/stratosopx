import { limits, type DocKind } from "@stratosopx/core/ingestion-policy";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireRole } from "../auth";
import type { AppEnv } from "../env";
import { audit } from "../orders";
import { enqueueExtraction } from "../extract/process";
import { ingest } from "./ingest";

export const intake = new Hono<AppEnv>();

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

intake.get("/intake", async (c) => {
  const user = c.get("user");
  const [tenant, senders] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT intake_address FROM tenants WHERE id = ?").bind(user.tenantId),
    c.env.DB.prepare("SELECT pattern, added_by, created_at FROM intake_senders WHERE tenant_id = ? ORDER BY pattern").bind(user.tenantId),
  ]);
  const local = (tenant.results[0] as { intake_address: string | null } | undefined)?.intake_address;
  return c.json({
    address: local ? `${local}@${c.env.INTAKE_DOMAIN}` : null,
    senders: senders.results,
    limits: { maxFileMB: limits.maxFileMB, orderMaxPages: limits.orderMaxPages, bidMaxPages: limits.bidMaxPages },
  });
});

intake.post("/intake/senders", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  const { pattern } = (await c.req.json().catch(() => ({}))) as { pattern?: string };
  const p = (pattern ?? "").trim().toLowerCase();
  if (!/^([^@\s]+@[^@\s]+\.[^@\s]+|@[^@\s]+\.[^@\s]+)$/.test(p)) {
    throw new HTTPException(400, { message: "Enter an email address or @domain.com" });
  }
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT OR IGNORE INTO intake_senders (tenant_id, pattern, added_by) VALUES (?, ?, ?)").bind(user.tenantId, p, user.email),
    audit(c.env.DB, user.tenantId, user.email, "intake.sender_added", p),
  ]);
  return c.json({ pattern: p });
});

intake.delete("/intake/senders/:pattern", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  const p = decodeURIComponent(c.req.param("pattern")).toLowerCase();
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM intake_senders WHERE tenant_id = ? AND pattern = ?").bind(user.tenantId, p),
    audit(c.env.DB, user.tenantId, user.email, "intake.sender_removed", p),
  ]);
  return c.json({ removed: p });
});

intake.get("/documents", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, filename, kind, size_bytes, pages, sender, channel, outcome, state, reasons, subject, uploaded_by, received_at, expires_at, r2_key IS NOT NULL AS has_file,
            extraction_state, extraction_note, order_id
     FROM documents WHERE tenant_id = ? ORDER BY received_at DESC LIMIT 100`,
  )
    .bind(c.get("user").tenantId)
    .all();
  return c.json({ documents: rows.results.map((d) => ({ ...d, reasons: JSON.parse(String(d.reasons)) })) });
});

intake.post("/documents", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin", "approver");
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) throw new HTTPException(400, { message: "Attach a file in the 'file' field" });
  const kind = (form.get("kind") === "bid" ? "bid" : "order") as DocKind;
  // Over-limit files are still screened and recorded as rejected; only refuse
  // bodies far beyond any accepted size before reading them into memory.
  if (file.size > limits.maxFileMB * 1_000_000 * 4) {
    throw new HTTPException(413, { message: `File is too large (limit ${limits.maxFileMB} MB)` });
  }

  const result = await ingest(c.env, {
    tenantId: user.tenantId,
    filename: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type || null,
    kind,
    channel: "upload",
    sender: user.email,
    senderAllowed: true, // a signed-in user is an authorized channel
    authPassed: true,
    actor: user.email,
    uploadedBy: user.email,
  });
  return c.json(result, 201);
});

async function loadDoc(c: { env: Env }, tenantId: string, id: string) {
  const doc = await c.env.DB.prepare("SELECT id, state, r2_key, filename FROM documents WHERE tenant_id = ? AND id = ?")
    .bind(tenantId, id)
    .first<{ id: string; state: string; r2_key: string | null; filename: string }>();
  if (!doc) throw new HTTPException(404, { message: "Document not found" });
  return doc;
}

intake.post("/documents/:id/release", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  const doc = await loadDoc(c, user.tenantId, c.req.param("id"));
  if (doc.state !== "quarantined") throw new HTTPException(409, { message: `Document is ${doc.state}, not quarantined` });
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE documents SET state = 'released', billable = 1, decided_by = ?, decided_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), expires_at = ? WHERE tenant_id = ? AND id = ?",
    ).bind(user.email, days(limits.sourceRetentionDays), user.tenantId, doc.id),
    audit(c.env.DB, user.tenantId, user.email, "document.released", doc.id, { filename: doc.filename }),
  ]);
  await enqueueExtraction(c.env, user.tenantId, doc.id);
  return c.json({ state: "released" });
});

intake.delete("/documents/:id", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  const doc = await loadDoc(c, user.tenantId, c.req.param("id"));
  if (doc.r2_key) await c.env.DOCS.delete(doc.r2_key);
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE documents SET state = 'deleted', r2_key = NULL, decided_by = ?, decided_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE tenant_id = ? AND id = ?",
    ).bind(user.email, user.tenantId, doc.id),
    audit(c.env.DB, user.tenantId, user.email, "document.deleted", doc.id, { filename: doc.filename }),
  ]);
  return c.json({ state: "deleted" });
});

// Download as an attachment only: customer files are untrusted and must never
// render inside the app's origin.
intake.get("/documents/:id/file", async (c) => {
  const user = c.get("user");
  const doc = await loadDoc(c, user.tenantId, c.req.param("id"));
  if (!doc.r2_key || !["stored", "released"].includes(doc.state)) {
    throw new HTTPException(409, { message: "Only accepted or released documents can be downloaded" });
  }
  const obj = await c.env.DOCS.get(doc.r2_key);
  if (!obj) throw new HTTPException(404, { message: "File is no longer stored" });
  await audit(c.env.DB, user.tenantId, user.email, "document.downloaded", doc.id).run();
  return new Response(obj.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
});

intake.post("/documents/:id/extract", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin", "approver");
  const doc = await loadDoc(c, user.tenantId, c.req.param("id"));
  if (!["stored", "released"].includes(doc.state)) throw new HTTPException(409, { message: "Only accepted documents can be extracted" });
  const row = await c.env.DB.prepare("SELECT extraction_state FROM documents WHERE tenant_id = ? AND id = ?")
    .bind(user.tenantId, doc.id)
    .first<{ extraction_state: string }>();
  if (row && ["queued", "running", "done"].includes(row.extraction_state)) {
    throw new HTTPException(409, { message: `Extraction is already ${row.extraction_state}` });
  }
  await enqueueExtraction(c.env, user.tenantId, doc.id);
  await audit(c.env.DB, user.tenantId, user.email, "document.extraction_requested", doc.id).run();
  return c.json({ extraction_state: "queued" });
});

intake.get("/catalog", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT sku, description, sell_uom, uom_options, tier_price, stock FROM erp_items WHERE tenant_id = ? ORDER BY sku",
  )
    .bind(c.get("user").tenantId)
    .all<{ sku: string; description: string; sell_uom: string; uom_options: string; tier_price: number; stock: number }>();
  return c.json({
    items: rows.results.map((r) => ({
      sku: r.sku,
      description: r.description,
      sellUom: r.sell_uom,
      uomOptions: JSON.parse(r.uom_options),
      tierPrice: r.tier_price,
      stock: r.stock,
    })),
  });
});
