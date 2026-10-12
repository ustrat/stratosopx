import { useRef, useState } from "react";
import { useApi } from "../api";
import type { CatalogItem, Me } from "../types";
import { ErrorCard, Loading } from "./common";

type Kind = "items" | "customers" | "aliases";
type Summary = { items: number; customers: number; aliases: number };
type ImportResult =
  | { ok: true; dryRun: boolean; total: number; added: number; updated: number; removed: number; aliasesRemoved: number }
  | { ok: false; errorCount: number; errors: { row: number; message: string }[] };

const labels: Record<Kind, { title: string; help: string }> = {
  items: {
    title: "Items",
    help: "sku, description, sell_uom, contract_price, and optionally stock and other_units (e.g. BX=100;CS=12: selling units per box or case).",
  },
  customers: { title: "Customers", help: "customer_id, name, and optionally credit_limit and open_balance." },
  aliases: { title: "Part aliases", help: "customer_id, customer_part, sku: the customer's own part number for one of your SKUs." },
};

async function sendImport(kind: Kind, csv: string, mode: string, dryRun: boolean): Promise<ImportResult> {
  const res = await fetch(`/api/catalog/import/${kind}?mode=${mode}${dryRun ? "&dryRun=1" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csv,
    credentials: "same-origin",
  });
  const body = (await res.json().catch(() => ({}))) as ImportResult & { error?: string };
  if (!res.ok && res.status !== 422) throw new Error(body.error ?? `Import failed (${res.status})`);
  return body;
}

function Importer({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>("items");
  const [mode, setMode] = useState<"upsert" | "replace">("upsert");
  const [csv, setCsv] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCsv(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function run(dryRun: boolean) {
    if (!csv) return;
    setBusy(true);
    setError(null);
    try {
      const r = await sendImport(kind, csv, mode, dryRun);
      setResult(r);
      if (r.ok && !r.dryRun) {
        onImported();
        setCsv(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="decision-form">
      <div className="upload-row">
        <label className="select-field">
          <span>What</span>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind);
              reset();
            }}
          >
            <option value="items">Items</option>
            <option value="customers">Customers</option>
            <option value="aliases">Part aliases</option>
          </select>
        </label>
        <label className="select-field">
          <span>Mode</span>
          <select value={mode} onChange={(e) => (setMode(e.target.value as "upsert" | "replace"), setResult(null))}>
            <option value="upsert">Add and update</option>
            <option value="replace">Replace everything</option>
          </select>
        </label>
        <label className="field" style={{ flex: "1 1 240px", marginBottom: 0 }}>
          <span>CSV file</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="file-input"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              setResult(null);
              setCsv(f ? await f.text() : null);
            }}
          />
        </label>
      </div>
      <p className="hint">
        Columns: {labels[kind].help}{" "}
        <a href={`/api/catalog/template/${kind}`} download>
          Download template
        </a>
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="btn btn-ghost" disabled={!csv || busy} onClick={() => run(true)}>
          Preview
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!csv || busy || !result?.ok || !result.dryRun}
          onClick={() => run(false)}
        >
          {busy ? "Working…" : "Import"}
        </button>
      </div>
      {error && (
        <p className="hint" role="alert" style={{ color: "#fca5a5" }}>
          {error}
        </p>
      )}
      {result && (
        <div className={`decision decision-${result.ok ? "approved" : "rejected"}`} role="status" style={{ marginTop: 12 }}>
          {result.ok ? (
            <>
              <strong>{result.dryRun ? "Preview: ready to import" : "Imported"}</strong>
              <p>
                {result.total.toLocaleString("en-US")} rows · {result.added} new · {result.updated} updated
                {mode === "replace" && ` · ${result.removed} removed`}
                {result.aliasesRemoved > 0 && ` · ${result.aliasesRemoved} part aliases removed with them`}
              </p>
              {result.dryRun && mode === "replace" && result.removed > 0 && (
                <p className="sample-note">Replace removes rows that aren't in this file. Check the numbers before importing.</p>
              )}
            </>
          ) : (
            <>
              <strong>
                {result.errorCount} problem{result.errorCount === 1 ? "" : "s"}: nothing was imported
              </strong>
              <ul className="screen-reasons" style={{ maxHeight: 220, overflow: "auto" }}>
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
              {result.errorCount > result.errors.length && <p className="sample-note">Showing the first {result.errors.length}.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CatalogTable({ kind }: { kind: Kind }) {
  const path = kind === "items" ? "/catalog" : `/catalog/${kind}`;
  const { data, error } = useApi<{ items?: CatalogItem[]; customers?: Record<string, unknown>[]; aliases?: Record<string, unknown>[] }>(path);
  const [q, setQ] = useState("");
  if (error) return <ErrorCard error={error} />;
  if (!data) return <Loading />;
  const match = (...v: unknown[]) => !q || v.some((x) => String(x ?? "").toLowerCase().includes(q.toLowerCase()));

  let head: string[];
  let rows: (string | number)[][];
  if (kind === "items") {
    head = ["SKU", "Description", "Unit", "Other units", "Contract price", "Stock"];
    rows = (data.items ?? [])
      .filter((i) => match(i.sku, i.description))
      .map((i) => [
        i.sku,
        i.description,
        i.sellUom,
        i.uomOptions.slice(1).map((u) => `${u.code}=${u.factor}`).join(" ") || "—",
        `$${i.tierPrice.toFixed(2)}`,
        i.stock.toLocaleString("en-US"),
      ]);
  } else if (kind === "customers") {
    head = ["Customer ID", "Name", "Credit limit", "Open balance"];
    rows = (data.customers ?? [])
      .filter((c) => match(c.id, c.name))
      .map((c) => [String(c.id), String(c.name), `$${Number(c.credit_limit).toLocaleString("en-US")}`, `$${Number(c.open_balance).toLocaleString("en-US")}`]);
  } else {
    head = ["Customer ID", "Customer part", "SKU"];
    rows = (data.aliases ?? []).filter((a) => match(a.customer_id, a.customer_part, a.sku)).map((a) => [String(a.customer_id), String(a.customer_part), String(a.sku)]);
  }

  return (
    <>
      <label className="search catalog-search" style={{ marginBottom: 12 }}>
        <span className="sr-only">Search</span>
        <input type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {rows.length === 0 ? (
        <p className="empty-note">Nothing here yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {head.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j} className={j === 0 ? "mono" : undefined}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function Catalog() {
  const { data: me } = useApi<Me>("/me");
  const summary = useApi<Summary>("/catalog/summary");
  const [tab, setTab] = useState<Kind>("items");
  const [version, setVersion] = useState(0);
  const isAdmin = me?.user.role === "admin";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Catalog</h1>
          <p>The customers, items and part numbers that orders are matched against, until your ERP is connected.</p>
        </div>
      </div>

      <div className="kpis">
        {(["items", "customers", "aliases"] as Kind[]).map((k) => (
          <div key={k} className="card kpi">
            <div className="kpi-body">
              <span className="kpi-label">{labels[k].title}</span>
              <span className="kpi-value">{summary.data ? summary.data[k].toLocaleString("en-US") : "…"}</span>
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <section className="card" aria-labelledby="import-title">
          <div className="card-head">
            <h2 id="import-title">Import from CSV</h2>
          </div>
          <Importer
            onImported={() => {
              summary.reload();
              setVersion((v) => v + 1);
            }}
          />
        </section>
      )}

      <section className="card" aria-label="Catalog data">
        <div className="billing-toggle" role="tablist" aria-label="Catalog data">
          {(["items", "customers", "aliases"] as Kind[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "active" : undefined} onClick={() => setTab(k)}>
              {labels[k].title}
            </button>
          ))}
        </div>
        <CatalogTable key={`${tab}-${version}`} kind={tab} />
      </section>
    </>
  );
}
