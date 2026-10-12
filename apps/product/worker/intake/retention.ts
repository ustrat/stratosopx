// Daily retention job (Ingestion Policy section 7): delete source files past
// their retention date. The database row stays as the audit record.

export async function enforceRetention(env: Env) {
  const now = new Date().toISOString();
  const due = await env.DB.prepare(
    "SELECT id, tenant_id, r2_key, state FROM documents WHERE state IN ('stored','released','quarantined') AND expires_at IS NOT NULL AND expires_at < ? LIMIT 500",
  )
    .bind(now)
    .all<{ id: string; tenant_id: string; r2_key: string | null; state: string }>();

  const byTenant = new Map<string, number>();
  for (const d of due.results) {
    if (d.r2_key) await env.DOCS.delete(d.r2_key);
    byTenant.set(d.tenant_id, (byTenant.get(d.tenant_id) ?? 0) + 1);
  }

  if (due.results.length) {
    await env.DB.batch([
      ...due.results.map((d) =>
        env.DB.prepare("UPDATE documents SET state = 'expired', r2_key = NULL WHERE tenant_id = ? AND id = ?").bind(d.tenant_id, d.id),
      ),
      ...[...byTenant].map(([tenantId, count]) =>
        env.DB.prepare("INSERT INTO audit_log (tenant_id, actor, action, detail) VALUES (?, 'system:retention', 'documents.expired', ?)").bind(
          tenantId,
          JSON.stringify({ count }),
        ),
      ),
    ]);
  }
  return due.results.length;
}
