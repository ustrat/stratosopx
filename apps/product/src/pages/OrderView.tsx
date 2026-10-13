import { UNMATCHED_SKU, formatDate, money } from "@stratosopx/core/orders";
import { Link, useParams } from "react-router";
import { formatDateTime, useApi } from "../api";
import type { Branding, OrderDetail } from "../types";
import { ErrorCard, Loading } from "./common";

const stamp: Record<OrderDetail["status"], { label: string; tone: "draft" | "ok" | "void" }> = {
  needs_review: { label: "Draft · pending review", tone: "draft" },
  approved: { label: "Approved", tone: "ok" },
  written: { label: "Confirmed", tone: "ok" },
  failed: { label: "Approved · ERP write pending", tone: "draft" },
  rejected: { label: "Rejected", tone: "void" },
};

// Printable sales order confirmation, branded with the company's logo and details.
export function OrderView() {
  const { id = "" } = useParams();
  const order = useApi<OrderDetail>(`/orders/${encodeURIComponent(id)}`);
  const brand = useApi<Branding>("/branding");

  if (order.error) return <ErrorCard error={order.error} />;
  if (!order.data || !brand.data) return <Loading />;

  const { order: o, status, decision } = order.data;
  const b = brand.data;
  // Lines left off a new PO (quantity 0) are not part of the order.
  const lines = o.kind === "po" ? o.lines.filter((l) => l.qty > 0) : o.lines;
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const s = stamp[status];
  const name = b.details.displayName || b.name;

  return (
    <>
      <div className="doc-toolbar no-print">
        <Link to={`/review/${encodeURIComponent(o.id)}`} className="btn btn-ghost btn-sm">
          ← Back to order
        </Link>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <article className={`doc doc-${s.tone}`} aria-label={`Sales order confirmation for ${o.title}`}>
        {s.tone !== "ok" && (
          <div className="doc-watermark" aria-hidden="true">
            {status === "rejected" ? "REJECTED" : "DRAFT"}
          </div>
        )}

        <header className="doc-head">
          <div className="doc-company">
            {b.logoUrl ? <img src={b.logoUrl} alt={`${name} logo`} className="doc-logo" /> : <div className="doc-name">{name}</div>}
            {b.logoUrl && <div className="doc-name-small">{name}</div>}
            {b.details.address && <div className="doc-address">{b.details.address}</div>}
            <div className="doc-contact">
              {[b.details.phone, b.details.email, b.details.website].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="doc-title">
            <h1>Sales order confirmation</h1>
            <span className={`doc-stamp doc-stamp-${s.tone}`}>{s.label}</span>
            <dl>
              <dt>Customer PO</dt>
              <dd className="mono">{o.poNumber}</dd>
              {o.salesOrder && (
                <>
                  <dt>Revises order</dt>
                  <dd className="mono">{o.salesOrder}</dd>
                </>
              )}
              <dt>Order date</dt>
              <dd>{formatDate(o.receivedAt.slice(0, 10))}</dd>
              <dt>Requested ship date</dt>
              <dd>{formatDate(o.shipDate)}</dd>
            </dl>
          </div>
        </header>

        <section className="doc-parties">
          <div>
            <h2>Customer</h2>
            <p>
              {o.customer.name}
              <br />
              <span className="mono">Account {o.customer.id}</span>
            </p>
          </div>
          <div>
            <h2>Order type</h2>
            <p>{o.kind === "change-order" ? "Change order (revision)" : "Purchase order"}</p>
          </div>
        </section>

        <table className="doc-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Your part</th>
              <th scope="col">Item</th>
              <th scope="col">Description</th>
              <th scope="col" className="num">
                Qty
              </th>
              <th scope="col">Unit</th>
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
              <tr key={l.n}>
                <td>{l.n}</td>
                <td className="mono">{l.customerPart}</td>
                <td className="mono">{l.sku === UNMATCHED_SKU ? "—" : l.sku}</td>
                <td>{l.description}</td>
                <td className="num">{l.qty.toLocaleString("en-US")}</td>
                <td>{l.uom}</td>
                <td className="num">{money(l.unitPrice)}</td>
                <td className="num">{money(l.qty * l.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} className="num">
                Subtotal (before tax and freight)
              </td>
              <td className="num">{money(subtotal)}</td>
            </tr>
          </tfoot>
        </table>

        <footer className="doc-foot">
          {decision?.decision === "approved" ? (
            <p>
              Approved by {decision.approver} on {formatDateTime(decision.created_at)}
              {decision.fingerprint && <span className="mono"> · ref {decision.fingerprint}</span>}
            </p>
          ) : status === "needs_review" ? (
            <p>This order is still being reviewed. Quantities, prices and dates may change.</p>
          ) : null}
          <p className="doc-powered">Prepared with StratosOpX</p>
        </footer>
      </article>
    </>
  );
}
