// StratosOpx Document Integration & Ingestion Policy — DRAFT v0.1, October 2026.
//
// The limits below are both published (on /integrations/policy) and enforced
// (by screenDocument), so the policy text and the code cannot drift apart.
// Proposed values: confirm with counsel and security before launch.

import { bidTiers } from "@/lib/pricing";

export const POLICY_VERSION = "0.1 (draft)";
export const POLICY_DATE = "October 2026";

export type DocKind = "order" | "bid";

export const limits = {
  maxFileMB: 25,
  maxMessageMB: 40,
  maxAttachments: 20,
  orderMaxPages: 50,
  bidIncludedPages: 150, // Pricing Strategy: analyses include up to 150 pages
  bidMaxPages: 400, // Bid Desk Pro includes up to 400 pages
  zipMaxFiles: 100,
  sourceRetentionDays: 90,
  quarantineRetentionDays: 30,
  deletionAfterTerminationDays: 30,
};

export type FileRule = { ext: string[]; label: string; kinds: DocKind[]; note?: string };

export const acceptedFiles: FileRule[] = [
  { ext: ["pdf"], label: "PDF (text or scanned)", kinds: ["order", "bid"] },
  { ext: ["xlsx", "xls", "csv"], label: "Excel and CSV", kinds: ["order", "bid"] },
  { ext: ["xlsm"], label: "Macro-enabled Excel", kinds: ["order"], note: "Read as data only; macros are never run" },
  { ext: ["docx", "doc"], label: "Word", kinds: ["order", "bid"] },
  { ext: ["txt", "eml", "html"], label: "Email body and plain text", kinds: ["order"] },
  { ext: ["png", "jpg", "jpeg", "tif", "tiff"], label: "Images and faxes", kinds: ["order"] },
  { ext: ["zip"], label: "ZIP archive", kinds: ["bid"], note: `One level deep, up to ${limits.zipMaxFiles} files` },
];

export const blockedExtensions = ["exe", "dll", "bat", "cmd", "ps1", "sh", "js", "vbs", "jar", "msi", "scr", "iso", "7z", "rar"];

export type InboundDocument = {
  name: string;
  kind: DocKind;
  sizeMB: number;
  pages?: number;
  sender: string;
  senderAllowed: boolean; // on the tenant's trading-partner allowlist
  authPassed: boolean; // SPF / DKIM / DMARC alignment
  passwordProtected?: boolean;
  malware?: "clean" | "detected" | "pending";
  cardNumberDetected?: boolean;
  duplicateOf?: string;
};

export type Outcome = "accept" | "quarantine" | "reject";

export type ScreenResult = {
  outcome: Outcome;
  reasons: string[];
  billable: boolean;
  extraPages?: number; // bid pages over the included 150
};

const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

