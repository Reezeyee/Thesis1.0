import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from '@react-google-maps/api';
import { MapPin, RefreshCw } from 'lucide-react';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { Button } from './ui/button';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES, DEFAULT_MAP_CENTER, hasGoogleMapsApiKey } from '../lib/googleMaps';

type BuyerProfile = {
  uid: string;
  displayName: string;
  email: string;
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
};

const MAP_CONTAINER_STYLE = { width: '100%', height: 'min(480px, 70vh)', minHeight: '340px', borderRadius: '0.75rem' };

/**
 * Admin-only: plots every self-registered buyer's mandatory location (see BuyerAuthDialog /
 * AuthProvider.signUpAsBuyer) on a live Google Map, replacing the old static/hardcoded hub
 * coordinates. Reads the `users` collection filtered to role == 'BUYER' -- allowed for the
 * admin account by firestore.rules.
 */
export function BuyerLocationsMap() {
  const [buyers, setBuyers] = useState<BuyerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<BuyerProfile | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'acojido-google-maps-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const loadBuyers = async () => {
    setLoading(true);
    setLoadErrorMessage(null);
    try {
      const snap = await getDocs(query(collection(db, COLLECTIONS.USERS), where('role', '==', 'BUYER')));
      const rows = snap.docs.map((d) => {
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

  const center = buyersWithLocation[0]
    ? { lat: buyersWithLocation[0].locationLat!, lng: buyersWithLocation[0].locationLng! }
    : DEFAULT_MAP_CENTER;

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

      {!hasGoogleMapsApiKey() ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-400">
          Google Maps API key not configured (set <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code>). Showing the buyer
          list below without a map.
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400">
          Google Maps failed to load. Check that the API key is valid and the Maps JavaScript + Places APIs are enabled.
        </div>
      ) : !isLoaded ? (
        <div className="h-[340px] w-full rounded-xl border border-border/60 bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
          Loading map…
        </div>
      ) : (
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={center}
          zoom={buyersWithLocation.length > 0 ? 9 : 8}
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
        >
          {buyersWithLocation.map((buyer) => (
            <Marker
              key={buyer.uid}
              position={{ lat: buyer.locationLat!, lng: buyer.locationLng! }}
              onClick={() => setSelected(buyer)}
            />
          ))}
          {selected && selected.locationLat != null && selected.locationLng != null ? (
            <InfoWindow
              position={{ lat: selected.locationLat, lng: selected.locationLng }}
              onCloseClick={() => setSelected(null)}
            >
              <div className="min-w-[190px] max-w-[260px] space-y-1">
                <p className="text-sm font-semibold text-[#3e2723]">{selected.displayName}</p>
                <p className="text-xs text-muted-foreground break-all">{selected.email}</p>
                {selected.locationAddress ? (
                  <p className="text-xs text-[#5d4037] leading-snug flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                    {selected.locationAddress}
                  </p>
                ) : null}
              </div>
            </InfoWindow>
          ) : null}
        </GoogleMap>
      )}

      <div className="space-y-2">
        {buyers.length === 0 && !loading ? (
          <p className="text-xs text-muted-foreground">No buyer accounts have registered yet.</p>
        ) : (
          buyers.map((buyer) => (
            <div
              key={buyer.uid}
              className="rounded-lg bg-muted/40 p-3 border border-border/60 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{buyer.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{buyer.email}</p>
              </div>
              <div className="text-right shrink-0">
                {buyer.locationAddress ? (
                  <p className="text-xs text-[#2d5016] max-w-[220px] truncate">{buyer.locationAddress}</p>
                ) : (
                  <p className="text-xs text-amber-600">No location set</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
