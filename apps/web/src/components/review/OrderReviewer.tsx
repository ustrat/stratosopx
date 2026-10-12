"use client";

import { useMemo, useState } from "react";
import { useExecution } from "@/components/dashboard/ExecutionProvider";
import { fingerprint, tierInfo } from "@stratosopx/core/controls";
import {
  erpPayload,
  formatDate,
  money,
  orderTotal,
  validateOrder,
  type Issue,
  type IssueCategory,
  type OrderLine,
  type OrderReview,
} from "@/lib/review";

const checks: { category: IssueCategory; label: string }[] = [
  { category: "match", label: "SKU matching" },
  { category: "uom", label: "Units of measure" },
  { category: "pricing", label: "Contract pricing" },
  { category: "inventory", label: "Inventory" },
  { category: "change", label: "Changes vs. confirmed order" },
  { category: "credit", label: "Credit limit" },
];

type Decision = {
  kind: "approved" | "rejected";
  note: string;
  at: string;
  fingerprint: string;
} | null;

const APPROVER = "[Your name]";

export function OrderReviewer({ order }: { order: OrderReview }) {
  const [lines, setLines] = useState<OrderLine[]>(order.lines);
  const [shipDate, setShipDate] = useState(order.shipDate);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [decision, setDecision] = useState<Decision>(null);
  const [note, setNote] = useState("");
  const { paused } = useExecution();

  const issues = useMemo(() => validateOrder(order, lines, shipDate), [order, lines, shipDate]);
  const open = issues.filter((i) => !accepted.has(i.key));
  const blocking = open.filter((i) => i.severity === "blocking");
  const payload = useMemo(() => erpPayload(order, lines, shipDate), [order, lines, shipDate]);
  const total = orderTotal(lines);
  const payloadFingerprint = fingerprint(payload);
  const target = `${order.erp} · production`;
  const actionLabel = order.salesOrder ? `Update sales order ${order.salesOrder}` : "Create sales order";
  const locked = decision !== null;
  const issueLines = new Set(open.map((i) => i.line));

  function updateLine(n: number, patch: Partial<OrderLine>) {
    setLines((ls) => ls.map((l) => (l.n === n ? { ...l, ...patch } : l)));
  }

  function applyFix(issue: Issue) {
    if (!issue.fix) return;
    if (issue.fix.line !== undefined && issue.fix.patch) updateLine(issue.fix.line, issue.fix.patch);
    if (issue.fix.shipDate) setShipDate(issue.fix.shipDate);
  }

  function accept(issue: Issue) {
    setAccepted((s) => new Set(s).add(issue.key));
  }

  function decide(kind: "approved" | "rejected") {
    setDecision({
      kind,
      note,
      at: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
      fingerprint: payloadFingerprint,
    });
  }

  function reset() {
    setLines(order.lines);
    setShipDate(order.shipDate);
    setAccepted(new Set());
    setDecision(null);
    setNote("");
  }

  return (
    <div className="review-layout">
      <div className="review-main">
        <section className="card" aria-labelledby="issues-title">
          <div className="card-head">
            <h2 id="issues-title">
              Exceptions <span className="pill pill-count">{open.length} open</span>
            </h2>
            {issues.length > open.length && <span className="muted-label">{issues.length - open.length} accepted</span>}
          </div>
          {open.length === 0 ? (
            <p className="empty-note">All exceptions resolved. Ready to approve.</p>
          ) : (
            <ul className="list">
              {open.map((issue) => (
                <li key={issue.key} className={`issue issue-${issue.severity}`}>
                  <div className="list-body">
                    <span className="list-title">
                      {issue.title}{" "}
                      <span className={`pill tone-${issue.severity === "blocking" ? "danger" : "warning"}`}>
                        {issue.severity === "blocking" ? "Blocking" : "Review"}
                      </span>
                    </span>
                    <span className="list-sub">{issue.message}</span>
                  </div>
                  <div className="issue-actions">
                    {issue.fix && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={locked}
                        onClick={() => applyFix(issue)}
                      >
                        {issue.fixLabel}
                      </button>
                    )}
                    {issue.canAccept && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={locked}
                        onClick={() => accept(issue)}
                      >
                        {issue.acceptLabel}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="lines-title">
          <div className="card-head">
            <h2 id="lines-title">Extracted lines</h2>
            <label className="ship-date">
              Ship date
              <input type="date" value={shipDate} disabled={locked} onChange={(e) => setShipDate(e.target.value)} />
              {order.prevShipDate && order.prevShipDate !== shipDate && (
                <span className="prev">was {formatDate(order.prevShipDate)}</span>
              )}
            </label>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Customer part → SKU</th>
                  <th scope="col">Description</th>
                  <th scope="col" className="num">
                    Qty
                  </th>
                  <th scope="col">UOM</th>
                  <th scope="col" className="num">
                    Unit price
                  </th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.n} className={issueLines.has(l.n) ? "flagged" : undefined}>
                    <td className="mono">{l.n}</td>
                    <td>
                      <span className="mono">{l.customerPart}</span>
                      <span className="arrow"> → </span>
                      <span className="mono sku">{l.sku}</span>
                      <span className={`confidence${l.matchConfidence < 0.9 ? " low" : ""}`}>
                        {Math.round(l.matchConfidence * 100)}%
                      </span>
                    </td>
                    <td className="desc">{l.description}</td>
                    <td className="num">
                      <input
                        aria-label={`Quantity, line ${l.n}`}
                        className="cell-input mono"
                        type="number"
                        min={0}
                        value={l.qty}
                        disabled={locked}
                        onChange={(e) => updateLine(l.n, { qty: Number(e.target.value) })}
                      />
                      {l.prev?.qty !== undefined && l.prev.qty !== l.qty && (
                        <span className="prev mono">was {l.prev.qty}</span>
                      )}
                    </td>
                    <td>
                      <select
                        aria-label={`Unit of measure, line ${l.n}`}
                        className="cell-input mono"
                        value={l.uom}
                        disabled={locked}
                        onChange={(e) => updateLine(l.n, { uom: e.target.value })}
                      >
                        {l.uomOptions.map((u) => (
                          <option key={u.code} value={u.code}>
                            {u.code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="num">
                      <input
                        aria-label={`Unit price, line ${l.n}`}
                        className="cell-input mono"
                        type="number"
                        min={0}
                        step={0.01}
                        value={l.unitPrice}
                        disabled={locked}
                        onChange={(e) => updateLine(l.n, { unitPrice: Number(e.target.value) })}
                      />
                    </td>
                    <td className="num mono">{money(l.qty * l.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="num">
                    Order total
                  </td>
                  <td className="num mono">{money(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>

      <aside className="review-side">
        <section className="card" aria-labelledby="checks-title">
          <div className="card-head">
            <h2 id="checks-title">Checks</h2>
          </div>
          <ul className="checks">
            {checks.map((c) => {
              const openCount = open.filter((i) => i.category === c.category).length;
              const hadIssue = issues.some((i) => i.category === c.category);
              const state = openCount > 0 ? "open" : hadIssue ? "accepted" : "pass";
              return (
                <li key={c.category} className={`check check-${state}`}>
                  <span className="check-mark" aria-hidden="true">
                    {state === "open" ? "!" : "✓"}
                  </span>
                  <span>{c.label}</span>
                  <span className="check-state">
                    {state === "open" ? `${openCount} open` : state === "accepted" ? "Resolved" : "Passed"}
                  </span>
                </li>
              );
            })}
          </ul>
          <dl className="credit">
            <dt>Credit used</dt>
            <dd className="mono">
              {money(order.customer.openBalance + total)} / {money(order.customer.creditLimit)}
            </dd>
          </dl>
        </section>

        <section className="card" aria-labelledby="decision-title">
          <div className="card-head">
            <h2 id="decision-title">Decision</h2>
          </div>
          <dl className="action-binding">
            <dt>Action</dt>
            <dd>{actionLabel}</dd>
            <dt>Target</dt>
            <dd>{target}</dd>
            <dt>Risk tier</dt>
            <dd>
              <span className={`pill tone-${tierInfo[3].tone}`}>Tier 3 · {tierInfo[3].name}</span>
            </dd>
            <dt>Payload</dt>
            <dd className="mono">#{payloadFingerprint}</dd>
          </dl>
          {decision ? (
            <div className={`decision decision-${decision.kind}`} role="status">
              <strong>
                {decision.kind === "approved"
                  ? `Approved · queued for ${order.erp} write`
                  : "Rejected · returned to sender"}
              </strong>
              <p>
                {APPROVER} · {decision.at}
              </p>
              {decision.kind === "approved" && (
                <p className="mono" style={{ fontSize: 12 }}>
                  Bound to payload #{decision.fingerprint} · idempotency key {order.id}-{decision.fingerprint}
                </p>
              )}
              {decision.note && <p>“{decision.note}”</p>}
              <p className="sample-note">
                {decision.kind === "approved" ? "Billed as 1 order." : "Not billed: rejected documents don't count."}{" "}
                Sample mode: nothing was sent to the ERP.
              </p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                Reset review
              </button>
            </div>
          ) : (
            <>
              <label className="field">
                <span>Note (optional)</span>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Recorded in the audit log"
                />
              </label>
              <button
                type="button"
                className="btn btn-gradient"
                disabled={open.length > 0 || paused}
                onClick={() => decide("approved")}
              >
                Approve &amp; write to {order.erp}
              </button>
              <p className="hint">
                {paused
                  ? "ERP writes are paused. Resume them from the top bar to approve."
                  : blocking.length > 0
                    ? `${blocking.length} blocking exception${blocking.length > 1 ? "s" : ""} must be fixed first.`
                    : open.length > 0
                      ? `Resolve or accept ${open.length} exception${open.length > 1 ? "s" : ""} to approve.`
                      : "Approval covers this exact payload. Any later change needs a new approval."}
              </p>
              <button type="button" className="btn btn-ghost" onClick={() => decide("rejected")}>
                Reject &amp; return to sender
              </button>
            </>
          )}
        </section>

        <section className="card" aria-labelledby="payload-title">
          <div className="card-head">
            <h2 id="payload-title">{order.erp} payload</h2>
            <span className="muted-label">Live preview</span>
          </div>
          <code className="endpoint mono">{payload.endpoint}</code>
          <pre className="payload mono">{JSON.stringify(payload.body, null, 2)}</pre>
        </section>
      </aside>
    </div>
  );
}
