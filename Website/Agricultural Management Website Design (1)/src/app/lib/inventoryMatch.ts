import type { ConsumableSupplyRecord, EquipmentRecord } from '../types/appState';

const norm = (v: string) => v.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Adding a supply that already exists must restock it, never create a second row. Same name AND unit means "this is
 * the supply we already have"; when the unit was left blank, the same name is enough (if only one has that name).
 */
export function findExistingSupply(supplies: ConsumableSupplyRecord[], name: string, unit: string): ConsumableSupplyRecord | undefined {
  const n = norm(name);
  const u = norm(unit);
  const sameName = supplies.filter((s) => norm(s.name) === n);
  if (!u) return sameName.length === 1 ? sameName[0] : undefined;
  return sameName.find((s) => norm(s.unit) === u);
}

/**
 * Adding equipment that is already in the fleet must add to its quantity, never create a duplicate row. The name is
 * what identifies it (ignoring case and spacing) -- a different category typed the second time is still the same
 * machine. [ignoreIndex] skips the record being edited so it doesn't match itself.
 */
export function findExistingEquipmentIndex(equipment: EquipmentRecord[], name: string, ignoreIndex = -1): number {
  const n = norm(name);
  return equipment.findIndex((e, i) => i !== ignoreIndex && norm(e.name) === n);
}
