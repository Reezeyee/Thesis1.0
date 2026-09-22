/** Admin-defined classification shown on each buyer record (Maintenance -> Buyer Records) and editable via BuyerRecordEditDialog. */
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
};
