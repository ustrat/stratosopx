import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv, User } from "./env";

// Identity comes from Cloudflare Access, which sits in front of app.stratosopx.com
// and signs every request with a JWT. The Worker verifies that JWT itself rather
// than trusting the network path (Legal & Compliance Plan: authenticate the user,
// bind actions to a tenant). Users must also be invited (a row in `users`).

const jwksByTeam = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwks(teamDomain: string) {
  let set = jwksByTeam.get(teamDomain);
  if (!set) {
    set = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksByTeam.set(teamDomain, set);
  }
  return set;
}

async function emailFromAccess(req: Request, env: Env): Promise<string> {
  const team = String(env.ACCESS_TEAM_DOMAIN);
  const aud = String(env.ACCESS_AUD);
  if (!team || !aud) throw new HTTPException(500, { message: "Access is not configured" });

  const token = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new HTTPException(401, { message: "Not signed in" });

  try {
    const { payload } = await jwtVerify(token, jwks(team), { issuer: `https://${team}`, audience: aud });
    if (typeof payload.email !== "string") throw new Error("no email claim");
    return payload.email;
  } catch {
    throw new HTTPException(401, { message: "Invalid sign-in token" });
  }
}

function emailFromDev(req: Request, env: Env): string {
  const host = new URL(req.url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new HTTPException(500, { message: "Dev auth is only allowed on localhost" });
  }
  if (!env.DEV_USER_EMAIL) throw new HTTPException(500, { message: "Set DEV_USER_EMAIL in .dev.vars" });
  return env.DEV_USER_EMAIL;
}

export const authenticate = createMiddleware<AppEnv>(async (c, next) => {
  const mode = String(c.env.AUTH_MODE);
  const email =
    mode === "dev" ? emailFromDev(c.req.raw, c.env) : mode === "access" ? await emailFromAccess(c.req.raw, c.env) : null;
  if (!email) throw new HTTPException(500, { message: "Unknown AUTH_MODE" });

  const row = await c.env.DB.prepare("SELECT id, email, name, role, tenant_id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; email: string; name: string | null; role: User["role"]; tenant_id: string }>();
  if (!row) throw new HTTPException(403, { message: `${email} has not been invited to StratosOpx` });

  c.set("user", { id: row.id, email: row.email, name: row.name, role: row.role, tenantId: row.tenant_id });
  await next();
});

export function requireRole(user: User, ...roles: User["role"][]) {
  if (!roles.includes(user.role)) throw new HTTPException(403, { message: "Your role does not allow this action" });
}
