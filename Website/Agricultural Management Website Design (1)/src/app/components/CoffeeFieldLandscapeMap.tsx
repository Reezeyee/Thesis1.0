import { useState, useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { CoffeeFieldRecord } from '../types/appState';
import { Layers, MapPin, Trees } from 'lucide-react';

interface CoffeeFieldLandscapeMapProps {
  selectedLat?: number;
  selectedLng?: number;
  onSelectLocation?: (lat: number, lng: number) => void;
  existingFields?: CoffeeFieldRecord[];
}

/** Pre-set default landscape coordinates for Bataan Coffee Fields (KML location: 14.5394408, 120.5763727). */
const DEFAULT_CENTER: [number, number] = [14.5394408, 120.5763727];

/** Map Tile Providers */
const MAP_LAYERS = {
  satellite: {
    name: 'Satellite Landscape',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
    maxZoom: 18,
  },
  topo: {
    name: 'Topographic Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
  },
  street: {
    name: 'Standard Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
};

/** Dynamic green coffee plot pin icon */
const FIELD_DIV_ICON = L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:#2d5016;border:2px solid #ffffff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:16px;line-height:1;color:#ffffff">🌱</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

/** Dynamic new selected location pin icon */
const SELECTED_DIV_ICON = L.divIcon({
  className: '',
  html: `<div style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:#d4183d;border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 3px 10px rgba(212,24,61,0.5);font-size:18px;line-height:1;color:#ffffff">📍</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function MapClickHandler({ onSelect }: { onSelect?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onSelect) {
        onSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function InvalidateSizeOnLoad() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export function CoffeeFieldLandscapeMap({
  selectedLat,
  selectedLng,
  onSelectLocation,
  existingFields = [],
}: CoffeeFieldLandscapeMapProps) {
  const [activeLayer, setActiveLayer] = useState<'satellite' | 'topo' | 'street'>('street');

  const center: [number, number] = useMemo(() => {
    if (selectedLat && selectedLng) return [selectedLat, selectedLng];
    const firstWithCoords = existingFields.find((f) => f.lat && f.lng);
    if (firstWithCoords && firstWithCoords.lat && firstWithCoords.lng) {
      return [firstWithCoords.lat, firstWithCoords.lng];
    }
    return DEFAULT_CENTER;
  }, [selectedLat, selectedLng, existingFields]);

  const layerConfig = MAP_LAYERS[activeLayer];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[#3e2723]">
        <div className="flex items-center gap-1.5 font-medium">
          <Trees className="w-4 h-4 text-[#2d5016]" />
          <span>Coffee Field Plantation Landscape</span>
        </div>
        {/* Layer Switcher */}
        <div className="flex items-center gap-1 bg-[#f5f1ed] p-1 rounded-lg border border-[#4a2c2a]/15">
          <Layers className="w-3.5 h-3.5 text-muted-foreground ml-1 mr-0.5" />
          <button
            type="button"
            onClick={() => setActiveLayer('satellite')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
              activeLayer === 'satellite'
                ? 'bg-[#2d5016] text-white shadow-xs'
                : 'text-[#3e2723] hover:bg-black/5'
            }`}
          >
            🛰️ Satellite
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('topo')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
              activeLayer === 'topo'
                ? 'bg-[#2d5016] text-white shadow-xs'
                : 'text-[#3e2723] hover:bg-black/5'
            }`}
          >
            ⛰️ Terrain
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('street')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
              activeLayer === 'street'
                ? 'bg-[#2d5016] text-white shadow-xs'
                : 'text-[#3e2723] hover:bg-black/5'
            }`}
          >
            🗺️ Street
          </button>
        </div>
      </div>

      <div className="relative h-[260px] w-full overflow-hidden rounded-xl border border-[#4a2c2a]/20 bg-[#e4e8ec] shadow-inner [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:rounded-xl">
        <MapContainer
          center={center}
          zoom={13}
          minZoom={6}
          maxZoom={18}
          scrollWheelZoom
          className="z-0"
        >
          <InvalidateSizeOnLoad />
          <TileLayer
            key={activeLayer}
            url={layerConfig.url}
            attribution={layerConfig.attribution}
            maxZoom={layerConfig.maxZoom}
          />
          <ZoomControl position="topleft" />
          <MapClickHandler onSelect={onSelectLocation} />

          {/* Render Existing Coffee Fields */}
          {existingFields.map((field, idx) => {
            if (!field.lat || !field.lng) {
              const baseLat = DEFAULT_CENTER[0] + (idx % 3) * 0.008 - 0.004;
              const baseLng = DEFAULT_CENTER[1] + Math.floor(idx / 3) * 0.008 - 0.004;
              return (
                <Marker key={field.fieldId || field.name} position={[baseLat, baseLng]} icon={FIELD_DIV_ICON}>
                  <Popup className="font-sans text-xs">
                    <div className="p-1 space-y-1">
                      <p className="font-bold text-[#2d5016]">{field.name}</p>
                      <p><span className="text-muted-foreground">Area:</span> {field.area || '—'}</p>
                      <p><span className="text-muted-foreground">Trees:</span> {field.trees} trees</p>
                      <p><span className="text-muted-foreground">Variety:</span> {field.variety || '—'}</p>
                      <p><span className="text-muted-foreground">Status:</span> <span className="capitalize font-medium">{field.status}</span></p>
                    </div>
                  </Popup>
                </Marker>
              );
            }
            return (
              <Marker key={field.fieldId || field.name} position={[field.lat, field.lng]} icon={FIELD_DIV_ICON}>
                <Popup className="font-sans text-xs">
                  <div className="p-1 space-y-1">
                    <p className="font-bold text-[#2d5016]">{field.name}</p>
                    <p><span className="text-muted-foreground">Area:</span> {field.area || '—'}</p>
                    <p><span className="text-muted-foreground">Trees:</span> {field.trees} trees</p>
                    <p><span className="text-muted-foreground">Variety:</span> {field.variety || '—'}</p>
                    <p><span className="text-muted-foreground">Status:</span> <span className="capitalize font-medium">{field.status}</span></p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Selected Pin for new field */}
          {selectedLat && selectedLng ? (
            <Marker position={[selectedLat, selectedLng]} icon={SELECTED_DIV_ICON}>
              <Popup className="font-sans text-xs">
                <div className="p-1">
                  <p className="font-bold text-[#d4183d]">📍 Selected New Field Pin</p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedLat.toFixed(5)}, {selectedLng.toFixed(5)}
                  </p>
                </div>
              </Popup>
            </Marker>
          ) : null}
        </MapContainer>

        <div className="absolute bottom-2 left-2 z-10 bg-black/70 backdrop-blur-xs text-white text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md">
          <MapPin className="w-3 h-3 text-[#7cfc00]" />
          <span>Click anywhere on map to pin plot location</span>
        </div>
      </div>
    </div>
  );
}
