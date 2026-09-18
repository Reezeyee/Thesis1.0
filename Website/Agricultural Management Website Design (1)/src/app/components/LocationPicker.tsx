import { useCallback, useRef, useState } from 'react';
import { GoogleMap, Marker, Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES, DEFAULT_MAP_CENTER, hasGoogleMapsApiKey } from '../lib/googleMaps';

export type PickedLocation = { lat: number; lng: number; address: string };

const MAP_CONTAINER_STYLE = { width: '100%', height: '260px', borderRadius: '0.75rem' };

/**
 * Mandatory location picker used at buyer sign-up. Backed by the Google Maps JS API (Places
 * Autocomplete + a draggable marker + click-to-drop-pin, with reverse geocoding for the address
 * text). Falls back to plain address/lat/lng text inputs when no VITE_GOOGLE_MAPS_API_KEY is
 * configured, so the mandatory-location requirement still works without the key.
 */
export function LocationPicker({
  value,
  onChange,
  id = 'buyer-location',
}: {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation) => void;
  id?: string;
}) {
  if (!hasGoogleMapsApiKey()) {
    return <ManualLocationFallback value={value} onChange={onChange} id={id} />;
  }
  return <GoogleLocationPicker value={value} onChange={onChange} id={id} />;
}

function ManualLocationFallback({
  value,
  onChange,
  id,
}: {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation) => void;
  id: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-address`} className="text-xs font-semibold">
        Business / pickup location <span className="text-destructive">*</span>
      </Label>
      <Input
        id={`${id}-address`}
        value={value?.address ?? ''}
        onChange={(e) => onChange({ lat: value?.lat ?? 0, lng: value?.lng ?? 0, address: e.target.value })}
        placeholder="Sample: Balanga City, Bataan"
        className="h-10 rounded-xl text-xs"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          id={`${id}-lat`}
          type="number"
          step="any"
          value={value?.lat ?? ''}
          onChange={(e) => onChange({ lat: Number(e.target.value) || 0, lng: value?.lng ?? 0, address: value?.address ?? '' })}
          placeholder="Latitude"
          className="h-9 rounded-xl text-xs"
        />
        <Input
          id={`${id}-lng`}
          type="number"
          step="any"
          value={value?.lng ?? ''}
          onChange={(e) => onChange({ lat: value?.lat ?? 0, lng: Number(e.target.value) || 0, address: value?.address ?? '' })}
          placeholder="Longitude"
          className="h-9 rounded-xl text-xs"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Map picker unavailable (no Google Maps API key configured) -- enter your location manually.
      </p>
    </div>
  );
}

function GoogleLocationPicker({
  value,
  onChange,
  id,
}: {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation) => void;
  id: string;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'acojido-google-maps-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [addressInput, setAddressInput] = useState(value?.address ?? '');

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      if (!geocoderRef.current) geocoderRef.current = new google.maps.Geocoder();
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        const address = status === 'OK' && results?.[0] ? results[0].formatted_address : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setAddressInput(address);
        onChange({ lat, lng, address });
      });
    },
    [onChange],
  );

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const lat = e.latLng?.lat();
      const lng = e.latLng?.lng();
      if (lat == null || lng == null) return;
      reverseGeocode(lat, lng);
    },
    [reverseGeocode],
  );

  const handleMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const lat = e.latLng?.lat();
      const lng = e.latLng?.lng();
      if (lat == null || lng == null) return;
      reverseGeocode(lat, lng);
    },
    [reverseGeocode],
  );

  const handlePlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    const loc = place?.geometry?.location;
    if (!loc) return;
    const address = place?.formatted_address ?? place?.name ?? `${loc.lat().toFixed(5)}, ${loc.lng().toFixed(5)}`;
    setAddressInput(address);
    onChange({ lat: loc.lat(), lng: loc.lng(), address });
  }, [onChange]);

  if (loadError) {
    return <ManualLocationFallback value={value} onChange={onChange} id={id} />;
  }

  if (!isLoaded) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">
          Business / pickup location <span className="text-destructive">*</span>
        </Label>
        <div className="h-[260px] w-full rounded-xl border border-border/60 bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
          Loading map…
        </div>
      </div>
    );
  }

  const center = value ? { lat: value.lat, lng: value.lng } : DEFAULT_MAP_CENTER;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-search`} className="text-xs font-semibold">
        Business / pickup location <span className="text-destructive">*</span>
      </Label>
      <Autocomplete
        onLoad={(ac) => { autocompleteRef.current = ac; }}
        onPlaceChanged={handlePlaceChanged}
      >
        <Input
          id={`${id}-search`}
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          placeholder="Search your address…"
          className="h-10 rounded-xl text-xs"
        />
      </Autocomplete>
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={center}
        zoom={value ? 15 : 10}
        onClick={handleMapClick}
        options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
      >
        {value ? (
          <Marker
            position={{ lat: value.lat, lng: value.lng }}
            draggable
            onDragEnd={handleMarkerDragEnd}
          />
        ) : null}
      </GoogleMap>
      <p className="text-[11px] text-muted-foreground">
        Search your address, or tap/drag the pin on the map to set your exact location.
      </p>
    </div>
  );
}
