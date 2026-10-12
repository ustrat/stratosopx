import { limits } from "@stratosopx/core/ingestion-policy";
import PostalMime from "postal-mime";
import { audit } from "../orders";
import { ingest } from "./ingest";

// Inbound email for <intake_address>@in.stratosopx.com, delivered by Cloudflare
// Email Routing (catch-all on the subdomain -> this Worker). Each attachment is
// screened as its own document; a message without attachments is treated as a
// PO in the email body.

export async function senderAllowed(db: D1Database, tenantId: string, sender: string) {
  const domain = "@" + (sender.split("@")[1] ?? "");
  const row = await db
    .prepare("SELECT 1 FROM intake_senders WHERE tenant_id = ? AND (pattern = ? OR pattern = ?) LIMIT 1")
    .bind(tenantId, sender, domain)
    .first();
  return !!row;
}

// Email Routing records SPF / DKIM / DMARC results in Authentication-Results.
// Pass requires DMARC pass, or SPF and DKIM both passing when no DMARC result exists.
export function authenticationPassed(headers: { key: string; value: string }[]) {
  const results = headers
    .filter((h) => h.key === "authentication-results" || h.key === "arc-authentication-results")
    .map((h) => h.value.toLowerCase())
    .join(" ; ");
  if (/dmarc=pass/.test(results)) return true;
  if (/dmarc=(fail|quarantine|reject)/.test(results)) return false;
  return /spf=pass/.test(results) && /dkim=pass/.test(results);
}

export async function handleEmail(message: ForwardableEmailMessage, env: Env) {
  const [localPart, domain] = message.to.toLowerCase().split("@");
  // Mail for other domains (e.g. a zone-wide catch-all) is dropped silently, like
  // Email Routing's Drop action; bouncing it would send backscatter to forged senders.
  if (domain !== String(env.INTAKE_DOMAIN)) return;
  const local = localPart!.split("+")[0]!;
  const tenant = await env.DB.prepare("SELECT id FROM tenants WHERE intake_address = ?").bind(local).first<{ id: string }>();
  if (!tenant) {
    message.setReject("Unknown StratosOpx address");
    return;
  }
  if (message.rawSize > limits.maxMessageMB * 1_000_000) {
    message.setReject(`Message is larger than ${limits.maxMessageMB} MB`);
    return;
  }

  const email = await PostalMime.parse(message.raw, { attachmentEncoding: "arraybuffer", maxRfc822NestingDepth: 3 });
  const sender = (email.from?.address ?? message.from).toLowerCase();
  const allowed = await senderAllowed(env.DB, tenant.id, sender);
  const authPassed = authenticationPassed(email.headers);
  // Messages nested deeper than the parser inspects could hide content from screening.
  const extraQuarantine = email.attachments.some((a) => a.rfc822DepthExceeded)
    ? ["Contains nested messages too deep to inspect"]
    : [];

  const attachments = email.attachments.filter((a) => a.disposition !== "inline" || a.filename);
  const common = {
    tenantId: tenant.id,
    kind: "order" as const,
    channel: "email" as const,
    sender,
    senderAllowed: allowed,
    authPassed,
    actor: `email:${sender}`,
    messageId: email.messageId ?? undefined,
    subject: email.subject ?? undefined,
    extraQuarantine,
  };

  if (attachments.length > limits.maxAttachments) {
    await audit(env.DB, tenant.id, `email:${sender}`, "email.too_many_attachments", null, {
      count: attachments.length,
      processed: limits.maxAttachments,
    }).run();
  }

  if (attachments.length === 0) {
    const body = (email.text ?? "").trim();
    if (!body) return;
    await ingest(env, { ...common, filename: "email-body.txt", bytes: new TextEncoder().encode(body), contentType: "text/plain" });
    return;
  }

  for (const a of attachments.slice(0, limits.maxAttachments)) {
    const bytes = new Uint8Array(a.content as ArrayBuffer);
    await ingest(env, { ...common, filename: a.filename, bytes, contentType: a.mimeType });
  }
}
