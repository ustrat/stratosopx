import Link from "next/link";
import type { CSSProperties } from "react";
import { DotWave } from "@/components/DotWave";
import { Icon, type IconName } from "@/components/Icon";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

const pillars: { title: string; body: string; icon: IconName; color: string; tint: string }[] = [
  { title: "Elevation", body: "Rise above complexity.", icon: "layers", color: "#5B7CFA", tint: "rgba(37,99,235,0.08)" },
  { title: "Operation", body: "Seamless execution.", icon: "speed", color: "#6D6AF5", tint: "rgba(79,70,229,0.08)" },
  { title: "Optimization", body: "Smarter outcomes.", icon: "target", color: "#7C5CF2", tint: "rgba(109,40,217,0.08)" },
  { title: "Performance", body: "Outperform at every level.", icon: "trend", color: "#8B5CF6", tint: "rgba(124,58,237,0.08)" },
];

const agents: { name: string; icon: IconName; body: string; points: string[]; from: string }[] = [
  {
    name: "Order Reconciliation Agent",
    icon: "document",
    body: "Reads emailed POs and change orders in Excel, PDF or plain text, checks them against your inventory and pricing tiers, and prepares clean sales orders for your ERP.",
    points: [
      "Customer and item matching",
      "Contract pricing and inventory checks",
      "Change-order diffs",
      "NetSuite, Sage, SAP Business One, Acumatica",
    ],
    from: "From $795 / month",
  },
  {
    name: "Bid Qualification Agent",
    icon: "building",
    body: "Reads RFP and bid packages, compares requirements with your certifications, insurance, bonding and past wins, and drafts a Go / No-Go summary and compliance checklist.",
    points: ["Dealbreakers flagged up front", "Compliance matrix", "Capability match against past bids", "Draft response outline"],
    from: "From $395 per RFP",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main id="main">
        <section className="hero">
          <DotWave className="hero-wave" />
          <div className="container hero-inner">
            <span className="eyebrow">OPERATE. OPTIMIZE. OUTPERFORM.</span>
            <h1>
              Operate. Optimize.
              <br />
              <span className="gradient-text">Outperform.</span>
            </h1>
            <p className="hero-lead">AI-powered operations platform for modern teams.</p>
            <div className="hero-actions">
              <a href="#demo" className="btn btn-primary btn-lg">
                Request a Demo
              </a>
              <Link href="/dashboard" className="btn btn-ghost btn-lg">
                Explore the platform <Icon name="arrowRight" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </section>

        <section id="platform" className="band">
          <div className="container concept">
            <div>
              <span className="concept-label">WHY STRATOSOPX</span>
              <h2>Built for teams that operate at scale and aspire higher.</h2>
            </div>
            <p>
              StratosOpx represents elevation and operational excellence. Our platform brings altitude, motion and
              seamless optimization to the way your team works, so you can rise above complexity and focus on outcomes.
            </p>
          </div>
        </section>

        <section id="solutions" className="band" style={{ borderTop: 0 }}>
          <div className="container pillars">
            {pillars.map((p) => (
              <div key={p.title} className="pillar" style={{ "--pillar-tint": p.tint } as CSSProperties}>
                <Icon name={p.icon} size={44} strokeWidth={1.5} color={p.color} />
                <h3>{p.title.toUpperCase()}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>

          <div className="container agents-section">
            <span className="concept-label">TWO AGENTS</span>
            <div className="agent-cards">
              {agents.map((a) => (
                <article key={a.name} className="agent-card">
                  <span className="kpi-icon" style={{ "--kpi-color": "#818CF8" } as CSSProperties}>
                    <Icon name={a.icon} size={22} />
                  </span>
                  <h3>{a.name}</h3>
                  <p>{a.body}</p>
                  <ul>
                    {a.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                  <Link href="/pricing" className="agent-card-price">
                    {a.from} →
                  </Link>
                </article>
              ))}
            </div>
            <p className="assist-note">
              <Icon name="shield" size={18} /> Every plan starts in Assist mode: a person approves every order before it
              reaches your ERP. Automation expands only after accuracy is proven on your data.
            </p>
          </div>
        </section>

        <section id="demo" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="container cta-section">
            <div className="cta">
              <div style={{ maxWidth: 620 }}>
                <h2>See StratosOpx in action.</h2>
                <p>Get a walkthrough tailored to how your team operates.</p>
              </div>
              <a href="mailto:hello@stratosopx.com" className="btn btn-white btn-lg">
                Request a Demo
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
