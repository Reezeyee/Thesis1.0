/**
 * Bataan (PH-BAN) schematic map for SVG.
 *
 * Bounding box from public province bounds (rounded); outline is simplified for web display (~15 vertices).
 * Coordinates lng/lat in WGS84; project with `bataanLngLatToSvg`.
 */
export const BATAAN_BBOX = {
  minLng: 120.238747,
  maxLng: 120.61042,
  minLat: 14.408722,
  maxLat: 14.922721,
} as const;

export const BATAAN_VIEWBOX = '0 0 100 101';

/** Simplified closed path in 0–100 SVG space (proportional to bbox above). */
export const BATAAN_PROVINCE_OUTLINE_PATH =
  'M 16.48,3.45 L 48.77,0.92 L 78.36,7.34 L 93.16,27.77 L 96.66,52.09 L 85.09,78.35 L 67.60,93.91 L 40.70,98.78 L 11.10,94.89 L 1.68,78.35 L 0.55,58.90 L 4.37,35.55 L 9.75,16.09 L 13.25,5.39 Z';

export function bataanLngLatToSvg(lng: number, lat: number): { x: number; y: number } {
  const { minLng, maxLng, minLat, maxLat } = BATAAN_BBOX;
  return {
    x: ((lng - minLng) / (maxLng - minLng)) * 100,
    y: ((maxLat - lat) / (maxLat - minLat)) * 100,
  };
}

export interface BataanMapHub {
  name: string;
  municipality: string;
  lng: number;
  lat: number;
  volumePeso: number;
  color: string;
  role: string;
}

/** Operational hubs — lng/lat are municipal town centroids from OpenStreetMap (Nominatim) so pins stay on land. Volume figures remain illustrative demo data. */
export const BATAAN_MAP_HUBS: BataanMapHub[] = [
  {
    name: 'Limay Farm HQ · Acojido Coffee Production Site',
    municipality: 'Limay',
    lng: 120.5949559,
    lat: 14.5625242,
    volumePeso: 198400,
    color: '#d4183d',
    role: 'Coffee production farm and system deployment site',
  },
  {
    name: 'Hermosa consolidation',
    municipality: 'Hermosa',
    lng: 120.5086406,
    lat: 14.8302478,
    volumePeso: 156200,
    color: '#2d5016',
    role: 'Cherry pooling & hauling',
  },
  {
    name: 'Mariveles port lane',
    municipality: 'Mariveles',
    lng: 120.4903355,
    lat: 14.4355997,
    volumePeso: 128650,
    color: '#4a2c2a',
    role: 'Outbound green / containers',
  },
  {
    name: 'Morong huller coop',
    municipality: 'Morong',
    lng: 120.2652634,
    lat: 14.6779981,
    volumePeso: 124500,
    color: '#8b6f47',
    role: 'Wet milling & hulling share',
  },
  {
    name: 'Bagac buyer pickup',
    municipality: 'Bagac',
    lng: 120.3923303,
    lat: 14.596782,
    volumePeso: 98650,
    color: '#2d5016',
    role: 'West coast parchment lift',
  },
  {
    name: 'Orion cold store',
    municipality: 'Orion',
    lng: 120.5772317,
    lat: 14.62157,
    volumePeso: 68300,
    color: '#d4a574',
    role: 'Storage & coop spot sales',
  },
];

/** Mapped `amenity=cafe` nodes in Bataan bbox (Philippines); coordinates from OSM contributors. Confirm hours before visiting. */
export interface BataanRealCafe {
  osmNodeId: number;
  name: string;
  lat: number;
  lng: number;
  municipality: string;
  addressLine?: string;
}

/**
 * Verified café locations sourced from OSM (`amenity=cafe`, bbox ~ Bataan peninsula).
 * Queried 2026-05 via Overpass; node IDs preserve deep links to OSM for checks/updates.
 */
export const BATAAN_REAL_CAFE_MARKERS: BataanRealCafe[] = [
  {
    osmNodeId: 10916179771,
    name: 'Kōhī Cafe',
    lat: 14.662415,
    lng: 120.5378692,
    municipality: 'Balanga City · San José',
    addressLine: '609 Maluya Road',
  },
  {
    osmNodeId: 1249361738,
    name: 'Starbucks · Balanga Capitol',
    lat: 14.6764698,
    lng: 120.5324859,
    municipality: 'Balanga City · Capitol vicinity',
  },
  {
    osmNodeId: 1485785198,
    name: 'The Beanery · Balanga',
    lat: 14.6761944,
    lng: 120.5313846,
    municipality: 'Balanga City',
    addressLine: 'Capitol Drive',
  },
  {
    osmNodeId: 4125082089,
    name: "Shaira's Cafe - Capitol",
    lat: 14.6773894,
    lng: 120.5374662,
    municipality: 'Balanga City · San José',
    addressLine: 'Capitol Drive · PC 2100',
  },
  {
    osmNodeId: 4782196526,
    name: 'Café Marivent',
    lat: 14.5997661,
    lng: 120.3855341,
    municipality: 'Bagac',
  },
  {
    osmNodeId: 2598598949,
    name: 'The Bean Box',
    lat: 14.8680845,
    lng: 120.4612228,
    municipality: 'Dinalupihan',
  },
  {
    osmNodeId: 4423144194,
    name: 'The Beanery · Dinalupihan',
    lat: 14.8595525,
    lng: 120.471113,
    municipality: 'Dinalupihan',
  },
  {
    osmNodeId: 2071510874,
    name: 'VSNRY Cafe',
    lat: 14.8378128,
    lng: 120.2816405,
    municipality: 'Morong (west Bataan corridor)',
    addressLine: "Listed in OSM with old_name: Daddy Ed's",
  },
  {
    osmNodeId: 4972909121,
    name: 'Bernarte Café',
    lat: 14.8361213,
    lng: 120.2820417,
    municipality: 'Morong (west Bataan corridor)',
  },
  {
    osmNodeId: 3413901180,
    name: 'Starbucks · Morong vicinity',
    lat: 14.8232181,
    lng: 120.2998515,
    municipality: 'Morong vicinity',
  },
  {
    osmNodeId: 2322134446,
    name: 'Ilanín Bay Café',
    lat: 14.7647341,
    lng: 120.2536332,
    municipality: 'Southwest Bataan (coastal)',
  },
  {
    osmNodeId: 4793359623,
    name: 'Meksi Coffee Shop',
    lat: 14.5273291,
    lng: 120.593989,
    municipality: 'Mariveles',
    addressLine: 'Roman Superhighway',
  },
  {
    osmNodeId: 4935283223,
    name: 'Cafe Carlos',
    lat: 14.5622122,
    lng: 120.595594,
    municipality: 'Mariveles',
  },
];
