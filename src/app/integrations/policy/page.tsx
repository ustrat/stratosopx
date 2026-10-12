import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { POLICY_DATE, POLICY_VERSION, acceptedFiles, limits, policySections } from "@/lib/ingestion-policy";

export const metadata: Metadata = {
  title: "Document integration & ingestion policy · StratosOpx",
  description: "How StratosOpx accepts, screens, processes, retains and writes customer documents and ERP records.",
};

export default function IngestionPolicyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="pricing">
        <section className="container pricing-hero">
          <span className="eyebrow">POLICY</span>
          <h1>Document integration &amp; ingestion policy</h1>
          <p className="hint" style={{ margin: 0 }}>
            Version {POLICY_VERSION} · {POLICY_DATE} · Pending legal and security review
          </p>
        </section>

        <div className="container policy-layout">
          <nav aria-label="Policy sections" className="policy-toc">
            {policySections.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.title}
              </a>
            ))}
          </nav>

          <div className="policy-body">
            {policySections.map((s) => (
              <section key={s.id} id={s.id} className="policy-section">
                <h2>{s.title}</h2>
                <ul>
                  {s.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>

                {s.id === "formats" && (
                  <div className="card table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th scope="col">Format</th>
                          <th scope="col">Extensions</th>
                          <th scope="col">Orders</th>
                          <th scope="col">Bids</th>
                          <th scope="col">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acceptedFiles.map((f) => (
                          <tr key={f.label}>
                            <td>{f.label}</td>
                            <td className="mono desc">{f.ext.map((e) => `.${e}`).join(" ")}</td>
                            <td>{f.kinds.includes("order") ? "Yes" : "—"}</td>
                            <td>{f.kinds.includes("bid") ? "Yes" : "—"}</td>
                            <td className="desc">{f.note ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {s.id === "data" && (
                  <dl className="meta-list policy-limits">
                    <dt>Source documents</dt>
                    <dd>{limits.sourceRetentionDays} days</dd>
                    <dt>Unreleased quarantine</dt>
                    <dd>{limits.quarantineRetentionDays} days</dd>
                    <dt>Deletion after termination</dt>
                    <dd>Within {limits.deletionAfterTerminationDays} days</dd>
                  </dl>
                )}
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
