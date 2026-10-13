import { useRef, useState, type FormEvent } from "react";
import { api, put, useApi, type ApiError } from "../api";
import type { Branding } from "../types";

// Company logo and contact details used on order confirmations.
export function BrandingSettings({ isAdmin }: { isAdmin: boolean }) {
  const { data, reload } = useApi<Branding>("/branding");
  const fileRef = useRef<HTMLInputElement>(null);
  const [details, setDetails] = useState<Branding["details"] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!data) return null;
  const d = details ?? data.details;
  const set = (k: keyof Branding["details"], v: string) => setDetails({ ...d, [k]: v });

  async function uploadLogo() {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    setBusy(true);
    const form = new FormData();
    form.append("logo", f);
    const res = await fetch("/api/branding/logo", { method: "PUT", body: form, credentials: "same-origin" }).catch(() => null);
    const body = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : null;
    setMsg(res?.ok ? { ok: true, text: "Logo updated." } : { ok: false, text: body?.error ?? "Upload failed" });
    if (fileRef.current) fileRef.current.value = "";
    setBusy(false);
    reload();
  }

  async function removeLogo() {
    await api("/branding/logo", { method: "DELETE" }).catch(() => {});
    reload();
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await put("/branding", d);
      setMsg({ ok: true, text: "Details saved." });
      setDetails(null);
      reload();
    } catch (err) {
      setMsg({ ok: false, text: (err as ApiError).message });
    }
  }

  return (
    <section className="card" aria-labelledby="brand-title">
      <div className="card-head">
        <h2 id="brand-title">Company branding</h2>
        <span className="muted-label">Shown on order confirmations</span>
      </div>

      <div className="brand-logo-row">
        <div className="brand-logo-preview">
          {data.logoUrl ? <img src={data.logoUrl} alt={`${data.name} logo`} /> : <span>No logo</span>}
        </div>
        {isAdmin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="file-input" aria-label="Logo file" />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={uploadLogo}>
                {busy ? "Uploading…" : "Upload logo"}
              </button>
              {data.logoUrl && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={removeLogo}>
                  Remove
                </button>
              )}
            </div>
            <span className="hint" style={{ margin: 0 }}>
              PNG, JPEG or WebP, up to 1 MB. A wide logo on a transparent or white background prints best.
            </span>
          </div>
        )}
      </div>

      <form onSubmit={save} className="brand-form">
        {(
          [
            ["displayName", "Name on documents", data.name],
            ["address", "Address", "Street, City, State ZIP"],
            ["phone", "Phone", ""],
            ["email", "Orders email", ""],
            ["website", "Website", ""],
          ] as [keyof Branding["details"], string, string][]
        ).map(([k, label, ph]) => (
          <label key={k} className="field">
            <span>{label}</span>
            {k === "address" ? (
              <textarea rows={2} value={d[k] ?? ""} placeholder={ph} disabled={!isAdmin} onChange={(e) => set(k, e.target.value)} />
            ) : (
              <input className="text-input" value={d[k] ?? ""} placeholder={ph} disabled={!isAdmin} onChange={(e) => set(k, e.target.value)} />
            )}
          </label>
        ))}
        {isAdmin && (
          <button type="submit" className="btn btn-ghost btn-sm" style={{ width: "auto" }}>
            Save details
          </button>
        )}
      </form>
      {msg && (
        <p className="hint" role="status" style={{ color: msg.ok ? "var(--success)" : "#fca5a5" }}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
