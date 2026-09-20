import { computeSupplyStatus, type ConsumableSupplyRecord } from '../types/appState';

/**
 * Parts / materials a Maintenance worker reports using up in a repair (e.g. 4 screws). The admin takes them out of
 * the consumable supplies from the repair card; each job is deducted only once (`partsDeductedAt`).
 */
export interface PartUsed {
  name: string;
  quantity: number;
}

export const MAX_PARTS_PER_JOB = 10;

/** Reads `partsUsed` from a Firestore document defensively -- rules can't look inside the list. */
export function cleanPartsUsed(raw: unknown): PartUsed[] {
  if (!Array.isArray(raw)) return [];
  const parts: PartUsed[] = [];
  for (const item of raw.slice(0, MAX_PARTS_PER_JOB)) {
    if (!item || typeof item !== 'object') continue;
    const name = typeof (item as PartUsed).name === 'string' ? (item as PartUsed).name.trim().replace(/\s+/g, ' ').slice(0, 60) : '';
    const quantity = (item as PartUsed).quantity;
    if (name && typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0 && quantity <= 100000) {
      parts.push({ name, quantity: Math.round(quantity * 100) / 100 });
    }
  }
  return parts;
}

const formatQty = (q: number) => (Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100));

/** "4 × Screw, 1 × Spark plug" */
export function partsSummary(parts: PartUsed[]): string {
  return parts.map((p) => `${formatQty(p.quantity)} × ${p.name}`).join(', ');
}

/** Lower-case, trimmed, single-spaced, with a trailing plural "s" removed so "Screws" matches "Screw". */
export function normalizePartName(name: string): string {
  const n = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return n.length > 3 && n.endsWith('s') && !n.endsWith('ss') ? n.slice(0, -1) : n;
}

/** The supply a part comes out of: the same name (ignoring case, spacing and a plural "s"). With several units of the same name, the one with the most stock. */
export function findSupplyForPart(supplies: ConsumableSupplyRecord[], partName: string): ConsumableSupplyRecord | undefined {
  const wanted = normalizePartName(partName);
  const matches = supplies.filter((s) => normalizePartName(s.name) === wanted);
  return matches.sort((a, b) => b.stock - a.stock)[0];
}

export interface DeductionLine {
  part: PartUsed;
  supplyId?: string;
  supplyName?: string;
  unit?: string;
  stockBefore?: number;
  /** How much was really taken out (never below zero stock). */
  deducted: number;
  /** Part of the quantity the supply didn't have enough of. */
  shortBy: number;
}

export interface DeductionResult {
  supplies: ConsumableSupplyRecord[];
  lines: DeductionLine[];
  /** Parts with no matching supply: nothing was deducted for them. */
  unmatched: PartUsed[];
}

/** Deducts each part from its matching supply. Stock never goes below 0 and the supply status is recomputed. */
export function deductPartsFromSupplies(supplies: ConsumableSupplyRecord[], parts: PartUsed[]): DeductionResult {
  const stockBySupply = new Map(supplies.map((s) => [s.supplyId, s.stock]));
  const lines: DeductionLine[] = [];
  const unmatched: PartUsed[] = [];
  for (const part of parts) {
    const supply = findSupplyForPart(supplies, part.name);
    if (!supply) {
      unmatched.push(part);
      continue;
    }
    const before = stockBySupply.get(supply.supplyId) ?? 0;
    const deducted = Math.min(before, part.quantity);
    stockBySupply.set(supply.supplyId, Math.round((before - deducted) * 100) / 100);
    lines.push({
      part,
      supplyId: supply.supplyId,
      supplyName: supply.name,
      unit: supply.unit,
      stockBefore: before,
      deducted: Math.round(deducted * 100) / 100,
      shortBy: Math.round((part.quantity - deducted) * 100) / 100,
    });
  }
  const next = supplies.map((s) => {
    const stock = stockBySupply.get(s.supplyId) ?? s.stock;
    if (stock === s.stock) return s;
    const updated = { ...s, stock };
    return { ...updated, status: computeSupplyStatus(updated) };
  });
  return { supplies: next, lines, unmatched };
}
