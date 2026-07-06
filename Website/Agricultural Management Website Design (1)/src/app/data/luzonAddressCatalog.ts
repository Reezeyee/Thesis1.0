/**
 * Luzon-focused provinces (PSA groupings: NCR, CAR, Regions I–V, and MIMAROPA provinces
 * usually administered under Luzon). Used for buyer/outlet addressing beyond Bataan alone.
 *
 * City/municipality and barangay stay free-text in forms — only provinces are enumerated here.
 */

/** Approximate WGS84 envelope: Luzon landmass + Mindoro, Marinduque, Romblon, Catanduanes, Masbate, Palawan (wide south). */
export const LUZON_BBOX = {
  minLng: 116.95,
  maxLng: 124.75,
  minLat: 7.55,
  maxLat: 19.05,
} as const;

/** Sorted for dropdowns */
export const LUZON_PROVINCES = [
  'Abra',
  'Albay',
  'Apayao',
  'Aurora',
  'Bataan',
  'Batanes',
  'Batangas',
  'Benguet',
  'Bulacan',
  'Cagayan',
  'Camarines Norte',
  'Camarines Sur',
  'Catanduanes',
  'Cavite',
  'Ifugao',
  'Ilocos Norte',
  'Ilocos Sur',
  'Isabela',
  'Kalinga',
  'La Union',
  'Laguna',
  'Marinduque',
  'Masbate',
  'Metro Manila',
  'Mountain Province',
  'Nueva Ecija',
  'Nueva Vizcaya',
  'Occidental Mindoro',
  'Oriental Mindoro',
  'Palawan',
  'Pampanga',
  'Pangasinan',
  'Quezon',
  'Quirino',
  'Rizal',
  'Romblon',
  'Sorsogon',
  'Tarlac',
  'Zambales',
] as const;

export type LuzonProvince = (typeof LUZON_PROVINCES)[number];
