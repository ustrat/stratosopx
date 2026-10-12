import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { reviewQueue } from "@/lib/data";
import { getReview } from "@/lib/review";

export const metadata: Metadata = {
  title: "Review queue · StratosOpx",
};

export default function ReviewQueuePage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Review queue</h1>
          <p>Exceptions waiting on a person before anything reaches the ERP or a bid goes out.</p>
        </div>
      </div>

      <section className="card" aria-label="Queue">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Source</th>
                <th scope="col">Reason</th>
                <th scope="col">Received</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {reviewQueue.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className={`list-icon-sm tone-${item.tone}`}>
                      <Icon name={item.icon} size={16} />
                    </span>
                    <span className={item.mono ? "mono" : undefined}>{item.title}</span>
                  </td>
                  <td>{item.source}</td>
                  <td className="desc">{item.reason}</td>
                  <td className="desc">{getReview(item.id)?.receivedAt}</td>
                  <td>
                    <span className={`pill tone-${item.tone}`}>{item.status}</span>
                  </td>
                  <td className="num">
                    <Link href={`/dashboard/review/${item.id}`} className="btn btn-ghost btn-sm">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          Showing 3 sample items of 23.
        </p>
      </section>
    </>
  );
}
