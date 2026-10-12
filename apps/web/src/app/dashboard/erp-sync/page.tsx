import type { Metadata } from "next";
import Link from "next/link";
import { KillSwitch } from "@/components/dashboard/ExecutionProvider";
import { erps, supportInfo } from "@stratosopx/core/erp-catalog";
import { screenDocument, type InboundDocument, type Outcome } from "@stratosopx/core/ingestion-policy";

export const metadata: Metadata = {
  title: "ERP sync · StratosOpx",
};

// Sample inbound traffic for the last 24 hours.
const inbound: (InboundDocument & { received: string })[] = [
  { name: "Acme_PO_48213.pdf", kind: "order", sizeMB: 1.2, pages: 3, sender: "purchasing@acme-industrial.example", senderAllowed: true, authPassed: true, malware: "clean", received: "9:42 AM" },
  { name: "Delta_PO_rev2.xlsx", kind: "order", sizeMB: 0.3, sender: "buyer@deltafasteners.example", senderAllowed: true, authPassed: true, malware: "clean", received: "8:15 AM" },
  { name: "RTD_Bid_Package_Vol2.pdf", kind: "bid", sizeMB: 18.4, pages: 142, sender: "procurement@rrta.example", senderAllowed: true, authPassed: true, malware: "clean", received: "Yesterday" },
  { name: "Brightline_PO_7781.xlsm", kind: "order", sizeMB: 0.4, sender: "ap@brightline.example", senderAllowed: true, authPassed: true, malware: "clean", received: "7:58 AM" },
  { name: "Order_confirm.pdf", kind: "order", sizeMB: 0.2, pages: 1, sender: "orders@unknown-vendor.example", senderAllowed: false, authPassed: false, malware: "clean", received: "7:31 AM" },
  { name: "invoice_viewer.exe", kind: "order", sizeMB: 2.1, sender: "billing@lookalike-acme.example", senderAllowed: false, authPassed: false, malware: "detected", received: "6:02 AM" },
  { name: "Acme_PO_48213.pdf", kind: "order", sizeMB: 1.2, pages: 3, sender: "purchasing@acme-industrial.example", senderAllowed: true, authPassed: true, malware: "clean", duplicateOf: "PO-48213", received: "9:44 AM" },
  { name: "Northgate_PO_secure.pdf", kind: "order", sizeMB: 0.6, pages: 2, sender: "buyer@northgate.example", senderAllowed: true, authPassed: true, passwordProtected: true, malware: "clean", received: "Yesterday" },
];

const outcomeTone: Record<Outcome, string> = { accept: "success", quarantine: "warning", reject: "danger" };
const outcomeLabel: Record<Outcome, string> = { accept: "Accepted", quarantine: "Quarantined", reject: "Rejected" };

const connected = erps.find((e) => e.id === "netsuite")!;
const secondary = erps.find((e) => e.id === "sap-b1")!;

export default function ErpSyncPage() {
  const screened = inbound.map((d) => ({ doc: d, result: screenDocument(d) }));
  const counts = screened.reduce<Record<Outcome, number>>(
    (acc, s) => ({ ...acc, [s.result.outcome]: acc[s.result.outcome] + 1 }),
    { accept: 0, quarantine: 0, reject: 0 },
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ERP sync</h1>
          <p>Connections, inbound document screening and write controls.</p>
        </div>
        <Link href="/integrations" className="btn btn-ghost">
          Browse ERP catalog
        </Link>
      </div>

      <div className="review-layout">
        <div className="review-main">
          <section className="card" aria-labelledby="inbound-title">
            <div className="card-head">
              <h2 id="inbound-title">Inbound documents · last 24 hours</h2>
              <span className="muted-label">
                {counts.accept} accepted · {counts.quarantine} quarantined · {counts.reject} rejected
              </span>
            </div>
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
                  {screened.map(({ doc, result }, i) => (
                    <tr key={`${doc.name}-${i}`} className={result.outcome === "reject" ? "blocked" : undefined}>
                      <td>
                        <span className="mono">{doc.name}</span>
                        <span className="cell-label">
                          {doc.kind === "bid" ? "Bid package" : "Order"} · {doc.sizeMB} MB{doc.pages ? ` · ${doc.pages} pp` : ""}
                        </span>
                      </td>
                      <td className="desc mono" style={{ fontSize: 12 }}>
                        {doc.sender}
                      </td>
                      <td className="desc">{doc.received}</td>
                      <td>
                        <span className={`pill tone-${outcomeTone[result.outcome]}`}>{outcomeLabel[result.outcome]}</span>
                        {result.reasons.length > 0 && (
                          <ul className="screen-reasons">
                            {result.reasons.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="desc">{result.billable ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint" style={{ marginBottom: 0 }}>
              Screening follows the{" "}
              <Link href="/integrations/policy">document integration &amp; ingestion policy</Link>. Quarantined documents are
              deleted after 30 days unless released.
            </p>
          </section>
        </div>

        <aside className="review-side">
          <section className="card" aria-labelledby="conn-title">
            <div className="card-head">
              <h2 id="conn-title">Connections</h2>
            </div>
            {[
              { erp: connected, env: "Production", user: "stratosopx_integration", status: "Connected", last: "Last write 2 min ago" },
              { erp: secondary, env: "Production", user: "STRATOS_INT", status: "Retrying", last: "Service Layer timeout · 2 queued" },
            ].map((c) => (
              <div key={c.erp.id} className="connection">
                <div className="match-head">
                  <strong>{c.erp.name}</strong>
                  <span className={`pill tone-${c.status === "Connected" ? "success" : "warning"}`}>{c.status}</span>
                </div>
                <dl className="meta-list">
                  <dt>Interface</dt>
                  <dd>{c.erp.interfaces[0]}</dd>
                  <dt>Environment</dt>
                  <dd>{c.env}</dd>
                  <dt>Integration user</dt>
                  <dd className="mono">{c.user}</dd>
                  <dt>Package</dt>
                  <dd>{supportInfo[c.erp.support].label}</dd>
                </dl>
                <span className="list-sub">{c.last}</span>
              </div>
            ))}
          </section>

          <section className="card" aria-labelledby="writes-title">
            <div className="card-head">
              <h2 id="writes-title">Write controls</h2>
              <Link href="/dashboard/settings">Manage ›</Link>
            </div>
            <KillSwitch />
          </section>
        </aside>
      </div>
    </>
  );
}
