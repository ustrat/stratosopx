import { UNMATCHED_SKU, type OrderLine, type Uom } from "@stratosopx/core/orders";
import type { Extraction } from "./claude";

// Turns the model's extraction into order lines using only ERP data for anything
// the ERP owns (SKU, unit, contract price, stock). The model's SKU guess is used
// only when it names a real catalog item; known customer part aliases win.

export type CatalogItem = { sku: string; description: string; sellUom: string; uomOptions: Uom[]; tierPrice: number; stock: number };

export type PriorOrder = { id: string; shipDate: string; salesOrder: string | null; qtyBySku: Map<string, number> };

const UOM_SYNONYMS: Record<string, string[]> = {
  EA: ["EA", "EACH", "PC", "PCS", "PCE", "PIECE", "PIECES", "UNIT", "UNITS", "U", "EAS"],
  CS: ["CS", "CASE", "CASES", "CA", "CSE"],
  BX: ["BX", "BOX", "BOXES", "BXS"],
  PK: ["PK", "PACK", "PACKS", "PKG", "PKGS"],
  DZ: ["DZ", "DOZ", "DOZEN"],
};

export function normalizeUom(raw: string, options: Uom[]): string | null {
  const v = raw.trim().toUpperCase().replace(/\.$/, "");
  if (options.some((o) => o.code === v)) return v;
  for (const [code, names] of Object.entries(UOM_SYNONYMS)) {
    if (names.includes(v) && options.some((o) => o.code === code)) return code;
  }
  return null;
}

export function resolveCustomer(extraction: Extraction, customers: { id: string; name: string }[]): string | null {
  if (extraction.matched_customer_id && customers.some((c) => c.id === extraction.matched_customer_id)) {
    return extraction.matched_customer_id;
  }
  const name = extraction.customer_name?.trim().toLowerCase();
  if (!name) return null;
  return customers.find((c) => c.name.toLowerCase() === name)?.id ?? null;
}

export function resolveShipDate(raw: string | null, receivedAt: string): { date: string; warning?: string } {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw))) return { date: raw };
  const fallback = new Date(Date.parse(receivedAt) + 14 * 86_400_000).toISOString().slice(0, 10);
  return { date: fallback, warning: `No valid ship date on the document; set to ${fallback} (14 days after receipt). Check it.` };
}

// What the server settled for each line, used to drop model warnings it resolved.
export type LineFacts = {
  aliasUsed: boolean;
  unmatched: boolean;
  lowConfidence: boolean;
  uomRecognized: boolean;
  priceDefaulted: boolean;
};

