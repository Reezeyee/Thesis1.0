import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { BATAAN_BBOX, BATAAN_MAP_HUBS, BATAAN_REAL_CAFE_MARKERS } from '../data/bataanProvinceMap';
import { formatCurrency } from '../lib/currencyFormat';

/** Café pins driven by buyer state (synced with OSM nodes). */
export interface CafeMapMarker {
  osmNodeId: number;
  lat: number;
  lng: number;
  name: string;
  municipality: string;
  addressLine?: string;
  salesVolumePeso?: number;
  status: 'active' | 'inactive';
}

/** Additional buyers with coordinates (wholesale / depot / custom). */
export interface CustomBuyerMapMarker {
  id: number;
  lat: number;
  lng: number;
  name: string;
  salesVolumePeso?: number;
  status: 'active' | 'inactive';
}

/** Compact ☕ pin at exact coordinates (size does not imply an area on the map). */
const CAFE_DIV_ICON = L.divIcon({
  className: '',
  html: `<div aria-hidden="true" style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:#fefdfb;border:2px solid #5c4033;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.2);font-size:13px;line-height:1">☕</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function MapTabIndex() {
  const map = useMap();
  useEffect(() => {
    map.getContainer().setAttribute('tabindex', '0');
    map.getContainer().setAttribute('role', 'application');
    map.getContainer().setAttribute(
      'aria-label',
      'Interactive map of Bataan. Drag to pan, scroll or pinch to zoom, use plus and minus keys while focused.'
    );
  }, [map]);
  return null;
}

function FitBataanBounds() {
  const map = useMap();
  useEffect(() => {
    const b = BATAAN_BBOX;
    const bounds = L.latLngBounds(L.latLng(b.minLat, b.minLng), L.latLng(b.maxLat, b.maxLng));
    const id = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
    }, 0);
    return () => clearTimeout(id);
  }, [map]);
  return null;
}

export interface BataanCoffeeLeafletMapProps {
  hubStatuses: Array<{ status: 'active' | 'inactive' }>;
  /** Sidebar-style labels (matches buyers list), same order as `BATAAN_MAP_HUBS`. */
  hubDisplayNames?: string[];
  /** Optional per-hub illustrative volume (₱); defaults to static hub volume when omitted. */
  hubVolumes?: number[];
  /**
   * When provided, café markers and popups use this list (e.g. merged with buyer volumes).
   * When omitted, falls back to static `BATAAN_REAL_CAFE_MARKERS`.
   */
  cafeMarkers?: CafeMapMarker[];
  /** Extra buyer locations (custom rows with lat/lng). */
  customBuyerMarkers?: CustomBuyerMapMarker[];
}

export function BataanCoffeeLeafletMap({
  hubStatuses,
  hubDisplayNames,
  hubVolumes,
  cafeMarkers,
  customBuyerMarkers,
}: BataanCoffeeLeafletMapProps) {
  const center = useMemo(
    (): [number, number] => [
      (BATAAN_BBOX.minLat + BATAAN_BBOX.maxLat) / 2,
      (BATAAN_BBOX.minLng + BATAAN_BBOX.maxLng) / 2,
    ],
    []
  );

  return (
    <div className="space-y-2">
      <div className="relative h-[min(480px,70vh)] w-full min-h-[340px] overflow-hidden rounded-xl border border-[#4a2c2a]/20 bg-[#e8f4e8]/30 shadow-sm [&_.leaflet-container]:outline-none [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:rounded-xl [&_.leaflet-container]:cursor-grab [&_.leaflet-container]:active:cursor-grabbing [&_.leaflet-container]:touch-auto [&_.leaflet-container]:font-sans [&_.leaflet-control-zoom]:border-[#4a2c2a]/20">
        <MapContainer
          center={center}
          zoom={10}
          minZoom={7}
          maxZoom={19}
          scrollWheelZoom
          doubleClickZoom
          dragging
          trackResize
          boxZoom={false}
          fadeAnimation
          keyboard
          inertia
          preferCanvas={false}
          className="isolate z-0 outline-none ring-0"
          style={{ height: '100%', width: '100%' }}
          attributionControl
        >
          <FitBataanBounds />
          <MapTabIndex />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <ZoomControl position="topleft" />

          {BATAAN_MAP_HUBS.map((hub, idx) => {
            const inactive = hubStatuses[idx]?.status === 'inactive';
            /** Fixed-size dots: volume is only in the popup (large circles looked like “wrong areas” / water). */
            const isHq = idx === 0;
            const r = inactive ? 4 : isHq ? 6 : 5;
            const title = hubDisplayNames?.[idx] ?? hub.name;
            return (
              <CircleMarker
                key={`${hub.municipality}-${hub.name}`}
                center={[hub.lat, hub.lng]}
                radius={r}
                pathOptions={{
                  color: hub.color,
                  fillColor: hub.color,
                  weight: isHq ? 2.5 : 2,
                  fillOpacity: inactive ? 0.35 : 0.88,
                  opacity: inactive ? 0.65 : 1,
                }}
              >
                <Popup>
                  <div className="min-w-[200px] max-w-[260px]">
                    <p className="text-sm font-semibold text-[#3e2723]">☕ Coffee channel</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Pin: {hub.municipality} municipal center (OpenStreetMap / Nominatim). Example site only.
                    </p>
                    <p className="text-sm font-medium leading-snug">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {hub.municipality}, Bataan
                    </p>
                    <p className="mt-1 text-xs leading-snug text-[#5d4037]">{hub.role}</p>
                    <p className="mt-1.5 text-xs tabular-nums text-[#2d5016]">
                      Illustrative volume:{' '}
                      {formatCurrency(hubVolumes?.[idx] ?? hub.volumePeso)}
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {(cafeMarkers ??
            BATAAN_REAL_CAFE_MARKERS.map((cafe) => ({
              osmNodeId: cafe.osmNodeId,
              lat: cafe.lat,
              lng: cafe.lng,
              name: cafe.name,
              municipality: cafe.municipality,
              addressLine: cafe.addressLine,
              status: 'active' as const,
            }))).map((cafe) => {
            const osmUrl = `https://www.openstreetmap.org/node/${cafe.osmNodeId}`;
            const vol = 'salesVolumePeso' in cafe ? cafe.salesVolumePeso : undefined;
            return (
              <Marker
                key={`osm-cafe-${cafe.osmNodeId}`}
                position={[cafe.lat, cafe.lng]}
                icon={CAFE_DIV_ICON}
                zIndexOffset={600}
                opacity={cafe.status === 'inactive' ? 0.55 : 1}
              >
                <Popup>
                  <div className="min-w-[190px] max-w-[280px]">
                    <p className="text-sm font-semibold text-[#5c4033]">☕ Café (OSM)</p>
                    <p className="text-sm font-medium leading-snug">{cafe.name}</p>
                    {cafe.addressLine ? (
                      <p className="text-xs font-medium text-[#5d4037] mt-1">{cafe.addressLine}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-1">{cafe.municipality}, Bataan</p>
                    {vol != null && vol > 0 ? (
                      <p className="mt-1.5 text-xs tabular-nums text-[#2d5016]">Tracked volume: {formatCurrency(vol)}</p>
                    ) : null}
                    <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
                      Coordinates from OpenStreetMap <code className="text-[10px]">amenity=cafe</code>; confirm locally.
                    </p>
                    <p className="mt-2 text-[11px]">
                      <a href={osmUrl} target="_blank" rel="noopener noreferrer" className="underline">
                        OSM node {cafe.osmNodeId}
                      </a>
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {(customBuyerMarkers ?? []).map((m) => (
            <CircleMarker
              key={`custom-buyer-${m.id}`}
              center={[m.lat, m.lng]}
              radius={m.status === 'inactive' ? 4 : 6}
              pathOptions={{
                color: '#5c4033',
                fillColor: '#c45c26',
                weight: 2,
                fillOpacity: m.status === 'inactive' ? 0.35 : 0.85,
                opacity: m.status === 'inactive' ? 0.65 : 1,
              }}
            >
              <Popup>
                <div className="min-w-[180px] max-w-[260px]">
                  <p className="text-sm font-semibold text-[#3e2723]">Buyer (custom)</p>
                  <p className="text-sm font-medium leading-snug">{m.name}</p>
                  {m.salesVolumePeso != null && m.salesVolumePeso > 0 ? (
                    <p className="mt-1.5 text-xs tabular-nums text-[#2d5016]">Volume: {formatCurrency(m.salesVolumePeso)}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                    Coordinates from your buyer record; adjust via Edit buyer if needed.
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2d5016]" aria-hidden /> Coop hubs (small dots at town centers)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-sm leading-none" aria-hidden>
                  ☕
                </span>
                {(cafeMarkers ?? BATAAN_REAL_CAFE_MARKERS).length} OSM-listed cafés
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#c45c26]" aria-hidden /> Other buyers (orange · Luzon coords; zoom out if not visible)
              </span>
              <span>Drag/slide map to pan · scroll or pinch zoom · +/- buttons · +/- keys while map is focused</span>
            </div>
    </div>
  );
}
