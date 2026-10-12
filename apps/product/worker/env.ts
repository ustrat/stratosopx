// Bindings and variables beyond what `wrangler types` generates from wrangler.jsonc.
declare global {
  interface Env {
    /** Local development only (.dev.vars): the signed-in user's email. */
    DEV_USER_EMAIL?: string;
    /** Secret: Claude API key for order extraction (wrangler secret put ANTHROPIC_API_KEY). */
    ANTHROPIC_API_KEY?: string;
    /** Secret: Cloudflare API token with Email Routing Rules: Edit on stratosopx.com. */
    CF_EMAIL_ROUTING_TOKEN?: string;
  }
}

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "approver" | "viewer";
  tenantId: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: { user: User };
};
