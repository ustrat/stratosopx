import type { AgentAction, AutomationMode, Criterion } from "@stratosopx/core/controls";
import type { OrderReview } from "@stratosopx/core/orders";

export type Me = {
  user: { id: string; email: string; name: string | null; role: "admin" | "approver" | "viewer"; tenantId: string };
  tenant: { id: string; name: string };
};

export type QueueItem = {
  id: string;
  title: string;
  customer: string;
  reason: string;
  status: string;
  tone: string;
  kind: "po" | "change-order";
  issues: number;
};

export type Overview = {
  tenant: { name: string; writesPaused: boolean; automationMode: AutomationMode };
  kpis: { processed: number; straightThrough: number | null; openExceptions: number; blocking: number; openOrders: number };
  queue: QueueItem[];
  queueTotal: number;
  volume: { day: string; n: number }[];
  routing: { clean: number; change: number; exception: number; total: number };
  usage: { plan: string; used: number; included: number; overage: number; projected: number; projectedOverage: number };
  launch: { met: number; total: number };
};

export type OrderStatus = "needs_review" | "approved" | "rejected" | "written" | "failed";

export type OrderSummary = {
  id: string;
  title: string;
  kind: "po" | "change-order";
  status: OrderStatus;
  received_at: string;
  decided_at: string | null;
  po_number: string;
  customer: string | null;
};

export type OrderDetail = {
  order: OrderReview;
  status: OrderStatus;
  source: { filename: string | null; channel: string | null; sender: string | null };
  decision: { decision: "approved" | "rejected"; note: string | null; fingerprint: string | null; created_at: string; approver: string } | null;
  erp: { name: string; environment: "sandbox" | "production"; format: string };
  writesPaused: boolean;
  canApprove: boolean;
};

export type Controls = {
  writesPaused: boolean;
  automationMode: AutomationMode;
  orderPlan: string;
  launchCriteria: Criterion[];
  modes: { id: AutomationMode; name: string; body: string; minTier: string; inPlan: boolean; locked: boolean }[];
  permissionMatrix: AgentAction[];
};

export type DocumentRow = {
  id: string;
  filename: string;
  kind: "order" | "bid";
  size_bytes: number;
  pages: number | null;
  sender: string | null;
  channel: string;
  outcome: "accept" | "quarantine" | "reject";
  reasons: string[];
  billable: number;
  received_at: string;
};

export type AuditEntry = { actor: string; action: string; target: string | null; detail: Record<string, unknown>; created_at: string };
