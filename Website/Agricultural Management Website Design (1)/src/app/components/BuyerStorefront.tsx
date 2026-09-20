import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, LogOut, Coffee, Package, Clock, CheckCircle2, XCircle, Truck, Store, Loader2, Banknote, Wallet } from 'lucide-react';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { useFarmData } from '../store/FarmDataProvider';
import { fetchReservedNow, useStockHolds } from '../store/useStockHolds';
import { availableAfterHolds, cartShortfalls } from '../lib/stockMath';
import type { AuthSession } from '../auth/AuthProvider';
import { isValidPhone11, PHONE_ERROR_MESSAGE, PHONE_PLACEHOLDER, sanitizePhoneInput } from '../lib/phone';
import type { BuyerFulfillmentMethod, BuyerOrderItem, BuyerOrderRecord, BuyerPaymentMethod } from '../types/appState';
import { DELIVERY_ZONES, deliveryFeeFor, detectProvince, paymentLabel } from '../lib/orderCheckout';
import { formatCurrency } from '../lib/currencyFormat';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { OrderThankYou } from './OrderThankYou';
import { DeliveryProofPhoto } from './DeliveryProofPhoto';
import { LocationPicker, type PickedLocation } from './LocationPicker';

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
  const [myOrders, setMyOrders] = useState<BuyerOrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  // Set when an order goes through; drives the thank-you popup (see OrderThankYou).
  // The method is kept after closing so the message doesn't change while the popup fades out.
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const [thankYouMethod, setThankYouMethod] = useState<BuyerFulfillmentMethod>('delivery');
  const closeThankYou = useCallback(() => setThankYouOpen(false), []);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<BuyerFulfillmentMethod>('delivery');
  // Map pin + address for a delivery: the rider's app shows this pin, so it must come from the map.
  const [deliveryLocation, setDeliveryLocation] = useState<PickedLocation | null>(null);
  const deliveryAddress = deliveryLocation?.address ?? '';
  // Luzon province for the delivery fee. Guessed from the address until the buyer picks one by hand.
  const [deliveryProvince, setDeliveryProvince] = useState('');
  const [provinceChosenByBuyer, setProvinceChosenByBuyer] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<BuyerPaymentMethod>('cash');
  const [phone, setPhone] = useState('');
  // Phone already saved on the buyer's profile, so checkout only writes it back when it changed
  // (accounts made before the phone field existed have none).
  const [savedPhone, setSavedPhone] = useState('');

  // Prefill delivery address + phone from the profile the buyer filled in at sign-up.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.USERS, session.userId));
        const data = snap.data();
        if (cancelled || !data) return;
        // Start from the pin the buyer set at sign-up (older accounts without coordinates must drop a new pin).
        const lat = Number(data.locationLat);
        const lng = Number(data.locationLng);
        const addr = String(data.locationAddress ?? '');
        if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) && addr) {
          setDeliveryLocation((prev) => prev ?? { lat, lng, address: addr, pinned: true });
        }
        const p = sanitizePhoneInput(String(data.phone ?? ''));
        setPhone((prev) => prev || p);
        setSavedPhone(p);
      } catch {
        // Non-fatal -- the buyer can just type both fields at checkout.
      }
    })();
    return () => { cancelled = true; };
  }, [session.userId]);

  useEffect(() => {
    if (!provinceChosenByBuyer) setDeliveryProvince(detectProvince(deliveryAddress));
  }, [deliveryAddress, provinceChosenByBuyer]);

  // Out-of-stock listings still show (greyed out, "Out of Stock" badge) instead of silently
  // disappearing, so a buyer can tell "sold out, check back" apart from "never existed". In-stock
  // listings sort first so the catalog leads with what's actually purchasable.
  // Stock a buyer can still order = listing stock minus what pending orders have reserved (live).
  const { reserved } = useStockHolds();
  const availableOf = (listingId: string, availableQty: number) =>
    availableAfterHolds(availableQty, reserved[listingId] ?? 0);
  const listings = useMemo(
    () =>
      [...(state.productListings ?? [])].sort(
        (a, b) =>
          (availableAfterHolds(b.availableQty, reserved[b.listingId] ?? 0) > 0 ? 1 : 0) -
          (availableAfterHolds(a.availableQty, reserved[a.listingId] ?? 0) > 0 ? 1 : 0),
      ),
    [state.productListings, reserved],
  );

  // If other buyers' orders just used up stock that is in this cart, trim the cart to what is left.
  useEffect(() => {
    setCart((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const l of state.productListings ?? []) {
        const want = prev[l.listingId] ?? 0;
        if (want <= 0) continue;
        const left = availableAfterHolds(l.availableQty, reserved[l.listingId] ?? 0);
        if (want > left) {
          changed = true;
          if (left <= 0) delete next[l.listingId];
          else next[l.listingId] = left;
        }
      }
      return changed ? next : prev;
    });
  }, [reserved, state.productListings]);

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
    // A quantity of 0 removes the entry so the input goes back to empty (placeholder "0").
    // Storing 0 made the box display "0" and typing 1 or 2 gave "01" / "02".
    setCart((prev) => {
      if (clamped === 0) {
        const { [listingId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [listingId]: clamped };
    });
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

  const cartSubtotal = cartItems.reduce((sum, it) => sum + it.subtotal, 0);
  const deliveryFee = fulfillmentMethod === 'delivery' ? deliveryFeeFor(deliveryProvince) : 0;
  const cartTotal = Math.round((cartSubtotal + deliveryFee) * 100) / 100;

  const placeOrder = async () => {
    if (cartItems.length === 0) return;
    const trimmedPhone = sanitizePhoneInput(phone);
    const trimmedAddress = deliveryAddress.trim();
    if (!isValidPhone11(trimmedPhone)) {
      setPlaceError(PHONE_ERROR_MESSAGE);
      return;
    }
    if (fulfillmentMethod === 'delivery' && !trimmedAddress) {
      setPlaceError('Enter the address where the order should be delivered.');
      return;
    }
    if (fulfillmentMethod === 'delivery' && (!deliveryLocation?.pinned || !trimmedAddress)) {
      setPlaceError('Drop a pin on the map for your delivery address so the rider can find you.');
      return;
    }
    if (fulfillmentMethod === 'delivery' && !deliveryProvince) {
      setPlaceError('Choose your province so we can work out the delivery fee.');
      return;
    }
    setPlacing(true);
    setPlaceError(null);
    try {
      // Re-check against the freshest holds so two buyers don't both take the last of a product.
      const freshReserved = await fetchReservedNow().catch(() => reserved);
      const short = cartShortfalls(cart, state.productListings ?? [], freshReserved);
      if (short.length > 0) {
        setCart((prev) => {
          const next = { ...prev };
          for (const sh of short) {
            if (sh.left <= 0) delete next[sh.listingId];
            else next[sh.listingId] = sh.left;
          }
          return next;
        });
        setPlaceError(
          'Someone just ordered some of this: ' +
            short.map((sh) => (sh.left > 0 ? `only ${sh.left} ${sh.unit} of ${sh.name} left` : `${sh.name} is now sold out`)).join('; ') +
            '. Your cart was updated -- check it and place the order again.',
        );
        return;
      }
      // The order and its stock hold are written together (one batch); firestore.rules only accepts
      // the hold if it matches this buyer's order exactly.
      const orderRef = doc(collection(db, COLLECTIONS.BUYER_ORDERS));
      const batch = writeBatch(db);
      batch.set(orderRef, {
        buyerUid: session.userId,
        buyerName: session.displayName || session.email,
        buyerEmail: session.email,
        buyerPhone: trimmedPhone,
        fulfillmentMethod,
        deliveryAddress: fulfillmentMethod === 'delivery' ? trimmedAddress : null,
        deliveryProvince: fulfillmentMethod === 'delivery' ? deliveryProvince : null,
        deliveryLat: fulfillmentMethod === 'delivery' ? deliveryLocation?.lat ?? null : null,
        deliveryLng: fulfillmentMethod === 'delivery' ? deliveryLocation?.lng ?? null : null,
        paymentMethod,
        items: cartItems,
        subtotal: cartSubtotal,
        deliveryFee,
        totalAmount: cartTotal,
        status: 'pending',
        createdAt: new Date().toISOString(),
        fulfilledAt: null,
        _serverCreatedAt: serverTimestamp(),
      });
      batch.set(doc(db, COLLECTIONS.STOCK_HOLDS, orderRef.id), { items: cartItems, createdAt: new Date().toISOString() });
      await batch.commit();
      setCart({});
      setThankYouMethod(fulfillmentMethod);
      setThankYouOpen(true);
      if (trimmedPhone !== savedPhone) {
        // Remember the phone on the profile (role is untouched, so firestore.rules allows it).
        void updateDoc(doc(db, COLLECTIONS.USERS, session.userId), { phone: trimmedPhone })
          .then(() => setSavedPhone(trimmedPhone))
          .catch(() => undefined);
      }
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
              {listings.map((l) => {
                const available = availableOf(l.listingId, l.availableQty);
                const outOfStock = available <= 0;
                return (
                  <Card key={l.listingId} className={outOfStock ? 'opacity-60' : undefined}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold flex items-center justify-between gap-2">
                        <span>{l.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {outOfStock ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 uppercase whitespace-nowrap">
                              Out of Stock
                            </span>
                          ) : null}
                          <span className="text-xs font-normal text-muted-foreground">{l.category}</span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-lg font-bold">
                        {formatCurrency(l.pricePerUnit)} <span className="text-xs font-normal text-muted-foreground">/ {l.unit}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {outOfStock ? 'Out of stock — check back soon' : `${available} ${l.unit} available`}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          type="number"
                          min={0}
                          max={available}
                          value={cart[l.listingId] ?? ''}
                          onChange={(e) => setQty(l.listingId, Number(e.target.value), available)}
                          placeholder="0"
                          disabled={outOfStock}
                          className="h-9 w-24 rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="text-xs text-muted-foreground">{l.unit}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
                <div className="pt-3 space-y-2">
                  <Label className="text-xs font-semibold">How would you like to get your order?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'delivery', label: 'Delivery', hint: 'We bring it to you', Icon: Truck },
                      { value: 'pickup', label: 'Pick up', hint: 'You come to the farm', Icon: Store },
                    ] as const).map(({ value, label, hint, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFulfillmentMethod(value)}
                        aria-pressed={fulfillmentMethod === value}
                        className={`rounded-xl border p-2.5 text-left cursor-pointer transition-colors ${
                          fulfillmentMethod === value
                            ? 'border-primary bg-primary/10'
                            : 'border-border/70 hover:bg-muted/40'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-bold"><Icon className="w-4 h-4" /> {label}</span>
                        <span className="block text-[11px] text-muted-foreground">{hint}</span>
                      </button>
                    ))}
                  </div>
                  {fulfillmentMethod === 'delivery' ? (
                    <div className="space-y-1.5">
                      <LocationPicker
                        id="delivery-location"
                        label="Delivery location"
                        value={deliveryLocation}
                        onChange={setDeliveryLocation}
                      />
                      <Label htmlFor="delivery-province" className="text-xs font-semibold pt-1 block">Province (sets the delivery fee)</Label>
                      <select
                        id="delivery-province"
                        value={deliveryProvince}
                        onChange={(e) => { setDeliveryProvince(e.target.value); setProvinceChosenByBuyer(true); }}
                        className="flex h-9 w-full rounded-md border border-border/80 bg-background/80 px-3 py-1 text-xs"
                      >
                        <option value="">Choose your province…</option>
                        {DELIVERY_ZONES.map((z) => (
                          <optgroup key={z.id} label={`${z.label} — ${formatCurrency(z.fee)}`}>
                            {z.provinces.map((prov) => (
                              <option key={prov} value={prov}>{prov} — {formatCurrency(z.fee)}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      You'll collect this order at the farm yourself -- the farm will contact you when it's ready.
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="order-phone" className="text-xs font-semibold">Phone number</Label>
                    <Input
                      id="order-phone"
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                      placeholder={PHONE_PLACEHOLDER}
                      autoComplete="tel"
                      aria-invalid={phone !== '' && !isValidPhone11(phone)}
                      className={`h-9 rounded-lg text-xs ${phone !== '' && !isValidPhone11(phone) ? 'border-rose-500' : ''}`}
                    />
                    <p className={`text-[11px] ${phone !== '' && !isValidPhone11(phone) ? 'text-rose-500 font-medium' : 'text-muted-foreground'}`}>
                      {phone !== '' && !isValidPhone11(phone) ? PHONE_ERROR_MESSAGE : 'Numbers only, 11 digits starting with 09.'}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-semibold">How will you pay?</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        {
                          value: 'cash' as const,
                          label: paymentLabel('cash', fulfillmentMethod),
                          hint: fulfillmentMethod === 'delivery' ? 'Pay the rider when it arrives' : 'Pay when you pick it up',
                          Icon: Banknote,
                        },
                        { value: 'e_wallet' as const, label: 'E-wallet', hint: 'Pay online (GCash, Maya…)', Icon: Wallet },
                      ]).map(({ value, label, hint, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPaymentMethod(value)}
                          aria-pressed={paymentMethod === value}
                          className={`rounded-xl border p-2.5 text-left cursor-pointer transition-colors ${
                            paymentMethod === value
                              ? 'border-primary bg-primary/10'
                              : 'border-border/70 hover:bg-muted/40'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 text-xs font-bold"><Icon className="w-4 h-4" /> {label}</span>
                          <span className="block text-[11px] text-muted-foreground">{hint}</span>
                        </button>
                      ))}
                    </div>
                    {paymentMethod === 'e_wallet' ? (
                      <p className="text-[11px] text-muted-foreground">
                        The farm will contact you with its e-wallet details so you can pay for this order.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="pt-2 mt-1 border-t border-border/60 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(cartSubtotal)}</span>
                  </div>
                  {fulfillmentMethod === 'delivery' ? (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Delivery fee{deliveryProvince ? ` (${deliveryProvince})` : ''}</span>
                      <span>{deliveryProvince ? formatCurrency(deliveryFee) : 'Choose province'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Pick up at the farm</span>
                      <span>No delivery fee</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-bold">Total</span>
                    <span className="text-sm font-bold">{formatCurrency(cartTotal)}</span>
                  </div>
                </div>
                {placeError ? <p className="text-xs text-rose-500">{placeError}</p> : null}
                <motion.div whileHover={placing ? undefined : { scale: 1.02 }} whileTap={placing ? undefined : { scale: 0.95 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
                  <Button
                    onClick={() => void placeOrder()}
                    disabled={placing}
                    className="w-full h-10 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {placing ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Placing order…</span>
                    ) : (
                      <span className="inline-flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Place Order</span>
                    )}
                  </Button>
                </motion.div>
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
                    {o.fulfillmentMethod ? (
                      <p className="text-[11px] text-muted-foreground">
                        {o.fulfillmentMethod === 'delivery' ? `Delivery to ${o.deliveryAddress ?? ''}` : 'Pick up at the farm'}
                        {o.paymentMethod ? ` · ${paymentLabel(o.paymentMethod, o.fulfillmentMethod)}` : ''}
                      </p>
                    ) : null}
                    {o.fulfillmentMethod === 'delivery' && o.riderName && o.status !== 'cancelled' ? (
                      <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {o.deliveryStatus === 'out_for_delivery'
                          ? `${o.riderName} is on the way with your order`
                          : o.deliveryStatus === 'delivered'
                          ? `${o.riderName} marked your order as delivered`
                          : `${o.riderName} will deliver your order`}
                      </p>
                    ) : null}
                    {o.hasDeliveryProof ? (
                      <DeliveryProofPhoto orderId={o.orderId} takenAtLabel={o.deliveredAt ? new Date(o.deliveredAt).toLocaleString() : undefined} />
                    ) : null}
                    {o.deliveryFee ? (
                      <p className="text-[11px] text-muted-foreground">
                        Includes {formatCurrency(o.deliveryFee)} delivery{o.deliveryProvince ? ` (${o.deliveryProvince})` : ''}
                      </p>
                    ) : null}
                    <p className="text-sm font-bold pt-1">{formatCurrency(o.totalAmount)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
      <OrderThankYou
        open={thankYouOpen}
        buyerName={session.displayName || session.email}
        method={thankYouMethod}
        onClose={closeThankYou}
      />
    </div>
  );
}
