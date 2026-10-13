import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { packageBlocks } from "../worker/bids/claude";
import { parseIntakeLocal, recommend, type Requirement } from "../worker/bids/recommend";

const req = (over: Partial<Requirement>): Requirement => ({
  clause: "§1",
  page: 1,
  category: "insurance",
  requirement: "General liability $5M",
  mandatory: true,
  status: "meets",
  evidence: "GL policy $5M",
  dealbreaker: false,
  ...over,
});

describe("recommend", () => {
  it("is No-Go when any dealbreaker fails", () => {
    const r = recommend([req({ dealbreaker: true, status: "fails", clause: "§4.2.1" }), req({ status: "unclear" })]);
    expect(r.recommendation).toBe("no_go");
    expect(r.reason).toMatch(/§4\.2\.1 General liability/);
    expect(recommend([req({ dealbreaker: true, status: "fails", requirement: "Umbrella may not be used." })]).reason).toMatch(/used\.$/);
    expect(recommend([req({ dealbreaker: true, status: "fails", requirement: "Umbrella may not be used." })]).reason).not.toMatch(/\.\.$/);
  });

  it("needs info when a mandatory item or dealbreaker isn't confirmed", () => {
    expect(recommend([req({ status: "unclear" })]).recommendation).toBe("needs_info");
    expect(recommend([req({ mandatory: false, dealbreaker: true, status: "unclear" })]).recommendation).toBe("needs_info");
    expect(recommend([req({ mandatory: true, status: "fails" })]).recommendation).toBe("needs_info");
  });

  it("is Go when everything mandatory is met, ignoring optional gaps", () => {
    expect(recommend([req({}), req({ mandatory: false, status: "fails" })]).recommendation).toBe("go");
  });
});

describe("parseIntakeLocal", () => {
  it("routes +bids and +rfp to bid intake", () => {
    expect(parseIntakeLocal("demo")).toEqual({ local: "demo", kind: "order" });
    expect(parseIntakeLocal("Demo+Bids")).toEqual({ local: "demo", kind: "bid" });
    expect(parseIntakeLocal("demo+rfp")).toEqual({ local: "demo", kind: "bid" });
    expect(parseIntakeLocal("demo+anything")).toEqual({ local: "demo", kind: "order" });
  });
});

describe("packageBlocks", () => {
  it("unpacks a ZIP into labelled blocks and lists what it couldn't read", () => {
    const zip = zipSync({
      "RFP/specs.pdf": strToU8("%PDF-1.7 spec"),
      "RFP/forms.csv": strToU8("form,required\nBid bond,yes"),
      "RFP/drawing.dwg": strToU8("binary"),
      "__MACOSX/._specs.pdf": strToU8("junk"),
    });
    const { blocks, skipped } = packageBlocks("package.zip", zip);
    expect(blocks.filter((b) => b.type === "document")).toHaveLength(1);
    expect(blocks.some((b) => b.type === "text" && b.text === "File in package: RFP/forms.csv")).toBe(true);
    expect(skipped).toEqual(["RFP/drawing.dwg: .dwg files can't be read automatically"]);
  });

  it("sends a single PDF without a file label", () => {
    const { blocks } = packageBlocks("rfp.pdf", strToU8("%PDF-1.7"));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe("document");
  });
});
