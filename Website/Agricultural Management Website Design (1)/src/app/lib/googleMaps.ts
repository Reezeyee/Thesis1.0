/** Shared Google Maps JS API config for the buyer location picker and admin buyer map. */

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

export const GOOGLE_MAPS_LIBRARIES: 'places'[] = ['places'];

export function hasGoogleMapsApiKey(): boolean {
  return GOOGLE_MAPS_API_KEY.trim().length > 0;
}

/** Bataan, Philippines -- default map center when no marker is set yet. */
export const DEFAULT_MAP_CENTER = { lat: 14.6417, lng: 120.4818 };
