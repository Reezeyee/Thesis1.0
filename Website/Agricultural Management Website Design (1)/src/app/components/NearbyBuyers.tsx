import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, RefreshCw, Package, Navigation } from 'lucide-react';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { useFarmData } from '../store/FarmDataProvider';
import { Button } from './ui/button';
import { BATAAN_MAP_HUBS } from '../data/bataanProvinceMap';
import { distanceKm, formatDistanceKm } from '../lib/geo';
import { formatCurrency } from '../lib/currencyFormat';
import type { BuyerOrderRecord, SaleRecord } from '../types/appState';

/** The farm's own fixed coordinates (Limay Farm HQ hub), used as the "nearby" reference point for every distance shown on this page. */
const FARM_HQ = BATAAN_MAP_HUBS[0];
const FARM_CENTER: [number, number] = [FARM_HQ.lat, FARM_HQ.lng];

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

/**
 * Combines Buyer storefront orders with manually-recorded sales (Profit & Finance -> Add sale)
 * that were linked to a buyer account, so a buyer's total reflects every sale to them, not just
 * ones placed through their own storefront account.
 */
function statsFromOrdersAndSales(orders: BuyerOrderRecord[], sales: SaleRecord[]): Map<string, BuyerStats> {
  const byBuyer = new Map<string, BuyerStats>();
  const get = (uid: string) => byBuyer.get(uid) ?? { fulfilledCount: 0, fulfilledTotal: 0, pendingCount: 0 };
  for (const order of orders) {
    const uid = order.buyerUid;
    if (!uid) continue;
    const current = get(uid);
    if (order.status === 'fulfilled') {
      current.fulfilledCount += 1;
      current.fulfilledTotal += order.totalAmount ?? 0;
    } else if (order.status === 'pending') {
      current.pendingCount += 1;
    }
    byBuyer.set(uid, current);
  }
  for (const sale of sales) {
    const uid = sale.buyerUid;
    if (!uid) continue;
    const current = get(uid);
    current.fulfilledCount += 1;
    current.fulfilledTotal += sale.total ?? 0;
    byBuyer.set(uid, current);
  }
  return byBuyer;
}

