// ERP systems common among U.S. manufacturers and distributors, grouped by how
// StratosOpx integrates with them. Not exhaustive: the "Other ERP" entry covers
// anything unlisted through file-based import.
//
// Support levels follow the Pricing Strategy (section 7):
//   standard   — covered by the $7,500 standard implementation
//   advanced   — on-premise / legacy; fixed fee quoted after assessment
//   assessment — fit, interfaces and scope confirmed in a Readiness Assessment first
//
// `verify: true` marks entries whose integration interfaces must be confirmed
// against the vendor's current documentation and the customer's version before
// any public claim is made about them.

export type GroupId = "cloud-api" | "distribution" | "manufacturing" | "enterprise" | "legacy" | "smb";
export type Segment = "small" | "mid" | "enterprise";
export type Deployment = "cloud" | "on-prem" | "hosted";
export type SupportLevel = "standard" | "advanced" | "assessment";

export type ErpGroup = {
  id: GroupId;
  name: string;
  summary: string;
  pattern: string; // how StratosOpx reads and writes
  ingestion: string; // how orders reach the ERP
  typicalPackage: string;
};

export type Erp = {
  id: string;
  name: string;
  vendor: string;
  group: GroupId;
  segments: Segment[];
  deployment: Deployment[];
  focus: string;
  interfaces: string[];
  support: SupportLevel;
  note?: string;
  verify?: boolean;
};

export const erpGroups: ErpGroup[] = [
  {
    id: "cloud-api",
    name: "Cloud ERPs with open APIs",
    summary: "Modern SaaS or API-first ERPs with documented REST or OData interfaces.",
    pattern: "Dedicated integration user with least-privilege role; real-time reads of items, prices, inventory and open orders.",
    ingestion: "Sales orders created or updated through the vendor API, after approval, with post-write verification.",
    typicalPackage: "Standard implementation where listed; otherwise assessment",
  },
  {
    id: "distribution",
    name: "Distribution-specialist ERPs",
    summary: "Built for wholesale distributors: counter sales, warehousing, rebates and EDI-heavy trading partners.",
    pattern: "Vendor API or import queue, version-dependent; often hosted on-premise. EDI orders keep flowing as they do today.",
    ingestion: "Approved emailed orders written through the API or order-import queue alongside existing EDI.",
    typicalPackage: "Assessment, then standard or advanced",
  },
  {
    id: "manufacturing",
    name: "Job-shop and SMB manufacturing ERPs",
    summary: "Discrete and process manufacturers: jobs, routings, quoting and shop-floor scheduling.",
    pattern: "Vendor API where available; otherwise read via ODBC or reporting views and write through a supported import.",
    ingestion: "Approved orders posted through the API or a vendor-supported CSV/XML import, then read back to verify.",
    typicalPackage: "Assessment, then standard or advanced",
  },
  {
    id: "enterprise",
    name: "Enterprise suites",
    summary: "Large-footprint ERPs, usually run by an IT team with formal change control.",
    pattern: "Through the customer's integration layer (for example SAP Integration Suite, Oracle Integration, Infor ION, Dynamics DMF).",
    ingestion: "Approved orders handed to the integration layer as IDoc, data entity, BOD or import file under IT change control.",
    typicalPackage: "Assessment; may exceed the SMB packages",
  },
  {
    id: "legacy",
    name: "On-premise and legacy ERPs",
    summary: "Older or on-premise systems with SDKs, business-object interfaces or file imports rather than web APIs.",
    pattern: "A secure on-premise connector using the vendor SDK or business-object interface; read-only database access for checks.",
    ingestion: "Approved orders written through the business-object interface or a drop-folder import, then verified.",
    typicalPackage: "Advanced implementation",
  },
  {
    id: "smb",
    name: "Small-business accounting and inventory",
    summary: "Accounting and inventory tools that small distributors and shops use as their system of record.",
    pattern: "Public REST APIs or desktop SDKs; limited order-management depth (pricing tiers and change orders may be basic).",
    ingestion: "Approved orders created as sales orders or invoices through the vendor API.",
    typicalPackage: "Assessment; usually suited to Essentials",
  },
];

const S = "standard";
const A = "advanced";
const X = "assessment";

