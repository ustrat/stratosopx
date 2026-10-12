"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { QueueItem } from "@/lib/data";

export function ReviewQueue({ items, total }: { items: QueueItem[]; total: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  function reviewNext() {
    const idx = selected ? items.indexOf(selected) : -1;
    setSelectedId(items[(idx + 1) % items.length].id);
  }

  return (
    <section aria-labelledby="queue-title" className="card col-side">
      <div className="card-head">
        <h2 id="queue-title">
          Review queue{" "}
          <span className="pill pill-count">
            {items.length} of {total}
          </span>
        </h2>
        <Link href="/dashboard/review">View all ›</Link>
      </div>

      <ul className="list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="list-item"
              aria-pressed={item.id === selectedId}
              onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
            >
              <span className={`list-icon tone-${item.icon === "document" ? "violet" : item.tone}`}>
                <Icon name={item.icon} />
              </span>
              <span className="list-body">
                <span className={`list-title${item.mono ? " mono" : ""}`}>{item.title}</span>
                <span className="list-sub">
                  {item.source} · {item.reason}
                </span>
              </span>
              <span className={`pill tone-${item.tone}`}>{item.status}</span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="queue-detail" aria-live="polite">
          <strong>{selected.title}</strong>
          <dl>
            {selected.details.map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <Link href={`/dashboard/review/${selected.id}`} className="detail-link">
            Open full review →
          </Link>
        </div>
      )}

      <div className="queue-actions">
        <button type="button" className="btn btn-ghost">
          Assign
        </button>
        <button type="button" className="btn btn-primary" onClick={reviewNext}>
          Review next
        </button>
      </div>
    </section>
  );
}
