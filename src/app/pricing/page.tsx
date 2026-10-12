import type { Metadata } from "next";
import Link from "next/link";
import { OrderPlans } from "@/components/pricing/OrderPlans";
import { RoiCalculator } from "@/components/pricing/RoiCalculator";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { bidTiers, bundles, services, usd } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing · StratosOpx",
  description: "Published pricing for the Order Reconciliation Agent and Bid Qualification Agent. No per-user fees.",
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />

      <main id="main" className="pricing">
        <section className="container pricing-hero">
          <span className="eyebrow">PRICING</span>
          <h1>Priced on outcomes, not seats.</h1>
          <p className="hero-lead">
            Published prices, no per-user fees, and fixed-fee implementation, so you know your first-year cost before you
            sign. Every plan starts in Assist mode: a person approves every order before it reaches your ERP.
          </p>
        </section>

        <section className="container pricing-section" aria-labelledby="order-plans">
          <div className="pricing-section-head">
            <div>
              <h2 id="order-plans">Order Reconciliation Agent</h2>
              <p>Billed by orders processed. One customer PO becomes one ERP sales order, whatever the line count.</p>
            </div>
          </div>
          <OrderPlans />
          <ul className="pricing-notes">
            <li>A change order to an existing PO counts as one order. Duplicate and rejected documents are not billed.</li>
            <li>Above 4,000 orders a month: custom quote from Scale pricing plus $0.85 per additional order.</li>
            <li>
              *Auto-post is switched on only after your authorization schedule is signed and approval, monitoring and recovery
              controls are tested for your account.
            </li>
          </ul>
        </section>

        <section className="container pricing-section" aria-labelledby="roi-title">
          <div className="pricing-section-head">
            <div>
              <h2 id="roi-title">What it&apos;s worth to you</h2>
              <p>A conservative labor-plus-rework model. Change the numbers to match your order desk.</p>
            </div>
          </div>
          <RoiCalculator />
        </section>

        <section className="container pricing-section" aria-labelledby="bid-plans">
          <div className="pricing-section-head">
            <div>
              <h2 id="bid-plans">Bid Qualification Agent</h2>
              <p>Answers &ldquo;should we bid, and can we comply?&rdquo; Works alongside the tool you already use to find bids.</p>
            </div>
          </div>
          <div className="plans">
            {bidTiers.map((t) => (
              <article key={t.id} className={`plan${t.recommended ? " plan-recommended" : ""}`}>
                {t.recommended && <span className="plan-badge">Most popular</span>}
                <h3>{t.name}</h3>
                <p className="plan-for">{t.bestFor}</p>
                <p className="plan-price">
                  {t.price}
                  <small> {t.priceNote}</small>
                </p>
                <dl className="plan-volume">
                  <div>
                    <dt>Included</dt>
                    <dd>{t.included}</dd>
                  </div>
                  <div>
                    <dt>Additional</dt>
                    <dd>{t.additional}</dd>
                  </div>
                  <div>
                    <dt>Extra pages</dt>
                    <dd>{t.extraPages}</dd>
                  </div>
                  <div>
                    <dt>Turnaround</dt>
                    <dd>{t.turnaround}</dd>
                  </div>
                </dl>
                <ul className="plan-features">
                  {t.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link href="/#demo" className={`btn ${t.recommended ? "btn-gradient" : "btn-ghost"}`}>
                  Talk to us
                </Link>
              </article>
            ))}
          </div>
          <ul className="pricing-notes">
            <li>Up to two pay-per-bid purchases from the last 60 days are credited toward your first Bid Desk month.</li>
            <li>Optional analyst review of the compliance matrix before delivery: $150 per RFP.</li>
          </ul>
        </section>

        <section className="container pricing-section" aria-labelledby="bundle-title">
          <div className="pricing-section-head">
            <div>
              <h2 id="bundle-title">Both agents</h2>
            </div>
          </div>
          <div className="bundles">
            {bundles.map((b) => (
              <div key={b.name} className="card bundle">
                <div>
                  <h3>{b.name}</h3>
                  <p>{b.contents}</p>
                </div>
                <p className="bundle-price">
                  <s>{usd(b.list)}</s> {usd(b.price)}
                  <small> / month</small>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="container pricing-section" aria-labelledby="services-title">
          <div className="pricing-section-head">
            <div>
              <h2 id="services-title">Implementation and services</h2>
              <p>Always a fixed fee with a written scope. Invoiced 50% at signature and 50% at go-live acceptance.</p>
            </div>
          </div>
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Package</th>
                  <th scope="col">Scope</th>
                  <th scope="col">Price</th>
                  <th scope="col">Timeline</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.name}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td className="desc">{s.scope}</td>
                    <td>{s.price}</td>
                    <td className="desc" style={{ whiteSpace: "nowrap" }}>
                      {s.timeline}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="pricing-notes">
            <li>Prices in USD, excluding taxes. Standard renewal uplift is 5% a year, stated in your order form.</li>
            <li>Service levels and service credits are set out in the SaaS order form and SLA.</li>
          </ul>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