export const erps: Erp[] = [
  // ---- Cloud ERPs with open APIs ----
  { id: "netsuite", name: "NetSuite", vendor: "Oracle", group: "cloud-api", segments: ["mid"], deployment: ["cloud"], focus: "Distribution, manufacturing, wholesale", interfaces: ["SuiteTalk REST", "SuiteQL", "SOAP web services"], support: S },
  { id: "acumatica", name: "Acumatica Cloud ERP", vendor: "Acumatica", group: "cloud-api", segments: ["small", "mid"], deployment: ["cloud", "hosted"], focus: "Distribution, manufacturing", interfaces: ["Contract-based REST API", "OData"], support: S },
  { id: "sage-intacct", name: "Sage Intacct", vendor: "Sage", group: "cloud-api", segments: ["small", "mid"], deployment: ["cloud"], focus: "Finance-led; Order Entry module", interfaces: ["XML web services", "REST API"], support: S },
  { id: "sap-b1", name: "SAP Business One", vendor: "SAP", group: "cloud-api", segments: ["small", "mid"], deployment: ["on-prem", "hosted"], focus: "Distribution, light manufacturing", interfaces: ["Service Layer (OData)", "DI API"], support: S },
  { id: "bc", name: "Dynamics 365 Business Central", vendor: "Microsoft", group: "cloud-api", segments: ["small", "mid"], deployment: ["cloud", "on-prem"], focus: "Distribution, manufacturing", interfaces: ["REST API v2.0", "OData v4"], support: X },
  { id: "epicor-kinetic", name: "Epicor Kinetic", vendor: "Epicor", group: "cloud-api", segments: ["mid"], deployment: ["cloud", "on-prem"], focus: "Discrete manufacturing", interfaces: ["REST API v2 (OData)", "BAQ services"], support: X },
  { id: "plex", name: "Plex Smart Manufacturing Platform", vendor: "Rockwell Automation", group: "cloud-api", segments: ["mid"], deployment: ["cloud"], focus: "Automotive, food, discrete manufacturing", interfaces: ["REST APIs", "Data source APIs"], support: X },
  { id: "syteline", name: "Infor CloudSuite Industrial (SyteLine)", vendor: "Infor", group: "cloud-api", segments: ["mid"], deployment: ["cloud", "on-prem"], focus: "Make-to-order manufacturing", interfaces: ["IDO REST (Mongoose)", "Infor ION API"], support: X },
  { id: "sage-x3", name: "Sage X3", vendor: "Sage", group: "cloud-api", segments: ["mid"], deployment: ["cloud", "on-prem"], focus: "Process and discrete manufacturing, distribution", interfaces: ["SOAP web services", "GraphQL API (recent versions)"], support: X },
  { id: "odoo", name: "Odoo", vendor: "Odoo", group: "cloud-api", segments: ["small", "mid"], deployment: ["cloud", "on-prem"], focus: "General; modular", interfaces: ["XML-RPC / JSON-RPC external API"], support: X },
  { id: "priority", name: "Priority ERP", vendor: "Priority Software", group: "cloud-api", segments: ["small", "mid"], deployment: ["cloud"], focus: "Manufacturing, distribution", interfaces: ["REST (OData) API"], support: X },
  { id: "rootstock", name: "Rootstock Cloud ERP", vendor: "Rootstock", group: "cloud-api", segments: ["mid"], deployment: ["cloud"], focus: "Manufacturing on Salesforce", interfaces: ["Salesforce REST / SOAP APIs"], support: X },

  // ---- Distribution-specialist ----
  { id: "p21", name: "Prophet 21", vendor: "Epicor", group: "distribution", segments: ["mid"], deployment: ["on-prem", "hosted", "cloud"], focus: "Industrial, fluid power, MRO distribution", interfaces: ["P21 API", "ODBC (read)", "EDI"], support: X, verify: true },
  { id: "eclipse", name: "Eclipse", vendor: "Epicor", group: "distribution", segments: ["mid"], deployment: ["on-prem", "hosted"], focus: "Electrical, plumbing, HVAC distribution", interfaces: ["Vendor API (version-dependent)", "EDI"], support: X, verify: true },
  { id: "sxe", name: "CloudSuite Distribution (SX.e)", vendor: "Infor", group: "distribution", segments: ["mid"], deployment: ["cloud", "on-prem"], focus: "Wholesale distribution", interfaces: ["SX.API via Infor ION", "EDI"], support: X, verify: true },
  { id: "ddi", name: "Inform ERP", vendor: "DDI System", group: "distribution", segments: ["small", "mid"], deployment: ["cloud", "hosted"], focus: "Industrial and specialty distribution", interfaces: ["To confirm in assessment", "EDI"], support: X, verify: true },
  { id: "bluelink", name: "Blue Link ERP", vendor: "Blue Link", group: "distribution", segments: ["small", "mid"], deployment: ["cloud", "on-prem"], focus: "Wholesale distribution", interfaces: ["To confirm in assessment", "EDI"], support: X, verify: true },
  { id: "agility", name: "Agility", vendor: "DMSi", group: "distribution", segments: ["mid"], deployment: ["cloud", "hosted"], focus: "Lumber and building materials", interfaces: ["Agility API", "EDI"], support: X, verify: true },
  { id: "bistrack", name: "BisTrack", vendor: "Epicor", group: "distribution", segments: ["small", "mid"], deployment: ["on-prem", "cloud"], focus: "Lumber and building materials", interfaces: ["To confirm in assessment"], support: X, verify: true },
  { id: "erp-one", name: "ERP-ONE", vendor: "Distribution One", group: "distribution", segments: ["small", "mid"], deployment: ["cloud", "on-prem"], focus: "Wholesale distribution", interfaces: ["To confirm in assessment", "EDI"], support: X, verify: true },

  // ---- Job-shop and SMB manufacturing ----
  { id: "jobboss", name: "JobBOSS²", vendor: "ECI Software Solutions", group: "manufacturing", segments: ["small"], deployment: ["on-prem", "cloud"], focus: "Job shops", interfaces: ["SQL / ODBC (read)", "Vendor API to confirm"], support: X, verify: true },
  { id: "e2", name: "E2 Shop System", vendor: "ECI Software Solutions", group: "manufacturing", segments: ["small"], deployment: ["on-prem", "cloud"], focus: "Job shops", interfaces: ["SQL / ODBC (read)", "Vendor API to confirm"], support: X, verify: true },
  { id: "gss", name: "Global Shop Solutions", vendor: "Global Shop Solutions", group: "manufacturing", segments: ["small", "mid"], deployment: ["on-prem", "cloud"], focus: "Make-to-order manufacturing", interfaces: ["ODBC (read)", "Vendor API to confirm"], support: X, verify: true },
  { id: "proshop", name: "ProShop ERP", vendor: "ProShop", group: "manufacturing", segments: ["small", "mid"], deployment: ["cloud", "on-prem"], focus: "Precision machining", interfaces: ["Vendor API to confirm"], support: X, verify: true },
  { id: "visual", name: "Infor VISUAL", vendor: "Infor", group: "manufacturing", segments: ["small", "mid"], deployment: ["on-prem", "cloud"], focus: "Make-to-order manufacturing", interfaces: ["Infor ION", "Database (read)"], support: X, verify: true },
  { id: "delmiaworks", name: "DELMIAworks", vendor: "Dassault Systèmes", group: "manufacturing", segments: ["mid"], deployment: ["on-prem", "cloud"], focus: "Plastics, medical device, process", interfaces: ["To confirm in assessment"], support: X, verify: true },
  { id: "syspro", name: "SYSPRO", vendor: "SYSPRO", group: "manufacturing", segments: ["small", "mid"], deployment: ["on-prem", "cloud"], focus: "Manufacturing and distribution", interfaces: ["e.net business objects", "Web services"], support: X, verify: true },
  { id: "macola", name: "Macola", vendor: "ECI Software Solutions", group: "manufacturing", segments: ["small", "mid"], deployment: ["on-prem", "cloud"], focus: "Process and discrete manufacturing", interfaces: ["To confirm in assessment"], support: X, verify: true },
  { id: "m2m", name: "M2M (Made2Manage)", vendor: "ECI Software Solutions", group: "manufacturing", segments: ["small", "mid"], deployment: ["on-prem"], focus: "Discrete manufacturing", interfaces: ["SQL Server / ODBC (read)", "Import utilities"], support: X, verify: true },
  { id: "deacom", name: "Deacom ERP", vendor: "ECI Software Solutions", group: "manufacturing", segments: ["mid"], deployment: ["cloud", "on-prem"], focus: "Process manufacturing", interfaces: ["To confirm in assessment"], support: X, verify: true },
  { id: "aptean-ross", name: "Aptean Process Manufacturing (Ross)", vendor: "Aptean", group: "manufacturing", segments: ["mid"], deployment: ["on-prem", "cloud"], focus: "Food, chemical, life sciences", interfaces: ["To confirm in assessment"], support: X, verify: true },
  { id: "cetec", name: "Cetec ERP", vendor: "Cetec", group: "manufacturing", segments: ["small"], deployment: ["cloud"], focus: "Electronics and discrete manufacturing", interfaces: ["Vendor API to confirm"], support: X, verify: true },

  // ---- Enterprise suites ----
  { id: "s4", name: "SAP S/4HANA", vendor: "SAP", group: "enterprise", segments: ["enterprise"], deployment: ["cloud", "on-prem"], focus: "All industries", interfaces: ["OData APIs", "IDoc", "BAPI / RFC"], support: X },
  { id: "ecc", name: "SAP ECC", vendor: "SAP", group: "enterprise", segments: ["enterprise"], deployment: ["on-prem"], focus: "All industries", interfaces: ["IDoc", "BAPI / RFC"], support: X, note: "Mainstream maintenance ends 2027; many customers are mid-migration to S/4HANA." },
  { id: "fusion", name: "Oracle Fusion Cloud ERP", vendor: "Oracle", group: "enterprise", segments: ["enterprise"], deployment: ["cloud"], focus: "All industries", interfaces: ["REST APIs", "File-based data import (FBDI)"], support: X },
  { id: "jde", name: "JD Edwards EnterpriseOne", vendor: "Oracle", group: "enterprise", segments: ["mid", "enterprise"], deployment: ["on-prem", "hosted"], focus: "Manufacturing, distribution, construction", interfaces: ["AIS Server REST", "Orchestrator", "Business services"], support: X },
  { id: "ebs", name: "Oracle E-Business Suite", vendor: "Oracle", group: "enterprise", segments: ["enterprise"], deployment: ["on-prem", "hosted"], focus: "All industries", interfaces: ["Integrated SOA Gateway", "Open interface tables"], support: X },
  { id: "d365fo", name: "Dynamics 365 Finance & Supply Chain", vendor: "Microsoft", group: "enterprise", segments: ["enterprise"], deployment: ["cloud"], focus: "Manufacturing, distribution", interfaces: ["OData data entities", "Data Management Framework"], support: X },
  { id: "m3", name: "Infor M3", vendor: "Infor", group: "enterprise", segments: ["enterprise"], deployment: ["cloud", "on-prem"], focus: "Process manufacturing, distribution", interfaces: ["Infor ION", "M3 API programs"], support: X },
  { id: "ln", name: "Infor LN", vendor: "Infor", group: "enterprise", segments: ["enterprise"], deployment: ["cloud", "on-prem"], focus: "Complex discrete manufacturing", interfaces: ["Infor ION (BODs)"], support: X },
  { id: "qad", name: "QAD Adaptive ERP", vendor: "QAD", group: "enterprise", segments: ["mid", "enterprise"], deployment: ["cloud", "on-prem"], focus: "Automotive, industrial, life sciences", interfaces: ["QAD APIs", "QXtend"], support: X, verify: true },
  { id: "ifs", name: "IFS Cloud", vendor: "IFS", group: "enterprise", segments: ["mid", "enterprise"], deployment: ["cloud", "on-prem"], focus: "Asset-intensive manufacturing, A&D", interfaces: ["OData REST APIs"], support: X },

  // ---- On-premise and legacy ----
  { id: "sage-100", name: "Sage 100", vendor: "Sage", group: "legacy", segments: ["small", "mid"], deployment: ["on-prem", "hosted"], focus: "Distribution, light manufacturing", interfaces: ["Business Object Interface", "Visual Integrator imports", "ODBC (read)"], support: A },
  { id: "sage-300", name: "Sage 300", vendor: "Sage", group: "legacy", segments: ["small", "mid"], deployment: ["on-prem", "hosted"], focus: "Distribution, multi-currency", interfaces: ["Sage 300 Web API (recent versions)", "SDK", "Import templates"], support: A },
  { id: "gp", name: "Dynamics GP", vendor: "Microsoft", group: "legacy", segments: ["small", "mid"], deployment: ["on-prem", "hosted"], focus: "Finance-led distribution", interfaces: ["eConnect", "SQL Server (read)"], support: A, note: "Microsoft is retiring GP; confirm the support timeline and any migration plan with the customer." },
  { id: "nav", name: "Dynamics NAV", vendor: "Microsoft", group: "legacy", segments: ["small", "mid"], deployment: ["on-prem", "hosted"], focus: "Distribution, manufacturing", interfaces: ["SOAP / OData web services"], support: A, note: "Succeeded by Business Central." },
  { id: "epicor-legacy", name: "Epicor ERP 9 / 10, Vantage, Vista", vendor: "Epicor", group: "legacy", segments: ["mid"], deployment: ["on-prem"], focus: "Discrete manufacturing", interfaces: ["REST v1 (ERP 10)", "Service Connect"], support: A, verify: true },
  { id: "infor-lx", name: "Infor LX / MAPICS (IBM i)", vendor: "Infor", group: "legacy", segments: ["mid"], deployment: ["on-prem"], focus: "Process and discrete manufacturing", interfaces: ["Infor ION", "DB2 (read)", "File import"], support: A, verify: true },
  { id: "other", name: "Other or homegrown ERP", vendor: "—", group: "legacy", segments: ["small", "mid", "enterprise"], deployment: ["on-prem", "cloud", "hosted"], focus: "Any", interfaces: ["CSV / XML drop folder", "Read-only database view"], support: A, note: "Works with any system that can import orders from a file." },

  // ---- Small-business accounting and inventory ----
  { id: "qbo", name: "QuickBooks Online", vendor: "Intuit", group: "smb", segments: ["small"], deployment: ["cloud"], focus: "Small distributors and shops", interfaces: ["QuickBooks Online REST API"], support: X },
  { id: "qbd", name: "QuickBooks Desktop Enterprise", vendor: "Intuit", group: "smb", segments: ["small"], deployment: ["on-prem"], focus: "Small distributors and shops", interfaces: ["QuickBooks SDK (qbXML) via Web Connector"], support: X },
  { id: "xero", name: "Xero", vendor: "Xero", group: "smb", segments: ["small"], deployment: ["cloud"], focus: "Small businesses", interfaces: ["Xero REST API"], support: X },
  { id: "fishbowl", name: "Fishbowl", vendor: "Fishbowl", group: "smb", segments: ["small"], deployment: ["on-prem", "cloud"], focus: "Inventory and light manufacturing", interfaces: ["Fishbowl REST API"], support: X, verify: true },
  { id: "katana", name: "Katana", vendor: "Katana", group: "smb", segments: ["small"], deployment: ["cloud"], focus: "Small manufacturers", interfaces: ["REST API"], support: X },
  { id: "mrpeasy", name: "MRPeasy", vendor: "MRPeasy", group: "smb", segments: ["small"], deployment: ["cloud"], focus: "Small manufacturers", interfaces: ["REST API"], support: X },
  { id: "zoho-inventory", name: "Zoho Inventory", vendor: "Zoho", group: "smb", segments: ["small"], deployment: ["cloud"], focus: "Small distributors", interfaces: ["REST API"], support: X },
  { id: "acctivate", name: "Acctivate", vendor: "Acctivate", group: "smb", segments: ["small"], deployment: ["on-prem"], focus: "Inventory for QuickBooks users", interfaces: ["To confirm in assessment"], support: X, verify: true },
];

export const supportInfo: Record<SupportLevel, { label: string; detail: string; tone: string }> = {
  standard: { label: "Standard", detail: "Covered by the $7,500 fixed-fee standard implementation.", tone: "success" },
  advanced: { label: "Advanced", detail: "Fixed-fee advanced implementation ($15,000 to $25,000), quoted after assessment.", tone: "violet" },
  assessment: { label: "Assessment", detail: "Fit, interfaces and scope confirmed in a Readiness Assessment before we quote.", tone: "info" },
};

export const segmentLabel: Record<Segment, string> = { small: "Small business", mid: "Mid-market", enterprise: "Enterprise" };
export const deploymentLabel: Record<Deployment, string> = { cloud: "Cloud", "on-prem": "On-premise", hosted: "Hosted" };
