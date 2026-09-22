import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { Package, ShoppingBag, Plus, Trash2, Edit2, CheckCircle2, XCircle, Clock, Sprout, Store, Phone, Banknote, Wallet } from 'lucide-react';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { useFarmData } from '../store/FarmDataProvider';
import { useStockHolds } from '../store/useStockHolds';
import type { BuyerOrderRecord, ExpenseRecord, ProductListingRecord, SaleRecord } from '../types/appState';
import { computeSupplyStatus } from '../types/appState';
import { formatCurrency } from '../lib/currencyFormat';
import { runSave, showSaveError } from '../lib/saveFeedback';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { FixedSelect } from './ui/FixedSelect';

const LISTING_CATEGORIES = ['Green Beans', 'Roasted Beans', 'Ripe Cherries', 'Dried Cherries'] as const;
const LISTING_UNITS = ['kg', 'sacks', 'bags', 'lbs'] as const;

/** "Cash at pickup", paid when the buyer collects the order at the farm. */
function paymentLabel(payment: NonNullable<BuyerOrderRecord['paymentMethod']>): string {
  return payment === 'e_wallet' ? 'E-wallet' : 'Cash at pickup';
}

/** Every order is picked up at the farm by the buyer -- shows payment method and phone. */
function FulfillmentDetails({ order }: { order: BuyerOrderRecord }) {
  if (!order.buyerPhone && !order.paymentMethod) return null;
  return (
    <div className="rounded-lg bg-muted/40 border border-border/50 px-3 py-2 space-y-1">
      <p className="text-xs font-bold flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /> Pick up at the farm (buyer collects it)</p>
      {order.paymentMethod ? (
        <p className="text-xs font-semibold flex items-center gap-1.5">
          {order.paymentMethod === 'e_wallet' ? <Wallet className="w-3.5 h-3.5" /> : <Banknote className="w-3.5 h-3.5" />}
          Payment: {paymentLabel(order.paymentMethod)}
          {order.paymentMethod === 'e_wallet' ? <span className="font-normal text-muted-foreground"> — send them your e-wallet details</span> : null}
        </p>
      ) : null}
      {order.buyerPhone ? (
        <p className="text-xs flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5" />
          <a href={`tel:${order.buyerPhone}`} className="underline">{order.buyerPhone}</a>
        </p>
      ) : null}
    </div>
  );
}

function emptyListingForm() {
  return { name: '', category: 'Green Beans', unit: 'kg', pricePerUnit: '', availableQty: '', sourceHarvestId: '' };
}

function listingToForm(l: ProductListingRecord) {
  return {
    name: l.name,
    category: l.category,
    unit: l.unit,
    pricePerUnit: String(l.pricePerUnit),
    availableQty: String(l.availableQty),
    sourceHarvestId: l.sourceHarvestId ?? '',
  };
}

function harvestKey(h: { harvestId?: string; batchId: string }) {
  return h.harvestId ?? h.batchId;
}

/**
 * Admin side of the Buyer storefront: manage what's listed for sale, and review/fulfill orders
 * Buyers place. Fulfilling an order is the only moment inventory (availableQty) moves and a
 * SaleRecord is created -- placing an order never touches inventory, matching the Phase 3 design
 * decision (admin-fulfillment triggers the decrement, not order placement).
 */
