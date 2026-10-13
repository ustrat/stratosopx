import { tierInfo } from "@stratosopx/core/controls";
import { useState } from "react";
import { put, useApi, type ApiError } from "../api";
import { BrandingSettings } from "../components/BrandingSettings";
import { KillSwitch } from "../components/Controls";
import type { Controls, Me } from "../types";
import { ErrorCard, Loading } from "./common";

export function Settings() {
  const { data, error, reload } = useApi<Controls>("/controls");
  const { data: me } = useApi<Me>("/me");
  const [modeError, setModeError] = useState<string | null>(null);

  if (error) return <ErrorCard error={error} />;
  if (!data) return <Loading />;
  const met = data.launchCriteria.filter((c) => c.done).length;

  async function setMode(mode: Controls["automationMode"]) {
    try {
      await put("/controls/mode", { mode });
      setModeError(null);
      reload();
    } catch (e) {
      setModeError((e as ApiError).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings &amp; controls</h1>
          <p>What the agents may do in your systems, who approves it, and how to stop it.</p>
        </div>
      </div>

      <div className="review-layout">
        <div className="review-main">
          <section className="card" aria-labelledby="mode-title">
            <div className="card-head">
              <h2 id="mode-title">Automation mode</h2>
            </div>
            <fieldset className="mode-list">
              <legend className="sr-only">Automation mode</legend>
              {data.modes.map((m) => (
                <label key={m.id} className={`radio mode${data.automationMode === m.id ? " checked" : ""}${m.locked ? " locked" : ""}`}>
                  <input
                    type="radio"
                    name="automation-mode"
                    value={m.id}
                    checked={data.automationMode === m.id}
                    disabled={m.locked}
                    onChange={() => setMode(m.id)}
                  />
                  <span className="mode-body">
                    <strong>{m.name}</strong>
                    <span>{m.body}</span>
                    {m.locked && (
                      <span className="mode-lock">{!m.inPlan ? "Not included in your plan" : "Locked until launch acceptance is complete"}</span>
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
            {modeError && (
              <p className="hint" role="alert" style={{ color: "#fca5a5" }}>
                {modeError}
              </p>
            )}
          </section>

          <BrandingSettings isAdmin={me?.user.role === "admin"} />

          <section className="card" aria-labelledby="matrix-title">
            <div className="card-head">
              <h2 id="matrix-title">Agent permission matrix</h2>
              <span className="muted-label">Enforced at execution time</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Action</th>
                    <th scope="col">System</th>
                    <th scope="col">Risk tier</th>
                    <th scope="col">Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {data.permissionMatrix.map((a) => (
                    <tr key={a.action} className={a.tier === 4 ? "blocked" : undefined}>
                      <td>{a.action}</td>
                      <td className="desc">{a.system}</td>
                      <td>
                        <span className={`pill tone-${tierInfo[a.tier].tone}`}>
                          {a.tier} · {tierInfo[a.tier].name}
                        </span>
                      </td>
                      <td className="desc">{a.approval}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="review-side">
          <section className="card" aria-labelledby="kill-title">
            <div className="card-head">
              <h2 id="kill-title">Emergency stop</h2>
            </div>
            <p className="hint" style={{ marginTop: 0 }}>
              Stops all new ERP writes. Reading and drafting continue; approvals wait.
            </p>
            <KillSwitch />
          </section>

          <section className="card" aria-labelledby="criteria-title">
            <div className="card-head">
              <h2 id="criteria-title">Launch acceptance</h2>
              <span className="muted-label">
                {met} of {data.launchCriteria.length}
              </span>
            </div>
            <ul className="checks">
              {data.launchCriteria.map((c) => (
                <li key={c.label} className={`check check-${c.done ? "pass" : "open"}`}>
                  <span className="check-mark" aria-hidden="true">
                    {c.done ? "✓" : "!"}
                  </span>
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