// Order matters: a hard reject wins over quarantine, quarantine over accept.
export function screenDocument(doc: InboundDocument): ScreenResult {
  const reject: string[] = [];
  const quarantine: string[] = [];
  const notes: string[] = [];
  const ext = extOf(doc.name);
  const rule = acceptedFiles.find((r) => r.ext.includes(ext));

  if (blockedExtensions.includes(ext)) reject.push(`.${ext} files are never accepted`);
  else if (!rule) reject.push(`.${ext} is not an accepted format`);
  else if (!rule.kinds.includes(doc.kind)) reject.push(`.${ext} is not accepted for ${doc.kind === "bid" ? "bid packages" : "orders"}`);

  if (doc.sizeMB > limits.maxFileMB) reject.push(`File is ${doc.sizeMB} MB; the limit is ${limits.maxFileMB} MB`);

  const maxPages = doc.kind === "bid" ? limits.bidMaxPages : limits.orderMaxPages;
  if (doc.pages && doc.pages > maxPages) reject.push(`${doc.pages} pages; the limit is ${maxPages} for ${doc.kind === "bid" ? "bid packages" : "orders"}`);

  if (doc.malware === "detected") reject.push("Malware detected");
  if (doc.malware === "pending") quarantine.push("Malware scan not finished");
  if (!doc.authPassed) quarantine.push("Sender failed SPF / DKIM / DMARC checks");
  if (!doc.senderAllowed) quarantine.push(`${doc.sender} is not on the trading-partner allowlist`);
  if (doc.passwordProtected) quarantine.push("Password-protected; the customer must supply an unprotected copy");
  if (doc.cardNumberDetected) quarantine.push("Possible payment-card number; redacted and held for review");

  if (doc.duplicateOf) {
    reject.push(`Duplicate of ${doc.duplicateOf}`);
  }

  if (rule?.note) notes.push(rule.note);

  const extraPages =
    doc.kind === "bid" && doc.pages && doc.pages > limits.bidIncludedPages ? doc.pages - limits.bidIncludedPages : undefined;
  if (extraPages) notes.push(`${extraPages} pages over the ${limits.bidIncludedPages} included`);

  const outcome: Outcome = reject.length ? "reject" : quarantine.length ? "quarantine" : "accept";
  return {
    outcome,
    reasons: [...reject, ...quarantine, ...(outcome === "accept" ? notes : [])],
    // Rejected and duplicate documents are never billed; quarantined ones only once released.
    billable: outcome === "accept",
    extraPages,
  };
}

export type PolicySection = { id: string; title: string; rules: string[] };

const proPages = bidTiers.find((t) => t.id === "pro")?.extraPages ?? "";

