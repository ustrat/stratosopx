"use client";

import { useId, useState } from "react";
import { STANDARD_IMPLEMENTATION, cheapestTier, customVolume, tierCost, usd } from "@stratosopx/core/pricing";

// Conservative labor-plus-rework model from the Pricing Strategy, section 4.
const defaults = {
  orders: 1000,
  minutes: 6,
  hourly: 40,
  errorRate: 2,
  rework: 150,
  touchless: 70,
};

type Inputs = typeof defaults;

const fields: { key: keyof Inputs; label: string; suffix?: string; prefix?: string; step: number; min: number; max?: number }[] = [
  { key: "orders", label: "Emailed POs per month", step: 50, min: 0 },
  { key: "minutes", label: "Minutes to key one order", step: 1, min: 0 },
  { key: "hourly", label: "Loaded labor cost per hour", prefix: "$", step: 1, min: 0 },
  { key: "errorRate", label: "Orders with an error", suffix: "%", step: 0.5, min: 0, max: 100 },
  { key: "rework", label: "Average cost to fix an error", prefix: "$", step: 10, min: 0 },
  { key: "touchless", label: "Orders processed touchless", suffix: "%", step: 5, min: 0, max: 100 },
];

export function RoiCalculator() {
  const id = useId();
  const [v, setV] = useState<Inputs>(defaults);

  const laborPerOrder = (v.minutes / 60) * v.hourly;
  const reworkPerOrder = (v.errorRate / 100) * v.rework;
  const currentCost = v.orders * (laborPerOrder + reworkPerOrder);
  const savings = currentCost * (v.touchless / 100);
  const tier = cheapestTier(v.orders);
  const subscription = tierCost(tier, v.orders);
  const net = savings - subscription;
  const share = savings > 0 ? subscription / savings : Infinity;
  const payback = net > 0 ? STANDARD_IMPLEMENTATION / net : null;
  const custom = v.orders > customVolume.above;

  return (
    <div className="roi">
      <form className="roi-inputs" onSubmit={(e) => e.preventDefault()}>
        {fields.map((f) => (
          <label key={f.key} htmlFor={`${id}-${f.key}`} className="roi-field">
            <span>{f.label}</span>
            <span className="roi-input">
              {f.prefix && <span aria-hidden="true">{f.prefix}</span>}
              <input
                id={`${id}-${f.key}`}
                type="number"
                inputMode="decimal"
                min={f.min}
                max={f.max}
                step={f.step}
                value={v[f.key]}
                onChange={(e) => setV((s) => ({ ...s, [f.key]: Math.max(0, Number(e.target.value) || 0) }))}
              />
              {f.suffix && <span aria-hidden="true">{f.suffix}</span>}
            </span>
          </label>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setV(defaults)}>
          Reset to conservative defaults
        </button>
      </form>

      <div className="roi-results" aria-live="polite">
        <dl>
          <div>
            <dt>Current cost of manual entry</dt>
            <dd>
              {usd(currentCost)} <small>/ month</small>
            </dd>
          </div>
          <div>
            <dt>Savings at {v.touchless}% touchless</dt>
            <dd>
              {usd(savings)} <small>/ month</small>
            </dd>
          </div>
          <div>
            <dt>
              Order Agent {tier.name}
              {custom ? " (custom volume)" : ""}
            </dt>
            <dd>
              −{usd(subscription)} <small>/ month</small>
            </dd>
          </div>
          <div className="roi-net">
            <dt>Estimated net monthly benefit</dt>
            <dd className={net >= 0 ? "up" : "down"}>{usd(net)}</dd>
          </div>
          <div>
            <dt>Payback on {usd(STANDARD_IMPLEMENTATION)} implementation</dt>
            <dd>{payback ? `${payback.toFixed(1)} months` : "Does not pay back"}</dd>
          </div>
          <div>
            <dt>Subscription as share of savings</dt>
            <dd>{Number.isFinite(share) ? `${Math.round(share * 100)}%` : "—"}</dd>
          </div>
        </dl>
        <p className="roi-note">
          {net <= 0
            ? "On these numbers the Order Agent does not pay for itself. Pay-per-bid, a smaller volume, or no purchase may be the better call."
            : share > 0.35
              ? "The subscription would take more than a third of your savings. Worth checking your volume and error figures with us before committing."
              : "Estimate only, based on the figures you entered. It is not a guarantee of savings."}
        </p>
        <p className="roi-fine">
          Labor plus rework only. It leaves out faster cash cycles, fewer credits and redeployed staff. Annual billing; overage at
          the tier&apos;s per-order rate.
        </p>
      </div>
    </div>
  );
}
