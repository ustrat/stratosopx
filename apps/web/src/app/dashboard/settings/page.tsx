import type { Metadata } from "next";
import { AutomationMode } from "@/components/dashboard/AutomationMode";
import { KillSwitch } from "@/components/dashboard/ExecutionProvider";
import { launchCriteria, permissionMatrix, tierInfo } from "@stratosopx/core/controls";

export const metadata: Metadata = {
  title: "Settings & controls · StratosOpx",
};

export default function SettingsPage() {
  const met = launchCriteria.filter((c) => c.done).length;

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
            <AutomationMode criteriaMet={met === launchCriteria.length} />
          </section>

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
                  {permissionMatrix.map((a) => (
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
            <p className="hint" style={{ marginBottom: 0 }}>
              Approval binds to the exact action, target and payload. If any of them change, a new approval is required.
            </p>
          </section>
        </div>

        <aside className="review-side">
          <section className="card" aria-labelledby="kill-title">
            <div className="card-head">
              <h2 id="kill-title">Emergency stop</h2>
            </div>
            <p className="hint" style={{ marginTop: 0 }}>
              Stops all new ERP writes for every agent. Reading and drafting continue; queued approvals wait.
            </p>
            <KillSwitch />
          </section>

          <section className="card" aria-labelledby="criteria-title">
            <div className="card-head">
              <h2 id="criteria-title">Launch acceptance</h2>
              <span className="muted-label">
                {met} of {launchCriteria.length}
              </span>
            </div>
            <ul className="checks">
              {launchCriteria.map((c) => (
                <li key={c.label} className={`check check-${c.done ? "pass" : "open"}`}>
                  <span className="check-mark" aria-hidden="true">
                    {c.done ? "✓" : "!"}
                  </span>
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
            <p className="hint" style={{ marginBottom: 0 }}>
              Auto-post stays locked until every item is complete for your account.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
