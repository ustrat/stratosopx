// CSV parsing and validation for catalog imports (items, customers, part
// aliases). Pure functions: no database access, so they are unit-tested.

export type CatalogKind = "items" | "customers" | "aliases";

export type RowError = { row: number; message: string };

export type ItemRow = {
  sku: string;
  description: string;
  sellUom: string;
  uomOptions: { code: string; factor: number }[];
  tierPrice: number;
  stock: number;
};
export type CustomerRow = { id: string; name: string; creditLimit: number; openBalance: number };
export type AliasRow = { customerId: string; customerPart: string; sku: string; row: number };

export const COLUMNS: Record<CatalogKind, { required: string[]; optional: string[] }> = {
  items: { required: ["sku", "description", "sell_uom", "contract_price"], optional: ["stock", "other_units"] },
  customers: { required: ["customer_id", "name"], optional: ["credit_limit", "open_balance"] },
  aliases: { required: ["customer_id", "customer_part", "sku"], optional: [] },
};

export const MAX_ROWS = 20_000;

/** RFC 4180-style CSV: quoted fields, escaped quotes, commas/newlines inside quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const normHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

function number(raw: string | undefined, row: number, col: string, errors: RowError[], { required = false, min = 0 } = {}) {
  const v = (raw ?? "").trim().replace(/[$,]/g, "");
  if (v === "") {
    if (required) errors.push({ row, message: `${col} is required` });
    return 0;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) {
    errors.push({ row, message: `${col} "${raw}" is not a valid number` });
    return 0;
  }
  return n;
}

const UOM = /^[A-Z][A-Z0-9]{0,9}$/;

function parseUnits(raw: string, sellUom: string, row: number, errors: RowError[]) {
  const options = [{ code: sellUom, factor: 1 }];
  for (const part of raw.split(/[;|]/).map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^([A-Za-z][A-Za-z0-9]{0,9})\s*=\s*([0-9.]+)$/);
    const code = m?.[1]?.toUpperCase();
    const factor = Number(m?.[2]);
    if (!m || !code || !Number.isFinite(factor) || factor <= 0) {
      errors.push({ row, message: `other_units "${part}" should look like BX=100` });
      continue;
    }
    if (options.some((o) => o.code === code)) {
      errors.push({ row, message: `unit ${code} is listed twice` });
      continue;
    }
    options.push({ code, factor });
  }
  return options;
}

type Parsed<T> = { rows: T[]; errors: RowError[] };

/** Map header names to indexes and report missing required columns. */
function header(table: string[][], kind: CatalogKind): { index: Map<string, number>; errors: RowError[] } {
  const errors: RowError[] = [];
  const index = new Map((table[0] ?? []).map((h, i) => [normHeader(h), i]));
  for (const col of COLUMNS[kind].required) {
    if (!index.has(col)) errors.push({ row: 1, message: `Missing column "${col}"` });
  }
  if (table.length - 1 > MAX_ROWS) errors.push({ row: 1, message: `Too many rows (limit ${MAX_ROWS.toLocaleString("en-US")})` });
  if (table.length < 2) errors.push({ row: 1, message: "The file has no data rows" });
  return { index, errors };
}

export function parseCatalog(kind: "items", text: string): Parsed<ItemRow>;
export function parseCatalog(kind: "customers", text: string): Parsed<CustomerRow>;
export function parseCatalog(kind: "aliases", text: string): Parsed<AliasRow>;
export function parseCatalog(kind: CatalogKind, text: string): Parsed<ItemRow | CustomerRow | AliasRow> {
  const table = parseCsv(text);
  const { index, errors } = header(table, kind);
  if (errors.length) return { rows: [], errors };

  const get = (r: string[], col: string) => {
    const i = index.get(col);
    return i === undefined ? "" : (r[i] ?? "").trim();
  };
  const seen = new Set<string>();
  const rows: (ItemRow | CustomerRow | AliasRow)[] = [];

  table.slice(1).forEach((r, i) => {
    const row = i + 2; // 1-based, after the header
    const before = errors.length;
    if (kind === "items") {
      const sku = get(r, "sku");
      const sellUom = get(r, "sell_uom").toUpperCase();
      const description = get(r, "description");
      if (!sku) errors.push({ row, message: "sku is required" });
      else if (sku.length > 64) errors.push({ row, message: "sku is longer than 64 characters" });
      if (!description) errors.push({ row, message: "description is required" });
      if (!UOM.test(sellUom)) errors.push({ row, message: `sell_uom "${get(r, "sell_uom")}" should be a unit code like EA` });
      const tierPrice = number(get(r, "contract_price"), row, "contract_price", errors, { required: true });
      const stock = number(get(r, "stock"), row, "stock", errors);
      const uomOptions = parseUnits(get(r, "other_units"), sellUom, row, errors);
      const key = sku.toLowerCase();
      if (sku && seen.has(key)) errors.push({ row, message: `sku ${sku} appears more than once` });
      seen.add(key);
      if (errors.length === before) rows.push({ sku, description, sellUom, uomOptions, tierPrice, stock });
    } else if (kind === "customers") {
      const id = get(r, "customer_id");
      const name = get(r, "name");
      if (!id) errors.push({ row, message: "customer_id is required" });
      if (!name) errors.push({ row, message: "name is required" });
      const creditLimit = number(get(r, "credit_limit"), row, "credit_limit", errors);
      const openBalance = number(get(r, "open_balance"), row, "open_balance", errors);
      const key = id.toLowerCase();
      if (id && seen.has(key)) errors.push({ row, message: `customer_id ${id} appears more than once` });
      seen.add(key);
      if (errors.length === before) rows.push({ id, name, creditLimit, openBalance });
    } else {
      const customerId = get(r, "customer_id");
      const customerPart = get(r, "customer_part");
      const sku = get(r, "sku");
      if (!customerId) errors.push({ row, message: "customer_id is required" });
      if (!customerPart) errors.push({ row, message: "customer_part is required" });
      if (!sku) errors.push({ row, message: "sku is required" });
      const key = `${customerId}|${customerPart}`.toLowerCase();
      if (customerId && customerPart && seen.has(key)) {
        errors.push({ row, message: `${customerPart} for ${customerId} appears more than once` });
      }
      seen.add(key);
      if (errors.length === before) rows.push({ customerId, customerPart, sku, row });
    }
  });
  return { rows, errors };
}

export const TEMPLATES: Record<CatalogKind, string> = {
  items: "sku,description,sell_uom,contract_price,stock,other_units\n4410-A,Hex bolt 3/8-16 x 2 Gr5 zinc,EA,0.42,12400,BX=100\n",
  customers: "customer_id,name,credit_limit,open_balance\nC-10442,Acme Industrial,25000,8340\n",
  aliases: "customer_id,customer_part,sku\nC-10442,AC-HX-0375,4410-A\n",
};
