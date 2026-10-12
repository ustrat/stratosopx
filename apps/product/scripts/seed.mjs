// Seeds a demo tenant: mock ERP catalog and customers, open orders to review,
// and this month's order history. Usage:
//
//   ADMIN_EMAIL=you@company.com node scripts/seed.mjs --local    (or --remote)
//
// The admin email is passed in rather than committed, because the repo is public.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const email = process.env.ADMIN_EMAIL;
const target = process.argv.includes("--remote") ? "--remote" : "--local";
if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error("Set ADMIN_EMAIL to the address you sign in with.");
  process.exit(1);
}

const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const sql = [];
const T = "demo";

const criteria = [
  ["Customer authorization names the system, environment and action category", true],
  ["Authorization and execution controls passed documented testing", true],
  ["Approvals, monitoring and recovery procedures are operational", true],
  ["Contractual risk allocation and insurance reviewed for this service", false],
  ["Customer-specific risk assessment approved", false],
  ["No open authorization-bypass, cross-tenant or destructive-action findings", true],
].map(([label, done]) => ({ label, done }));

// Start clean so the seed can be re-run.
for (const table of ["intake_senders", "audit_log", "approvals", "order_lines", "orders", "documents", "erp_sales_orders", "erp_customer_parts", "erp_items", "erp_customers", "users", "tenants"]) {
  sql.push(`DELETE FROM ${table} WHERE ${table === "tenants" ? "id" : "tenant_id"} = ${q(T)};`);
}

sql.push(
  `INSERT INTO tenants (id, name, order_plan, erp_format, launch_criteria, intake_address) VALUES (${q(T)}, 'Demo Distribution Co', 'growth', 'NetSuite', ${q(JSON.stringify(criteria))}, 'demo');`,
  `INSERT INTO users (id, tenant_id, email, name, role) VALUES (${q(crypto.randomUUID())}, ${q(T)}, ${q(email)}, NULL, 'admin');`,
);

for (const pattern of ["@acme-industrial.example", "@deltafasteners.example", "ap@brightline.example"]) {
  sql.push(`INSERT INTO intake_senders (tenant_id, pattern, added_by) VALUES (${q(T)}, ${q(pattern)}, 'seed');`);
}

const customers = [
  ["C-10442", "Acme Industrial", 25000, 8340],
  ["C-10587", "Delta Fasteners", 60000, 21400],
  ["C-10611", "Brightline Distribution", 45000, 44100],
  ["C-10650", "Northgate Supply", 30000, 5200],
];
for (const [id, name, limit, bal] of customers) {
  sql.push(`INSERT INTO erp_customers VALUES (${q(id)}, ${q(T)}, ${q(name)}, ${limit}, ${bal});`);
}

const EA = { code: "EA", factor: 1 };
const items = {
  "4410-A": ['Hex bolt 3/8"-16 x 2" Gr5 zinc', "EA", [EA, { code: "BX", factor: 100 }], 0.42, 12400],
  "4420-C": ['Flat washer 3/8" SAE zinc', "EA", [EA, { code: "BX", factor: 100 }], 0.06, 30000],
  "4431-B": ['Nylon insert lock nut 3/8"-16 zinc', "EA", [EA, { code: "BX", factor: 100 }], 0.11, 9100],
  "7714-B": ["Socket cap screw M8 x 30 A2 stainless", "EA", [EA, { code: "CS", factor: 12 }], 1.55, 860],
  "5120-T": ['Threaded rod 1/2"-13 x 6 ft zinc', "EA", [EA], 7.25, 310],
  "6602-S": ["Hex nut M10 class 8 zinc", "EA", [EA], 0.09, 41000],
  "6710-H": ["Hex flange bolt M10 x 40 class 10.9", "EA", [EA], 0.86, 138],
  "6815-W": ["Fender washer M10 x 30 zinc", "EA", [EA], 0.14, 5200],
};
for (const [sku, [desc, uom, opts, price, stock]] of Object.entries(items)) {
  sql.push(`INSERT INTO erp_items VALUES (${q(T)}, ${q(sku)}, ${q(desc)}, ${q(uom)}, ${q(JSON.stringify(opts))}, ${price}, ${stock});`);
}

const parts = [
  ["C-10442", "AC-HX-0375", "4410-A"],
  ["C-10442", "AC-FW-0375", "4420-C"],
  ["C-10442", "AC-SS-7714", "7714-B"],
  ["C-10442", "AC-TR-0500", "5120-T"],
  ["C-10587", "DF-1020", "6602-S"],
  ["C-10587", "DF-3344", "6710-H"],
  ["C-10587", "DF-5501", "6815-W"],
];
for (const [cust, part, sku] of parts) sql.push(`INSERT INTO erp_customer_parts VALUES (${q(T)}, ${q(cust)}, ${q(part)}, ${q(sku)});`);

const now = new Date();
const iso = (d) => d.toISOString();
const daysAgo = (n, h = 9) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n, h, 15));
const dateOnly = (d) => iso(d).slice(0, 10);

