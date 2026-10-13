import { Link, useParams } from "react-router";
import { formatDateTime, useApi } from "../api";
import { OrderReviewer } from "../components/OrderReviewer";
import type { CatalogItem, OrderDetail, OrderSummary } from "../types";
import { ErrorCard, Loading, statusLabel } from "./common";

export function OrderList({ mode }: { mode: "open" | "all" }) {
  const { data, error } = useApi<{ orders: OrderSummary[] }>(`/orders?status=${mode}`);
  const title = mode === "open" ? "Review queue" : "Orders";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>
            {mode === "open"
              ? "Orders waiting on a person before anything reaches the ERP."
              : "Every order received, with its decision and ERP status (latest 200)."}
          </p>
        </div>
      </div>
      {error ? (
        <ErrorCard error={error} />
      ) : !data ? (
        <Loading />
      ) : data.orders.length === 0 ? (
        <div className="card placeholder">
          <h2>{mode === "open" ? "Nothing waiting for review" : "No orders yet"}</h2>
        </div>
      ) : (
        <section className="card" aria-label={title}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Type</th>
                  <th scope="col">Received</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{o.title}</td>
                    <td>{o.customer ?? "—"}</td>
                    <td className="desc">{o.kind === "change-order" ? "Change order" : "Purchase order"}</td>
                    <td className="desc">{formatDateTime(o.received_at)}</td>
                    <td>
                      <span className={`pill tone-${statusLabel[o.status].tone}`}>{statusLabel[o.status].label}</span>
                    </td>
                    <td className="num">
                      <Link to={`/review/${encodeURIComponent(o.id)}`} className="btn btn-ghost btn-sm">
                        {o.status === "needs_review" ? "Review" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

export function OrderReview() {
  const { id = "" } = useParams();
  const { data, error, reload } = useApi<OrderDetail>(`/orders/${encodeURIComponent(id)}`);
  const catalog = useApi<{ items: CatalogItem[] }>("/catalog");

  if (error) return <ErrorCard error={error} />;
  if (!data) return <Loading />;
  const o = data.order;

  return (
    <>
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/review">Review queue</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="mono">
          {o.title}
        </span>
      </nav>
      <div className="page-head">
        <div>
          <span className="eyebrow-sm">{o.kind === "change-order" ? "Change order" : "Purchase order"}</span>
          <h1 className="mono-title">{o.title}</h1>
          <p>
            {o.customer.name} <span className="mono">({o.customer.id})</span>
            {data.source.filename && (
              <>
                {" "}
                · <span className="mono">{data.source.filename}</span> via {data.source.channel}
              </>
            )}{" "}
            · {formatDateTime(o.receivedAt)}
            {o.salesOrder && (
              <>
                {" "}
                · updates <span className="mono">{o.salesOrder}</span>
              </>
            )}
          </p>
        </div>
        <Link to={`/orders/${encodeURIComponent(o.id)}/view`} className="btn btn-ghost">
          Order view
        </Link>
      </div>
      {(data.warnings.length > 0 || data.documentId) && (
        <section className="card extraction-notes" aria-labelledby="notes-title">
          <div className="card-head">
            <h2 id="notes-title">Extraction notes</h2>
            {data.documentId && data.source.filename && (
              <a className="btn btn-ghost btn-sm" href={`/api/documents/${data.documentId}/file`}>
                Download source
              </a>
            )}
          </div>
          {data.warnings.length ? (
            <ul className="screen-reasons" style={{ fontSize: 13, lineHeight: 1.7 }}>
              {data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className="hint" style={{ margin: 0 }}>
              Nothing unusual was found when this order was read.
            </p>
          )}
        </section>
      )}
      {/* Remount on status change so local edits reset to the stored order. */}
      <OrderReviewer key={data.status} detail={data} catalog={catalog.data?.items ?? []} onDecided={reload} />
    </>
  );
}
