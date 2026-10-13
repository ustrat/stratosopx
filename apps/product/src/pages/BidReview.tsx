import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { formatDateTime, post, useApi, type ApiError } from "../api";
import type { BidChoice, BidDetail, BidRequirement } from "../types";
import { choiceLabel } from "./Bids";
import { ErrorCard, Loading } from "./common";

const statusLabel: Record<BidRequirement["status"], { label: string; tone: string }> = {
  meets: { label: "Meets", tone: "success" },
  fails: { label: "Fails", tone: "danger" },
  unclear: { label: "Unclear", tone: "warning" },
};

function Decision({ bid, onDone }: { bid: BidDetail; onDone: () => void }) {
  const [choice, setChoice] = useState<BidChoice | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overriding = choice !== null && choice !== bid.recommendation;

  if (bid.status === "decided" && bid.decision) {
    return (
      <div className={`decision decision-${bid.decision === "go" ? "approved" : "rejected"}`} role="status">
        <strong>Decided: {choiceLabel[bid.decision].label}</strong>
        <p>
          {bid.decided_by} · {bid.decided_at ? formatDateTime(bid.decided_at) : ""}
        </p>
        {bid.decision !== bid.recommendation && <p className="sample-note">Overrode the {choiceLabel[bid.recommendation].label} recommendation.</p>}
        {bid.decision_note && <p>“{bid.decision_note}”</p>}
      </div>
    );
  }
  if (!bid.canDecide) return <p className="hint">Your role can view bids but not decide them.</p>;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!choice) return;
    setBusy(true);
    setError(null);
    try {
      await post(`/bids/${bid.id}/decision`, { choice, note });
      onDone();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="decision-form" onSubmit={submit}>
      <fieldset>
        <legend className="sr-only">Bid decision</legend>
        {(Object.keys(choiceLabel) as BidChoice[]).map((c) => (
          <label key={c} className={`radio${choice === c ? " checked" : ""}`}>
            <input type="radio" name="decision" value={c} checked={choice === c} onChange={() => setChoice(c)} />
            {choiceLabel[c].label}
            {c === bid.recommendation && <span className="pill pill-count">Recommended</span>}
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span>{overriding ? "Reason for overriding (required)" : "Note (optional)"}</span>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button type="submit" className="btn btn-gradient" disabled={!choice || busy || (overriding && !note.trim())}>
        {busy ? "Saving…" : "Record decision"}
      </button>
      {error && (
        <p className="hint" role="alert" style={{ color: "#fca5a5" }}>
          {error}
        </p>
      )}
    </form>
  );
}

export function BidReview() {
  const { id = "" } = useParams();
  const { data: bid, error, reload } = useApi<BidDetail>(`/bids/${encodeURIComponent(id)}`);
  const [onlyFlags, setOnlyFlags] = useState(false);

  if (error) return <ErrorCard error={error} />;
  if (!bid) return <Loading />;

  const rec = choiceLabel[bid.recommendation];
  const rows = onlyFlags ? bid.requirements.filter((r) => r.status !== "meets") : bid.requirements;
  const dealbreakers = bid.requirements.filter((r) => r.dealbreaker).length;

  return (
    <>
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/bids">Bids &amp; RFPs</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{bid.title}</span>
      </nav>
      <div className="page-head">
        <div>
          <span className="eyebrow-sm">{bid.package_name ?? "Bid package"}</span>
          <h1>{bid.title}</h1>
          <p>
            {bid.owner ?? "Owner not stated"}
            {bid.due_date && ` · due ${bid.due_date}`}
            {bid.document && (
              <>
                {" "}
                · <span className="mono">{bid.document.filename}</span>
                {bid.pages ? ` · ${bid.pages} pp` : ""}
              </>
            )}
          </p>
        </div>
        <a className="btn btn-ghost" href={`/api/bids/${bid.id}/matrix.csv`}>
          Export matrix (CSV)
        </a>
      </div>

      <div className="review-layout">
        <div className="review-main">
          <section className={`card verdict verdict-${bid.recommendation.replace("_", "-")}`} aria-labelledby="verdict-title">
            <span className="eyebrow-sm">Recommendation</span>
            <h2 id="verdict-title">{rec.label}</h2>
            <p>{bid.recommendation_reason}</p>
            {bid.summary && (
              <p className="hint" style={{ marginBottom: 0 }}>
                {bid.summary}
              </p>
            )}
          </section>

          <section className="card" aria-labelledby="req-title">
            <div className="card-head">
              <h2 id="req-title">
                Compliance matrix <span className="pill pill-count">{bid.requirements.length}</span>
              </h2>
              <label className="toggle">
                <input type="checkbox" checked={onlyFlags} onChange={(e) => setOnlyFlags(e.target.checked)} />
                Flagged only
              </label>
            </div>
            <p className="hint" style={{ marginTop: 0 }}>
              {dealbreakers} dealbreaker{dealbreakers === 1 ? "" : "s"} identified. Check clause and page references against the package
              before relying on them.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Clause</th>
                    <th scope="col">Requirement</th>
                    <th scope="col">Evidence</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={r.dealbreaker && r.status === "fails" ? "flagged" : undefined}>
                      <td className="mono">
                        {r.clause ?? "—"}
                        {r.page !== null && <span className="cell-label">p. {r.page}</span>}
                      </td>
                      <td>
                        <span className="cell-label">
                          {r.category.replace(/_/g, " ")}
                          {r.mandatory ? " · mandatory" : ""}
                        </span>
                        {r.requirement}
                        {r.dealbreaker && <span className="pill tone-violet tag">Dealbreaker</span>}
                      </td>
                      <td className="desc">{r.evidence}</td>
                      <td>
                        <span className={`pill tone-${statusLabel[r.status].tone}`}>{statusLabel[r.status].label}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {bid.scope_matches.length > 0 && (
            <section className="card" aria-labelledby="match-title">
              <div className="card-head">
                <h2 id="match-title">Capability match</h2>
                <span className="muted-label">Scope of work vs. past projects</span>
              </div>
              <ul className="matches">
                {bid.scope_matches.map((m) => (
                  <li key={m.scope}>
                    <div className="match-head">
                      <span>{m.scope}</span>
                      <span className="mono">{Math.round(m.match * 100)}%</span>
                    </div>
                    <div className="meter" role="meter" aria-label={`${m.scope} match`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(m.match * 100)}>
                      <span style={{ width: `${m.match * 100}%` }} className={m.match < 0.7 ? "weak" : undefined} />
                    </div>
                    <span className="list-sub">{m.evidence}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="review-side">
          <section className="card" aria-labelledby="decision-title">
            <div className="card-head">
              <h2 id="decision-title">Decision</h2>
            </div>
            <Decision bid={bid} onDone={reload} />
          </section>

          {bid.warnings.length > 0 && (
            <section className="card" aria-labelledby="bid-notes-title">
              <div className="card-head">
                <h2 id="bid-notes-title">Notes</h2>
              </div>
              <ul className="screen-reasons" style={{ fontSize: 13, lineHeight: 1.7 }}>
                {bid.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
