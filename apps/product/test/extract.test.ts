import { UNMATCHED_SKU } from "@stratosopx/core/orders";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { Extraction } from "../worker/extract/claude";
import { convert, decodeXml, docxToText, xlsxToText } from "../worker/extract/convert";
import { buildLines, filterModelWarnings, normalizeUom, resolveCustomer, resolveShipDate, type CatalogItem } from "../worker/extract/draft";

const EA = { code: "EA", factor: 1 };
const items = new Map<string, CatalogItem>([
  ["4410-A", { sku: "4410-A", description: "Hex bolt", sellUom: "EA", uomOptions: [EA, { code: "BX", factor: 100 }], tierPrice: 0.42, stock: 12400 }],
  ["7714-B", { sku: "7714-B", description: "Socket cap screw", sellUom: "EA", uomOptions: [EA, { code: "CS", factor: 12 }], tierPrice: 1.55, stock: 860 }],
]);
const aliases = new Map([["C-1|ac-hx-0375", "4410-A"]]);

const line = (over: Partial<Extraction["lines"][number]> = {}): Extraction["lines"][number] => ({
  line_number: 1,
  customer_part: null,
  description: "Hex bolt 3/8",
  quantity: 500,
  uom: "EA",
  unit_price: 0.42,
  matched_sku: "4410-A",
  match_confidence: 0.96,
  ...over,
});

describe("convert", () => {
  it("turns an xlsx into aligned tab-separated rows with shared strings", () => {
    const xlsx = zipSync({
      "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="PO" sheetId="1"/></sheets></workbook>'),
      "xl/sharedStrings.xml": strToU8("<sst><si><t>SKU</t></si><si><t>Qty</t></si><si><r><t>AC-</t></r><r><t>HX-0375</t></r></si></sst>"),
      "xl/worksheets/sheet1.xml": strToU8(
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
          '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>500</v></c></row>' +
          '<row r="3"><c r="B3" t="inlineStr"><is><t>R&amp;D note</t></is></c></row></sheetData></worksheet>',
      ),
    });
    expect(xlsxToText(xlsx)).toBe("### Sheet: PO\nSKU\t\tQty\nAC-HX-0375\t\t500\n\tR&D note");
  });

  it("extracts paragraphs and table cells from a docx", () => {
    const docx = zipSync({
      "word/document.xml": strToU8(
        "<w:document><w:body><w:p><w:r><w:t>PO 123</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>4410-A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>500</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>",
      ),
    });
    expect(docxToText(docx)).toContain("PO 123");
    expect(docxToText(docx)).toContain("4410-A");
  });

  it("sends PDFs as document blocks and refuses legacy formats", () => {
    const pdf = convert("po.pdf", strToU8("%PDF-1.7"));
    expect(pdf.ok && pdf.blocks[0]!.type).toBe("document");
    const xls = convert("po.xls", strToU8("x"));
    expect(xls.ok).toBe(false);
    expect(convert("empty.csv", strToU8("   ")).ok).toBe(false);
  });

  it("decodes XML entities", () => {
    expect(decodeXml("A &amp; B &lt;1&gt; &#233;&#x41;")).toBe("A & B <1> éA");
  });
});

describe("draft", () => {
  it("normalizes unit synonyms only to units the item allows", () => {
    expect(normalizeUom("pcs", [EA])).toBe("EA");
    expect(normalizeUom("Case", [EA, { code: "CS", factor: 12 }])).toBe("CS");
    expect(normalizeUom("Case", [EA])).toBeNull();
  });

  it("resolves customers only to known ids or exact names", () => {
    const customers = [{ id: "C-1", name: "Acme Industrial" }];
    const ext = { matched_customer_id: "C-9", customer_name: "acme industrial" } as Extraction;
    expect(resolveCustomer(ext, customers)).toBe("C-1");
    expect(resolveCustomer({ matched_customer_id: null, customer_name: "Acme" } as Extraction, customers)).toBeNull();
  });

  it("defaults a missing ship date with a warning", () => {
    expect(resolveShipDate("2026-11-04", "2026-10-12T10:00:00Z")).toEqual({ date: "2026-11-04" });
    const r = resolveShipDate("next Tuesday", "2026-10-12T10:00:00Z");
    expect(r.date).toBe("2026-10-26");
    expect(r.warning).toMatch(/No valid ship date/);
  });

  it("prefers the customer's part alias over the model's guess", () => {
    const { lines, warnings } = buildLines(
      [line({ customer_part: "AC-HX-0375", matched_sku: "7714-B", match_confidence: 0.7 })],
      "C-1",
      items,
      aliases,
      null,
    );
    expect(lines[0]!.sku).toBe("4410-A");
    expect(lines[0]!.matchConfidence).toBe(0.99);
    expect(warnings[0]).toMatch(/mapped to 4410-A/);
  });

  it("takes prices, units and stock from the catalog, not the model", () => {
    const { lines, warnings } = buildLines([line({ uom: "pieces", unit_price: null })], "C-1", items, aliases, null);
    expect(lines[0]).toMatchObject({ sku: "4410-A", uom: "EA", unitPrice: 0.42, tierPrice: 0.42, stock: 12400 });
    expect(warnings).toContain("Line 1: no price on the document; used the contract price.");
  });

  it("marks lines with no catalog match as unmatched", () => {
    const { lines, warnings } = buildLines([line({ matched_sku: "ZZZ-9", description: "Mystery part" })], "C-1", items, aliases, null);
    expect(lines[0]).toMatchObject({ sku: UNMATCHED_SKU, matchConfidence: 0, description: "Mystery part" });
    expect(warnings[0]).toMatch(/ZZZ-9 is not in the catalog/);
  });

  it("carries previous quantities for change orders and flags added and removed lines", () => {
    const prior = { id: "o1", shipDate: "2026-11-01", salesOrder: null, qtyBySku: new Map([["4410-A", 400], ["7714-B", 10]]) };
    const { lines, warnings } = buildLines([line({ quantity: 500 })], "C-1", items, aliases, prior);
    expect(lines[0]!.prev).toEqual({ qty: 400 });
    expect(warnings).toContain("7714-B was on the original order but is not in this revision.");
  });
});

