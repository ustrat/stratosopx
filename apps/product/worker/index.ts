import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { authenticate } from "./auth";
import type { AppEnv } from "./env";
import { processDocument, RetryLater } from "./extract/process";
import { handleEmail } from "./intake/email";
import { enforceRetention } from "./intake/retention";
import { intake } from "./intake/routes";
import { api } from "./routes";

type ExtractJob = { tenantId: string; documentId: string };

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
  // Background extraction of accepted order documents.
  queue: async (batch, env) => {
    for (const msg of batch.messages) {
      try {
        await processDocument(env, msg.body.tenantId, msg.body.documentId);
        msg.ack();
      } catch (err) {
        if (err instanceof RetryLater) {
          msg.retry({ delaySeconds: 60 * msg.attempts });
        } else if (msg.attempts >= 3) {
          console.error("extraction failed", msg.body, err);
          await env.DB.prepare(
            "UPDATE documents SET extraction_state = 'failed', extraction_note = 'Unexpected error during extraction' WHERE tenant_id = ? AND id = ?",
          )
            .bind(msg.body.tenantId, msg.body.documentId)
            .run();
          msg.ack();
        } else {
          msg.retry({ delaySeconds: 30 });
        }
      }
    }
  },
} satisfies ExportedHandler<Env, ExtractJob>;
