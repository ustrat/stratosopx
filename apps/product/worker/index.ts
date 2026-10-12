import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { authenticate } from "./auth";
import type { AppEnv } from "./env";
import { handleEmail } from "./intake/email";
import { enforceRetention } from "./intake/retention";
import { intake } from "./intake/routes";
import { api } from "./routes";

// Requests for /api/* reach this Worker first (wrangler.jsonc run_worker_first);
// everything else is served from the built SPA assets.
const app = new Hono<AppEnv>();

app.use("/api/*", secureHeaders());
app.use("/api/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});
app.use("/api/*", authenticate);
app.route("/api", api);
app.route("/api", intake);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Something went wrong. It has been logged." }, 500);
});

export default {
  fetch: app.fetch,
  // Inbound PO email: catch-all on in.stratosopx.com routed to this Worker.
  email: (message, env) => handleEmail(message, env),
  // Daily retention job (see wrangler.jsonc triggers).
  scheduled: async (_event, env, ctx) => {
    ctx.waitUntil(enforceRetention(env));
  },
} satisfies ExportedHandler<Env>;