function addOrder(o) {
  const docId = crypto.randomUUID();
  sql.push(
    `INSERT INTO documents (id, tenant_id, filename, kind, size_bytes, pages, sender, channel, outcome, reasons, billable, received_at) VALUES (${q(docId)}, ${q(T)}, ${q(o.file)}, 'order', ${o.size ?? 120000}, ${q(o.pages ?? null)}, ${q(o.sender)}, 'email', 'accept', '[]', ${o.status === "rejected" ? 0 : 1}, ${q(iso(o.received))});`,
    `INSERT INTO orders (id, tenant_id, document_id, kind, title, po_number, sales_order, customer_id, ship_date, prev_ship_date, status, initial_issue_count, received_at, decided_at) VALUES (${q(o.id)}, ${q(T)}, ${q(docId)}, ${q(o.kind ?? "po")}, ${q(o.title ?? o.id)}, ${q(o.po ?? o.id)}, ${q(o.salesOrder ?? null)}, ${q(o.customer)}, ${q(o.shipDate)}, ${q(o.prevShipDate ?? null)}, ${q(o.status)}, ${o.issues ?? 0}, ${q(iso(o.received))}, ${q(o.decided ? iso(o.decided) : null)});`,
  );
  for (const [i, l] of o.lines.entries()) {
    const [desc, sellUom, opts, tier, stock] = items[l.sku];
    sql.push(
      `INSERT INTO order_lines VALUES (${q(o.id)}, ${q(T)}, ${i + 1}, ${q(l.part)}, ${q(l.sku)}, ${q(desc)}, ${l.conf ?? 0.98}, ${l.qty}, ${q(l.uom ?? sellUom)}, ${l.price ?? tier}, ${q(sellUom)}, ${q(JSON.stringify(opts))}, ${tier}, ${stock}, ${q(l.prevQty ?? null)}, NULL);`,
    );
  }
}

// Open orders waiting for review (match the marketing demo).
addOrder({
  id: "PO-48213", customer: "C-10442", file: "Acme_PO_48213.pdf", sender: "purchasing@acme-industrial.example", pages: 3,
  received: daysAgo(0, 13), shipDate: dateOnly(daysAgo(-13)), status: "needs_review", issues: 3,
  lines: [
    { part: "AC-HX-0375", sku: "4410-A", qty: 500 },
    { part: "AC-FW-0375", sku: "4420-C", qty: 500 },
    { part: "AC-NL-0375", sku: "4431-B", qty: 500, conf: 0.87 },
    { part: "AC-SS-7714", sku: "7714-B", qty: 12, uom: "CS", price: 18.4 },
    { part: "AC-TR-0500", sku: "5120-T", qty: 40, price: 6.8 },
  ],
});
addOrder({
  id: "CO-1192", title: "CO-1192 rev2", kind: "change-order", po: "DF-77310", salesOrder: "SO-20871", customer: "C-10587",
  file: "Delta_PO_rev2.xlsx", sender: "buyer@deltafasteners.example", received: daysAgo(0, 12),
  shipDate: dateOnly(daysAgo(-16)), prevShipDate: dateOnly(daysAgo(-23)), status: "needs_review", issues: 3,
  lines: [
    { part: "DF-1020", sku: "6602-S", qty: 2000 },
    { part: "DF-3344", sku: "6710-H", qty: 150, prevQty: 120 },
    { part: "DF-5501", sku: "6815-W", qty: 300 },
  ],
});
addOrder({
  id: "PO-7781", customer: "C-10611", file: "Brightline_PO_7781.xlsm", sender: "ap@brightline.example",
  received: daysAgo(0, 11), shipDate: dateOnly(daysAgo(-10)), status: "needs_review", issues: 1,
  lines: [
    { part: "BL-5120", sku: "5120-T", qty: 300 },
    { part: "BL-6710", sku: "6710-H", qty: 100 },
    { part: "BL-4410", sku: "4410-A", qty: 4000 },
  ],
});

// This month's history: deterministic pseudo-random volume.
let seed = 7;
const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const custIds = customers.map(([id]) => id);
const skus = Object.keys(items);
let n = 50000;
for (let d = now.getUTCDate() - 1; d >= 1; d--) {
  const perDay = 18 + Math.round(rnd() * 22);
  for (let k = 0; k < perDay; k++) {
    const received = daysAgo(d, 8 + Math.floor(rnd() * 9));
    const issues = rnd() < 0.14 ? 1 + Math.floor(rnd() * 2) : 0;
    const status = rnd() < 0.02 ? "rejected" : "written";
    const sku = skus[Math.floor(rnd() * skus.length)];
    addOrder({
      id: `PO-${n++}`, customer: custIds[Math.floor(rnd() * custIds.length)], file: `PO_${n}.pdf`, sender: "orders@customer.example",
      received, decided: new Date(received.getTime() + 40 * 60000), shipDate: dateOnly(daysAgo(d - 10)),
      status, issues, kind: rnd() < 0.15 ? "change-order" : "po",
      lines: [{ part: `CP-${sku}`, sku, qty: 10 + Math.floor(rnd() * 400) }],
    });
  }
}

mkdirSync(".wrangler", { recursive: true });
const file = ".wrangler/seed.sql";
writeFileSync(file, sql.join("\n") + "\n");
console.log(`Wrote ${sql.length} statements to ${file}; applying ${target}...`);
const wranglerPkg = createRequire(import.meta.url).resolve("wrangler/package.json");
const wrangler = join(dirname(wranglerPkg), "bin", "wrangler.js");
execFileSync(process.execPath, [wrangler, "d1", "execute", "stratosopx", target, "--file", file, "--yes"], { stdio: "inherit" });
