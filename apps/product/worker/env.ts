// Bindings and variables beyond what `wrangler types` generates from wrangler.jsonc.
declare global {
  interface Env {
    /** Local development only (.dev.vars): the signed-in user's email. */
    DEV_USER_EMAIL?: string;
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
