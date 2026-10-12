import { limits, screenDocument, type DocKind, type Outcome } from "@stratosopx/core/ingestion-policy";
import { audit } from "../orders";
import { checkFile, sanitizeFilename } from "./filecheck";

// One path for every inbound file, whatever the channel: check structure,
// screen against the ingestion policy, then store (or not) and record it.

export type IngestInput = {
  tenantId: string;
  filename: string | null;
  bytes: Uint8Array;
  contentType: string | null;
  kind: DocKind;
  channel: "upload" | "email";
  sender: string;
  senderAllowed: boolean;
  authPassed: boolean;
  actor: string; // audit actor: user email or email:<sender>
  uploadedBy?: string;
  messageId?: string;
  subject?: string;
  extraQuarantine?: string[]; // channel-level reasons, e.g. unreadable nested message
};

export type IngestResult = {
  id: string;
  filename: string;
  outcome: Outcome;
  state: "stored" | "quarantined" | "rejected";
  reasons: string[];
  billable: boolean;
};

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ingest(env: Env, input: IngestInput): Promise<IngestResult> {
  const db = env.DB;
  const id = crypto.randomUUID();
  const filename = sanitizeFilename(input.filename);
  const hash = await sha256(input.bytes);
  const check = checkFile(filename, input.bytes);

  const dup = await db
    .prepare(
      "SELECT d.id, COALESCE(o.title, d.filename) AS label FROM documents d LEFT JOIN orders o ON o.document_id = d.id WHERE d.tenant_id = ? AND d.sha256 = ? AND d.state IN ('stored','released','quarantined') LIMIT 1",
    )
    .bind(input.tenantId, hash)
    .first<{ id: string; label: string }>();

  const screened = screenDocument({
    name: filename,
    kind: input.kind,
    sizeMB: +(input.bytes.byteLength / 1_000_000).toFixed(2),
    pages: check.pages,
    sender: input.sender,
    senderAllowed: input.senderAllowed,
    authPassed: input.authPassed,
    passwordProtected: check.passwordProtected,
    malware: check.dangerous.length ? "detected" : "clean",
    duplicateOf: dup?.label,
  });

  // File-structure findings sharpen the policy result: a mismatch or active content
  // is a reject; channel-level problems are a quarantine.
  const reasons = [...check.dangerous, ...(check.mismatch ? [check.mismatch] : []), ...screened.reasons];
  let outcome: Outcome = screened.outcome;
  if (check.dangerous.length || check.mismatch) outcome = "reject";
  else if (input.extraQuarantine?.length && outcome === "accept") outcome = "quarantine";
  if (input.extraQuarantine?.length) reasons.push(...input.extraQuarantine);

  const state = outcome === "accept" ? "stored" : outcome === "quarantine" ? "quarantined" : "rejected";
  // Rejected files are never stored; only the record is kept.
  const r2Key = state === "rejected" ? null : `${input.tenantId}/${id}/${filename}`;
  if (r2Key) {
    await env.DOCS.put(r2Key, input.bytes, {
      httpMetadata: { contentType: "application/octet-stream" },
      customMetadata: { sha256: hash, originalType: input.contentType ?? "", channel: input.channel },
    });
  }
  const expiresAt =
    state === "stored" ? days(limits.sourceRetentionDays) : state === "quarantined" ? days(limits.quarantineRetentionDays) : null;

  await db.batch([
    db
      .prepare(
        `INSERT INTO documents (id, tenant_id, filename, kind, size_bytes, pages, sender, channel, r2_key, sha256, outcome, reasons, billable,
           state, content_type, message_id, subject, uploaded_by, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.tenantId,
        filename,
        input.kind,
        input.bytes.byteLength,
        check.pages ?? null,
        input.sender,
        input.channel,
        r2Key,
        hash,
        outcome,
        JSON.stringify(reasons),
        // Billing happens per order, not per document; this flag marks documents that can become one.
        screened.billable && outcome === "accept" ? 1 : 0,
        state,
        input.contentType,
        input.messageId ?? null,
        input.subject ?? null,
        input.uploadedBy ?? null,
        expiresAt,
      ),
    audit(db, input.tenantId, input.actor, `document.${state}`, id, { filename, channel: input.channel, reasons }),
  ]);

  return { id, filename, outcome, state, reasons, billable: state === "stored" };
}
