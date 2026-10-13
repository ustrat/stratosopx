import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { api, post, useApi, type ApiError } from "../api";
import type { BidChoice, BidSummary, Capability, Me, PastProject } from "../types";
import { ErrorCard, Loading } from "./common";

export const choiceLabel: Record<BidChoice, { label: string; tone: string }> = {
  go: { label: "Go", tone: "success" },
  no_go: { label: "No-Go", tone: "danger" },
  needs_info: { label: "Needs info", tone: "warning" },
};

const KINDS: [string, string][] = [
  ["certification", "Certification"],
  ["insurance", "Insurance"],
  ["bonding", "Bonding"],
  ["license", "License"],
  ["safety", "Safety program"],
  ["staffing", "Staffing"],
  ["equipment", "Equipment"],
  ["other", "Other"],
];
const kindLabel = Object.fromEntries(KINDS);

const usd = (n: number | null) => (n === null ? "" : `$${n.toLocaleString("en-US")}`);

function BidList() {
  const { data, error } = useApi<{ bids: BidSummary[] }>("/bids");
  if (error) return <ErrorCard error={error} />;
  if (!data) return <Loading />;
  if (!data.bids.length) {
    return (
      <div className="placeholder" style={{ padding: "24px 0" }}>
        <h2>No bids yet</h2>
        <p>
          Upload an RFP package on the <Link to="/intake">Intake</Link> page with Type "Bid or RFP package", or email it to your intake
          address with <span className="mono">+bids</span> before the @.
        </p>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">Owner</th>
            <th scope="col">Due</th>
            <th scope="col">Recommendation</th>
            <th scope="col">Decision</th>
            <th scope="col">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.bids.map((b) => (
            <tr key={b.id}>
              <td>
                {b.title}
                {b.package_name && <span className="cell-label">{b.package_name}</span>}
              </td>
              <td className="desc">{b.owner ?? "—"}</td>
              <td className="desc">{b.due_date ?? "—"}</td>
              <td>
                <span className={`pill tone-${choiceLabel[b.recommendation].tone}`}>{choiceLabel[b.recommendation].label}</span>
              </td>
              <td>
                {b.decision ? (
                  <span className={`pill tone-${choiceLabel[b.decision].tone}`}>{choiceLabel[b.decision].label}</span>
                ) : (
                  <span className="desc">Awaiting review</span>
                )}
              </td>
              <td className="num">
                <Link to={`/bids/${b.id}`} className="btn btn-ghost btn-sm">
                  {b.status === "decided" ? "View" : "Review"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Library({ isAdmin }: { isAdmin: boolean }) {
  const { data, error, reload } = useApi<{ capabilities: Capability[]; projects: PastProject[] }>("/capabilities");
  const [cap, setCap] = useState({ kind: "insurance", name: "", detail: "", amount: "", expiresOn: "" });
  const [proj, setProj] = useState({ name: "", client: "", year: "", value: "", scope: "", outcome: "won" });
  const [msg, setMsg] = useState<string | null>(null);

  if (error) return <ErrorCard error={error} />;
  if (!data) return <Loading />;

  async function addCap(e: FormEvent) {
    e.preventDefault();
    try {
      await post("/capabilities", cap);
      setCap({ kind: cap.kind, name: "", detail: "", amount: "", expiresOn: "" });
      setMsg(null);
      reload();
    } catch (err) {
      setMsg((err as ApiError).message);
    }
  }
  async function addProj(e: FormEvent) {
    e.preventDefault();
    try {
      await post("/projects", proj);
      setProj({ name: "", client: "", year: "", value: "", scope: "", outcome: "won" });
      setMsg(null);
      reload();
    } catch (err) {
      setMsg((err as ApiError).message);
    }
  }
  async function remove(path: string) {
    await api(path, { method: "DELETE" }).catch(() => {});
    reload();
  }

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Every analysis compares the package with this library. Keep limits, expiry dates and recent projects current: an outdated
        library makes requirements show as "unclear" or "fails".
      </p>
      {msg && (
        <p className="hint" role="alert" style={{ color: "#fca5a5" }}>
          {msg}
        </p>
      )}

      <h3 className="lib-title">Capabilities</h3>
      {data.capabilities.length === 0 ? (
        <p className="empty-note">None yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Name</th>
                <th scope="col">Detail</th>
                <th scope="col" className="num">
                  Amount
                </th>
                <th scope="col">Expires</th>
                {isAdmin && (
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.capabilities.map((c) => {
                const expired = c.expires_on && c.expires_on < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={c.id}>
                    <td className="desc">{kindLabel[c.kind] ?? c.kind}</td>
                    <td>{c.name}</td>
                    <td className="desc">{c.detail ?? ""}</td>
                    <td className="num mono">{usd(c.amount)}</td>
                    <td className={expired ? "down" : "desc"}>{c.expires_on ? `${c.expires_on}${expired ? " (expired)" : ""}` : "—"}</td>
                    {isAdmin && (
                      <td className="num">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(`/capabilities/${c.id}`)} aria-label={`Remove ${c.name}`}>
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {isAdmin && (
        <form onSubmit={addCap} className="lib-form">
          <label className="select-field">
            <span>Type</span>
            <select value={cap.kind} onChange={(e) => setCap({ ...cap, kind: e.target.value })}>
              {KINDS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Name</span>
            <input className="text-input" required placeholder="General liability" value={cap.name} onChange={(e) => setCap({ ...cap, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Detail</span>
            <input className="text-input" placeholder="per occurrence, carrier, license no." value={cap.detail} onChange={(e) => setCap({ ...cap, detail: e.target.value })} />
          </label>
          <label className="field">
            <span>Amount ($)</span>
            <input className="text-input" inputMode="decimal" value={cap.amount} onChange={(e) => setCap({ ...cap, amount: e.target.value })} />
          </label>
          <label className="field">
            <span>Expires</span>
            <input className="text-input" type="date" value={cap.expiresOn} onChange={(e) => setCap({ ...cap, expiresOn: e.target.value })} />
          </label>
          <button type="submit" className="btn btn-ghost btn-sm">
            Add capability
          </button>
        </form>
      )}

      <h3 className="lib-title">Past projects</h3>
      {data.projects.length === 0 ? (
        <p className="empty-note">None yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">Client</th>
                <th scope="col">Year</th>
                <th scope="col" className="num">
                  Value
                </th>
                <th scope="col">Outcome</th>
                <th scope="col">Scope</th>
                {isAdmin && (
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="desc">{p.client ?? ""}</td>
                  <td className="desc">{p.year ?? ""}</td>
                  <td className="num mono">{usd(p.value)}</td>
                  <td className="desc" style={{ textTransform: "capitalize" }}>
                    {p.outcome.replace("_", " ")}
                  </td>
                  <td className="desc">{p.scope}</td>
                  {isAdmin && (
                    <td className="num">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(`/projects/${p.id}`)} aria-label={`Remove ${p.name}`}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isAdmin && (
        <form onSubmit={addProj} className="lib-form">
          <label className="field">
            <span>Project</span>
            <input className="text-input" required value={proj.name} onChange={(e) => setProj({ ...proj, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Client</span>
            <input className="text-input" value={proj.client} onChange={(e) => setProj({ ...proj, client: e.target.value })} />
          </label>
          <label className="field">
            <span>Year</span>
            <input className="text-input" inputMode="numeric" value={proj.year} onChange={(e) => setProj({ ...proj, year: e.target.value })} />
          </label>
          <label className="field">
            <span>Value ($)</span>
            <input className="text-input" inputMode="decimal" value={proj.value} onChange={(e) => setProj({ ...proj, value: e.target.value })} />
          </label>
          <label className="select-field">
            <span>Outcome</span>
            <select value={proj.outcome} onChange={(e) => setProj({ ...proj, outcome: e.target.value })}>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In progress</option>
            </select>
          </label>
          <label className="field lib-scope">
            <span>Scope of work</span>
            <input className="text-input" required placeholder="Traction power feeders and duct bank" value={proj.scope} onChange={(e) => setProj({ ...proj, scope: e.target.value })} />
          </label>
          <button type="submit" className="btn btn-ghost btn-sm">
            Add project
          </button>
        </form>
      )}
    </>
  );
}

export function Bids() {
  const { data: me } = useApi<Me>("/me");
  const [tab, setTab] = useState<"bids" | "library">("bids");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bids &amp; RFPs</h1>
          <p>Go / No-Go recommendations, dealbreakers and compliance matrices, checked against your capability library.</p>
        </div>
      </div>
      <section className="card">
        <div className="billing-toggle" role="tablist" aria-label="Bids">
          <button type="button" role="tab" aria-selected={tab === "bids"} className={tab === "bids" ? "active" : undefined} onClick={() => setTab("bids")}>
            Bids
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "library"}
            className={tab === "library" ? "active" : undefined}
            onClick={() => setTab("library")}
          >
            Capability library
          </button>
        </div>
        {tab === "bids" ? <BidList /> : <Library isAdmin={me?.user.role === "admin"} />}
      </section>
      <p className="hint">Analyses run in the background after upload; larger packages take a few minutes.</p>
    </>
  );
}
