"use client";

import { useMemo, useState } from "react";
import {
  deploymentLabel,
  erpGroups,
  erps,
  segmentLabel,
  supportInfo,
  type Deployment,
  type Segment,
  type SupportLevel,
} from "@stratosopx/core/erp-catalog";

type Filter<T extends string> = T | "all";

export function ErpCatalog() {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Filter<Segment>>("all");
  const [deployment, setDeployment] = useState<Filter<Deployment>>("all");
  const [support, setSupport] = useState<Filter<SupportLevel>>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return erps.filter(
      (e) =>
        (!q || `${e.name} ${e.vendor} ${e.focus} ${e.interfaces.join(" ")}`.toLowerCase().includes(q)) &&
        (segment === "all" || e.segments.includes(segment)) &&
        (deployment === "all" || e.deployment.includes(deployment)) &&
        (support === "all" || e.support === support),
    );
  }, [query, segment, deployment, support]);

  return (
    <>
      <div className="catalog-filters">
        <label className="search catalog-search">
          <span className="sr-only">Search ERP systems</span>
          <input
            type="search"
            placeholder="Search by ERP, vendor or interface"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="select-field">
          <span>Company size</span>
          <select value={segment} onChange={(e) => setSegment(e.target.value as Filter<Segment>)}>
            <option value="all">All</option>
            {Object.entries(segmentLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="select-field">
          <span>Deployment</span>
          <select value={deployment} onChange={(e) => setDeployment(e.target.value as Filter<Deployment>)}>
            <option value="all">All</option>
            {Object.entries(deploymentLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="select-field">
          <span>Implementation</span>
          <select value={support} onChange={(e) => setSupport(e.target.value as Filter<SupportLevel>)}>
            <option value="all">All</option>
            {Object.entries(supportInfo).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint" aria-live="polite">
        {filtered.length} of {erps.length} systems
      </p>

      {erpGroups.map((g) => {
        const items = filtered.filter((e) => e.group === g.id);
        if (items.length === 0) return null;
        return (
          <section key={g.id} className="erp-group" aria-labelledby={`group-${g.id}`}>
            <div className="erp-group-head">
              <div>
                <h3 id={`group-${g.id}`}>{g.name}</h3>
                <p>{g.summary}</p>
              </div>
              <dl className="erp-pattern">
                <dt>How we connect</dt>
                <dd>{g.pattern}</dd>
                <dt>How orders land</dt>
                <dd>{g.ingestion}</dd>
                <dt>Typical package</dt>
                <dd>{g.typicalPackage}</dd>
              </dl>
            </div>
            <ul className="erp-grid">
              {items.map((e) => (
                <li key={e.id} className="erp-card">
                  <div className="erp-card-head">
                    <div>
                      <strong>{e.name}</strong>
                      <span className="list-sub">{e.vendor}</span>
                    </div>
                    <span className={`pill tone-${supportInfo[e.support].tone}`} title={supportInfo[e.support].detail}>
                      {supportInfo[e.support].label}
                    </span>
                  </div>
                  <span className="list-sub">{e.focus}</span>
                  <div className="erp-tags">
                    {e.deployment.map((d) => (
                      <span key={d} className="erp-tag">
                        {deploymentLabel[d]}
                      </span>
                    ))}
                    {e.segments.map((s) => (
                      <span key={s} className="erp-tag">
                        {segmentLabel[s]}
                      </span>
                    ))}
                  </div>
                  <ul className="erp-interfaces">
                    {e.interfaces.map((i) => (
                      <li key={i} className="mono">
                        {i}
                      </li>
                    ))}
                  </ul>
                  {e.verify && <span className="erp-verify">Interfaces confirmed per version during assessment</span>}
                  {e.note && <span className="erp-note">{e.note}</span>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
