import type { AgentAction, AutomationMode, Criterion } from "@stratosopx/core/controls";
import type { OrderReview } from "@stratosopx/core/orders";

export type Me = {
  user: { id: string; email: string; name: string | null; role: "admin" | "approver" | "viewer"; tenantId: string };
  tenant: { id: string; name: string };
  isPlatformAdmin: boolean;
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
  warnings: string[];
  documentId: string | null;
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
  state: "stored" | "quarantined" | "rejected" | "released" | "deleted" | "expired";
  reasons: string[];
  subject: string | null;
  uploaded_by: string | null;
  received_at: string;
  expires_at: string | null;
  has_file: number;
  extraction_state: "none" | "queued" | "running" | "done" | "not_order" | "skipped" | "needs_attention" | "failed";
  extraction_note: string | null;
  order_id: string | null;
  bid_id: string | null;
};

export type CatalogItem = {
  sku: string;
  description: string;
  sellUom: string;
  uomOptions: { code: string; factor: number }[];
  tierPrice: number;
  stock: number;
};

export type IntakeSettings = {
  address: string | null;
  senders: { pattern: string; added_by: string; created_at: string }[];
  limits: { maxFileMB: number; orderMaxPages: number; bidMaxPages: number };
};

export type AuditEntry = { actor: string; action: string; target: string | null; detail: Record<string, unknown>; created_at: string };

export type Branding = {
  name: string;
  details: { displayName?: string; address?: string; phone?: string; email?: string; website?: string };
  logoUrl: string | null;
};

export type BidChoice = "go" | "no_go" | "needs_info";

export type BidSummary = {
  id: string;
  title: string;
  owner: string | null;
  package_name: string | null;
  due_date: string | null;
  recommendation: BidChoice;
  status: "needs_review" | "decided";
  decision: BidChoice | null;
  created_at: string;
};

export type BidRequirement = {
  clause: string | null;
  page: number | null;
  category: string;
  requirement: string;
  mandatory: boolean;
  status: "meets" | "fails" | "unclear";
  evidence: string;
  dealbreaker: boolean;
};

export type BidDetail = BidSummary & {
  pages: number | null;
  summary: string | null;
  requirements: BidRequirement[];
  scope_matches: { scope: string; match: number; evidence: string }[];
  warnings: string[];
  recommendation_reason: string;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  document: { filename: string; sender: string | null; channel: string; received_at: string } | null;
  canDecide: boolean;
};

export type Capability = { id: string; kind: string; name: string; detail: string | null; amount: number | null; expires_on: string | null };
export type PastProject = { id: string; name: string; client: string | null; year: number | null; value: number | null; scope: string; outcome: string };
