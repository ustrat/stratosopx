import Link from "next/link";
import type { CSSProperties } from "react";
import { KillSwitch } from "@/components/dashboard/ExecutionProvider";
import { PlanUsage } from "@/components/dashboard/PlanUsage";
import { ReviewQueue } from "@/components/dashboard/ReviewQueue";
import { RoutingMap } from "@/components/dashboard/RoutingMap";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { VolumeChart } from "@/components/dashboard/VolumeChart";
import { Icon } from "@/components/Icon";
import { launchCriteria } from "@/lib/controls";
import { agents, dailyVolume, kpis, reviewQueue, systemAlerts } from "@/lib/data";

const statusColor = { Healthy: "#34D399", Retrying: "#FBBF24", Down: "#F87171" } as const;

export default function Overview() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Order &amp; Bid Command Center</h1>
          <p>Monitor extraction, SKU matching, exceptions, change orders and ERP writes in one place.</p>
        </div>
        <Link href="/dashboard/review" className="btn btn-gradient">
          Open review queue <Icon name="arrowRight" size={16} strokeWidth={2} />
        </Link>
      </div>

      <div className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className="card kpi">
            <div className="kpi-icon" style={{ "--kpi-color": k.color } as CSSProperties}>
              <Icon name={k.icon} size={22} />
            </div>
            <div className="kpi-body">
              <span className="kpi-label">{k.label}</span>
              <span className="kpi-value">{k.value}</span>
              <span className="kpi-note">
                {k.note.map((part, i) => (
                  <span key={i} className={part.tone}>
                    {part.text}
                  </span>
                ))}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="row">
        <RoutingMap />
        <ReviewQueue items={reviewQueue} total={23} />
      </div>

      <div className="row">
        <section aria-labelledby="agents-title" className="card col-third">
          <div className="card-head">
            <h2 id="agents-title">Agent health</h2>
            <Link href="/dashboard/agents">View all ›</Link>
          </div>
          {agents.map((a) => (
            <div key={a.name} className="agent">
              <span className="agent-icon">
                <Icon name="bot" size={16} />
              </span>
              <div className="list-body">
                <span className="agent-name">{a.name}</span>
                <span className="agent-meta mono">{a.meta}</span>
              </div>
              <span className="agent-status" style={{ color: statusColor[a.status] }}>
                ● {a.status}
              </span>
              <Sparkline seed={a.seed} color={statusColor[a.status]} />
            </div>
          ))}
        </section>

        <section aria-labelledby="alerts-title" className="card col-third">
          <div className="card-head">
            <h2 id="alerts-title">System alerts</h2>
            <Link href="/dashboard/erp-sync">View all ›</Link>
          </div>
          <ul className="list">
            {systemAlerts.map((a) => (
              <li key={a.title} className="list-item alert">
                <span className="alert-icon" style={{ color: a.kind === "warning" ? "#FBBF24" : "#93C5FD" }}>
                  {a.kind === "warning" ? "!" : "i"}
                </span>
                <div className="list-body">
                  <span className="list-title" style={{ fontWeight: 500 }}>
                    {a.title}
                  </span>
                  <span className="list-sub">
                    {a.detail}
                    {a.monoDetail && <span className="mono">{a.monoDetail}</span>}
                  </span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm">
                  {a.action}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="volume-title" className="card col-chart">
          <div className="card-head">
            <h2 id="volume-title">Order volume</h2>
            <span className="muted-label">This month</span>
          </div>
          <VolumeChart values={dailyVolume} month="Oct" />
        </section>
      </div>

      <div className="row">
        <PlanUsage />
        <section aria-labelledby="controls-title" className="card col-side">
          <div className="card-head">
            <h2 id="controls-title">Execution controls</h2>
            <Link href="/dashboard/settings">Manage ›</Link>
          </div>
          <dl className="meta-list" style={{ marginBottom: 14 }}>
            <dt>Automation mode</dt>
            <dd>Assist · every order approved</dd>
            <dt>Auto-post</dt>
            <dd>
              Locked · {launchCriteria.filter((c) => c.done).length} of {launchCriteria.length} launch criteria met
            </dd>
          </dl>
          <KillSwitch />
        </section>
      </div>
    </>
  );
}
