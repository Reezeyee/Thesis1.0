import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Search, RefreshCw, Phone, MapPin, Package, Pencil, Users } from 'lucide-react';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { useFarmData } from '../store/FarmDataProvider';
import { formatCurrency } from '../lib/currencyFormat';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { BuyerRecordEditDialog } from './BuyerRecordEditDialog';
import type { BuyerOrderRecord, SaleRecord } from '../types/appState';
import type { BuyerRecord } from '../lib/buyerRecord';

type BuyerStats = { fulfilledCount: number; fulfilledTotal: number; pendingCount: number };
const EMPTY_STATS: BuyerStats = { fulfilledCount: 0, fulfilledTotal: 0, pendingCount: 0 };

/** Combines storefront orders with manually-recorded sales linked to a buyer account, same as BuyerProfileDialog's counterparts elsewhere in Equipment/Maintenance. */
function statsFromOrdersAndSales(orders: BuyerOrderRecord[], sales: SaleRecord[]): Map<string, BuyerStats> {
  const byBuyer = new Map<string, BuyerStats>();
  const get = (uid: string) => byBuyer.get(uid) ?? { fulfilledCount: 0, fulfilledTotal: 0, pendingCount: 0 };
  for (const order of orders) {
    if (!order.buyerUid) continue;
    const current = get(order.buyerUid);
    if (order.status === 'fulfilled') {
      current.fulfilledCount += 1;
      current.fulfilledTotal += order.totalAmount ?? 0;
    } else if (order.status === 'pending') {
      current.pendingCount += 1;
    }
    byBuyer.set(order.buyerUid, current);
  }
  for (const sale of sales) {
    if (!sale.buyerUid) continue;
    const current = get(sale.buyerUid);
    current.fulfilledCount += 1;
    current.fulfilledTotal += sale.total ?? 0;
    byBuyer.set(sale.buyerUid, current);
  }
  return byBuyer;
}

/**
 * Admin-facing buyer record book (Maintenance -> Buyer Records): every self-registered buyer's
 * name, contact info, address, an admin-assigned buyer type, and a purchase history reference --
 * editable via BuyerRecordEditDialog. Reads the same `users` (role == BUYER) + `buyer_orders`
 * sources as BuyerProfileDialog/NearbyBuyers, so all three stay consistent.
 */
export function BuyerRecords() {
  const { state } = useFarmData();
  const [buyers, setBuyers] = useState<BuyerRecord[]>([]);
  const [orders, setOrders] = useState<BuyerOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<BuyerRecord | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [buyersSnap, ordersSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.USERS), where('role', '==', 'BUYER'))),
        getDocs(collection(db, COLLECTIONS.BUYER_ORDERS)),
      ]);
      setBuyers(
        buyersSnap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            uid: d.id,
            displayName: (data.displayName as string) ?? 'Unnamed buyer',
            email: (data.email as string) ?? '',
            phone: (data.phone as string) ?? '',
            locationLat: typeof data.locationLat === 'number' ? data.locationLat : undefined,
            locationLng: typeof data.locationLng === 'number' ? data.locationLng : undefined,
            locationAddress: (data.locationAddress as string) ?? '',
            buyerType: (data.buyerType as string) ?? '',
          };
        }),
      );
      setOrders(ordersSnap.docs.map((d) => ({ orderId: d.id, ...(d.data() as Omit<BuyerOrderRecord, 'orderId'>) })));
    } catch {
      setLoadError('Could not load buyer accounts. Confirm firestore.rules has been published.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const statsByBuyer = useMemo(() => statsFromOrdersAndSales(orders, state.sales ?? []), [orders, state.sales]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? buyers.filter(
          (b) =>
            b.displayName.toLowerCase().includes(q) ||
            b.email.toLowerCase().includes(q) ||
            (b.phone ?? '').includes(q) ||
            (b.locationAddress ?? '').toLowerCase().includes(q),
        )
      : buyers;
    return [...rows].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [buyers, search]);

  const handleSaved = (uid: string, patch: Partial<BuyerRecord>) => {
    setBuyers((prev) => prev.map((b) => (b.uid === uid ? { ...b, ...patch } : b)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, or address…"
            className="h-9 pl-8 rounded-lg text-xs"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loadError ? (
        <p className="text-xs font-medium text-rose-500 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
          {loadError}
        </p>
      ) : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading buyer records…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">{buyers.length === 0 ? 'No buyer accounts have registered yet.' : 'No buyers match your search.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((buyer) => {
            const stats = statsByBuyer.get(buyer.uid) ?? EMPTY_STATS;
            return (
              <div key={buyer.uid} className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{buyer.displayName}</p>
                      {buyer.buyerType ? (
                        <Badge variant="secondary" className="text-[10px] font-semibold">{buyer.buyerType}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground">Type not set</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{buyer.email}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    onClick={() => setEditing(buyer)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 border-t border-border/50">
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 shrink-0" />
                    {buyer.phone ? buyer.phone : <span className="italic">No phone on record</span>}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Package className="w-3 h-3 shrink-0" />
                    {stats.fulfilledCount} order{stats.fulfilledCount === 1 ? '' : 's'} · {formatCurrency(stats.fulfilledTotal)}
                    {stats.pendingCount > 0 ? ` (${stats.pendingCount} pending)` : ''}
                  </p>
                  <p className="flex items-start gap-1.5 sm:col-span-2">
                    <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                    {buyer.locationAddress ? buyer.locationAddress : <span className="italic">No address on record</span>}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BuyerRecordEditDialog
        buyer={editing}
        open={editing !== null}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
        onSaved={handleSaved}
      />
    </div>
  );
}
