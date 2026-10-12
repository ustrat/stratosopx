import { Link } from "react-router";
import type { ApiError } from "../api";

export function Loading() {
  return (
    <p className="hint" role="status">
      Loading…
    </p>
  );
}

export function ErrorCard({ error }: { error: ApiError }) {
  return (
    <div className="card placeholder" role="alert">
      <h2>{error.status === 404 ? "Not found" : "Something went wrong"}</h2>
      <p>{error.message}</p>
      <Link to="/" className="btn btn-ghost">
        Back to Overview
      </Link>
    </div>
  );
}

export function Placeholder({ title, summary }: { title: string; summary: string }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{summary}</p>
        </div>
      </div>
      <div className="card placeholder">
        <h2>Not built yet</h2>
        <p>This part of the product is planned for a later milestone.</p>
        <Link to="/" className="btn btn-ghost">
          Back to Overview
        </Link>
      </div>
    </>
  );
}

export const statusLabel = {
  needs_review: { label: "Needs review", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  written: { label: "Written to ERP", tone: "success" },
  failed: { label: "Write failed", tone: "danger" },
  rejected: { label: "Rejected", tone: "danger" },
} as const;
