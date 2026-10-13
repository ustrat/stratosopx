// The Go / No-Go recommendation is derived here from the compliance matrix,
// not taken from the model, so the rule is explicit and the same for every bid.

export type ReqStatus = "meets" | "fails" | "unclear";

export type Requirement = {
  clause: string | null;
  page: number | null;
  category: string;
  requirement: string;
  mandatory: boolean;
  status: ReqStatus;
  evidence: string;
  dealbreaker: boolean;
};

export type Recommendation = { recommendation: "go" | "no_go" | "needs_info"; reason: string };

const ref = (r: Requirement) => `${r.clause ? `${r.clause} ` : ""}${r.requirement}`;

export function recommend(requirements: Requirement[]): Recommendation {
  const failedDealbreakers = requirements.filter((r) => r.dealbreaker && r.status === "fails");
  if (failedDealbreakers.length) {
    return {
      recommendation: "no_go",
      reason: `${failedDealbreakers.length} dealbreaker${failedDealbreakers.length > 1 ? "s" : ""} not met: ${failedDealbreakers.map(ref).join("; ")}.`,
    };
  }
  const open = requirements.filter((r) => (r.mandatory || r.dealbreaker) && r.status !== "meets");
  if (open.length) {
    return {
      recommendation: "needs_info",
      reason: `${open.length} mandatory requirement${open.length > 1 ? "s" : ""} not confirmed: ${open.map(ref).join("; ")}.`,
    };
  }
  return { recommendation: "go", reason: "Every mandatory requirement and dealbreaker is met by the capability library." };
}

/** "demo+bids" -> { local: "demo", kind: "bid" }; anything else is an order. */
export function parseIntakeLocal(localPart: string): { local: string; kind: "order" | "bid" } {
  const [local, tag] = localPart.toLowerCase().split("+");
  return { local: local ?? "", kind: tag && ["bid", "bids", "rfp", "rfps"].includes(tag) ? "bid" : "order" };
}
