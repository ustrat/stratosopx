import type { Metadata } from "next";
import Link from "next/link";
import { ErpCatalog } from "@/components/integrations/ErpCatalog";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { supportInfo } from "@stratosopx/core/erp-catalog";

export const metadata: Metadata = {
  title: "ERP integrations · StratosOpx",
  description: "The ERP systems StratosOpx works with, grouped by how we connect, and what implementation each needs.",
};

export default function IntegrationsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="pricing">
        <section className="container pricing-hero">
          <span className="eyebrow">INTEGRATIONS</span>
          <h1>Your ERP stays the system of record.</h1>
          <p className="hero-lead">
            StratosOpx reads your items, prices and inventory, and writes approved orders back through the interfaces your
            ERP already supports. Below are the systems U.S. manufacturers and distributors run most, grouped by how we
            connect to them.
          </p>
          <div className="support-legend">
            {Object.values(supportInfo).map((s) => (
              <div key={s.label}>
                <span className={`pill tone-${s.tone}`}>{s.label}</span>
                <span>{s.detail}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="container pricing-section" aria-label="ERP catalog">
          <ErpCatalog />
        </section>

        <section className="container pricing-section">
          <div className="pricing-section-head">
            <div>
              <h2>Don&apos;t see your ERP?</h2>
              <p>
                If your system can import orders from a CSV or XML file, StratosOpx can work with it. We confirm the details in
                a Readiness Assessment before quoting. Product names are trademarks of their owners; listing does not imply
                endorsement or partnership.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/integrations/policy" className="btn btn-ghost">
                Ingestion policy
              </Link>
              <Link href="/#demo" className="btn btn-primary">
                Ask about your ERP
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
