// Sample review records behind the Review queue. In production these come from
// the extraction pipeline; the validation rules below run the same either way.

export type Uom = { code: string; factor: number }; // factor = each per unit

export type OrderLine = {
  n: number;
  customerPart: string;
  sku: string;
  description: string;
  matchConfidence: number; // 0–1, how sure the SKU matcher is
  qty: number;
  uom: string;
  unitPrice: number;
  sellUom: string; // the item's master unit in the ERP
  uomOptions: Uom[];
  tierPrice: number; // contract price per sellUom
  stock: number; // available, in sellUom
  prev?: { qty?: number; unitPrice?: number }; // values on the confirmed order (change orders)
};

export type OrderReview = {
  kind: "po" | "change-order";
  id: string;
  title: string;
  poNumber: string;
  salesOrder?: string;
  customer: { name: string; id: string; creditLimit: number; openBalance: number };
  receivedAt: string;
  sourceFile: string;
  channel: string;
  erp: "NetSuite" | "SAP B1";
  shipDate: string;
  prevShipDate?: string;
  lines: OrderLine[];
};

export type RequirementStatus = "pass" | "fail" | "review";

export type BidRequirement = {
  clause: string;
  category: string;
  requirement: string;
  onFile: string;
  status: RequirementStatus;
  dealbreaker: boolean;
};

export type CapabilityMatch = {
  scope: string;
  score: number; // 0–1
  evidence: string;
};

export type BidReview = {
  kind: "rfp";
  id: string;
  title: string;
  owner: string;
  packageName: string;
  dueDate: string;
  pages: number;
  sourceFile: string;
  receivedAt: string;
  requirements: BidRequirement[];
  matches: CapabilityMatch[];
};

export type Review = OrderReview | BidReview;

const each: Uom = { code: "EA", factor: 1 };

