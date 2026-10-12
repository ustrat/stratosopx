import { formatDateTime, useApi } from "../api";
import type { DocumentRow } from "../types";
import { ErrorCard, Loading } from "./common";

const outcome = {
  accept: { label: "Accepted", tone: "success" },
  quarantine: { label: "Quarantined", tone: "warning" },
  reject: { label: "Rejected", tone: "danger" },
} as const;

export function ErpSync() {
  const { data, error } = useApi<{ documents: DocumentRow[] }>("/documents");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ERP sync</h1>
          <p>Connections and inbound document screening.</p>
        </div>
      </div>

      <div className="review-layout">
        <div className="review-main">
          <section className="card" aria-labelledby="inbound-title">
            <div className="card-head">
              <h2 id="inbound-title">Inbound documents</h2>
              <span className="muted-label">Latest 100</span>
            </div>
            {error ? (
              <ErrorCard error={error} />
            ) : !data ? (
              <Loading />
            ) : data.documents.length === 0 ? (
              <p className="empty-note">No documents received yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Document</th>
                      <th scope="col">Sender</th>
                      <th scope="col">Received</th>
                      <th scope="col">Screening</th>
                      <th scope="col">Billable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.documents.map((d) => (
                      <tr key={d.id} className={d.outcome === "reject" ? "blocked" : undefined}>
                        <td>
                          <span className="mono">{d.filename}</span>
                          <span className="cell-label">
                            {d.kind === "bid" ? "Bid package" : "Order"} · {(d.size_bytes / 1e6).toFixed(1)} MB
                            {d.pages ? ` · ${d.pages} pp` : ""} · {d.channel}
                          </span>
                        </td>
                        <td className="desc mono" style={{ fontSize: 12 }}>
                          {d.sender ?? "—"}
                        </td>
                        <td className="desc">{formatDateTime(d.received_at)}</td>
                        <td>
                          <span className={`pill tone-${outcome[d.outcome].tone}`}>{outcome[d.outcome].label}</span>
                          {d.reasons.length > 0 && (
                            <ul className="screen-reasons">
                              {d.reasons.map((r) => (
                                <li key={r}>{r}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="desc">{d.billable ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="review-side">
          <section className="card" aria-labelledby="conn-title">
            <div className="card-head">
              <h2 id="conn-title">Connection</h2>
              <span className="pill tone-info">Sandbox</span>
            </div>
            <dl className="meta-list">
              <dt>ERP</dt>
              <dd>Mock ERP</dd>
              <dt>Payload format</dt>
              <dd>NetSuite sales order</dd>
              <dt>Writes</dt>
              <dd>Stored for inspection; nothing leaves StratosOpx</dd>
            </dl>
            <p className="hint" style={{ marginBottom: 0 }}>
              A real ERP connection replaces this once a design partner provides sandbox access.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
