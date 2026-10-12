import type { CSSProperties } from "react";
import { Link } from "react-router";
import { useApi } from "../api";
import { KillSwitch } from "../components/Controls";
import { Icon, type IconName } from "../components/Icon";
import { RoutingMap } from "../components/RoutingMap";
import { VolumeChart } from "../components/VolumeChart";
import type { Overview as OverviewData } from "../types";
import { ErrorCard, Loading } from "./common";

function Kpi({ label, value, note, icon, color }: { label: string; value: string; note: React.ReactNode; icon: IconName; color: string }) {
  return (
    <div className="card kpi">
      <div className="kpi-icon" style={{ "--kpi-color": color } as CSSProperties}>
        <Icon name={icon} size={22} />
      </div>
      <div className="kpi-body">
        <span className="kpi-label">{label}</span>
        <span className="kpi-value">{value}</span>
        <span className="kpi-note">{note}</span>
      </div>
    </div>
  );
}

export function Overview() {
  const { data, error } = useApi<OverviewData>("/overview");
  if (error) return <ErrorCard error={error} />;
  if (!data) return <Loading />;

  const { kpis, usage } = data;
  const today = new Date().getUTCDate();
  const month = new Date().toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const byDay = new Map(data.volume.map((v) => [Number(v.day.slice(8, 10)), v.n]));
  const series = Array.from({ length: today }, (_, i) => byDay.get(i + 1) ?? 0);
  const usedShare = Math.min(100, Math.round((usage.used / usage.included) * 100));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Order &amp; Bid Command Center</h1>
          <p>{data.tenant.name} · extraction, exceptions, approvals and ERP writes in one place.</p>
        </div>
        <Link to="/review" className="btn btn-gradient">
          Open review queue <Icon name="arrowRight" size={16} strokeWidth={2} />
        </Link>
      </div>

      <div className="kpis">
        <Kpi label="Orders processed this month" value={kpis.processed.toLocaleString("en-US")} note="Approved and written" icon="document" color="#60A5FA" />
        <Kpi
          label="Straight-through rate"
          value={kpis.straightThrough === null ? "—" : `${(kpis.straightThrough * 100).toFixed(1)}%`}
          note="Approved with no exceptions"
          icon="pulse"
          color="#2DD4BF"
        />
        <Kpi
          label="Open exceptions"
          value={String(kpis.openExceptions)}
          note={
            <>
              <span className={kpis.blocking ? "down" : undefined}>{kpis.blocking} blocking</span> · {kpis.openOrders} orders waiting
            </>
          }
          icon="shieldAlert"
          color="#FBBF24"
        />
        <Kpi label="Automation mode" value={data.tenant.automationMode === "assist" ? "Assist" : "Auto-post"} note={`Launch criteria ${data.launch.met} of ${data.launch.total}`} icon="shield" color="#A78BFA" />
      </div>

      <div className="row">
        <RoutingMap split={data.routing} />
        <section aria-labelledby="queue-title" className="card col-side">
          <div className="card-head">
            <h2 id="queue-title">
              Review queue <span className="pill pill-count">{data.queueTotal}</span>
            </h2>
            <Link to="/review">View all ›</Link>
          </div>
          {data.queue.length === 0 ? (
            <p className="empty-note">Nothing waiting for review.</p>
          ) : (
            <ul className="list">
              {data.queue.map((item) => (
                <li key={item.id}>
                  <Link to={`/review/${encodeURIComponent(item.id)}`} className="list-item" style={{ textDecoration: "none", color: "inherit" }}>
                    <span className={`list-icon tone-${item.kind === "change-order" ? "info" : "violet"}`}>
                      <Icon name={item.kind === "change-order" ? "swap" : "document"} />
                    </span>
                    <span className="list-body">
                      <span className="list-title mono">{item.title}</span>
                      <span className="list-sub">
                        {item.customer} · {item.reason}
                      </span>
                    </span>
                    <span className={`pill tone-${item.tone}`}>{item.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="row">
        <section aria-labelledby="volume-title" className="card col-chart">
          <div className="card-head">
            <h2 id="volume-title">Order volume</h2>
            <span className="muted-label">This month</span>
          </div>
          <VolumeChart values={series} month={month} />
        </section>

        <section aria-labelledby="plan-title" className="card col-third">
          <div className="card-head">
            <h2 id="plan-title">Plan &amp; usage</h2>
          </div>
          <div className="match-head">
            <span>
              Order Agent · <strong>{usage.plan}</strong>
            </span>
            <span className="mono">
              {usage.used.toLocaleString("en-US")} / {usage.included.toLocaleString("en-US")}
            </span>
          </div>
          <div className="meter" role="meter" aria-label="Orders used this month" aria-valuemin={0} aria-valuemax={usage.included} aria-valuenow={usage.used}>
            <span style={{ width: `${usedShare}%` }} className={usedShare >= 90 ? "weak" : undefined} />
          </div>
          <span className="list-sub">
            {usage.projectedOverage > 0
              ? `On pace for about ${usage.projected.toLocaleString("en-US")} orders: about ${usage.projectedOverage} over plan at $${usage.overage.toFixed(2)} each.`
              : `On pace for about ${usage.projected.toLocaleString("en-US")} orders, within plan.`}
          </span>
          <p className="hint" style={{ marginBottom: 0 }}>
            Change orders count as one order. Rejected and duplicate documents are not billed.
          </p>
        </section>

        <section aria-labelledby="controls-title" className="card col-third">
          <div className="card-head">
            <h2 id="controls-title">Execution controls</h2>
            <Link to="/settings">Manage ›</Link>
          </div>
          <dl className="meta-list" style={{ marginBottom: 14 }}>
            <dt>Automation mode</dt>
            <dd>{data.tenant.automationMode === "assist" ? "Assist · every order approved" : data.tenant.automationMode}</dd>
            <dt>Auto-post</dt>
            <dd>
              {data.launch.met === data.launch.total ? "Available" : "Locked"} · {data.launch.met} of {data.launch.total} launch criteria
            </dd>
          </dl>
          <KillSwitch />
        </section>
      </div>
    </>
  );
}