export const reviews: Review[] = [
  {
    kind: "po",
    id: "PO-48213",
    title: "PO-48213",
    poNumber: "PO-48213",
    customer: { name: "Acme Industrial", id: "C-10442", creditLimit: 25000, openBalance: 8340 },
    receivedAt: "Oct 11, 2026 · 9:42 AM",
    sourceFile: "Acme_PO_48213.pdf",
    channel: "orders@ inbox",
    erp: "NetSuite",
    shipDate: "2026-10-24",
    lines: [
      {
        n: 1,
        customerPart: "AC-HX-0375",
        sku: "4410-A",
        description: 'Hex bolt 3/8"-16 x 2" Gr5 zinc',
        matchConfidence: 0.99,
        qty: 500,
        uom: "EA",
        unitPrice: 0.42,
        sellUom: "EA",
        uomOptions: [each, { code: "BX", factor: 100 }],
        tierPrice: 0.42,
        stock: 12400,
      },
      {
        n: 2,
        customerPart: "AC-FW-0375",
        sku: "4420-C",
        description: 'Flat washer 3/8" SAE zinc',
        matchConfidence: 0.98,
        qty: 500,
        uom: "EA",
        unitPrice: 0.06,
        sellUom: "EA",
        uomOptions: [each, { code: "BX", factor: 100 }],
        tierPrice: 0.06,
        stock: 30000,
      },
      {
        n: 3,
        customerPart: "AC-NL-0375",
        sku: "4431-B",
        description: 'Nylon insert lock nut 3/8"-16 zinc',
        matchConfidence: 0.87,
        qty: 500,
        uom: "EA",
        unitPrice: 0.11,
        sellUom: "EA",
        uomOptions: [each, { code: "BX", factor: 100 }],
        tierPrice: 0.11,
        stock: 9100,
      },
      {
        n: 4,
        customerPart: "AC-SS-7714",
        sku: "7714-B",
        description: "Socket cap screw M8 x 30 A2 stainless",
        matchConfidence: 0.97,
        qty: 12,
        uom: "CS",
        unitPrice: 18.4,
        sellUom: "EA",
        uomOptions: [each, { code: "CS", factor: 12 }],
        tierPrice: 1.55,
        stock: 860,
      },
      {
        n: 5,
        customerPart: "AC-TR-0500",
        sku: "5120-T",
        description: 'Threaded rod 1/2"-13 x 6 ft zinc',
        matchConfidence: 0.96,
        qty: 40,
        uom: "EA",
        unitPrice: 6.8,
        sellUom: "EA",
        uomOptions: [each],
        tierPrice: 7.25,
        stock: 310,
      },
    ],
  },
  {
    kind: "change-order",
    id: "CO-1192",
    title: "CO-1192 rev2",
    poNumber: "DF-77310",
    salesOrder: "SO-20871",
    customer: { name: "Delta Fasteners", id: "C-10587", creditLimit: 60000, openBalance: 21400 },
    receivedAt: "Oct 11, 2026 · 8:15 AM",
    sourceFile: "Delta_PO_rev2.xlsx",
    channel: "orders@ inbox",
    erp: "SAP B1",
    shipDate: "2026-10-28",
    prevShipDate: "2026-11-04",
    lines: [
      {
        n: 1,
        customerPart: "DF-1020",
        sku: "6602-S",
        description: "Hex nut M10 class 8 zinc",
        matchConfidence: 0.99,
        qty: 2000,
        uom: "EA",
        unitPrice: 0.09,
        sellUom: "EA",
        uomOptions: [each],
        tierPrice: 0.09,
        stock: 41000,
      },
      {
        n: 2,
        customerPart: "DF-3344",
        sku: "6710-H",
        description: "Hex flange bolt M10 x 40 class 10.9",
        matchConfidence: 0.98,
        qty: 150,
        uom: "EA",
        unitPrice: 0.86,
        sellUom: "EA",
        uomOptions: [each],
        tierPrice: 0.86,
        stock: 138,
        prev: { qty: 120 },
      },
      {
        n: 3,
        customerPart: "DF-5501",
        sku: "6815-W",
        description: "Fender washer M10 x 30 zinc",
        matchConfidence: 0.97,
        qty: 300,
        uom: "EA",
        unitPrice: 0.14,
        sellUom: "EA",
        uomOptions: [each],
        tierPrice: 0.14,
        stock: 5200,
      },
    ],
  },
  {
    kind: "rfp",
    id: "RFP-RTD",
    title: "Riverside Transit Depot RFP",
    owner: "Riverside Regional Transit Authority",
    packageName: "Div. 26 Electrical subcontract",
    dueDate: "Nov 14, 2026",
    pages: 142,
    sourceFile: "RTD_Bid_Package_Vol2.pdf",
    receivedAt: "Oct 10, 2026 · 4:05 PM",
    requirements: [
      {
        clause: "§4.2.1",
        category: "Insurance",
        requirement: "General liability, $5M per occurrence",
        onFile: "$2M per occurrence",
        status: "fail",
        dealbreaker: true,
      },
      {
        clause: "§4.2.3",
        category: "Bonding",
        requirement: "Bid bond 10% of bid amount",
        onFile: "Bonding capacity $3M single project",
        status: "pass",
        dealbreaker: true,
      },
      {
        clause: "§2.4",
        category: "Certification",
        requirement: "OSHA 30 certified site supervisor",
        onFile: "3 supervisors certified",
        status: "pass",
        dealbreaker: true,
      },
      {
        clause: "§6.1",
        category: "Schedule",
        requirement: "Substantial completion within 180 days of NTP",
        onFile: "Similar past scope took 210 days",
        status: "review",
        dealbreaker: false,
      },
      {
        clause: "§7.3",
        category: "Liquidated damages",
        requirement: "$1,500 per calendar day",
        onFile: "No LD cap in company policy",
        status: "review",
        dealbreaker: false,
      },
      {
        clause: "§3.2",
        category: "Participation",
        requirement: "12% DBE participation",
        onFile: "8% average on past public bids",
        status: "review",
        dealbreaker: false,
      },
      {
        clause: "§8.1",
        category: "Payment terms",
        requirement: "Net 45, 5% retainage",
        onFile: "Accepts net 60, retainage up to 10%",
        status: "pass",
        dealbreaker: false,
      },
    ],
    matches: [
      { scope: "Traction power feeders and duct bank", score: 0.92, evidence: "Metro Line 3 Yard, 2024 (won)" },
      { scope: "LED yard and canopy lighting", score: 0.88, evidence: "Eastside Bus Garage, 2025 (won)" },
      { scope: "Fire alarm and mass notification", score: 0.64, evidence: "No comparable past bid; licensed staff: 1" },
    ],
  },
];

export function getReview(id: string) {
  return reviews.find((r) => r.id === id);
}

// ---------- Order validation ----------

export type IssueCategory = "match" | "uom" | "pricing" | "inventory" | "change" | "credit";

export type Issue = {
  key: string;
  category: IssueCategory;
  severity: "blocking" | "review";
  line?: number;
  title: string;
  message: string;
  fixLabel?: string;
  canAccept: boolean;
  acceptLabel?: string;
  fix?: { line?: number; patch?: Partial<OrderLine>; shipDate?: string };
};

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export function orderTotal(lines: OrderLine[]) {
  return lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
}

function factorOf(line: OrderLine, code: string) {
  return line.uomOptions.find((u) => u.code === code)?.factor ?? 1;
}

