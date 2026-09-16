import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, LogOut, Coffee, Package, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { useFarmData } from '../store/FarmDataProvider';
import type { AuthSession } from '../auth/AuthProvider';
import type { BuyerOrderItem, BuyerOrderRecord } from '../types/appState';
import { formatCurrency } from '../lib/currencyFormat';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

/**
 * Buyer-facing storefront: browse Admin-managed product listings, add to cart, place an order.
 * Orders are written straight to the buyer_orders collection (never through useFarmData's
 * updateState) because a Buyer only has permission to create/read their own order docs, not
 * write the shared app_state/farm blob -- see firestore.rules and the Phase 3 design decision.
 * Inventory does not move until Admin marks the order fulfilled.
 */
export function BuyerStorefront({ session, onSignOut }: { session: AuthSession; onSignOut: () => void }) {
  const { state, loading: farmLoading } = useFarmData();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placedNotice, setPlacedNotice] = useState<string | null>(null);
  const [myOrders, setMyOrders] = useState<BuyerOrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const listings = useMemo(
    () => (state.productListings ?? []).filter((l) => l.availableQty > 0),
    [state.productListings],
  );

  const loadMyOrders = async () => {
    setOrdersLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, COLLECTIONS.BUYER_ORDERS), where('buyerUid', '==', session.userId)),
      );
      const orders = snap.docs.map((d) => ({ orderId: d.id, ...(d.data() as Omit<BuyerOrderRecord, 'orderId'>) }));
      orders.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      setMyOrders(orders);
    } catch {
      // Non-fatal -- the catalog still works even if order history fails to load.
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    void loadMyOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.userId]);

  const setQty = (listingId: string, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(Math.round(qty) || 0, max));
    setCart((prev) => ({ ...prev, [listingId]: clamped }));
  };

  const cartItems = useMemo(() => {
    return listings
      .map((l) => {
        const qty = cart[l.listingId] ?? 0;
        if (qty <= 0) return null;
        const item: BuyerOrderItem = {
          listingId: l.listingId,
          name: l.name,
          unit: l.unit,
          pricePerUnit: l.pricePerUnit,
          quantity: qty,
          subtotal: Math.round(qty * l.pricePerUnit * 100) / 100,
        };
        return item;
      })
      .filter((x): x is BuyerOrderItem => x !== null);
  }, [cart, listings]);

  const cartTotal = cartItems.reduce((sum, it) => sum + it.subtotal, 0);

  const placeOrder = async () => {
    if (cartItems.length === 0) return;
    setPlacing(true);
    setPlaceError(null);
    setPlacedNotice(null);
    try {
      await addDoc(collection(db, COLLECTIONS.BUYER_ORDERS), {
        buyerUid: session.userId,
        buyerName: session.displayName || session.email,
        buyerEmail: session.email,
        items: cartItems,
        totalAmount: cartTotal,
        status: 'pending',
        createdAt: new Date().toISOString(),
        fulfilledAt: null,
        _serverCreatedAt: serverTimestamp(),
      });
      setCart({});
      setPlacedNotice('Order placed! The farm will review and confirm it soon.');
      void loadMyOrders();
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : 'Could not place your order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const statusBadge = (status: BuyerOrderRecord['status']) => {
    if (status === 'fulfilled') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 uppercase">
          <CheckCircle2 className="w-3 h-3" /> Fulfilled
        </span>
      );
    }
    if (status === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 uppercase">
          <XCircle className="w-3 h-3" /> Cancelled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 uppercase">
        <Clock className="w-3 h-3" /> Pending
      </span>
    );
  };

  if (farmLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground font-medium">Loading the storefront…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 sm:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-black flex items-center justify-center">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acojido Farm</p>
            <h1 className="text-lg font-bold font-heading">Buyer Storefront</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">{session.displayName || session.email}</span>
          <Button onClick={onSignOut} variant="outline" className="h-9 rounded-xl text-xs font-semibold cursor-pointer">
            <LogOut className="w-4 h-4 mr-1.5" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
        <section>
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" /> Available Coffee
          </h2>
          {listings.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing is listed for sale right now — check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {listings.map((l) => (
                <Card key={l.listingId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center justify-between">
                      <span>{l.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">{l.category}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-lg font-bold">
                      {formatCurrency(l.pricePerUnit)} <span className="text-xs font-normal text-muted-foreground">/ {l.unit}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{l.availableQty} {l.unit} available</p>
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        type="number"
                        min={0}
                        max={l.availableQty}
                        value={cart[l.listingId] ?? ''}
                        onChange={(e) => setQty(l.listingId, Number(e.target.value), l.availableQty)}
                        placeholder="0"
                        className="h-9 w-24 rounded-lg text-xs"
                      />
                      <span className="text-xs text-muted-foreground">{l.unit}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {cartItems.length > 0 ? (
          <section>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> Your Order
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cartItems.map((it) => (
                  <div key={it.listingId} className="flex items-center justify-between text-xs">
                    <span>{it.name} × {it.quantity} {it.unit}</span>
                    <span className="font-semibold">{formatCurrency(it.subtotal)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                  <span className="text-sm font-bold">Total</span>
                  <span className="text-sm font-bold">{formatCurrency(cartTotal)}</span>
                </div>
                {placeError ? <p className="text-xs text-rose-500">{placeError}</p> : null}
                {placedNotice ? <p className="text-xs text-emerald-500">{placedNotice}</p> : null}
                <Button
                  onClick={() => void placeOrder()}
                  disabled={placing}
                  className="w-full h-10 rounded-xl text-xs font-bold cursor-pointer"
                >
                  {placing ? 'Placing order…' : 'Place Order'}
                </Button>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section>
          <h2 className="text-sm font-bold mb-3">My Orders</h2>
          {ordersLoading ? (
            <p className="text-xs text-muted-foreground">Loading your orders…</p>
          ) : myOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground">You haven't placed any orders yet.</p>
          ) : (
            <div className="space-y-3">
              {myOrders.map((o) => (
                <Card key={o.orderId}>
                  <CardContent className="pt-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">Order #{o.orderId.slice(0, 8).toUpperCase()}</span>
                      {statusBadge(o.status)}
                    </div>
                    {o.items.map((it, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{it.name} × {it.quantity} {it.unit}</p>
                    ))}
                    <p className="text-sm font-bold pt-1">{formatCurrency(o.totalAmount)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
