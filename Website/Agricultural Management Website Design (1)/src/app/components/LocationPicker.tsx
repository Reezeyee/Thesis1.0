import { useCallback, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { BATAAN_BBOX, isWithinBataan } from '../data/bataanProvinceMap';

/** `pinned` is true only once the location came from an actual map pin (tap/drag), not from typing an address alone. */
export type PickedLocation = { lat: number; lng: number; address: string; pinned?: boolean };

const PIN_ICON = L.divIcon({
  className: '',
  html: `<div aria-hidden="true" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:#c45c26;border:2px solid #fefdfb;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const DEFAULT_CENTER: [number, number] = [
  (BATAAN_BBOX.minLat + BATAAN_BBOX.maxLat) / 2,
  (BATAAN_BBOX.minLng + BATAAN_BBOX.maxLng) / 2,
];

/** A little slack around the bbox so the map can still be panned right up to the province edge before maxBounds stops it; the actual pin-acceptance check is isWithinBataan's polygon test, not this rectangle. */
const BOUNDS_PADDING = 0.02;
const MAP_MAX_BOUNDS: L.LatLngBoundsExpression = [
  [BATAAN_BBOX.minLat - BOUNDS_PADDING, BATAAN_BBOX.minLng - BOUNDS_PADDING],
  [BATAAN_BBOX.maxLat + BOUNDS_PADDING, BATAAN_BBOX.maxLng + BOUNDS_PADDING],
];

/** Free OpenStreetMap Nominatim reverse geocode -- no API key required. */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
    );
    if (!res.ok) throw new Error('reverse geocode failed');
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

function ClickToPin({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Mandatory location picker used at buyer sign-up. A free Leaflet/OpenStreetMap map (no API key)
 * -- tap/click to drop a pin or drag the marker, with the address auto-filled via OSM Nominatim
 * reverse geocoding (editable by hand afterward).
 */
export function LocationPicker({
  value,
  onChange,
  id = 'buyer-location',
  label = 'Business / pickup location',
}: {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation) => void;
  id?: string;
  label?: string;
}) {
  const [resolving, setResolving] = useState(false);
  const [outOfBoundsError, setOutOfBoundsError] = useState<string | null>(null);

  const setPin = useCallback(
    async (lat: number, lng: number) => {
      if (!isWithinBataan(lat, lng)) {
        setOutOfBoundsError('That spot is outside Bataan. Pick a location inside the province.');
        return;
      }
      setOutOfBoundsError(null);
      setResolving(true);
      const address = await reverseGeocode(lat, lng);
      onChange({ lat, lng, address, pinned: true });
      setResolving(false);
    },
    [onChange],
  );

  const center: [number, number] = value ? [value.lat, value.lng] : DEFAULT_CENTER;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-address`} className="text-xs font-semibold">
        {label} <span className="text-destructive">*</span>
      </Label>
      <Input
        id={`${id}-address`}
        value={value?.address ?? ''}
        onChange={(e) => onChange({ lat: value?.lat ?? DEFAULT_CENTER[0], lng: value?.lng ?? DEFAULT_CENTER[1], address: e.target.value, pinned: value?.pinned ?? false })}
        placeholder="Tap the map below, then adjust the address if needed"
        className="h-10 rounded-xl text-xs"
      />
      <div className="relative h-[240px] w-full overflow-hidden rounded-xl border border-border/60 [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:cursor-crosshair">
        <MapContainer
          center={center}
          zoom={value ? 15 : 10}
          minZoom={9}
          maxBounds={MAP_MAX_BOUNDS}
          maxBoundsViscosity={1.0}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPin onPick={(lat, lng) => void setPin(lat, lng)} />
          {value ? (
            <Marker
              position={[value.lat, value.lng]}
              icon={PIN_ICON}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const pos = e.target.getLatLng();
                  void setPin(pos.lat, pos.lng);
                },
              }}
            />
          ) : null}
        </MapContainer>
      </div>
      {outOfBoundsError ? (
        <p className="text-[11px] text-rose-500 font-medium">{outOfBoundsError}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {resolving ? 'Looking up address…' : 'Tap the map to drop a pin, or drag it to adjust. Edit the address text above if needed. Must be within Bataan.'}
        </p>
      )}
    </div>
  );
}
