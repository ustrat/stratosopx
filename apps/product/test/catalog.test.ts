import { describe, expect, it } from "vitest";
import { parseCatalog, parseCsv } from "../worker/catalog/csv";

describe("parseCsv", () => {
  it("handles quotes, embedded commas and newlines, CRLF and BOM", () => {
    const text = '﻿sku,description\r\n"4410-A","Hex bolt, 3/8"" x 2"""\r\n7714-B,"Socket\ncap screw"\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["sku", "description"],
      ["4410-A", 'Hex bolt, 3/8" x 2"'],
      ["7714-B", "Socket\ncap screw"],
    ]);
  });
});

describe("parseCatalog", () => {
  it("parses items with other units, prices with $ and thousands separators", () => {
    const { rows, errors } = parseCatalog(
      "items",
      'SKU,Description,Sell UOM,Contract Price,Stock,Other Units\n4410-A,Hex bolt,ea,$0.42,"12,400",BX=100\n7714-B,Cap screw,EA,1.55,860,CS=12;BX=100',
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({
      sku: "4410-A",
      description: "Hex bolt",
      sellUom: "EA",
      uomOptions: [
        { code: "EA", factor: 1 },
        { code: "BX", factor: 100 },
      ],
      tierPrice: 0.42,
      stock: 12400,
    });
    expect(rows[1]!.uomOptions.map((u) => u.code)).toEqual(["EA", "CS", "BX"]);
  });

  it("reports every bad row with its row number", () => {
    const { rows, errors } = parseCatalog(
      "items",
      "sku,description,sell_uom,contract_price,other_units\n4410-A,Hex bolt,EA,abc,\n,No sku,EA,1,\n4410-A,Dup,EA,1,\nX1,Bad unit,each pack,1,BOX\n",
    );
    expect(rows).toEqual([]);
    expect(errors).toEqual([
      { row: 2, message: 'contract_price "abc" is not a valid number' },
      { row: 3, message: "sku is required" },
      { row: 4, message: "sku 4410-A appears more than once" },
      { row: 5, message: 'sell_uom "each pack" should be a unit code like EA' },
      { row: 5, message: 'other_units "BOX" should look like BX=100' },
    ]);
  });

  it("requires the mandatory columns", () => {
    expect(parseCatalog("customers", "id,name\nC-1,Acme").errors).toEqual([{ row: 1, message: 'Missing column "customer_id"' }]);
    expect(parseCatalog("aliases", "customer_id,customer_part,sku\n").errors).toEqual([{ row: 1, message: "The file has no data rows" }]);
  });

  it("parses customers and aliases, flagging duplicate aliases case-insensitively", () => {
    expect(parseCatalog("customers", "customer_id,name,credit_limit\nC-1,Acme,\"25,000\"").rows).toEqual([
      { id: "C-1", name: "Acme", creditLimit: 25000, openBalance: 0 },
    ]);
    const a = parseCatalog("aliases", "customer_id,customer_part,sku\nC-1,AC-1,4410-A\nc-1,ac-1,7714-B");
    expect(a.errors).toEqual([{ row: 3, message: "ac-1 for c-1 appears more than once" }]);
  });
});
