import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, RefreshCw, Package } from 'lucide-react';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { Button } from './ui/button';
import { BATAAN_BBOX } from '../data/bataanProvinceMap';
import { formatCurrency } from '../lib/currencyFormat';
import type { BuyerOrderRecord } from '../types/appState';

type BuyerProfile = {
  uid: string;
  displayName: string;
  email: string;
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
};

type BuyerStats = {
  fulfilledCount: number;
  fulfilledTotal: number;
  pendingCount: number;
};

const EMPTY_STATS: BuyerStats = { fulfilledCount: 0, fulfilledTotal: 0, pendingCount: 0 };

function statsFromOrders(orders: BuyerOrderRecord[]): Map<string, BuyerStats> {
  const byBuyer = new Map<string, BuyerStats>();
  for (const order of orders) {
    const uid = order.buyerUid;
    if (!uid) continue;
    const current = byBuyer.get(uid) ?? { fulfilledCount: 0, fulfilledTotal: 0, pendingCount: 0 };
    if (order.status === 'fulfilled') {
      current.fulfilledCount += 1;
      current.fulfilledTotal += order.totalAmount ?? 0;
    } else if (order.status === 'pending') {
      current.pendingCount += 1;
    }
    byBuyer.set(uid, current);
  }
  return byBuyer;
}

const PIN_ICON = L.divIcon({
  className: '',
  html: `<div aria-hidden="true" style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:#2d5016;border:2px solid #fefdfb;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

const DEFAULT_CENTER: [number, number] = [
  (BATAAN_BBOX.minLat + BATAAN_BBOX.maxLat) / 2,
  (BATAAN_BBOX.minLng + BATAAN_BBOX.maxLng) / 2,
];

function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const id = window.setTimeout(() => {
      map.invalidateSize();
      if (points.length === 1) {
        map.setView(points[0], 14);
      } else {
        map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 13 });
      }
    }, 0);
    return () => clearTimeout(id);
  }, [map, points]);
  return null;
}

/**
 * Admin-only: plots every self-registered buyer's mandatory location (see BuyerAuthDialog /
 * AuthProvider.signUpAsBuyer) on a live Leaflet/OpenStreetMap map (no API key needed), replacing
 * the old static/hardcoded hub coordinates and the manual "Add buyer / channel" flow. Reads the
 * `users` collection filtered to role == 'BUYER' (allowed for the admin account by
 * firestore.rules) and cross-references `buyer_orders` for each buyer's order count and total
 * fulfilled purchase amount.
 */
export function BuyerLocationsMap() {
  const [buyers, setBuyers] = useState<BuyerProfile[]>([]);
  const [statsByBuyer, setStatsByBuyer] = useState<Map<string, BuyerStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

  const loadBuyers = async () => {
    setLoading(true);
    setLoadErrorMessage(null);
    try {
      const [buyersSnap, ordersSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.USERS), where('role', '==', 'BUYER'))),
        getDocs(collection(db, COLLECTIONS.BUYER_ORDERS)),
      ]);
      const rows = buyersSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          uid: d.id,
          displayName: (data.displayName as string) ?? 'Unnamed buyer',
          email: (data.email as string) ?? '',
          locationLat: typeof data.locationLat === 'number' ? data.locationLat : undefined,
          locationLng: typeof data.locationLng === 'number' ? data.locationLng : undefined,
          locationAddress: (data.locationAddress as string) ?? '',
        };
      });
      const orders = ordersSnap.docs.map(
        (d) => ({ orderId: d.id, ...(d.data() as Omit<BuyerOrderRecord, 'orderId'>) }),
      );
      setBuyers(rows);
      setStatsByBuyer(statsFromOrders(orders));
    } catch {
      setLoadErrorMessage('Could not load buyer accounts. Confirm firestore.rules has been published.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBuyers();
  }, []);

  const buyersWithLocation = useMemo(
    () => buyers.filter((b) => typeof b.locationLat === 'number' && typeof b.locationLng === 'number'),
    [buyers],
  );

  const points = useMemo<[number, number][]>(
    () => buyersWithLocation.map((b) => [b.locationLat!, b.locationLng!]),
    [buyersWithLocation],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {loading ? 'Loading buyer accounts…' : `${buyersWithLocation.length} of ${buyers.length} registered buyer${buyers.length === 1 ? '' : 's'} have a location set.`}
        </p>
        <Button variant="outline" size="sm" onClick={() => void loadBuyers()} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loadErrorMessage ? (
        <p className="text-xs font-medium text-rose-500 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
          {loadErrorMessage}
        </p>
      ) : null}

      <div className="relative h-[min(420px,65vh)] min-h-[300px] w-full overflow-hidden rounded-xl border border-border/60 [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full">
        <MapContainer center={DEFAULT_CENTER} zoom={9} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToMarkers points={points} />
          {buyersWithLocation.map((buyer) => {
            const stats = statsByBuyer.get(buyer.uid) ?? EMPTY_STATS;
            return (
              <Marker key={buyer.uid} position={[buyer.locationLat!, buyer.locationLng!]} icon={PIN_ICON}>
                <Popup>
                  <div className="min-w-[190px] max-w-[260px] space-y-1">
                    <p className="text-sm font-semibold text-[#3e2723]">{buyer.displayName}</p>
                    <p className="text-xs text-muted-foreground break-all">{buyer.email}</p>
                    {buyer.locationAddress ? (
                      <p className="text-xs text-[#5d4037] leading-snug flex items-start gap-1">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                        {buyer.locationAddress}
                      </p>
                    ) : null}
                    <p className="text-xs text-[#2d5016] flex items-start gap-1 pt-1 border-t border-black/10 mt-1">
                      <Package className="w-3 h-3 mt-0.5 shrink-0" />
                      {stats.fulfilledCount} order{stats.fulfilledCount === 1 ? '' : 's'} · {formatCurrency(stats.fulfilledTotal)}
                      {stats.pendingCount > 0 ? ` (${stats.pendingCount} pending)` : ''}
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div className="space-y-2">
        {buyers.length === 0 && !loading ? (
          <p className="text-xs text-muted-foreground">No buyer accounts have registered yet.</p>
        ) : (
          buyers.map((buyer) => {
            const stats = statsByBuyer.get(buyer.uid) ?? EMPTY_STATS;
            return (
              <div
                key={buyer.uid}
                className="rounded-lg bg-muted/40 p-3 border border-border/60 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{buyer.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{buyer.email}</p>
                  {buyer.locationAddress ? (
                    <p className="text-xs text-[#2d5016] max-w-[280px] truncate">{buyer.locationAddress}</p>
                  ) : (
                    <p className="text-xs text-amber-600">No location set</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-[#2d5016] tabular-nums">{formatCurrency(stats.fulfilledTotal)}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.fulfilledCount} order{stats.fulfilledCount === 1 ? '' : 's'}
                    {stats.pendingCount > 0 ? ` · ${stats.pendingCount} pending` : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