export function validateOrder(order: OrderReview, lines: OrderLine[], shipDate: string): Issue[] {
  const issues: Issue[] = [];

  for (const l of lines) {
    if (l.matchConfidence < 0.9) {
      issues.push({
        key: `match-${l.n}`,
        category: "match",
        severity: "review",
        line: l.n,
        title: `Confirm SKU match, line ${l.n}`,
        message: `${l.customerPart} matched to ${l.sku} by description (${Math.round(l.matchConfidence * 100)}% confidence).`,
        canAccept: true,
        acceptLabel: "Confirm match",
      });
    }

    if (l.uom !== l.sellUom) {
      const eachQty = l.qty * factorOf(l, l.uom);
      const sellQty = eachQty / factorOf(l, l.sellUom);
      issues.push({
        key: `uom-${l.n}-${l.uom}`,
        category: "uom",
        severity: "blocking",
        line: l.n,
        title: `UOM mismatch, line ${l.n}`,
        message: `Ordered ${l.qty} ${l.uom}; ${l.sku} sells in ${l.sellUom} (1 ${l.uom} = ${factorOf(l, l.uom)} ${l.sellUom}).`,
        fixLabel: `Convert to ${sellQty} ${l.sellUom} at ${money(l.tierPrice)}`,
        fix: { line: l.n, patch: { qty: sellQty, uom: l.sellUom, unitPrice: l.tierPrice } },
        canAccept: false,
      });
      continue; // pricing and stock checks need the master unit
    }

    if (l.unitPrice + 0.0001 < l.tierPrice) {
      issues.push({
        key: `price-${l.n}-${l.unitPrice}`,
        category: "pricing",
        severity: "review",
        line: l.n,
        title: `Below contract price, line ${l.n}`,
        message: `PO price ${money(l.unitPrice)} is under the customer's tier price ${money(l.tierPrice)}.`,
        fixLabel: `Use tier price ${money(l.tierPrice)}`,
        fix: { line: l.n, patch: { unitPrice: l.tierPrice } },
        canAccept: true,
        acceptLabel: "Keep PO price",
      });
    }

    if (l.qty > l.stock) {
      issues.push({
        key: `stock-${l.n}-${l.qty}`,
        category: "inventory",
        severity: "review",
        line: l.n,
        title: `Short stock, line ${l.n}`,
        message: `${l.qty} ${l.uom} ordered, ${l.stock} available. ${l.qty - l.stock} ${l.uom} would go on backorder.`,
        fixLabel: `Reduce to ${l.stock} ${l.uom}`,
        fix: { line: l.n, patch: { qty: l.stock } },
        canAccept: true,
        acceptLabel: "Backorder the rest",
      });
    }

    if (l.prev?.qty !== undefined && l.prev.qty !== l.qty) {
      issues.push({
        key: `change-qty-${l.n}-${l.qty}`,
        category: "change",
        severity: "review",
        line: l.n,
        title: `Quantity changed, line ${l.n}`,
        message: `Confirmed order had ${l.prev.qty} ${l.uom}; revision asks for ${l.qty} ${l.uom}.`,
        canAccept: true,
        acceptLabel: "Acknowledge change",
      });
    }
  }

  if (order.prevShipDate && order.prevShipDate !== shipDate) {
    issues.push({
      key: `change-ship-${shipDate}`,
      category: "change",
      severity: "review",
      title: "Ship date moved",
      message: `Ship date changed from ${formatDate(order.prevShipDate)} to ${formatDate(shipDate)}.`,
      fixLabel: `Keep ${formatDate(order.prevShipDate)}`,
      fix: { shipDate: order.prevShipDate },
      canAccept: true,
      acceptLabel: "Accept new date",
    });
  }

  const exposure = order.customer.openBalance + orderTotal(lines);
  if (exposure > order.customer.creditLimit) {
    issues.push({
      key: `credit-${Math.round(exposure)}`,
      category: "credit",
      severity: "blocking",
      title: "Credit limit exceeded",
      message: `Open balance plus this order is ${money(exposure)} against a ${money(order.customer.creditLimit)} limit.`,
      canAccept: false,
    });
  }

  return issues;
}

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function erpPayload(order: OrderReview, lines: OrderLine[], shipDate: string) {
  if (order.erp === "SAP B1") {
    return {
      endpoint: order.salesOrder ? `PATCH /b1s/v1/Orders(${order.salesOrder})` : "POST /b1s/v1/Orders",
      body: {
        CardCode: order.customer.id,
        NumAtCard: order.poNumber,
        DocDueDate: shipDate,
        DocumentLines: lines.map((l) => ({
          LineNum: l.n - 1,
          ItemCode: l.sku,
          Quantity: l.qty,
          UoMCode: l.uom,
          UnitPrice: l.unitPrice,
        })),
      },
    };
  }
  return {
    endpoint: order.salesOrder
      ? `PATCH /services/rest/record/v1/salesOrder/${order.salesOrder}`
      : "POST /services/rest/record/v1/salesOrder",
    body: {
      entity: { id: order.customer.id },
      otherRefNum: order.poNumber,
      shipDate,
      item: {
        items: lines.map((l) => ({
          item: { id: l.sku },
          quantity: l.qty,
          units: l.uom,
          rate: l.unitPrice,
          custcol_customer_part: l.customerPart,
        })),
      },
    },
  };
}