describe("leaving lines off a new PO", () => {
  it("skips checks and the payload for quantity-0 lines on a PO, not on a change order", async () => {
    const { validateOrder, erpPayload } = await import("@stratosopx/core/orders");
    const base = {
      n: 2,
      customerPart: "AC-GL-0099",
      sku: UNMATCHED_SKU,
      description: "Nitrile gloves",
      matchConfidence: 0,
      qty: 0,
      uom: "BX",
      unitPrice: 12.75,
      sellUom: "BX",
      uomOptions: [{ code: "BX", factor: 1 }],
      tierPrice: 0,
      stock: 0,
    };
    const good = { ...base, n: 1, sku: "4410-A", customerPart: "AC-HX-0375", description: "Hex bolt", matchConfidence: 0.99, qty: 800, uom: "EA", unitPrice: 0.42, sellUom: "EA", uomOptions: [{ code: "EA", factor: 1 }], tierPrice: 0.42, stock: 12400 };
    const order = {
      kind: "po" as const, id: "o", title: "PO-1", poNumber: "PO-1", customer: { name: "Acme", id: "C-1", creditLimit: 1e6, openBalance: 0 },
      receivedAt: "", sourceFile: "", channel: "", erp: "NetSuite" as const, shipDate: "2026-10-30", lines: [good, base],
    };
    expect(validateOrder(order, order.lines, order.shipDate)).toEqual([]);
    const items = (erpPayload(order, order.lines, order.shipDate).body as { item: { items: unknown[] } }).item.items;
    expect(items).toHaveLength(1);
    const co = { ...order, kind: "change-order" as const };
    expect(validateOrder(co, co.lines, co.shipDate).map((i) => i.key)).toContain("unmatched-2");
  });
});

describe("filterModelWarnings", () => {
  it("keeps only the notes the server did not resolve (PO-48500 replay)", () => {
    const aliasesAcme = new Map([
      ["C-1|ac-hx-0375", "4410-A"],
      ["C-1|ac-ss-7714", "7714-B"],
    ]);
    const catalog = new Map(items);
    catalog.set("4420-C", { sku: "4420-C", description: "Flat washer", sellUom: "EA", uomOptions: [EA, { code: "BX", factor: 100 }], tierPrice: 0.06, stock: 30000 });
    const extracted = [
      line({ line_number: 1, customer_part: "AC-HX-0375", quantity: 800 }),
      line({ line_number: 2, customer_part: null, description: "Flat washer", matched_sku: "4420-C", match_confidence: 0.85, uom: "PCS", unit_price: 0.06 }),
      line({ line_number: 3, customer_part: "AC-SS-7714", matched_sku: "7714-B", quantity: 5, uom: "CASE", unit_price: 18.4 }),
      line({ line_number: 4, customer_part: "AC-GL-0099", description: "Nitrile gloves", matched_sku: null, match_confidence: 0, uom: "BX", unit_price: 12.75 }),
    ];
    const { facts } = buildLines(extracted, "C-1", catalog, aliasesAcme, null);
    const kept = filterModelWarnings(
      [
        { topic: "authenticity", line_number: null, message: "Sender domain doesn't match the customer's." },
        { topic: "customer_match", line_number: null, message: "Matched Acme Industrial Supply Co. to Acme Industrial." },
        { topic: "sku_match", line_number: 4, message: "Gloves are not in the catalog." },
        { topic: "unit", line_number: null, message: "Lines 2 and 3 use units that need mapping." },
        { topic: "missing_info", line_number: null, message: "No order total is stated." },
        { topic: "sku_match", line_number: 2, message: "Matched by description." },
        { topic: "unit", line_number: 3, message: "CASE vs CS; confirm pack size." },
      ],
      extracted,
      facts,
      { shipDateDefaulted: false },
    );
    expect(kept).toEqual(["Sender domain doesn't match the customer's.", "No order total is stated."]);
  });

  it("keeps an unresolved unit note and a SKU note on a confident match", () => {
    const extracted = [line({ line_number: 10, uom: "PALLET" })];
    const { facts } = buildLines(extracted, "C-1", items, aliases, null);
    const kept = filterModelWarnings(
      [
        { topic: "unit", line_number: 10, message: "PALLET isn't a stocked unit." },
        { topic: "sku_match", line_number: 10, message: "Two similar bolts; chose 4410-A." },
      ],
      extracted,
      facts,
      { shipDateDefaulted: false },
    );
    expect(kept).toEqual(["Line 1: PALLET isn't a stocked unit.", "Line 1: Two similar bolts; chose 4410-A."]);
  });
});
