import { describe, expect, it } from "vitest";
import { authenticationPassed } from "../worker/intake/email";
import { checkFile, sanitizeFilename } from "../worker/intake/filecheck";

const bytes = (s: string) => new TextEncoder().encode(s);
const latin = (s: string) => Uint8Array.from(s, (ch) => ch.charCodeAt(0));

const pdf = (body: string) => latin(`%PDF-1.7\n${body}\n%%EOF`);
// Minimal ZIP: a local header followed by central-directory headers in the real
// layout (name length at offset 28, name from offset 46).
function zip(names: string[]) {
  const parts: number[] = [...latin("PK\x03\x04"), ...new Array(26).fill(0)];
  for (const n of names) {
    const name = bytes(n);
    const header = new Uint8Array(46);
    header.set(latin("PK\x01\x02"), 0);
    new DataView(header.buffer).setUint16(28, name.length, true);
    parts.push(...header, ...name);
  }
  return Uint8Array.from(parts);
}

describe("checkFile", () => {
  it("accepts a plain PDF and counts pages", () => {
    const r = checkFile("po.pdf", pdf("1 0 obj << /Type /Page >> 2 0 obj << /Type /Page >> 3 0 obj << /Type /Pages >>"));
    expect(r.detected).toBe("pdf");
    expect(r.pages).toBe(2);
    expect(r.dangerous).toEqual([]);
    expect(r.mismatch).toBeNull();
    expect(r.passwordProtected).toBe(false);
  });

  it("flags PDF JavaScript, launch actions and embedded files", () => {
    const r = checkFile("po.pdf", pdf("/OpenAction << /S /JavaScript /JS (app.alert(1)) >> /Launch /EmbeddedFile"));
    expect(r.dangerous).toEqual(["PDF contains JavaScript", "PDF contains a launch action", "PDF contains embedded files"]);
  });

  it("detects encrypted PDFs", () => {
    expect(checkFile("po.pdf", pdf("trailer << /Encrypt 5 0 R >>")).passwordProtected).toBe(true);
  });

  it("rejects an executable renamed to .pdf", () => {
    const r = checkFile("invoice.pdf", latin("MZ\x90\x00rest-of-exe"));
    expect(r.detected).toBe("executable");
    expect(r.dangerous).toContain("File is an executable program");
  });

  it("flags extension mismatches", () => {
    expect(checkFile("orders.xlsx", pdf("")).mismatch).toBe("Contents do not match the .xlsx extension");
    expect(checkFile("orders.csv", latin("\x00\x01binary")).mismatch).toBe("Contents do not match the .csv extension");
  });

  it("treats an OLE container with an .xlsx name as password-protected", () => {
    const ole = latin("\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + "\0".repeat(64));
    const r = checkFile("po.xlsx", ole);
    expect(r.passwordProtected).toBe(true);
    expect(r.mismatch).toBeNull();
  });

  it("flags macros hidden in a non-macro workbook", () => {
    expect(checkFile("po.xlsx", zip(["xl/workbook.xml", "xl/vbaProject.bin"])).dangerous).toEqual([
      "Macro code inside a .xlsx file",
    ]);
    expect(checkFile("po.xlsm", zip(["xl/workbook.xml", "xl/vbaProject.bin"])).dangerous).toEqual([]);
  });

  it("flags nested archives and executables inside a ZIP", () => {
    const r = checkFile("bid.zip", zip(["specs.pdf", "inner.zip", "setup.exe"]));
    expect(r.dangerous).toEqual(["Archive contains another archive", "Archive contains executable files"]);
    expect(checkFile("bid.zip", zip(["specs.pdf", "drawings.pdf"])).dangerous).toEqual([]);
  });

  it("flags scripts", () => {
    expect(checkFile("orders.txt", bytes("#!/bin/sh\nrm -rf /")).dangerous).toContain("File is a script");
  });
});

describe("sanitizeFilename", () => {
  it("strips paths, control and bidi characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\x\\po.pdf")).toBe("po.pdf");
    expect(sanitizeFilename("invoice\u202Efdp.exe")).toBe("invoicefdp.exe");
    expect(sanitizeFilename("a<b>:c.pdf")).toBe("a_b__c.pdf");
  });

  it("falls back for empty or dot names", () => {
    expect(sanitizeFilename("")).toBe("document");
    expect(sanitizeFilename("..")).toBe("document");
    expect(sanitizeFilename(null, "email-body.txt")).toBe("email-body.txt");
  });
});

describe("authenticationPassed", () => {
  const h = (value: string) => [{ key: "authentication-results", value }];
  it("passes on DMARC pass", () => {
    expect(authenticationPassed(h("mx.cloudflare.net; dkim=pass; spf=pass; dmarc=pass"))).toBe(true);
  });
  it("fails on DMARC fail even if SPF passes", () => {
    expect(authenticationPassed(h("mx.cloudflare.net; spf=pass; dkim=fail; dmarc=fail"))).toBe(false);
  });
  it("needs both SPF and DKIM without DMARC", () => {
    expect(authenticationPassed(h("spf=pass; dkim=pass"))).toBe(true);
    expect(authenticationPassed(h("spf=pass; dkim=none"))).toBe(false);
  });
  it("fails closed with no results", () => {
    expect(authenticationPassed([])).toBe(false);
  });
});
