import { fingerprint, tierInfo } from "@stratosopx/core/controls";
import {
  UNMATCHED_SKU,
  erpPayload,
  formatDate,
  money,
  orderTotal,
  validateOrder,
  type Issue,
  type IssueCategory,
  type OrderLine,
} from "@stratosopx/core/orders";
import { useMemo, useState } from "react";
import { formatDateTime, post, type ApiError } from "../api";
import type { CatalogItem, OrderDetail } from "../types";
import { useControls } from "./Controls";

const checks: { category: IssueCategory; label: string }[] = [
  { category: "match", label: "SKU matching" },
  { category: "uom", label: "Units of measure" },
  { category: "pricing", label: "Contract pricing" },
  { category: "inventory", label: "Inventory" },
  { category: "change", label: "Changes vs. confirmed order" },
  { category: "credit", label: "Credit limit" },
];

const statusText: Record<OrderDetail["status"], string> = {
  needs_review: "Needs review",
  approved: "Approved · writing to ERP",
  written: "Approved · written to ERP",
  failed: "Approved · ERP write failed",
  rejected: "Rejected · returned to sender",
};

export function OrderReviewer({
  detail,
  catalog,
  onDecided,
}: {
  detail: OrderDetail;
  catalog: CatalogItem[];
  onDecided: () => void;
}) {
  const order = detail.order;
  const [lines, setLines] = useState<OrderLine[]>(order.lines);
  const [shipDate, setShipDate] = useState(order.shipDate);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { paused } = useControls();

  // The same checks and payload builder the server runs, so what the approver
  // sees is exactly what the server will verify and write.
  const issues = useMemo(() => validateOrder(order, lines, shipDate), [order, lines, shipDate]);
  const open = issues.filter((i) => !accepted.has(i.key));
  const blocking = open.filter((i) => i.severity === "blocking");
  const payload = useMemo(() => erpPayload(order, lines, shipDate), [order, lines, shipDate]);
  const total = orderTotal(lines);
  const payloadFingerprint = fingerprint(payload);
  const target = `${detail.erp.name} · ${detail.erp.environment}`;
  const actionLabel = order.salesOrder ? `Update sales order ${order.salesOrder}` : "Create sales order";
  const decided = detail.status !== "needs_review";
  const locked = decided || busy || !detail.canApprove;
  const issueLines = new Set(open.map((i) => i.line));

  function updateLine(n: number, patch: Partial<OrderLine>) {
    setLines((ls) => ls.map((l) => (l.n === n ? { ...l, ...patch } : l)));
  }

  // Reassign a line to a catalog SKU; the server re-applies the same catalog data.
  function changeSku(n: number, sku: string) {
    const item = catalog.find((i) => i.sku === sku);
    if (!item) return;
    setLines((ls) =>
      ls.map((l) =>
        l.n !== n
          ? l
          : {
              ...l,
              sku: item.sku,
              description: item.description,
              sellUom: item.sellUom,
              uomOptions: item.uomOptions,
              tierPrice: item.tierPrice,
              stock: item.stock,
              matchConfidence: 1,
              uom: item.sellUom,
              unitPrice: l.sku === UNMATCHED_SKU || !l.unitPrice ? item.tierPrice : l.unitPrice,
            },
      ),
    );
  }

  function applyFix(issue: Issue) {
    if (!issue.fix) return;
    if (issue.fix.line !== undefined && issue.fix.patch) updateLine(issue.fix.line, issue.fix.patch);
    if (issue.fix.shipDate) setShipDate(issue.fix.shipDate);
  }

  function accept(issue: Issue) {
    setAccepted((s) => new Set(s).add(issue.key));
  }

  async function decide(kind: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      if (kind === "approve") {
        await post(`/orders/${encodeURIComponent(order.id)}/approve`, {
          lines: lines.map(({ n, qty, uom, unitPrice, sku }) => ({ n, qty, uom, unitPrice, sku })),
          shipDate,
          acceptedIssues: issues.filter((i) => accepted.has(i.key)).map((i) => i.key),
          fingerprint: payloadFingerprint,
          note: note || undefined,
        });
      } else {
        await post(`/orders/${encodeURIComponent(order.id)}/reject`, { note: note || undefined });
      }
      onDecided();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
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
                      {!locked && catalog.length > 0 && (l.sku === UNMATCHED_SKU || l.matchConfidence < 0.9) ? (
                        <select
                          aria-label={`SKU, line ${l.n}`}
                          className="cell-input mono sku-select"
                          value={l.sku === UNMATCHED_SKU ? "" : l.sku}
                          onChange={(e) => changeSku(l.n, e.target.value)}
                        >
                          <option value="" disabled>
                            Choose SKU…
                          </option>
                          {catalog.map((i) => (
                            <option key={i.sku} value={i.sku}>
                              {i.sku} · {i.description}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="mono sku">{l.sku === UNMATCHED_SKU ? "no match" : l.sku}</span>
                      )}
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
            <dd className="mono">#{decided && detail.decision?.fingerprint ? detail.decision.fingerprint : payloadFingerprint}</dd>
          </dl>
          {decided ? (
            <div
              className={`decision decision-${detail.status === "rejected" || detail.status === "failed" ? "rejected" : "approved"}`}
              role="status"
            >
              <strong>{statusText[detail.status]}</strong>
              {detail.decision && (
                <p>
                  {detail.decision.approver} · {formatDateTime(detail.decision.created_at)}
                </p>
              )}
              {detail.decision?.fingerprint && (
                <p className="mono" style={{ fontSize: 12 }}>
                  Bound to payload #{detail.decision.fingerprint} · idempotency key {order.id}-{detail.decision.fingerprint}
                </p>
              )}
              {detail.decision?.note && <p>“{detail.decision.note}”</p>}
              <p className="sample-note">
                {detail.status === "rejected" ? "Not billed: rejected documents don’t count." : "Billed as 1 order."}
              </p>
            </div>
          ) : !detail.canApprove ? (
            <p className="hint">Your role can view orders but not approve them.</p>
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
                disabled={open.length > 0 || paused || busy}
                onClick={() => decide("approve")}
              >
                {busy ? "Working…" : `Approve & write to ${detail.erp.name}`}
              </button>
              <p className="hint" role={error ? "alert" : undefined} style={error ? { color: "#fca5a5" } : undefined}>
                {error ??
                  (paused
                    ? "ERP writes are paused. Resume them from the top bar to approve."
                    : blocking.length > 0
                      ? `${blocking.length} blocking exception${blocking.length > 1 ? "s" : ""} must be fixed first.`
                      : open.length > 0
                        ? `Resolve or accept ${open.length} exception${open.length > 1 ? "s" : ""} to approve.`
                        : "Approval covers this exact payload. Any later change needs a new approval.")}
              </p>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => decide("reject")}>
                Reject &amp; return to sender
              </button>
            </>
          )}
        </section>

        <section className="card" aria-labelledby="payload-title">
          <div className="card-head">
            <h2 id="payload-title">{detail.erp.format} payload</h2>
            <span className="muted-label">{decided ? "As approved" : "Live preview"}</span>
          </div>
          <code className="endpoint mono">{payload.endpoint}</code>
          <pre className="payload mono">{JSON.stringify(payload.body, null, 2)}</pre>
        </section>
      </aside>
    </div>
  );
}
