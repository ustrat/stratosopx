// Sample data for the Command Center. Replace with real API calls once the
// extraction pipeline and ERP integrations are wired up.

import type { IconName } from "@/components/Icon";

export type Tone = "warning" | "info" | "danger" | "success" | "violet";

// Daily POs processed, Oct 1 to Oct 29.
export const dailyVolume: number[] = Array.from({ length: 29 }, (_, i) => {
  if (i === 21) return 96;
  if (i === 20 || i === 22) return 74;
  const v = 30 + i * 1.3 + 12 * Math.sin(i / 2.2) + 8 * Math.sin(i * 1.7);
  return Math.max(8, Math.round(v));
});

export const monthlyVolume = dailyVolume.reduce((a, b) => a + b, 0);

export type Kpi = {
  label: string;
  value: string;
  icon: IconName;
  color: string;
  note: { text: string; tone?: "up" | "down" }[];
};

export const kpis: Kpi[] = [
  {
    label: "POs processed this month",
    value: monthlyVolume.toLocaleString("en-US"),
    icon: "document",
    color: "#60A5FA",
    note: [{ text: "↗ 18.2%", tone: "up" }, { text: " vs last month" }],
  },
  {
    label: "Straight-through rate",
    value: "86.4%",
    icon: "pulse",
    color: "#2DD4BF",
    note: [{ text: "↗ 3.1%", tone: "up" }, { text: " vs last month" }],
  },
  {
    label: "Open exceptions",
    value: "23",
    icon: "shieldAlert",
    color: "#FBBF24",
    note: [{ text: "7 blocking", tone: "down" }, { text: " · 16 for review" }],
  },
  {
    label: "RFPs analyzed",
    value: "11",
    icon: "building",
    color: "#A78BFA",
    note: [
      { text: "8 Go", tone: "up" },
      { text: " · " },
      { text: "3 No-Go", tone: "down" },
    ],
  },
];

export type QueueItem = {
  id: string;
  title: string;
  mono: boolean;
  source: string;
  reason: string;
  status: string;
  tone: Tone;
  icon: IconName;
  details: [string, string][];
};

export const reviewQueue: QueueItem[] = [
  {
    id: "PO-48213",
    title: "PO-48213",
    mono: true,
    source: "Acme Industrial",
    reason: "UOM mismatch, line 4",
    status: "Needs review",
    tone: "warning",
    icon: "document",
    details: [
      ["Source", "Acme_PO_48213.pdf · email"],
      ["Line 4", "SKU 7714-B · 12 CS ordered, master UOM is EA"],
      ["Suggested", "Convert to 144 EA at tier price $1.55"],
    ],
  },
  {
    id: "CO-1192",
    title: "CO-1192 rev2",
    mono: true,
    source: "Delta Fasteners",
    reason: "Qty 120 → 150, ship date moved",
    status: "Change order",
    tone: "info",
    icon: "swap",
    details: [
      ["Source", "Delta_PO_rev2.xlsx · email"],
      ["Line 2", "Quantity 120 → 150 EA"],
      ["Ship date", "Nov 4 → Oct 28"],
    ],
  },
  {
    id: "RFP-RTD",
    title: "Riverside Transit Depot RFP",
    mono: false,
    source: "§4.2.1",
    reason: "$5M insurance minimum exceeds coverage",
    status: "No-Go",
    tone: "danger",
    icon: "building",
    details: [
      ["Clause", "§4.2.1 General liability, $5M per occurrence"],
      ["On file", "$2M per occurrence"],
      ["Also flagged", "180-day schedule · LDs $1,500/day · 12% DBE"],
    ],
  },
];

export type Agent = {
  name: string;
  meta: string;
  status: "Healthy" | "Retrying" | "Down";
  seed: number;
};

export const agents: Agent[] = [
  { name: "Extraction agent", meta: "v3.2 · 99.1% field acc.", status: "Healthy", seed: 0.4 },
  { name: "SKU matcher", meta: "v2.4 · 97.8% match", status: "Healthy", seed: 1.9 },
  { name: "Dealbreaker gatekeeper", meta: "v1.6 · 98.5% recall", status: "Healthy", seed: 3.1 },
  { name: "ERP writer · SAP B1", meta: "v1.1 · 2 retries", status: "Retrying", seed: 4.6 },
];

export type SystemAlert = {
  title: string;
  detail: string;
  monoDetail?: string;
  kind: "warning" | "info";
  action: string;
};

export const systemAlerts: SystemAlert[] = [
  {
    title: "Credit limit exceeded",
    detail: "Brightline Distribution · ",
    monoDetail: "$48,200 / $45,000",
    kind: "warning",
    action: "Review",
  },
  {
    title: "ERP write retrying",
    detail: "SAP B1 Service Layer timeout · 2 orders queued",
    kind: "info",
    action: "Retry",
  },
];

export const routingSplit = [
  { label: "Clean PO", share: 74, color: "#A78BFA" },
  { label: "Change order", share: 16, color: "#60A5FA" },
  { label: "Exception → review", share: 10, color: "#2DD4BF" },
];
