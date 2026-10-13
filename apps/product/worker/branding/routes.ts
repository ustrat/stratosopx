import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireRole } from "../auth";
import type { AppEnv } from "../env";
import { audit } from "../orders";

// A company's logo and contact details, shown on order confirmations and in
// the app header. Logos are raster only: SVG can carry script.

export const branding = new Hono<AppEnv>();

const MAX_LOGO_BYTES = 1_000_000;

export type BrandDetails = { displayName?: string; address?: string; phone?: string; email?: string; website?: string };

const FIELDS: (keyof BrandDetails)[] = ["displayName", "address", "phone", "email", "website"];
const LIMITS: Record<keyof BrandDetails, number> = { displayName: 120, address: 300, phone: 40, email: 120, website: 200 };

function detectImage(b: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

branding.get("/branding", async (c) => {
  const t = await c.env.DB.prepare("SELECT name, logo_key, logo_updated_at, brand_details FROM tenants WHERE id = ?")
    .bind(c.get("user").tenantId)
    .first<{ name: string; logo_key: string | null; logo_updated_at: string | null; brand_details: string }>();
  if (!t) throw new HTTPException(404, { message: "Company not found" });
  const details = JSON.parse(t.brand_details) as BrandDetails;
  return c.json({
    name: t.name,
    details,
    logoUrl: t.logo_key ? `/api/branding/logo?v=${encodeURIComponent(t.logo_updated_at ?? "")}` : null,
  });
});

branding.put("/branding", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const details: BrandDetails = {};
  for (const f of FIELDS) {
    const v = typeof body[f] === "string" ? (body[f] as string).trim() : "";
    if (v.length > LIMITS[f]) throw new HTTPException(400, { message: `${f} is too long` });
    if (v) details[f] = v;
  }
  if (details.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(details.email)) throw new HTTPException(400, { message: "Enter a valid email" });
  if (details.website && !/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(details.website)) {
    throw new HTTPException(400, { message: "Enter a valid website" });
  }
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE tenants SET brand_details = ? WHERE id = ?").bind(JSON.stringify(details), user.tenantId),
    audit(c.env.DB, user.tenantId, user.email, "branding.updated", null, details),
  ]);
  return c.json({ details });
});

branding.put("/branding/logo", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("logo");
  if (!(file instanceof File)) throw new HTTPException(400, { message: "Attach an image in the 'logo' field" });
  if (file.size > MAX_LOGO_BYTES) throw new HTTPException(413, { message: "The logo must be 1 MB or smaller" });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImage(bytes);
  if (!type) throw new HTTPException(400, { message: "Use a PNG, JPEG or WebP image" });

  const key = `${user.tenantId}/branding/logo`;
  await c.env.DOCS.put(key, bytes, { httpMetadata: { contentType: type } });
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE tenants SET logo_key = ?, logo_type = ?, logo_updated_at = ? WHERE id = ?").bind(key, type, now, user.tenantId),
    audit(c.env.DB, user.tenantId, user.email, "branding.logo_updated", null, { type, bytes: bytes.byteLength }),
  ]);
  return c.json({ logoUrl: `/api/branding/logo?v=${encodeURIComponent(now)}` });
});

branding.delete("/branding/logo", async (c) => {
  const user = c.get("user");
  requireRole(user, "admin");
  await c.env.DOCS.delete(`${user.tenantId}/branding/logo`);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE tenants SET logo_key = NULL, logo_type = NULL, logo_updated_at = NULL WHERE id = ?").bind(user.tenantId),
    audit(c.env.DB, user.tenantId, user.email, "branding.logo_removed", null),
  ]);
  return c.json({ logoUrl: null });
});

// Served from the app's own origin to signed-in users of this company only.
branding.get("/branding/logo", async (c) => {
  const t = await c.env.DB.prepare("SELECT logo_key, logo_type FROM tenants WHERE id = ?")
    .bind(c.get("user").tenantId)
    .first<{ logo_key: string | null; logo_type: string | null }>();
  const obj = t?.logo_key ? await c.env.DOCS.get(t.logo_key) : null;
  if (!obj || !t?.logo_type) throw new HTTPException(404, { message: "No logo" });
  return new Response(obj.body, {
    headers: {
      "Content-Type": t.logo_type,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
});
