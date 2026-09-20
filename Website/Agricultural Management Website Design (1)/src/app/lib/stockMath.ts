/**
 * Stock shown to buyers = the listing's stock minus what pending orders have already reserved.
 * A pending order writes a "stock hold" (same id) with its items; Admin deletes the hold when the
 * order is cancelled (stock comes back) or fulfilled (the stock itself is deducted instead).
 */
export type HoldItem = { listingId: string; quantity: number };
export type StockHold = { items?: HoldItem[] };

/** Total quantity held per listing across all holds. Ignores malformed entries. */
export function reservedByListing(holds: StockHold[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const hold of holds) {
    for (const item of hold.items ?? []) {
      const qty = Number(item?.quantity);
      if (!item?.listingId || !Number.isFinite(qty) || qty <= 0) continue;
      totals[item.listingId] = (totals[item.listingId] ?? 0) + qty;
    }
  }
  return totals;
}

/** What a buyer can still order: stock minus reserved, never below zero. */
export function availableAfterHolds(availableQty: number, reserved: number): number {
  return Math.max(0, availableQty - reserved);
}

/** Cart lines asking for more than is still available, with how much is left. */
export function cartShortfalls(
  cart: Record<string, number>,
  listings: { listingId: string; name: string; unit: string; availableQty: number }[],
  reserved: Record<string, number>,
): { listingId: string; name: string; unit: string; left: number }[] {
  const out: { listingId: string; name: string; unit: string; left: number }[] = [];
  for (const l of listings) {
    const want = cart[l.listingId] ?? 0;
    if (want <= 0) continue;
    const left = availableAfterHolds(l.availableQty, reserved[l.listingId] ?? 0);
    if (want > left) out.push({ listingId: l.listingId, name: l.name, unit: l.unit, left });
  }
  return out;
}
