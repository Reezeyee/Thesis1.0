/** A buyer's own choice, made at sign-up (see BuyerAuthDialog), shown read-only on each buyer record in Maintenance -> Buyer Records. */
export const BUYER_TYPE_OPTIONS = [
  'Individual',
  'Café / Restaurant',
  'Retailer',
  'Wholesaler',
  'Roaster',
  'Exporter',
  'Other',
] as const;

export type BuyerRecord = {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
  buyerType?: string;
  photoBase64?: string | null;
  /** ISO-ish string from Firestore's serverTimestamp, already converted (see BuyerRecords.load). */
  createdAt?: string | null;
};