export const policySections: PolicySection[] = [
  {
    id: "scope",
    title: "1. Purpose and scope",
    rules: [
      "Covers every document StratosOpx receives on a customer's behalf: purchase orders, change orders, order acknowledgements, and RFP or bid packages.",
      "Covers every ERP connection StratosOpx uses to read customer data or write approved records.",
      "Applies to StratosOpx staff, contractors, subprocessors and every AI agent operating on the platform.",
      "EDI transactions are out of scope. Orders that already arrive by EDI keep their existing path; StratosOpx does not replace or alter them.",
    ],
  },
  {
    id: "channels",
    title: "2. Authorized ingestion channels",
    rules: [
      "Documents are accepted only through channels the customer has authorized in writing: a dedicated per-tenant inbound address, the web upload, the ingestion API, or an SFTP drop folder.",
      "Each tenant has its own inbound address and storage. Documents are tagged to the tenant at receipt and never processed outside it.",
      "Inbound email must pass SPF, DKIM or DMARC alignment. Mail that fails is quarantined, not processed.",
      "Senders must be on the customer's trading-partner allowlist. Mail from other senders is quarantined until the customer releases it or adds the sender.",
      "API and SFTP access uses per-tenant credentials stored in a managed vault and rotated at least every 90 days.",
    ],
  },
  {
    id: "formats",
    title: "3. Accepted formats and limits",
    rules: [
      `Maximum ${limits.maxFileMB} MB per file, ${limits.maxMessageMB} MB per email and ${limits.maxAttachments} attachments per email.`,
      `Orders: up to ${limits.orderMaxPages} pages per document.`,
      `Bid packages: up to ${limits.bidIncludedPages} pages included per analysis and ${limits.bidMaxPages} pages maximum. Extra pages are billed per the customer's plan (Bid Desk Pro: ${proPages.toLowerCase()}).`,
      `Executable and script files (${blockedExtensions.map((e) => `.${e}`).join(", ")}) are rejected.`,
      "Password-protected files are quarantined. StratosOpx never asks for document passwords by email.",
      "Macros, scripts and embedded objects are never executed. Links inside documents are never followed.",
    ],
  },
  {
    id: "screening",
    title: "4. Security screening",
    rules: [
      "Every file is malware-scanned before parsing. Files with a detection are rejected; files whose scan has not completed are held.",
      "Document content is treated as untrusted data. Text inside a document is never treated as an instruction to an agent, whatever it says.",
      "Extraction agents have read-only tools. They cannot write to an ERP, send email or call external services.",
      "Possible payment-card numbers are detected and redacted before storage, and the document is held for review.",
    ],
  },
  {
    id: "processing",
    title: "5. Classification, deduplication and billing",
    rules: [
      "Each document is classified (new order, change order, bid package, other). Documents classified as other are not processed further and not billed.",
      "Duplicates are detected by file hash and by customer plus PO number. Duplicates are rejected and not billed.",
      "A change order is linked to the open order it revises and billed as one order.",
      "Low-confidence extractions, SKU matches and classifications always go to a person for review.",
    ],
  },
  {
    id: "erp",
    title: "6. ERP integration and write controls",
    rules: [
      "StratosOpx connects through a dedicated integration user with the narrowest role that supports the authorized actions. Administrator credentials are never accepted.",
      "Reads (items, prices, inventory, open orders, credit) are Tier 1 actions. Sandbox drafts are Tier 2. Creating or updating production orders is Tier 3 and requires a named approver per order unless an auto-post policy has been authorized.",
      "Deleting records, bulk edits, and changes to prices, credit limits or customer master data are Tier 4 and blocked.",
      "Every write goes through the execution policy service. Approval binds to the exact payload; any change needs a new approval.",
      "Writes carry an idempotency key so a retry cannot create a second order. The resulting record is read back and verified, not just the API response.",
      "New connectors go live in a sandbox or test company first, and are enabled in production only after the launch acceptance criteria are met.",
      "Customers can stop all writes at any time with the emergency stop. Reads and drafting continue.",
    ],
  },
  {
    id: "data",
    title: "7. Data handling, retention and deletion",
    rules: [
      "Data is encrypted in transit and at rest and isolated per tenant, with tenant checks at every API, retrieval and tool boundary.",
      `Source documents are kept for ${limits.sourceRetentionDays} days by default (configurable by contract), then deleted. Quarantined documents are deleted after ${limits.quarantineRetentionDays} days if not released.`,
      "Extracted records, approvals and audit logs are kept for the subscription term. Longer log retention is available on the Scale plan.",
      `On termination, customer data is available for export and then deleted within ${limits.deletionAfterTerminationDays} days, except where law requires otherwise.`,
      "Personal data is limited to what orders and bids contain (for example buyer names and contact details) and is processed only to perform the service.",
      "Regulated data (health information, payment-card data beyond redaction, controlled technical data) is not accepted without a separate assessment and agreement.",
    ],
  },
  {
    id: "ai",
    title: "8. AI models and subprocessors",
    rules: [
      "Customer documents are not used to train general-purpose AI models.",
      "Customer-specific tuning (for example SKU aliases and validation rules) stays within that customer's tenant.",
      "Model, OCR and hosting providers are listed in the subprocessor register, which customers can request at any time.",
    ],
  },
  {
    id: "exceptions",
    title: "9. Exceptions and incidents",
    rules: [
      "Documents that cannot be parsed go to the review queue with the reason. They are never silently dropped.",
      "Suspected malicious documents are quarantined and the customer is notified.",
      "Security incidents are handled under the StratosOpx incident response plan, including evidence preservation and customer notification as the contract and law require.",
    ],
  },
  {
    id: "customer",
    title: "10. Customer responsibilities",
    rules: [
      "Authorize ingestion channels and maintain the trading-partner allowlist.",
      "Provide and maintain a least-privilege ERP integration user, and tell StratosOpx before ERP upgrades or configuration changes.",
      "Name the approvers for Tier 3 actions and keep that list current.",
      "Do not send regulated data unless a separate agreement covers it.",
    ],
  },
  {
    id: "review",
    title: "11. Ownership and review",
    rules: [
      "Owner: AI / agent lead, with the security owner. Approved by the founder.",
      "Reviewed quarterly, and whenever a new connector, document type or subprocessor is added.",
      "This draft is a business-planning document and must be reviewed by qualified legal and security advisers before it is published or incorporated into customer contracts.",
    ],
  },
];
