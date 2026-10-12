// Execution controls from StratosOpx_Legal_Compliance_Implementation_Plan.pdf
// (section 5, action-risk tiers; section 10, launch acceptance criteria) and the
// Pricing Strategy's rule that auto-post is never enabled before those criteria are met.

import { orderTiers, type OrderTier } from "@/lib/pricing";

export type RiskTier = 1 | 2 | 3 | 4;

export const tierInfo: Record<RiskTier, { name: string; control: string; tone: string }> = {
  1: { name: "Read-only", control: "Authorized data boundaries; access logging", tone: "success" },
  2: { name: "Reversible", control: "Scoped permission, validation, recovery path", tone: "info" },
  3: { name: "High-impact", control: "Named approval, bounded scope, preflight and post-action verification", tone: "warning" },
  4: { name: "Prohibited by default", control: "Blocked; exceptional workflow only if separately designed and approved", tone: "danger" },
};

export type AgentAction = {
  action: string;
  system: string;
  tier: RiskTier;
  approval: string;
};

// The permission matrix for this customer (sample).
export const permissionMatrix: AgentAction[] = [
  { action: "Read inventory, price tiers and open orders", system: "NetSuite · production", tier: 1, approval: "None" },
  { action: "Read RFP documents and capability library", system: "StratosOpx", tier: 1, approval: "None" },
  { action: "Draft sales order in sandbox", system: "NetSuite · sandbox", tier: 2, approval: "None; validated" },
  { action: "Create or update a sales order", system: "NetSuite · production", tier: 3, approval: "Named approver, per order" },
  { action: "Update an order from a change order", system: "SAP B1 · production", tier: 3, approval: "Named approver, per order" },
  { action: "Delete orders or bulk-edit records", system: "Any ERP", tier: 4, approval: "Blocked" },
  { action: "Change credit limits, prices or customer master data", system: "Any ERP", tier: 4, approval: "Blocked" },
];

export type Criterion = { label: string; done: boolean };

// Launch acceptance criteria, section 10. Sample status for this customer.
export const launchCriteria: Criterion[] = [
  { label: "Customer authorization names the system, environment and action category", done: true },
  { label: "Authorization and execution controls passed documented testing", done: true },
  { label: "Approvals, monitoring and recovery procedures are operational", done: true },
  { label: "Contractual risk allocation and insurance reviewed for this service", done: false },
  { label: "Customer-specific risk assessment approved", done: false },
  { label: "No open authorization-bypass, cross-tenant or destructive-action findings", done: true },
];

export type AutomationMode = "assist" | "rule-based" | "policy";

export const automationModes: { id: AutomationMode; name: string; body: string; minTier: OrderTier["id"] }[] = [
  {
    id: "assist",
    name: "Assist",
    body: "A person approves every order before it is written to the ERP.",
    minTier: "essentials",
  },
  {
    id: "rule-based",
    name: "Assist + rule-based auto-post",
    body: "Low-risk orders that pass every check post automatically; everything else waits for approval.",
    minTier: "growth",
  },
  {
    id: "policy",
    name: "Configurable auto-post policies",
    body: "Auto-post rules by customer, order value and SKU.",
    minTier: "scale",
  },
];

export function planAllows(plan: OrderTier["id"], min: OrderTier["id"]) {
  const rank = (id: OrderTier["id"]) => orderTiers.findIndex((t) => t.id === id);
  return rank(plan) >= rank(min);
}

// Short, stable fingerprint of an approved payload (FNV-1a, 32-bit). The
// approval is bound to it: any change to the payload needs a new approval.
export function fingerprint(value: unknown) {
  const text = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
