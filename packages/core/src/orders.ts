// Order, bid and validation types plus the order checks and ERP payload
// builder. Shared by the marketing demo (apps/web) and the product (apps/product).

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
