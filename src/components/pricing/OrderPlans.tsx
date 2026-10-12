"use client";

import Link from "next/link";
import { useState } from "react";
import { orderTiers, usd } from "@/lib/pricing";

export function OrderPlans() {
  const [billing, setBilling] = useState<"annual" | "monthly">("annual");

  return (
    <>
      <div className="billing-toggle" role="radiogroup" aria-label="Billing period">
        {(["annual", "monthly"] as const).map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={billing === b}
            className={billing === b ? "active" : undefined}
            onClick={() => setBilling(b)}
          >
            {b === "annual" ? "Annual" : "Monthly (+15%)"}
          </button>
        ))}
      </div>

      <div className="plans">
        {orderTiers.map((t) => (
          <article key={t.id} className={`plan${t.recommended ? " plan-recommended" : ""}`}>
            {t.recommended && <span className="plan-badge">Recommended</span>}
            <h3>{t.name}</h3>
            <p className="plan-for">{t.bestFor}</p>
            <p className="plan-price">
              {usd(billing === "annual" ? t.annual : t.monthly)}
              <small> / month</small>
            </p>
            <p className="plan-billing">
              {billing === "annual" ? `${usd(t.annual * 12)} billed annually` : "Billed monthly, cancel with 30 days' notice"}
            </p>
            <dl className="plan-volume">
              <div>
                <dt>Orders included</dt>
                <dd className="mono">{t.included.toLocaleString("en-US")} / mo</dd>
              </div>
              <div>
                <dt>Overage</dt>
                <dd className="mono">{usd(t.overage, 2)} / order</dd>
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
    </>
  );
}
