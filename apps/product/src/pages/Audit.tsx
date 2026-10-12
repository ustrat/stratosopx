import { formatDateTime, useApi } from "../api";
import type { AuditEntry } from "../types";
import { ErrorCard, Loading } from "./common";

export function Audit() {
  const { data, error } = useApi<{ entries: AuditEntry[] }>("/audit");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p>Every approval, rejection, ERP write and control change, newest first.</p>
        </div>
      </div>
      {error ? (
        <ErrorCard error={error} />
      ) : !data ? (
        <Loading />
      ) : data.entries.length === 0 ? (
        <div className="card placeholder">
          <h2>No activity yet</h2>
        </div>
      ) : (
        <section className="card" aria-label="Audit entries">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Target</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e, i) => (
                  <tr key={i}>
                    <td className="desc" style={{ whiteSpace: "nowrap" }}>
                      {formatDateTime(e.created_at)}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {e.actor}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {e.action}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {e.target ?? "—"}
                    </td>
                    <td className="desc mono" style={{ fontSize: 11, maxWidth: 360, wordBreak: "break-word" }}>
                      {Object.keys(e.detail).length ? JSON.stringify(e.detail) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
