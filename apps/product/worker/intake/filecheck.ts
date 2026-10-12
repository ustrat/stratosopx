// Structural checks on an uploaded or emailed file before anything parses it.
// These are NOT an antivirus scan: they confirm the bytes match the claimed type
// and flag active content (executables, PDF scripts, macros, nested archives).

export type FileCheck = {
  ext: string;
  detected: "pdf" | "zip" | "ole" | "png" | "jpeg" | "tiff" | "text" | "executable" | "unknown";
  pages?: number;
  passwordProtected: boolean;
  dangerous: string[]; // reasons to treat as malicious -> reject
  mismatch: string | null; // contents don't match the extension -> reject
};

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

function detect(b: Uint8Array): FileCheck["detected"] {
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06])) return "zip";
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a])) return "tiff";
  if (startsWith(b, [0x4d, 0x5a]) || startsWith(b, [0x7f, 0x45, 0x4c, 0x46]) || startsWith(b, [0xcf, 0xfa, 0xed, 0xfe])) {
    return "executable"; // MZ (Windows), ELF (Linux), Mach-O
  }
  // Text: no NUL bytes in the first 8 KB.
  const head = b.subarray(0, 8192);
  if (head.length && !head.includes(0)) return "text";
  return "unknown";
}

// Latin-1 view of the bytes for searching PDF structure markers.
const latin1 = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

// Entry names from the ZIP central directory. Each header ("PK\x01\x02") stores
// the name length at offset 28 and the name itself from offset 46.
export function zipEntryNames(b: Uint8Array, max = 10_000): string[] {
  const names: string[] = [];
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const decoder = new TextDecoder();
  for (let i = 0; i + 46 <= b.length && names.length < max; i++) {
    if (b[i] !== 0x50 || b[i + 1] !== 0x4b || b[i + 2] !== 0x01 || b[i + 3] !== 0x02) continue;
    const nameLen = view.getUint16(i + 28, true);
    const extraLen = view.getUint16(i + 30, true);
    const commentLen = view.getUint16(i + 32, true);
    if (i + 46 + nameLen > b.length) break;
    names.push(decoder.decode(b.subarray(i + 46, i + 46 + nameLen)));
    i += 45 + nameLen + extraLen + commentLen;
  }
  return names;
}

const expected: Record<string, FileCheck["detected"][]> = {
  pdf: ["pdf"],
  xlsx: ["zip", "ole"], // OLE = encrypted (password-protected) OOXML
  xlsm: ["zip", "ole"],
  docx: ["zip", "ole"],
  xls: ["ole"],
  doc: ["ole"],
  csv: ["text"],
  txt: ["text"],
  eml: ["text"],
  html: ["text"],
  png: ["png"],
  jpg: ["jpeg"],
  jpeg: ["jpeg"],
  tif: ["tiff"],
  tiff: ["tiff"],
  zip: ["zip"],
};

export function checkFile(filename: string, bytes: Uint8Array): FileCheck {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  const detected = detect(bytes);
  const dangerous: string[] = [];
  let passwordProtected = false;
  let pages: number | undefined;

  if (detected === "executable") dangerous.push("File is an executable program");
  if (detected === "text" && /^#!/.test(latin1(bytes.subarray(0, 2)))) dangerous.push("File is a script");

  const allowed = expected[ext];
  const mismatch =
    allowed && !allowed.includes(detected) && detected !== "executable"
      ? `Contents do not match the .${ext} extension`
      : null;

  if (detected === "pdf") {
    const s = latin1(bytes);
    pages = (s.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length || undefined;
    if (/\/Encrypt\b/.test(s)) passwordProtected = true;
    if (/\/(JavaScript|JS)\b/.test(s)) dangerous.push("PDF contains JavaScript");
    if (/\/Launch\b/.test(s)) dangerous.push("PDF contains a launch action");
    if (/\/EmbeddedFile\b/.test(s)) dangerous.push("PDF contains embedded files");
  }

  if (detected === "ole" && (ext === "xlsx" || ext === "xlsm" || ext === "docx")) passwordProtected = true;

  if (detected === "zip") {
    const names = zipEntryNames(bytes);
    if ((ext === "xlsx" || ext === "docx") && names.some((n) => /(^|\/)vbaProject\.bin$/i.test(n))) {
      dangerous.push(`Macro code inside a .${ext} file`);
    }
    if (ext === "zip") {
      if (names.some((n) => /\.(zip|7z|rar|gz|tgz|tar)$/i.test(n))) dangerous.push("Archive contains another archive");
      if (names.some((n) => /\.(exe|dll|bat|cmd|ps1|js|vbs|jar|msi|scr)$/i.test(n))) {
        dangerous.push("Archive contains executable files");
      }
      if (names.length > 100) dangerous.push(`Archive has ${names.length} files; the limit is 100`);
    }
  }

  return { ext, detected, pages, passwordProtected, dangerous, mismatch };
}

// Safe display/storage name: no paths, control or bidi characters, bounded length.
export function sanitizeFilename(name: string | null | undefined, fallback = "document") {
  const base = (name ?? "").split(/[\\/]/).pop() ?? "";
  const clean = base
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim()
    .slice(-120);
  return clean && clean !== "." && clean !== ".." ? clean : fallback;
}
