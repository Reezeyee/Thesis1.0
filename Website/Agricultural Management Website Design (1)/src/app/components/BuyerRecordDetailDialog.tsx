import { useMemo } from 'react';
import { User as UserIcon, Phone, Mail, MapPin, Calendar, CheckCircle2, XCircle, Clock, Store } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { formatCurrency } from '../lib/currencyFormat';
import type { BuyerOrderRecord, SaleRecord } from '../types/appState';
import type { BuyerRecord } from '../lib/buyerRecord';

function statusBadge(status: BuyerOrderRecord['status']) {
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
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Read-only detail view for a single buyer record, opened by tapping their card in
 * Maintenance -> Buyer Records. Shows the full profile plus every order (not just the
 * aggregate count/total shown on the card) and any manually-recorded sales linked to the
 * account, so admin can see exactly what was bought and when.
 */
export function BuyerRecordDetailDialog({
  buyer,
  orders,
  sales,
  open,
  onOpenChange,
}: {
  buyer: BuyerRecord | null;
  orders: BuyerOrderRecord[];
  sales: SaleRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const buyerOrders = useMemo(
    () =>
      buyer
        ? orders
            .filter((o) => o.buyerUid === buyer.uid)
            .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        : [],
    [orders, buyer],
  );

  const buyerSales = useMemo(
    () =>
      buyer
        ? sales.filter((s) => s.buyerUid === buyer.uid).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
        : [],
    [sales, buyer],
  );

  if (!buyer) return null;

  const totalSpent =
    buyerOrders.filter((o) => o.status === 'fulfilled').reduce((sum, o) => sum + (o.totalAmount ?? 0), 0) +
    buyerSales.reduce((sum, s) => sum + (s.total ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buyer record</DialogTitle>
          <DialogDescription>Read-only. This is the buyer's own account -- only they can edit it.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={buyer.photoBase64 ?? undefined} alt={buyer.displayName} />
              <AvatarFallback>
                <UserIcon className="w-6 h-6 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-bold text-foreground truncate">{buyer.displayName}</p>
                {buyer.buyerType ? (
                  <Badge variant="secondary" className="text-[10px] font-semibold">{buyer.buyerType}</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground">Type not set</Badge>
                )}
              </div>
              {buyer.createdAt ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Registered {formatDate(buyer.createdAt)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-border/60 p-3 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
              <p className="flex items-center gap-1.5"><Mail className="w-3 h-3 shrink-0" /> {buyer.email}</p>
              <p className="flex items-center gap-1.5">
                <Phone className="w-3 h-3 shrink-0" />
                {buyer.phone ? buyer.phone : <span className="italic text-muted-foreground">No phone on record</span>}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-3 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Address</p>
              <p className="flex items-start gap-1.5">
                <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                {buyer.locationAddress ? buyer.locationAddress : <span className="italic text-muted-foreground">No address on record</span>}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 p-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total purchased (fulfilled)</span>
            <span className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(totalSpent)}</span>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Purchase history</p>
            {buyerOrders.length === 0 && buyerSales.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No orders or recorded sales yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {buyerOrders.map((order) => (
                  <div key={order.orderId} className="rounded-lg border border-border/50 p-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">{formatDate(order.createdAt) || 'Storefront order'}</span>
                      {statusBadge(order.status)}
                    </div>
                    <p className="text-xs text-foreground">
                      {order.items.map((i) => `${i.name} × ${i.quantity} ${i.unit}`).join(', ')}
                    </p>
                    <p className="text-xs font-semibold text-foreground tabular-nums">{formatCurrency(order.totalAmount)}</p>
                  </div>
                ))}
                {buyerSales.map((sale, idx) => (
                  <div key={sale.saleId ?? `sale-${idx}`} className="rounded-lg border border-border/50 p-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">{formatDate(sale.date) || 'Manual sale'}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 uppercase">
                        <CheckCircle2 className="w-3 h-3" /> Recorded sale
                      </span>
                    </div>
                    <p className="text-xs text-foreground">{sale.details || sale.type}</p>
                    <p className="text-xs font-semibold text-foreground tabular-nums">{formatCurrency(sale.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
