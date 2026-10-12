import Link from "next/link";
import { plan, orderUsage } from "@/lib/plan";
import { usd } from "@/lib/pricing";

function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} className={value >= max * 0.9 ? "weak" : undefined} />
    </div>
  );
}

export function PlanUsage() {
  const o = orderUsage();
  const bidsLeft = plan.bidIncluded - plan.bidsUsed;

  return (
    <section aria-labelledby="plan-title" className="card col-wide">
      <div className="card-head">
        <h2 id="plan-title">Plan &amp; usage</h2>
        <Link href="/pricing">Compare plans ›</Link>
      </div>
      <div className="usage-grid">
        <div>
          <div className="match-head">
            <span>
              Order Agent · <strong>{plan.order.name}</strong>
            </span>
            <span className="mono">
              {o.used.toLocaleString("en-US")} / {o.included.toLocaleString("en-US")} orders
            </span>
          </div>
          <Meter label="Orders used this month" value={o.used} max={o.included} />
          <span className="list-sub">
            {o.projectedOverage > 0
              ? `On pace for about ${o.projected.toLocaleString("en-US")} orders: roughly ${o.projectedOverage} over, about ${usd(o.projectedOverageCost)} at ${usd(plan.order.overage, 2)} each.`
              : `On pace for about ${o.projected.toLocaleString("en-US")} orders, within your plan.`}
          </span>
        </div>
        <div>
          <div className="match-head">
            <span>
              Bid Agent · <strong>{plan.bid.name}</strong>
            </span>
            <span className="mono">
              {plan.bidsUsed} / {plan.bidIncluded} analyses
            </span>
          </div>
          <Meter label="Bid analyses used this month" value={plan.bidsUsed} max={plan.bidIncluded} />
          <span className="list-sub">
            {bidsLeft} left this month; unused analyses roll over one month. Extra analyses {usd(plan.bidOverage)} each.
          </span>
        </div>
      </div>
      <p className="hint" style={{ marginBottom: 0 }}>
        Change orders count as one order. Rejected and duplicate documents are not billed.
      </p>
    </section>
  );
}
