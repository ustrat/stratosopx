import { useState, type FormEvent } from "react";
import { formatDateTime, post, useApi, type ApiError } from "../api";
import { ErrorCard, Loading } from "./common";

type Tenant = {
  id: string;
  name: string;
  order_plan: string;
  erp_format: string;
  intake_address: string | null;
  intake_rule_status: "none" | "active" | "failed" | "manual";
  intake_rule_error: string | null;
  created_at: string;
  users: number;
  orders: number;
};

const routeLabel: Record<Tenant["intake_rule_status"], { label: string; tone: string }> = {
  active: { label: "Routing active", tone: "success" },
  manual: { label: "Set up by hand", tone: "info" },
  failed: { label: "Routing failed", tone: "danger" },
  none: { label: "No routing", tone: "warning" },
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

export function Companies() {
  const { data, error, reload } = useApi<{ tenants: Tenant[]; intakeDomain: string }>("/platform/tenants");
  const [form, setForm] = useState({ name: "", slug: "", plan: "growth", erpFormat: "NetSuite", adminEmail: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  if (error) return <ErrorCard error={error} />;
  if (!data) return <Loading />;

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await post<{ route: { status: string; address: string; error?: string } }>("/platform/tenants", form);
      setMessage(
        res.route.status === "active"
          ? { ok: true, text: `Created. Mail to ${res.route.address} now reaches the app.` }
          : { ok: false, text: `Company created, but the intake rule failed: ${res.route.error}. Use Retry once it's fixed.` },
      );
      setForm({ name: "", slug: "", plan: "growth", erpFormat: "NetSuite", adminEmail: "" });
      setSlugTouched(false);
      reload();
    } catch (err) {
      setMessage({ ok: false, text: (err as ApiError).message });
    } finally {
      setBusy(false);
    }
  }

  async function retry(id: string) {
    await post(`/platform/tenants/${id}/route`, {}).catch(() => {});
    reload();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Companies</h1>
          <p>StratosOpx customers. Adding one creates its workspace, its first admin and its intake email address.</p>
        </div>
      </div>

      <div className="review-layout">
        <div className="review-main">
          <section className="card" aria-label="Companies">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Company</th>
                    <th scope="col">Intake address</th>
                    <th scope="col">Plan</th>
                    <th scope="col" className="num">
                      Users
                    </th>
                    <th scope="col" className="num">
                      Orders
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.tenants.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {t.name}
                        <span className="cell-label">Added {formatDateTime(t.created_at)}</span>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: 12 }}>
                          {t.intake_address ? `${t.intake_address}@${data.intakeDomain}` : "—"}
                        </span>
                        <div style={{ marginTop: 4 }}>
                          <span className={`pill tone-${routeLabel[t.intake_rule_status].tone}`}>
                            {routeLabel[t.intake_rule_status].label}
                          </span>
                          {t.intake_rule_status === "failed" && (
                            <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => retry(t.id)}>
                              Retry
                            </button>
                          )}
                        </div>
                        {t.intake_rule_error && t.intake_rule_status === "failed" && (
                          <ul className="screen-reasons">
                            <li>{t.intake_rule_error}</li>
                          </ul>
                        )}
                      </td>
                      <td className="desc" style={{ textTransform: "capitalize" }}>
                        {t.order_plan} · {t.erp_format}
                      </td>
                      <td className="num">{t.users}</td>
                      <td className="num">{t.orders.toLocaleString("en-US")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="review-side">
          <section className="card" aria-labelledby="add-title">
            <div className="card-head">
              <h2 id="add-title">Add a company</h2>
            </div>
            <form onSubmit={create} className="decision-form">
              <label className="field">
                <span>Company name</span>
                <input
                  className="text-input"
                  required
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                  }}
                />
              </label>
              <label className="field">
                <span>Intake address</span>
                <span className="address-input">
                  <input
                    className="text-input mono"
                    required
                    pattern="[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }));
                    }}
                  />
                  <span className="mono">@{data.intakeDomain}</span>
                </span>
              </label>
              <label className="field">
                <span>First admin's email</span>
                <input
                  className="text-input"
                  type="email"
                  required
                  value={form.adminEmail}
                  onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                />
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <label className="select-field" style={{ flex: 1 }}>
                  <span>Plan</span>
                  <select value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}>
                    <option value="essentials">Essentials</option>
                    <option value="growth">Growth</option>
                    <option value="scale">Scale</option>
                  </select>
                </label>
                <label className="select-field" style={{ flex: 1 }}>
                  <span>ERP format</span>
                  <select value={form.erpFormat} onChange={(e) => setForm((f) => ({ ...f, erpFormat: e.target.value }))}>
                    <option value="NetSuite">NetSuite</option>
                    <option value="SAP B1">SAP B1</option>
                  </select>
                </label>
              </div>
              <button type="submit" className="btn btn-gradient" disabled={busy} style={{ marginTop: 14 }}>
                {busy ? "Creating…" : "Create company"}
              </button>
              {message && (
                <p className="hint" role="status" style={{ color: message.ok ? "var(--success)" : "#fca5a5" }}>
                  {message.text}
                </p>
              )}
            </form>
            <p className="hint" style={{ marginBottom: 0 }}>
              The first admin signs in at app.stratosopx.com with their email. They start with an empty catalog and no allowed senders.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
