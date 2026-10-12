import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { api, formatBytes, formatDateTime, post, useApi, type ApiError } from "../api";
import { Icon } from "../components/Icon";
import type { DocumentRow, IntakeSettings, Me } from "../types";
import { ErrorCard, Loading } from "./common";

const stateLabel: Record<DocumentRow["state"], { label: string; tone: string }> = {
  stored: { label: "Accepted", tone: "success" },
  released: { label: "Released", tone: "info" },
  quarantined: { label: "Quarantined", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
  deleted: { label: "Deleted", tone: "danger" },
  expired: { label: "Expired", tone: "info" },
};

const extractionLabel: Record<DocumentRow["extraction_state"], { label: string; tone: string } | null> = {
  none: null,
  queued: { label: "Waiting to read", tone: "info" },
  running: { label: "Reading…", tone: "info" },
  done: { label: "Order created", tone: "success" },
  not_order: { label: "Not an order", tone: "info" },
  skipped: { label: "Skipped", tone: "info" },
  needs_attention: { label: "Needs attention", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

function ExtractionCell({ doc, canRetry, onRetry }: { doc: DocumentRow; canRetry: boolean; onRetry: (id: string) => void }) {
  const l = extractionLabel[doc.extraction_state];
  if (!l) return <span className="desc">—</span>;
  return (
    <>
      {doc.extraction_state === "done" && doc.order_id ? (
        <Link to={`/review/${doc.order_id}`} className={`pill tone-${l.tone}`} style={{ textDecoration: "none" }}>
          {l.label} →
        </Link>
      ) : (
        <span className={`pill tone-${l.tone}`}>{l.label}</span>
      )}
      {doc.extraction_note && doc.extraction_state !== "done" && (
        <ul className="screen-reasons">
          <li>{doc.extraction_note}</li>
        </ul>
      )}
      {canRetry && (doc.extraction_state === "failed" || doc.extraction_state === "needs_attention") && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => onRetry(doc.id)}>
          Retry
        </button>
      )}
    </>
  );
}

type UploadResult = { filename: string; state: DocumentRow["state"]; reasons: string[] };

function UploadForm({ onUploaded, limits }: { onUploaded: () => void; limits: IntakeSettings["limits"] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"order" | "bid">("order");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const files = [...(fileRef.current?.files ?? [])];
    if (!files.length) return;
    setBusy(true);
    setError(null);
    const out: UploadResult[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const res = await fetch("/api/documents", { method: "POST", body: form, credentials: "same-origin" }).catch(() => null);
      const body = res ? ((await res.json().catch(() => ({}))) as UploadResult & { error?: string }) : null;
      if (!res || !res.ok) {
        setError(body?.error ?? `Upload of ${file.name} failed`);
        break;
      }
      out.push(body!);
    }
    setResults(out);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    onUploaded();
  }

  return (
    <form onSubmit={submit} className="upload-form">
      <div className="upload-row">
        <label className="field" style={{ flex: "1 1 260px", marginBottom: 0 }}>
          <span>Files (PDF, Excel, CSV, Word, images · up to {limits.maxFileMB} MB each)</span>
          <input ref={fileRef} type="file" multiple required className="file-input" />
        </label>
        <label className="select-field">
          <span>Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as "order" | "bid")}>
            <option value="order">Purchase / change order</option>
            <option value="bid">Bid or RFP package</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <Icon name="upload" size={16} /> {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      {error && (
        <p className="hint" role="alert" style={{ color: "#fca5a5" }}>
          {error}
        </p>
      )}
      {results.length > 0 && (
        <ul className="list" style={{ marginTop: 12 }} aria-live="polite">
          {results.map((r) => (
            <li key={r.filename + r.state} className="list-item">
              <span className="list-body">
                <span className="list-title mono">{r.filename}</span>
                {r.reasons.length > 0 && <span className="list-sub">{r.reasons.join(" · ")}</span>}
              </span>
              <span className={`pill tone-${stateLabel[r.state].tone}`}>{stateLabel[r.state].label}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function Senders({ settings, isAdmin, onChange }: { settings: IntakeSettings; isAdmin: boolean; onChange: () => void }) {
  const [pattern, setPattern] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await post("/intake/senders", { pattern });
      setPattern("");
      setError(null);
      onChange();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function remove(p: string) {
    await api(`/intake/senders/${encodeURIComponent(p)}`, { method: "DELETE" }).catch(() => {});
    onChange();
  }

  return (
    <>
      {settings.senders.length === 0 ? (
        <p className="hint" style={{ marginTop: 0 }}>
          No senders yet. Email from anyone not listed here is quarantined.
        </p>
      ) : (
        <ul className="sender-list">
          {settings.senders.map((s) => (
            <li key={s.pattern}>
              <span className="mono">{s.pattern}</span>
              {isAdmin && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(s.pattern)} aria-label={`Remove ${s.pattern}`}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isAdmin && (
        <form onSubmit={add} className="sender-add">
          <label className="sr-only" htmlFor="sender-pattern">
            Email address or @domain
          </label>
          <input
            id="sender-pattern"
            className="text-input"
            placeholder="buyer@customer.com or @customer.com"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
          <button type="submit" className="btn btn-ghost btn-sm">
            Add
          </button>
        </form>
      )}
      {error && (
        <p className="hint" role="alert" style={{ color: "#fca5a5" }}>
          {error}
        </p>
      )}
    </>
  );
}

export function Intake() {
  const { data: me } = useApi<Me>("/me");
  const settings = useApi<IntakeSettings>("/intake");
  const docs = useApi<{ documents: DocumentRow[] }>("/documents");
  const [copied, setCopied] = useState(false);
  const isAdmin = me?.user.role === "admin";
  const canUpload = me?.user.role === "admin" || me?.user.role === "approver";

  // Refresh while documents are being read.
  const busy = docs.data?.documents.some((d) => d.extraction_state === "queued" || d.extraction_state === "running");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(docs.reload, 5000);
    return () => clearInterval(t);
  }, [busy, docs.reload]);

  async function retry(id: string) {
    await post(`/documents/${id}/extract`, {}).catch(() => {});
    docs.reload();
  }

  async function act(id: string, action: "release" | "delete") {
    if (action === "delete" && !confirm("Delete this document and its stored file?")) return;
    await api(`/documents/${id}${action === "release" ? "/release" : ""}`, { method: action === "release" ? "POST" : "DELETE" }).catch(
      () => {},
    );
    docs.reload();
  }

  if (settings.error) return <ErrorCard error={settings.error} />;
  if (!settings.data) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Intake</h1>
          <p>Purchase orders and bid packages arrive here by email or upload, and are screened before anything reads them.</p>
        </div>
      </div>

      <div className="review-layout">
        <div className="review-main">
          {canUpload && (
            <section className="card" aria-labelledby="upload-title">
              <div className="card-head">
                <h2 id="upload-title">Upload documents</h2>
              </div>
              <UploadForm limits={settings.data.limits} onUploaded={docs.reload} />
            </section>
          )}

          <section className="card" aria-labelledby="docs-title">
            <div className="card-head">
              <h2 id="docs-title">Documents</h2>
              <span className="muted-label">Latest 100</span>
            </div>
            {docs.error ? (
              <ErrorCard error={docs.error} />
            ) : !docs.data ? (
              <Loading />
            ) : docs.data.documents.length === 0 ? (
              <p className="empty-note">No documents received yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Document</th>
                      <th scope="col">From</th>
                      <th scope="col">Received</th>
                      <th scope="col">Screening</th>
                      <th scope="col">Extraction</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.data.documents.map((d) => (
                      <tr key={d.id} className={d.state === "rejected" || d.state === "deleted" ? "blocked" : undefined}>
                        <td>
                          <span className="mono">{d.filename}</span>
                          <span className="cell-label">
                            {d.kind === "bid" ? "Bid package" : "Order"} · {formatBytes(d.size_bytes)}
                            {d.pages ? ` · ${d.pages} pp` : ""} · {d.channel}
                          </span>
                        </td>
                        <td className="desc mono" style={{ fontSize: 12 }}>
                          {d.sender ?? "—"}
                        </td>
                        <td className="desc" style={{ whiteSpace: "nowrap" }}>
                          {formatDateTime(d.received_at)}
                        </td>
                        <td>
                          <span className={`pill tone-${stateLabel[d.state].tone}`}>{stateLabel[d.state].label}</span>
                          {d.reasons.length > 0 && (
                            <ul className="screen-reasons">
                              {d.reasons.map((r) => (
                                <li key={r}>{r}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td>
                          <ExtractionCell doc={d} canRetry={canUpload} onRetry={retry} />
                        </td>
                        <td className="num">
                          <div className="row-actions">
                            {(d.state === "stored" || d.state === "released") && d.has_file === 1 && (
                              <a className="btn btn-ghost btn-sm" href={`/api/documents/${d.id}/file`}>
                                Download
                              </a>
                            )}
                            {isAdmin && d.state === "quarantined" && (
                              <>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(d.id, "release")}>
                                  Release
                                </button>
                                <button type="button" className="btn btn-danger btn-sm" onClick={() => act(d.id, "delete")}>
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="review-side">
          <section className="card" aria-labelledby="address-title">
            <div className="card-head">
              <h2 id="address-title">Intake email</h2>
            </div>
            {settings.data.address ? (
              <>
                <div className="address-box">
                  <span className="mono">{settings.data.address}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(settings.data!.address!).catch(() => {});
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="hint" style={{ marginBottom: 0 }}>
                  Ask buyers to send POs here, or forward them from your orders inbox. Each attachment becomes a document; an email
                  without attachments is read as a PO in the body.
                </p>
              </>
            ) : (
              <p className="hint">No intake address is set for your company yet.</p>
            )}
          </section>

          <section className="card" aria-labelledby="senders-title">
            <div className="card-head">
              <h2 id="senders-title">Allowed senders</h2>
            </div>
            <Senders settings={settings.data} isAdmin={isAdmin} onChange={settings.reload} />
          </section>

          <section className="card" aria-labelledby="checks-title">
            <div className="card-head">
              <h2 id="checks-title">What we check</h2>
            </div>
            <ul className="screen-reasons" style={{ fontSize: 13, lineHeight: 1.7 }}>
              <li>Sender is allowed and passes SPF, DKIM or DMARC</li>
              <li>File type, size and page limits</li>
              <li>Contents match the file type; no programs, PDF scripts or hidden macros</li>
              <li>Password-protected files are held</li>
              <li>Duplicates are rejected and never billed</li>
            </ul>
            <p className="hint" style={{ marginBottom: 0 }}>
              These are structural safety checks, not an antivirus scan.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
