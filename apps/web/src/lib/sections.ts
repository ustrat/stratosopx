import type { IconName } from "@/components/Icon";

export type Section = {
  slug: string;
  label: string;
  icon: IconName;
  summary: string;
  count?: number;
  built?: boolean; // has its own route under src/app/dashboard
};

// Overview lives at /dashboard; every other section at /dashboard/<slug>.
export const sections: Section[] = [
  { slug: "", label: "Overview", icon: "overview", summary: "" },
  {
    slug: "orders",
    label: "Orders",
    icon: "document",
    summary: "Every inbound PO with its extracted lines, SKU matches and ERP write status.",
  },
  {
    slug: "change-orders",
    label: "Change orders",
    icon: "swap",
    summary: "Revisions diffed against the open order: quantities, ship dates and unit prices.",
  },
  {
    slug: "bids",
    label: "Bids & RFPs",
    icon: "building",
    summary: "Go / No-Go decisions, dealbreaker clauses and draft compliance matrices.",
  },
  {
    slug: "review",
    label: "Review queue",
    icon: "shield",
    summary: "Exceptions waiting on a person before anything reaches the ERP or a bid goes out.",
    count: 23,
    built: true,
  },
  {
    slug: "agents",
    label: "Agents",
    icon: "bot",
    summary: "Versions, accuracy and health for the extraction, matching and gatekeeper agents.",
  },
  {
    slug: "erp-sync",
    label: "ERP sync",
    icon: "database",
    summary: "Connections, inbound document screening and write controls.",
    built: true,
  },
  {
    slug: "settings",
    label: "Settings & controls",
    icon: "settings",
    summary: "Automation mode, agent permissions, launch acceptance and the emergency stop.",
    built: true,
  },
];
