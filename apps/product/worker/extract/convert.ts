import type Anthropic from "@anthropic-ai/sdk";
import { unzipSync } from "fflate";

// Turn a stored document into Claude content blocks. PDFs and images go to Claude
// as-is; spreadsheets and Word files are converted to text here; legacy binary
// Office files and TIFF are not supported yet and need a human.

type Block = Anthropic.Beta.BetaContentBlockParam;

export type Converted = { ok: true; blocks: Block[]; note?: string } | { ok: false; reason: string };

const MAX_TEXT_CHARS = 600_000; // ~150k tokens: far beyond any real PO

export function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

const colIndex = (letters: string) => [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;

// Workbook -> one tab-separated block per sheet. Cells keep their column position
// so tables stay aligned.
export function xlsxToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const text = (path: string) => (files[path] ? new TextDecoder().decode(files[path]) : "");

  const shared: string[] = [];
  for (const si of text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    shared.push(decodeXml([...si[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join("")));
  }

  const sheetNames = [...text("xl/workbook.xml").matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => decodeXml(m[1]!));
  const sheetPaths = Object.keys(files)
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));

  const out: string[] = [];
  sheetPaths.forEach((path, i) => {
    const rows = new Map<number, Map<number, string>>();
    let maxCol = -1;
    const xml = text(path);
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]!;
      const ref = attrs.match(/\br="([A-Z]+)(\d+)"/);
      if (!ref) continue;
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const inner = c[2] ?? "";
      let value: string;
      if (type === "s") value = shared[Number(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1])] ?? "";
      else if (type === "inlineStr") value = decodeXml([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));
      else value = decodeXml(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
      if (value === "") continue;
      const col = colIndex(ref[1]!);
      const row = Number(ref[2]);
      maxCol = Math.max(maxCol, col);
      if (!rows.has(row)) rows.set(row, new Map());
      rows.get(row)!.set(col, value.replace(/[\t\r\n]+/g, " "));
    }
    const lines = [...rows.keys()]
      .sort((a, b) => a - b)
      .map((r) => Array.from({ length: maxCol + 1 }, (_, col) => rows.get(r)!.get(col) ?? "").join("\t").replace(/\t+$/, ""));
    if (lines.length) out.push(`### Sheet: ${sheetNames[i] ?? `Sheet${i + 1}`}\n${lines.join("\n")}`);
  });
  return out.join("\n\n");
}

export function docxToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const xml = files["word/document.xml"] ? new TextDecoder().decode(files["word/document.xml"]) : "";
  return decodeXml(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<\/w:tc>/g, "\t")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToText(html: string) {
  return decodeXml(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
      .replace(/<\/t[dh]>/gi, "\t")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textBlock(label: string, body: string): Converted {
  if (!body.trim()) return { ok: false, reason: "The document has no readable text" };
  if (body.length > MAX_TEXT_CHARS) return { ok: false, reason: "The document is too long to extract automatically" };
  return { ok: true, blocks: [{ type: "text", text: `<document format="${label}">\n${body}\n</document>` }] };
}

export function convert(filename: string, bytes: Uint8Array): Converted {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  try {
    switch (ext) {
      case "pdf":
        return {
          ok: true,
          blocks: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(bytes) } }],
        };
      case "png":
        return { ok: true, blocks: [{ type: "image", source: { type: "base64", media_type: "image/png", data: toBase64(bytes) } }] };
      case "jpg":
      case "jpeg":
        return { ok: true, blocks: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: toBase64(bytes) } }] };
      case "xlsx":
      case "xlsm":
        return textBlock("spreadsheet (tab-separated, one section per sheet)", xlsxToText(bytes));
      case "docx":
        return textBlock("word document", docxToText(bytes));
      case "csv":
        return textBlock("csv", new TextDecoder().decode(bytes));
      case "txt":
        return textBlock("email or plain text", new TextDecoder().decode(bytes));
      case "html":
        return textBlock("html email", htmlToText(new TextDecoder().decode(bytes)));
      case "eml":
        return textBlock("raw email", new TextDecoder().decode(bytes));
      case "xls":
      case "doc":
        return { ok: false, reason: `Legacy .${ext} files can't be read automatically yet; ask for .xlsx, .docx or PDF` };
      case "tif":
      case "tiff":
        return { ok: false, reason: "TIFF images can't be read automatically yet; ask for PDF" };
      default:
        return { ok: false, reason: `.${ext} files can't be read automatically` };
    }
  } catch {
    return { ok: false, reason: "The file could not be opened (it may be damaged)" };
  }
}