export function buildLines(
  extracted: Extraction["lines"],
  customerId: string,
  items: Map<string, CatalogItem>,
  aliases: Map<string, string>, // `${customerId}|${customerPart lowercased}` -> sku
  prior: PriorOrder | null,
): { lines: OrderLine[]; warnings: string[]; facts: LineFacts[] } {
  const warnings: string[] = [];
  const facts: LineFacts[] = [];
  const lines = extracted.map((x, i): OrderLine => {
    const n = i + 1;
    const part = x.customer_part?.trim() || null;
    const aliasSku = part ? aliases.get(`${customerId}|${part.toLowerCase()}`) : undefined;
    const modelSku = x.matched_sku && items.has(x.matched_sku) ? x.matched_sku : null;
    if (x.matched_sku && !modelSku) warnings.push(`Line ${n}: suggested SKU ${x.matched_sku} is not in the catalog.`);
    if (aliasSku && modelSku && aliasSku !== modelSku) {
      warnings.push(`Line ${n}: part ${part} is mapped to ${aliasSku}; the model suggested ${modelSku}. Used the mapping.`);
    }
    const sku = aliasSku ?? modelSku;
    const confidence = aliasSku ? 0.99 : modelSku ? Math.min(1, Math.max(0, x.match_confidence)) : 0;
    const qty = Number.isFinite(x.quantity) && x.quantity > 0 ? x.quantity : 0;
    if (qty === 0) warnings.push(`Line ${n}: no valid quantity on the document.`);

    const item = sku ? items.get(sku) : undefined;
    if (!item) {
      facts.push({ aliasUsed: false, unmatched: true, lowConfidence: true, uomRecognized: false, priceDefaulted: false });
      const uom = x.uom.trim().toUpperCase() || "EA";
      return {
        n,
        customerPart: part ?? "—",
        sku: UNMATCHED_SKU,
        description: x.description,
        matchConfidence: 0,
        qty,
        uom,
        unitPrice: x.unit_price ?? 0,
        sellUom: uom,
        uomOptions: [{ code: uom, factor: 1 }],
        tierPrice: 0,
        stock: 0,
      };
    }

    let uom = normalizeUom(x.uom, item.uomOptions);
    const uomRecognized = uom !== null;
    if (!uom) {
      warnings.push(`Line ${n}: unit "${x.uom}" isn't used for ${item.sku}; set to ${item.sellUom}. Check the quantity.`);
      uom = item.sellUom;
    }
    const factor = item.uomOptions.find((u) => u.code === uom)?.factor ?? 1;
    let unitPrice = x.unit_price;
    const priceDefaulted = unitPrice === null || !Number.isFinite(unitPrice);
    facts.push({ aliasUsed: !!aliasSku, unmatched: false, lowConfidence: confidence < 0.9, uomRecognized, priceDefaulted });
    if (unitPrice === null || !Number.isFinite(unitPrice)) {
      unitPrice = +(item.tierPrice * factor).toFixed(4);
      warnings.push(`Line ${n}: no price on the document; used the contract price.`);
    }

    const prevQty = prior ? prior.qtyBySku.get(item.sku) : undefined;
    if (prior && prevQty === undefined) warnings.push(`Line ${n}: ${item.sku} is new in this revision.`);

    return {
      n,
      customerPart: part ?? "—",
      sku: item.sku,
      description: item.description,
      matchConfidence: confidence,
      qty,
      uom,
      unitPrice,
      sellUom: item.sellUom,
      uomOptions: item.uomOptions,
      tierPrice: item.tierPrice,
      stock: item.stock,
      ...(prevQty !== undefined ? { prev: { qty: prevQty } } : {}),
    };
  });
  if (prior) {
    const present = new Set(lines.map((l) => l.sku));
    for (const sku of prior.qtyBySku.keys()) {
      if (!present.has(sku)) warnings.push(`${sku} was on the original order but is not in this revision.`);
    }
  }
  return { lines, warnings, facts };
}

// Keep only the model's warnings the server did not settle itself. Line numbers
// on the document map to our lines by position of that line in the extraction.
export function filterModelWarnings(
  warnings: Extraction["warnings"],
  extracted: Extraction["lines"],
  facts: LineFacts[],
  ctx: { shipDateDefaulted: boolean },
): string[] {
  const kept: string[] = [];
  for (const w of warnings) {
    const idx = w.line_number === null ? -1 : extracted.findIndex((l) => l.line_number === w.line_number);
    const f = idx >= 0 ? facts[idx] : undefined;
    const n = idx + 1;
    let resolved = false;
    switch (w.topic) {
      case "unit":
        resolved = f ? f.uomRecognized || f.unmatched : facts.filter((x) => !x.unmatched).every((x) => x.uomRecognized);
        break;
      case "sku_match":
        resolved = f ? f.aliasUsed || f.unmatched || f.lowConfidence : true;
        break;
      case "customer_match":
        resolved = true;
        break;
      case "price":
        resolved = !!f?.priceDefaulted;
        break;
      case "ship_date":
        resolved = ctx.shipDateDefaulted;
        break;
      default:
        resolved = false;
    }
    if (!resolved) kept.push(f ? `Line ${n}: ${w.message}` : w.message);
  }
  return kept;
}
