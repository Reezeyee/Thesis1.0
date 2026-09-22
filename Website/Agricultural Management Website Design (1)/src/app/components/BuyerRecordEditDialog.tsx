import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { FixedSelect } from './ui/FixedSelect';
import { LocationPicker, type PickedLocation } from './LocationPicker';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { isValidPersonName, NAME_ERROR_MESSAGE, sanitizeNameInput, normalizeName } from '../lib/personName';
import { isValidPhone11, PHONE_ERROR_MESSAGE, PHONE_PLACEHOLDER, sanitizePhoneInput } from '../lib/phone';
import { BUYER_TYPE_OPTIONS, type BuyerRecord } from '../lib/buyerRecord';

/**
 * Admin edit form for a single buyer record (Maintenance -> Buyer Records). Name/phone/type/
 * location are admin-editable here for record-keeping; email is read-only (it's tied to the
 * buyer's own Firebase Auth account -- see BuyerProfileDialog.changeEmail for how a buyer changes
 * it themselves, which this dialog must not bypass).
 */
export function BuyerRecordEditDialog({
  buyer,
  open,
  onOpenChange,
  onSaved,
}: {
  buyer: BuyerRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (uid: string, patch: Partial<BuyerRecord>) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [buyerType, setBuyerType] = useState<string>(BUYER_TYPE_OPTIONS[0]);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !buyer) return;
    setName(buyer.displayName);
    setPhone(sanitizePhoneInput(buyer.phone ?? ''));
    setBuyerType(buyer.buyerType || BUYER_TYPE_OPTIONS[0]);
    setLocation(
      typeof buyer.locationLat === 'number' && typeof buyer.locationLng === 'number'
        ? { lat: buyer.locationLat, lng: buyer.locationLng, address: buyer.locationAddress ?? '', pinned: true }
        : null,
    );
    setError(null);
  }, [open, buyer]);

  const handleSave = async () => {
    if (!buyer) return;
    const trimmedName = normalizeName(name);
    if (!isValidPersonName(trimmedName)) {
      setError(NAME_ERROR_MESSAGE);
      return;
    }
    if (phone !== '' && !isValidPhone11(phone)) {
      setError(PHONE_ERROR_MESSAGE);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const patch: Partial<BuyerRecord> = {
        displayName: trimmedName,
        phone,
        buyerType,
        locationAddress: location?.address ?? '',
        locationLat: location?.lat,
        locationLng: location?.lng,
      };
      await updateDoc(doc(db, COLLECTIONS.USERS, buyer.uid), patch);
      onSaved(buyer.uid, patch);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this record.');
    } finally {
      setSaving(false);
    }
  };

  if (!buyer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit buyer record</DialogTitle>
          <DialogDescription>Update this buyer's record for the farm's own reference.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="buyer-record-name" className="text-xs font-semibold">Buyer name</Label>
            <Input
              id="buyer-record-name"
              value={name}
              onChange={(e) => setName(sanitizeNameInput(e.target.value))}
              className="h-9 rounded-lg text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Email (read-only)</Label>
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border/60">
              {buyer.email}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyer-record-phone" className="text-xs font-semibold">Phone</Label>
            <Input
              id="buyer-record-phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
              placeholder={PHONE_PLACEHOLDER}
              className="h-9 rounded-lg text-xs"
            />
          </div>
          <FixedSelect
            id="buyer-record-type"
            label="Buyer type"
            value={buyerType}
            options={BUYER_TYPE_OPTIONS}
            onChange={setBuyerType}
          />
          <LocationPicker id="buyer-record-location" label="Address" value={location} onChange={setLocation} />
          {error ? (
            <p className="text-xs font-medium text-rose-500 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="text-xs font-bold">
            {saving ? 'Saving…' : 'Save record'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
