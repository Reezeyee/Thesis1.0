import { LUZON_PROVINCES, type LuzonProvince } from '../data/luzonAddressCatalog';
import type { BuyerFulfillmentMethod, BuyerPaymentMethod } from '../types/appState';

/**
 * Delivery fees for Buyer Storefront orders. The farm is in Bataan, so the fee grows with how far
 * the buyer's province is from it (roughly by road distance / travel time); island provinces that
 * need a ferry or air freight are priced highest. Pickup at the farm is always free.
 *
 * These are flat, easy-to-explain amounts the farm can tune -- change the numbers below and every
 * screen (checkout, order summary, admin orders) follows.
 */
export type DeliveryZone = { id: string; label: string; fee: number; provinces: readonly LuzonProvince[] };

export const DELIVERY_ZONES: readonly DeliveryZone[] = [
  { id: 'z1', label: 'Bataan', fee: 60, provinces: ['Bataan'] },
  { id: 'z2', label: 'Nearby Central Luzon', fee: 100, provinces: ['Pampanga', 'Zambales'] },
  { id: 'z3', label: 'Greater Manila area', fee: 150, provinces: ['Bulacan', 'Tarlac', 'Metro Manila'] },
  { id: 'z4', label: 'Central & South Luzon', fee: 250, provinces: ['Nueva Ecija', 'Cavite', 'Laguna', 'Rizal', 'Pangasinan'] },
  { id: 'z5', label: 'Far South & North-Central Luzon', fee: 350, provinces: ['Batangas', 'Quezon', 'La Union', 'Benguet', 'Nueva Vizcaya', 'Aurora'] },
  { id: 'z6', label: 'Northern Luzon', fee: 450, provinces: ['Ilocos Sur', 'Abra', 'Mountain Province', 'Ifugao', 'Quirino', 'Isabela', 'Kalinga'] },
  { id: 'z7', label: 'Far North & Bicol', fee: 550, provinces: ['Ilocos Norte', 'Cagayan', 'Apayao', 'Camarines Norte', 'Camarines Sur', 'Albay', 'Sorsogon'] },
  { id: 'z8', label: 'Island provinces (ferry / air freight)', fee: 750, provinces: ['Marinduque', 'Romblon', 'Oriental Mindoro', 'Occidental Mindoro', 'Catanduanes', 'Masbate', 'Palawan', 'Batanes'] },
];

const FEE_BY_PROVINCE = new Map<string, number>(
  DELIVERY_ZONES.flatMap((z) => z.provinces.map((p) => [p, z.fee] as const)),
);

const MAX_FEE = Math.max(...DELIVERY_ZONES.map((z) => z.fee));

/**
 * Delivery fee in pesos for a province; 0 while none is chosen. A province the zones above don't
 * list (e.g. one added to the address catalog later) is charged the highest fee rather than
 * shipping free (tests check that every catalog province has a zone).
 */
export function deliveryFeeFor(province: string): number {
  if (!province) return 0;
  return FEE_BY_PROVINCE.get(province) ?? MAX_FEE;
}

// Metro Manila cities are written without the words "Metro Manila" in many addresses, and
// "Quezon City" must not be mistaken for Quezon province -- so these are matched first.
const METRO_MANILA_HINTS = [
  'metro manila', 'national capital region', 'quezon city', 'manila', 'makati', 'pasig', 'taguig',
  'mandaluyong', 'marikina', 'pasay', 'paranaque', 'parañaque', 'caloocan', 'las piñas', 'las pinas',
  'muntinlupa', 'valenzuela', 'malabon', 'navotas', 'pateros',
];

const PROVINCES_LONGEST_FIRST = [...LUZON_PROVINCES].sort((a, b) => b.length - a.length);

/** Best-effort guess of the province from a typed / map-picked address, used only to prefill. */
export function detectProvince(address: string): LuzonProvince | '' {
  const a = address.toLowerCase();
  if (!a.trim()) return '';
  if (METRO_MANILA_HINTS.some((h) => a.includes(h))) return 'Metro Manila';
  return PROVINCES_LONGEST_FIRST.find((p) => a.includes(p.toLowerCase())) ?? '';
}

/** "Cash on Delivery" / "Cash at pickup" / "E-wallet" -- cash means something different per method. */
export function paymentLabel(payment: BuyerPaymentMethod, method: BuyerFulfillmentMethod | undefined): string {
  if (payment === 'e_wallet') return 'E-wallet';
  return method === 'pickup' ? 'Cash at pickup' : 'Cash on Delivery';
}
