"use client";

import { useState } from "react";
import type { BidRequirement, BidReview, RequirementStatus } from "@/lib/review";

type Choice = "no-go" | "go" | "info";

const choiceLabel: Record<Choice, string> = {
  "no-go": "No-Go",
  go: "Go",
  info: "Request clarification",
};

const statusLabel: Record<RequirementStatus, string> = { pass: "Meets", fail: "Fails", review: "Review" };
const statusTone: Record<RequirementStatus, string> = { pass: "success", fail: "danger", review: "warning" };

function toCsv(bid: BidReview) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["Clause", "Category", "Requirement", "On file", "Status", "Dealbreaker"];
  const rows = bid.requirements.map((r) =>
    [r.clause, r.category, r.requirement, r.onFile, statusLabel[r.status], r.dealbreaker ? "Yes" : "No"].map(esc).join(","),
  );
  return [header.map(esc).join(","), ...rows].join("\r\n");
}

export function BidReviewer({ bid }: { bid: BidReview }) {
  const [onlyFlags, setOnlyFlags] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [note, setNote] = useState("");
  const [recorded, setRecorded] = useState<{ choice: Choice; note: string } | null>(null);

  const dealbreakers = bid.requirements.filter((r) => r.dealbreaker && r.status === "fail");
  const toReview = bid.requirements.filter((r) => r.status === "review");
  const recommended: Choice = dealbreakers.length > 0 ? "no-go" : toReview.length > 0 ? "info" : "go";
  const overriding = choice !== null && choice !== recommended;
  const canSubmit = choice !== null && (!overriding || note.trim().length > 0);

  const rows: BidRequirement[] = onlyFlags ? bid.requirements.filter((r) => r.status !== "pass") : bid.requirements;

  function exportCsv() {
    const blob = new Blob([toCsv(bid)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bid.id}-compliance-matrix.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="review-layout">
      <div className="review-main">
        <section className={`card verdict verdict-${recommended}`} aria-labelledby="verdict-title">
          <span className="eyebrow-sm">Recommendation</span>
          <h2 id="verdict-title">{choiceLabel[recommended]}</h2>
          <p>
            {dealbreakers.length > 0
              ? `${dealbreakers.length} dealbreaker${dealbreakers.length > 1 ? "s" : ""}: ${dealbreakers
                  .map((d) => `${d.clause} ${d.requirement.toLowerCase()}`)
                  .join("; ")}.`
              : "No dealbreakers found."}{" "}
            {toReview.length > 0 && `${toReview.length} more clauses need a person to weigh in.`}
          </p>
        </section>

        <section className="card" aria-labelledby="req-title">
          <div className="card-head">
            <h2 id="req-title">Compliance matrix</h2>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label className="toggle">
                <input type="checkbox" checked={onlyFlags} onChange={(e) => setOnlyFlags(e.target.checked)} />
                Flagged only
              </label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}>
                Export CSV
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Clause</th>
                  <th scope="col">Requirement</th>
                  <th scope="col">On file</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.clause} className={r.status === "fail" ? "flagged" : undefined}>
                    <td className="mono">{r.clause}</td>
                    <td>
                      <span className="cell-label">{r.category}</span>
                      {r.requirement}
                      {r.dealbreaker && <span className="pill tone-violet tag">Gatekeeper</span>}
                    </td>
                    <td className="desc">{r.onFile}</td>
                    <td>
                      <span className={`pill tone-${statusTone[r.status]}`}>{statusLabel[r.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" aria-labelledby="match-title">
          <div className="card-head">
            <h2 id="match-title">Capability match</h2>
            <span className="muted-label">Scope of work vs. past bids</span>
          </div>
          <ul className="matches">
            {bid.matches.map((m) => (
              <li key={m.scope}>
                <div className="match-head">
                  <span>{m.scope}</span>
                  <span className="mono">{Math.round(m.score * 100)}%</span>
                </div>
                <div
                  className="meter"
                  role="meter"
                  aria-label={`${m.scope} match`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(m.score * 100)}
                >
                  <span style={{ width: `${m.score * 100}%` }} className={m.score < 0.7 ? "weak" : undefined} />
                </div>
                <span className="list-sub">{m.evidence}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="review-side">
        <section className="card" aria-labelledby="bid-meta-title">
          <div className="card-head">
            <h2 id="bid-meta-title">Package</h2>
          </div>
          <dl className="meta-list">
            <dt>Owner</dt>
            <dd>{bid.owner}</dd>
            <dt>Package</dt>
            <dd>{bid.packageName}</dd>
            <dt>Bid due</dt>
            <dd>{bid.dueDate}</dd>
            <dt>Document</dt>
            <dd className="mono">
              {bid.sourceFile} · {bid.pages} pp
            </dd>
          </dl>
        </section>

        <section className="card" aria-labelledby="bid-decision-title">
          <div className="card-head">
            <h2 id="bid-decision-title">Decision</h2>
          </div>
          {recorded ? (
            <div className={`decision decision-${recorded.choice === "go" ? "approved" : "rejected"}`} role="status">
              <strong>Recorded: {choiceLabel[recorded.choice]}</strong>
              {recorded.note && <p>“{recorded.note}”</p>}
              <p className="sample-note">Sample mode: nothing was sent.</p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setRecorded(null);
                  setChoice(null);
                  setNote("");
                }}
              >
                Change decision
              </button>
            </div>
          ) : (
            <form
              className="decision-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (choice && canSubmit) setRecorded({ choice, note });
              }}
            >
              <fieldset>
                <legend className="sr-only">Bid decision</legend>
                {(Object.keys(choiceLabel) as Choice[]).map((c) => (
                  <label key={c} className={`radio${choice === c ? " checked" : ""}`}>
                    <input type="radio" name="decision" value={c} checked={choice === c} onChange={() => setChoice(c)} />
                    {choiceLabel[c]}
                    {c === recommended && <span className="pill pill-count">Recommended</span>}
                  </label>
                ))}
              </fieldset>
              <label className="field">
                <span>{overriding ? "Reason for overriding (required)" : "Note (optional)"}</span>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button type="submit" className="btn btn-gradient" disabled={!canSubmit}>
                Record decision
              </button>
            </form>
          )}
        </section>
      </aside>
    </div>
  );
}
