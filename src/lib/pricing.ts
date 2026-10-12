// Proposed list prices from StratosOpX_Pricing_Strategy.pdf (October 2026).
// These are to be validated with design partners before they are final.

export type OrderTier = {
  id: "essentials" | "growth" | "scale";
  name: string;
  bestFor: string;
  annual: number; // per month, billed annually
  monthly: number; // per month, billed monthly (+15%)
  included: number; // orders per month
  overage: number; // per order above included
  features: string[];
  recommended?: boolean;
};

export const orderTiers: OrderTier[] = [
  {
    id: "essentials",
    name: "Essentials",
    bestFor: "Small distributors and job shops",
    annual: 795,
    monthly: 915,
    included: 400,
    overage: 2.0,
    features: [
      "Extraction from Excel, PDF and email body",
      "Customer and item matching",
      "Basic list-price validation",
      "1 ERP connection",
      "Assist mode: a person approves every order",
      "MFA and audit log",
      "Email support, next business day",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    bestFor: "Lower mid-market",
    annual: 1950,
    monthly: 2245,
    included: 1500,
    overage: 1.4,
    recommended: true,
    features: [
      "Everything in Essentials",
      "Contract and tiered pricing validation",
      "Real-time inventory check",
      "Change-order detection and diff",
      "Rule-based auto-post for low-risk orders*",
      "Role-based approvals",
      "1 ERP connection (2nd at +$250 / mo)",
      "Email support and scheduled calls",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    bestFor: "Mid-market, multi-site",
    annual: 3950,
    monthly: 4545,
    included: 4000,
    overage: 1.0,
    features: [
      "Everything in Growth",
      "Promo pricing rules",
      "Multi-warehouse inventory",
      "Change-order audit history",
      "Configurable auto-post policies by customer, value and SKU*",
      "Up to 3 ERP entities or instances",
      "SSO and extended log retention",
      "Priority support, named contact, quarterly review",
    ],
  },
];

export const customVolume = { above: 4000, perOrder: 0.85 };

export type BidTier = {
  id: "per-bid" | "starter" | "pro";
  name: string;
  bestFor: string;
  price: string;
  priceNote: string;
  included: string;
  additional: string;
  extraPages: string;
  turnaround: string;
  features: string[];
  recommended?: boolean;
};

export const bidTiers: BidTier[] = [
  {
    id: "per-bid",
    name: "Pay-per-bid",
    bestFor: "Occasional bidders, trial use",
    price: "$395",
    priceNote: "per RFP",
    included: "1 analysis, up to 150 pages",
    additional: "$395 per analysis",
    extraPages: "$125 per 100 pages over 150",
    turnaround: "48 business hours",
    features: ["Go / No-Go summary and dealbreakers", "Compliance checklist"],
  },
  {
    id: "starter",
    name: "Bid Desk Starter",
    bestFor: "Bidding about 3 to 5 times a month",
    price: "$495",
    priceNote: "/ month, billed annually",
    included: "5 analyses / month (unused roll 1 month)",
    additional: "$125 per analysis",
    extraPages: "$75 per 100 pages over 150",
    turnaround: "24 business hours",
    features: [
      "Go / No-Go summary and dealbreakers",
      "Compliance checklist",
      "Basic capability and past-performance library",
      "Library onboarding $2,500 one-time",
    ],
  },
  {
    id: "pro",
    name: "Bid Desk Pro",
    bestFor: "Bidding about 10 to 15 times a month",
    price: "$1,095",
    priceNote: "/ month, billed annually",
    included: "15 analyses / month (unused roll 1 month)",
    additional: "$95 per analysis",
    extraPages: "Included up to 400 pages",
    turnaround: "Same day under 150 pages",
    recommended: true,
    features: [
      "Go / No-Go summary and dealbreakers",
      "Compliance matrix, exportable to Word / Excel",
      "Full library with win / loss history",
      "Draft response outline",
      "Library onboarding waived",
    ],
  },
];

export const services = [
  {
    name: "Automation Readiness Assessment",
    scope: "Process walkthrough, volume and error baseline, ROI model, ERP fit check, written recommendation.",
    price: "$3,500 fixed, credited to implementation if signed within 60 days",
    timeline: "1 to 2 weeks",
  },
  {
    name: "Standard implementation",
    scope:
      "One cloud ERP (NetSuite, Sage Intacct, SAP Business One, Acumatica), customer and item mapping, validation rules, up to 25 trading-partner formats, training, 30-day hypercare.",
    price: "$7,500 fixed",
    timeline: "3 to 5 weeks",
  },
  {
    name: "Advanced implementation",
    scope: "On-premise or legacy ERP (e.g. Sage 100/300), custom fields, multiple entities or warehouses, complex contract pricing, EDI coexistence.",
    price: "$15,000 to $25,000 fixed, quoted after assessment",
    timeline: "6 to 10 weeks",
  },
  {
    name: "Optimization retainer",
    scope: "Core: up to 15 hours / month of rule tuning and exception analysis. Plus: up to 30 hours / month with new workflows and quarterly review.",
    price: "$2,500 or $4,500 / month, 3-month minimum",
    timeline: "Ongoing",
  },
];

export const bundles = [
  { name: "Ops Suite Starter", contents: "Order Agent Essentials + Bid Desk Starter", list: 1290, price: 1145 },
  { name: "Ops Suite Growth", contents: "Order Agent Growth + Bid Desk Pro", list: 3045, price: 2595 },
];

export const STANDARD_IMPLEMENTATION = 7500;

// Cost of a tier for a given monthly volume (annual billing). Above Scale's
// included volume the strategy prices a custom quote at $0.85 per order.
export function tierCost(tier: OrderTier, orders: number) {
  if (tier.id === "scale" && orders > customVolume.above) {
    return tier.annual + (orders - customVolume.above) * customVolume.perOrder;
  }
  return tier.annual + Math.max(0, orders - tier.included) * tier.overage;
}

export function cheapestTier(orders: number) {
  return orderTiers.reduce((best, t) => (tierCost(t, orders) < tierCost(best, orders) ? t : best));
}

export const usd = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
