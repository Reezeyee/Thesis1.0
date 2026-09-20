import { useEffect, useState } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { reservedByListing, type StockHold } from '../lib/stockMath';

/** Live quantity reserved per listing by pending buyer orders (firestore.rules lets any signed-in user read holds). */
export function useStockHolds(): { reserved: Record<string, number>; loaded: boolean } {
  const [reserved, setReserved] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, COLLECTIONS.STOCK_HOLDS),
      (snap) => {
        setReserved(reservedByListing(snap.docs.map((d) => d.data() as StockHold)));
        setLoaded(true);
      },
      () => setLoaded(true), // holds unreadable (e.g. rules not published yet): fall back to plain stock
    );
    return unsub;
  }, []);

  return { reserved, loaded };
}

/** One-off read of the current holds, used right before placing an order so the check isn't stale. */
export async function fetchReservedNow(): Promise<Record<string, number>> {
  const snap = await getDocs(collection(db, COLLECTIONS.STOCK_HOLDS));
  return reservedByListing(snap.docs.map((d) => d.data() as StockHold));
}
