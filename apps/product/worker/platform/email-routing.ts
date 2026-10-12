// Cloudflare Email Routing rules for tenant intake addresses
// (<intake_address>@in.stratosopx.com -> this Worker). Needs the zone ID (var
// CF_ZONE_ID) and a token with "Email Routing Rules: Edit" (secret
// CF_EMAIL_ROUTING_TOKEN) on the stratosopx.com zone only.

type CfResponse<T> = { success: boolean; errors: { code: number; message: string }[]; result: T };

export class RoutingError extends Error {}

async function cf<T>(env: Env, method: string, path: string, body?: unknown): Promise<T> {
  const zone = String(env.CF_ZONE_ID ?? "");
  if (!zone || !env.CF_EMAIL_ROUTING_TOKEN) {
    throw new RoutingError("Automatic email routing isn't configured (CF_ZONE_ID / CF_EMAIL_ROUTING_TOKEN)");
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/email/routing${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.CF_EMAIL_ROUTING_TOKEN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as CfResponse<T> | null;
  if (!res.ok || !data?.success) {
    const msg = data?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new RoutingError(`Cloudflare rejected the routing rule: ${msg}`);
  }
  return data.result;
}

export async function createIntakeRule(env: Env, address: string, tenantName: string) {
  const rule = await cf<{ id: string }>(env, "POST", "/rules", {
    name: `StratosOpx intake: ${tenantName}`.slice(0, 256),
    enabled: true,
    matchers: [{ type: "literal", field: "to", value: address }],
    actions: [{ type: "worker", value: [String(env.INTAKE_WORKER)] }],
  });
  return rule.id;
}

export async function deleteIntakeRule(env: Env, ruleId: string) {
  await cf(env, "DELETE", `/rules/${encodeURIComponent(ruleId)}`);
}