export function BuyerOrdersManagement() {
  const { state, updateState, saving } = useFarmData();
  const listings = state.productListings ?? [];
  const { reserved } = useStockHolds();
  const harvests = state.cherryHarvests ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyListingForm());
  const [orders, setOrders] = useState<BuyerOrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.BUYER_ORDERS));
      const all = snap.docs.map((d) => ({ orderId: d.id, ...(d.data() as Omit<BuyerOrderRecord, 'orderId'>) }));
      all.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      setOrders(all);
    } catch {
      setActionError('Could not load buyer orders. Confirm firestore.rules has been published.');
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const pendingOrders = useMemo(() => orders.filter((o) => o.status === 'pending'), [orders]);
  const readyOrders = useMemo(() => orders.filter((o) => o.status === 'ready'), [orders]);
  const pastOrders = useMemo(() => orders.filter((o) => o.status === 'fulfilled' || o.status === 'cancelled'), [orders]);

  /** Admin approves the order: the buyer is told "Product is ready to pick up". */
  const approveOrder = async (order: BuyerOrderRecord) => {
    setActionError(null);
    try {
      await updateDoc(doc(db, COLLECTIONS.BUYER_ORDERS, order.orderId), {
        status: 'ready',
        readyAt: new Date().toISOString(),
      });
      void loadOrders();
    } catch {
      setActionError('Could not approve this order. Please try again.');
    }
  };

  const openAddListing = () => {
    setEditingListingId(null);
    setForm(emptyListingForm());
    setFormOpen(true);
  };

  const openEditListing = (l: ProductListingRecord) => {
    setEditingListingId(l.listingId);
    setForm(listingToForm(l));
    setFormOpen(true);
  };

  const closeListingForm = () => {
    setFormOpen(false);
    setEditingListingId(null);
    setForm(emptyListingForm());
  };

  const saveListing = async () => {
    const name = form.name.trim();
    const price = Number(form.pricePerUnit);
    const qty = Number(form.availableQty);
    if (!name || !Number.isFinite(price) || price <= 0 || !Number.isFinite(qty) || qty < 0) {
      showSaveError('Enter a name, a price greater than 0, and a valid quantity.');
      return;
    }
    const sourceHarvest = form.sourceHarvestId ? harvests.find((h) => harvestKey(h) === form.sourceHarvestId) : undefined;
    const sourceHarvestFields = sourceHarvest
      ? {
          sourceHarvestId: harvestKey(sourceHarvest),
          sourceHarvestWorkerName: sourceHarvest.pickerWorkerName ?? undefined,
          sourceHarvestWeightText: sourceHarvest.weightText,
          sourceHarvestDate: sourceHarvest.date ?? undefined,
        }
      : {};
    const ok = await runSave('Product listing', () =>
      updateState((prev) => {
        if (editingListingId) {
          return {
            ...prev,
            productListings: (prev.productListings ?? []).map((l) =>
              l.listingId === editingListingId
                ? {
                    ...l,
                    name,
                    category: form.category,
                    unit: form.unit,
                    pricePerUnit: price,
                    availableQty: Math.round(qty),
                    status: qty > 0 ? 'Available' : 'Out of Stock',
                    ...sourceHarvestFields,
                  }
                : l,
            ),
          };
        }
        const record: ProductListingRecord = {
          listingId: `L-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          name,
          category: form.category,
          unit: form.unit,
          pricePerUnit: price,
          availableQty: Math.round(qty),
          status: qty > 0 ? 'Available' : 'Out of Stock',
          createdAt: new Date().toISOString().slice(0, 10),
          ...sourceHarvestFields,
        };
        return { ...prev, productListings: [...(prev.productListings ?? []), record] };
      }),
    );
    if (!ok) return;
    closeListingForm();
  };

  const deleteListing = async (listingId: string) => {
    if (!window.confirm('Remove this listing from the storefront?')) return;
    const ok = await runSave('Product listing', () =>
      updateState((prev) => ({
        ...prev,
        productListings: (prev.productListings ?? []).filter((l) => l.listingId !== listingId),
      })),
    );
    if (!ok) showSaveError('Could not remove listing.');
  };

  /** Deletes the order's stock hold (a no-op for orders placed before holds existed). */
  const releaseHold = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.STOCK_HOLDS, orderId));
    } catch {
      setActionError('The order was updated, but its stock reservation could not be released. Refresh and try again.');
    }
  };

  const fulfillOrder = async (order: BuyerOrderRecord) => {
    setActionError(null);
    // 1. Decrement inventory for each line item (skip listings that no longer exist).
    const ok = await runSave('Buyer order', () =>
      updateState((prev) => {
        const productListings = (prev.productListings ?? []).map((l) => {
          const line = order.items.find((it) => it.listingId === l.listingId);
          if (!line) return l;
          const newQty = Math.max(0, l.availableQty - line.quantity);
          return { ...l, availableQty: newQty, status: computeSupplyStatus(newQty, l.availableQty || newQty || 1) };
        });
        const sale: SaleRecord = {
          buyer: order.buyerName,
          details: `Buyer storefront order: ${order.items.map((it) => `${it.name} x${it.quantity}${it.unit}`).join(', ')}`,
          date: new Date().toISOString().slice(0, 10),
          total: order.totalAmount,
          type: 'Buyer Storefront Order',
          saleId: `S-${order.orderId.slice(0, 8).toUpperCase()}`,
          // Without these, this sale doesn't count toward the buyer's totals on the admin
          // Buyer Locations Map, which only attributes a sale to a buyer via buyerUid.
          buyerUid: order.buyerUid,
          buyerEmail: order.buyerEmail,
        };
        return { ...prev, productListings, sales: [...prev.sales, sale] };
      }),
    );
    if (!ok) {
      showSaveError('Could not update inventory for this order.');
      return;
    }
    // 2. Mark the order doc fulfilled (outside the AppState blob -- its own collection).
    try {
      await updateDoc(doc(db, COLLECTIONS.BUYER_ORDERS, order.orderId), {
        status: 'fulfilled',
        fulfilledAt: new Date().toISOString(),
      });
      void loadOrders();
    } catch {
      setActionError('Inventory and sale were recorded, but the order status could not be updated. Refresh to check.');
      return;
    }
    // The stock itself was just deducted, so release the reservation or it would be counted twice.
    await releaseHold(order.orderId);
  };

  const cancelOrder = async (order: BuyerOrderRecord) => {
    if (!window.confirm('Cancel this order? Inventory will not be affected.')) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.BUYER_ORDERS, order.orderId), {
        status: 'cancelled',
        fulfilledAt: null,
      });
      void loadOrders();
    } catch {
      setActionError('Could not cancel this order.');
      return;
    }
    // Cancelling gives the reserved stock back to buyers.
    await releaseHold(order.orderId);
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
    if (status === 'ready') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 uppercase">
          <Store className="w-3 h-3" /> Ready for Pickup
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 uppercase">
        <Clock className="w-3 h-3" /> Pending
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-heading mb-1">Buyers</h1>
        <p className="text-xs text-muted-foreground">Manage what's for sale and fulfill orders Buyers place.</p>
      </div>

      {actionError ? (
        <p className="text-xs font-medium text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">{actionError}</p>
      ) : null}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold flex items-center gap-2"><Package className="w-4 h-4" /> Product Listings</h2>
          <Button onClick={() => (formOpen ? closeListingForm() : openAddListing())} className="h-9 rounded-xl text-xs font-semibold cursor-pointer">
            <Plus className="w-4 h-4 mr-1" /> Add Listing
          </Button>
        </div>

        {formOpen ? (
          <Card className="mb-4">
            <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <p className="sm:col-span-2 text-sm font-bold">{editingListingId ? 'Edit Listing' : 'New Listing'}</p>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ripe Arabica Cherries" className="h-9 rounded-lg text-xs" />
              </div>
              <FixedSelect
                label="Category"
                value={form.category}
                options={LISTING_CATEGORIES}
                onChange={(v) => setForm({ ...form, category: v })}
              />
              <FixedSelect
                label="Unit"
                value={form.unit}
                options={LISTING_UNITS}
                onChange={(v) => setForm({ ...form, unit: v })}
              />
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Price per unit (₱)</Label>
                <Input type="number" min={0} value={form.pricePerUnit} onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })} placeholder="e.g. 120" className="h-9 rounded-lg text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Available quantity</Label>
                <Input type="number" min={0} value={form.availableQty} onChange={(e) => setForm({ ...form, availableQty: e.target.value })} placeholder="e.g. 50" className="h-9 rounded-lg text-xs" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Sourced from harvest (optional)</Label>
                <select
                  value={form.sourceHarvestId}
                  onChange={(e) => setForm({ ...form, sourceHarvestId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-border/80 bg-background/80 px-3 py-1 text-sm"
                >
                  <option value="">Not linked to a harvest</option>
                  {harvests.map((h) => (
                    <option key={harvestKey(h)} value={harvestKey(h)}>
                      {h.pickerWorkerName ?? 'Unknown picker'} · {h.weightText}{h.date ? ` · ${h.date}` : ''} ({harvestKey(h)})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Links this listing to the worker's harvest it came from, for traceability -- it does not affect available quantity.
                </p>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={closeListingForm} className="h-9 rounded-lg text-xs cursor-pointer">Cancel</Button>
                <Button onClick={() => void saveListing()} disabled={saving} className="h-9 rounded-lg text-xs font-semibold cursor-pointer">
                  {editingListingId ? 'Save Changes' : 'Save Listing'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {listings.length === 0 ? (
          <p className="text-xs text-muted-foreground">No listings yet — buyers won't see a storefront until you add one.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {listings.map((l) => (
              <Card key={l.listingId}>
                <CardContent className="pt-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{l.category} · {formatCurrency(l.pricePerUnit)}/{l.unit}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.availableQty} {l.unit} in stock
                      {(reserved[l.listingId] ?? 0) > 0
                        ? ` · ${reserved[l.listingId]} reserved by pending orders · ${Math.max(0, l.availableQty - reserved[l.listingId])} still orderable`
                        : ''}
                    </p>
                    {l.sourceHarvestId ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        <Sprout className="w-3 h-3" />
                        Harvested by {l.sourceHarvestWorkerName ?? 'unknown worker'} · {l.sourceHarvestWeightText}
                        {l.sourceHarvestDate ? ` · ${l.sourceHarvestDate}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      aria-label={`Edit ${l.name}`}
                      onClick={() => openEditListing(l)}
                      className="w-8 h-8 rounded-lg bg-background/80 border border-border/70 hover:bg-[#4a2c2a] hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${l.name}`}
                      onClick={() => void deleteListing(l.listingId)}
                      className="w-8 h-8 rounded-lg bg-background/80 border border-border/70 hover:bg-rose-500 hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
          <ShoppingBag className="w-4 h-4" /> Pending Orders {pendingOrders.length > 0 ? `(${pendingOrders.length})` : ''}
        </h2>
        {ordersLoading ? (
          <p className="text-xs text-muted-foreground">Loading orders…</p>
        ) : pendingOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground">No pending orders right now.</p>
        ) : (
          <div className="space-y-3">
            {pendingOrders.map((o) => (
              <Card key={o.orderId} id={`order-${o.orderId}`}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">{o.buyerName}</p>
                      <p className="text-xs text-muted-foreground">{o.buyerEmail}</p>
                    </div>
                    {statusBadge(o.status)}
                  </div>
                  <FulfillmentDetails order={o} />
                  {o.items.map((it, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{it.name} × {it.quantity} {it.unit} — {formatCurrency(it.subtotal)}</p>
                  ))}
                  <p className="text-sm font-bold">{formatCurrency(o.totalAmount)}</p>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={() => void approveOrder(o)} className="h-9 rounded-lg text-xs font-semibold cursor-pointer">Approve — Ready for Pickup</Button>
                    <Button variant="outline" onClick={() => void cancelOrder(o)} className="h-9 rounded-lg text-xs cursor-pointer">Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Store className="w-4 h-4" /> Ready for Pickup {readyOrders.length > 0 ? `(${readyOrders.length})` : ''}
        </h2>
        {ordersLoading ? (
          <p className="text-xs text-muted-foreground">Loading orders…</p>
        ) : readyOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground">No orders waiting for pickup right now.</p>
        ) : (
          <div className="space-y-3">
            {readyOrders.map((o) => (
              <Card key={o.orderId} id={`order-${o.orderId}`}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">{o.buyerName}</p>
                      <p className="text-xs text-muted-foreground">{o.buyerEmail}</p>
                    </div>
                    {statusBadge(o.status)}
                  </div>
                  <FulfillmentDetails order={o} />
                  {o.items.map((it, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{it.name} × {it.quantity} {it.unit} — {formatCurrency(it.subtotal)}</p>
                  ))}
                  <p className="text-sm font-bold">{formatCurrency(o.totalAmount)}</p>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={() => void fulfillOrder(o)} className="h-9 rounded-lg text-xs font-semibold cursor-pointer">Mark Picked Up</Button>
                    <Button variant="outline" onClick={() => void cancelOrder(o)} className="h-9 rounded-lg text-xs cursor-pointer">Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {pastOrders.length > 0 ? (
        <section>
          <h2 className="text-sm font-bold mb-3">Order History</h2>
          <div className="space-y-2">
            {pastOrders.map((o) => (
              <div key={o.orderId} className="text-xs bg-muted/30 rounded-lg px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span>{o.buyerName} — {formatCurrency(o.totalAmount)} · Pick up</span>
                  {statusBadge(o.status)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