const FARM_ICON = L.divIcon({
  className: '',
  html: `<div aria-hidden="true" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:#2d5016;border:3px solid #fefdfb;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const PIN_ICON = L.divIcon({
  className: '',
  html: `<div aria-hidden="true" style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:#4a2c2a;border:2px solid #fefdfb;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

const PIN_ICON_SELECTED = L.divIcon({
  className: '',
  html: `<div aria-hidden="true" style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:#d4a017;border:3px solid #fefdfb;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 0 0 6px rgba(212,160,23,0.35),0 2px 6px rgba(0,0,0,.4)"></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const id = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 13 });
    }, 0);
    return () => clearTimeout(id);
  }, [map, points]);
  return null;
}

function PanToSelected({ point }: { point: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    map.flyTo(point, Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [map, point]);
  return null;
}

/**
 * Admin-only "which registered buyers are closest to the farm" view: plots every self-registered
 * buyer's mandatory location (see BuyerAuthDialog / AuthProvider.signUpAsBuyer) alongside their
 * order/sales history, ranked by straight-line distance from the farm's own fixed coordinates
 * (Limay Farm HQ, see FARM_HQ above) so admin can prioritize outreach to the closest buyers for a
 * given batch.
 */
export function NearbyBuyers() {
  const { state } = useFarmData();
  const [buyers, setBuyers] = useState<BuyerProfile[]>([]);
  const [orders, setOrders] = useState<BuyerOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());

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
      setBuyers(rows);
      setOrders(ordersSnap.docs.map((d) => ({ orderId: d.id, ...(d.data() as Omit<BuyerOrderRecord, 'orderId'>) })));
    } catch {
      setLoadErrorMessage('Could not load buyer accounts. Confirm firestore.rules has been published.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBuyers();
  }, []);

  const statsByBuyer = useMemo(
    () => statsFromOrdersAndSales(orders, state.sales ?? []),
    [orders, state.sales],
  );

  const buyersWithLocation = useMemo(
    () =>
      buyers
        .filter((b) => typeof b.locationLat === 'number' && typeof b.locationLng === 'number')
        .map((b) => ({ ...b, distanceKm: distanceKm(FARM_HQ.lat, FARM_HQ.lng, b.locationLat!, b.locationLng!) }))
        .sort((a, b) => a.distanceKm - b.distanceKm),
    [buyers],
  );

  const points = useMemo<[number, number][]>(
    () => [FARM_CENTER, ...buyersWithLocation.map((b) => [b.locationLat!, b.locationLng!] as [number, number])],
    [buyersWithLocation],
  );

  const selectedPoint = useMemo<[number, number] | null>(() => {
    const buyer = buyersWithLocation.find((b) => b.uid === selectedUid);
    return buyer ? [buyer.locationLat!, buyer.locationLng!] : null;
  }, [buyersWithLocation, selectedUid]);

  const selectBuyer = (uid: string) => {
    setSelectedUid(uid);
    window.setTimeout(() => markerRefs.current.get(uid)?.openPopup(), 50);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {loading
            ? 'Loading buyer accounts…'
            : `${buyersWithLocation.length} of ${buyers.length} registered buyer${buyers.length === 1 ? '' : 's'} have a location set, ranked by distance from ${FARM_HQ.municipality}.`}
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
        <MapContainer center={FARM_CENTER} zoom={10} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToMarkers points={points} />
          <PanToSelected point={selectedPoint} />

          <Marker position={FARM_CENTER} icon={FARM_ICON} zIndexOffset={2000}>
            <Popup>
              <div className="min-w-[180px] space-y-1">
                <p className="text-sm font-semibold text-[#3e2723] flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5" /> {FARM_HQ.name}
                </p>
                <p className="text-xs text-muted-foreground">Distance reference point</p>
              </div>
            </Popup>
          </Marker>

          {buyersWithLocation.map((buyer) => {
            const stats = statsByBuyer.get(buyer.uid) ?? EMPTY_STATS;
            const isSelected = buyer.uid === selectedUid;
            return (
              <Marker
                key={buyer.uid}
                position={[buyer.locationLat!, buyer.locationLng!]}
                icon={isSelected ? PIN_ICON_SELECTED : PIN_ICON}
                zIndexOffset={isSelected ? 1000 : 0}
                ref={(instance) => {
                  if (instance) markerRefs.current.set(buyer.uid, instance);
                  else markerRefs.current.delete(buyer.uid);
                }}
                eventHandlers={{ click: () => setSelectedUid(buyer.uid) }}
              >
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
                    <p className="text-xs font-semibold text-[#2d5016]">{formatDistanceKm(buyer.distanceKm)} from farm</p>
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
        {buyersWithLocation.length === 0 && !loading ? (
          <p className="text-xs text-muted-foreground">No buyer accounts with a saved location yet.</p>
        ) : (
          buyersWithLocation.map((buyer, idx) => {
            const stats = statsByBuyer.get(buyer.uid) ?? EMPTY_STATS;
            const isSelected = buyer.uid === selectedUid;
            return (
              <button
                key={buyer.uid}
                type="button"
                onClick={() => selectBuyer(buyer.uid)}
                className={`w-full text-left rounded-lg p-3 border flex items-center gap-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/40'
                    : 'bg-muted/40 border-border/60 hover:border-border hover:bg-muted/60'
                }`}
              >
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#2d5016]/15 text-[#2d5016] text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{buyer.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{buyer.email}</p>
                  {buyer.locationAddress ? (
                    <p className="text-xs text-[#2d5016] max-w-[280px] truncate">{buyer.locationAddress}</p>
                  ) : null}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[#2d5016] tabular-nums">{formatDistanceKm(buyer.distanceKm)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(stats.fulfilledTotal)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
