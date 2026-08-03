import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { KeyRound, Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { SelectWithOther } from './ui/SelectWithOther';
import {
  BATAAN_PROVINCE,
  BATAAN_CITIES_AND_TOWNS,
  getBarangaysForCity,
} from '../data/bataanAddressCatalog';
import { isAtLeast18, isValidPhone11, sanitizePhoneInput, sanitizeEmergencyPhoneInput, isValidName } from '../lib/workerUi';

export type WorkerFormDraft = {
  name: string;
  birthday: string;
  sex: string;
  phone: string;
  role: string;
  municipality: string;
  barangay: string;
  street: string;
  houseNumber: string;
  province: typeof BATAAN_PROVINCE;
  imageUrl: string;
  status: 'active' | 'inactive';
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
};

const ADDRESS_SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-[#4a2c2a]/25 bg-white px-3 py-2 text-sm text-[#3e2723] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

const PHOTO_INPUT_CLASS =
  'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2d5016] px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#234010]';

const MAX_PHOTO_SIZE = 640;
const PHOTO_QUALITY = 0.82;

export function composeWorkerAddress(form: WorkerFormDraft): string {
  const hn = form.houseNumber.trim();
  const street = form.street.trim();
  const line1 = hn && street && hn !== street && !street.includes(hn) ? `${hn} ${street}` : (street || hn);
  return `${line1}, Barangay ${form.barangay.trim()}, ${form.municipality.trim()}, ${BATAAN_PROVINCE}`;
}

export function addressFormReady(
  form: WorkerFormDraft,
  opts?: { fallbackAddress?: string; isEditing?: boolean },
): boolean {
  return (
    isValidName(form.name) &&
    isAtLeast18(form.birthday) &&
    isValidPhone11(form.phone) &&
    form.municipality.trim() !== '' &&
    form.barangay.trim() !== '' &&
    (form.street.trim() !== '' || form.houseNumber.trim() !== '') &&
    (!form.emergencyName.trim() || isValidName(form.emergencyName))
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read the selected photo.'));
    image.src = src;
  });
}

async function fileToWorkerPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected photo.'));
    reader.readAsDataURL(file);
  });
  const image = await loadImage(source);
  const scale = Math.min(1, MAX_PHOTO_SIZE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not prepare the selected photo.');
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  form: WorkerFormDraft;
  setForm: Dispatch<SetStateAction<WorkerFormDraft>>;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  fallbackAddress?: string;
  formError?: string | null;
};

export function WorkerFormDialog({
  open,
  onOpenChange,
  isEditing,
  form,
  setForm,
  onSave,
  saving = false,
  fallbackAddress,
  formError,
}: Props) {
  const [photoError, setPhotoError] = useState<string | null>(null);
  const barangayOptions =
    form.municipality.trim() !== '' ? getBarangaysForCity(form.municipality) : [];

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setPhotoError(null);
    if (!file) return;

    try {
      const imageUrl = await fileToWorkerPhoto(file);
      setForm((f) => ({ ...f, imageUrl }));
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Could not upload the selected photo.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl bg-[#fdfbf7] border-[#4a2c2a]/15">
        <DialogHeader>
          <DialogTitle className="text-[#3e2723]">{isEditing ? 'Edit employee' : 'Add employee'}</DialogTitle>
          <DialogDescription>
            Worker ID is generated automatically. Addresses are in{' '}
            <span className="font-medium text-[#5d4037]">Bataan</span> only; choose city and barangay,
            then enter the street and house or lot number.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="worker-name">Full name *</Label>
              <Input
                id="worker-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Jose Rizal"
                className={`bg-white border-[#4a2c2a]/20 ${form.name && !isValidName(form.name) ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {form.name && !isValidName(form.name) && (
                <p className="text-xs text-red-600 font-medium">Full name must only contain letters, spaces, and dashes (-). No numbers or other special characters allowed.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="worker-birthday">Birthday *</Label>
              <Input
                id="worker-birthday"
                type="date"
                value={form.birthday}
                onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
                className={`bg-white border-[#4a2c2a]/20 ${form.birthday && !isAtLeast18(form.birthday) ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {form.birthday && !isAtLeast18(form.birthday) ? (
                <p className="text-xs text-red-600 font-medium">Error: Employee must be at least 18 years old.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Employees must be at least 18 years old.</p>
              )}
            </div>
              <SelectWithOther
                id="worker-sex"
                label="Sex"
                value={form.sex}
                onChange={(val) => setForm((f) => ({ ...f, sex: val }))}
                options={['Female', 'Male', 'Prefer not to say']}
                placeholder="— Select sex —"
                selectClassName={ADDRESS_SELECT_CLASS}
                otherPlaceholder="Type custom sex..."
              />
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="worker-phone">Phone number *</Label>
              <Input
                id="worker-phone"
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: sanitizePhoneInput(e.target.value) }))
                }
                placeholder="09XXXXXXXXX"
                className={`bg-white border-[#4a2c2a]/20 ${form.phone && !isValidPhone11(form.phone) ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {form.phone && !isValidPhone11(form.phone) ? (
                <p className="text-xs text-red-600 font-medium">Phone number must be exactly 11 digits starting with 09 (e.g. 09171234567).</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Format guide: 09171234567 (strictly 11 digits).
                </p>
              )}
            </div>
              <SelectWithOther
                id="worker-role"
                label="Role"
                value={form.role}
                onChange={(val) => setForm((f) => ({ ...f, role: val }))}
                options={['Picker', 'Sorter', 'Field Supervisor', 'Operator', 'Quality Inspector']}
                selectClassName={ADDRESS_SELECT_CLASS}
                otherPlaceholder="Type custom role..."
              />
            {!isEditing ? (
              <div className="sm:col-span-2 rounded-xl border border-[#2d5016]/20 bg-[#f0f7eb] p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#2d5016]">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#2d5016]">Authentication account</p>
                    <p className="text-xs text-[#4a2c2a]">
                      After saving, the system will generate the worker's login email and temporary
                      password. The credentials will appear immediately for the admin to give to the employee.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="space-y-2 sm:col-span-2 rounded-xl border border-[#4a2c2a]/15 bg-[#f5f1ed]/50 p-4">
              <p className="text-sm font-medium text-[#3e2723]">Emergency contact</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="worker-emergency-name">Full name</Label>
                  <Input
                    id="worker-emergency-name"
                    value={form.emergencyName}
                    onChange={(e) => setForm((f) => ({ ...f, emergencyName: e.target.value }))}
                    placeholder="e.g., Maria Santos"
                    className={`bg-white border-[#4a2c2a]/20 ${form.emergencyName && !isValidName(form.emergencyName) ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  />
                  {form.emergencyName && !isValidName(form.emergencyName) && (
                    <p className="text-xs text-red-600 font-medium">Name must only contain letters, spaces, and dashes (-). No numbers or special characters.</p>
                  )}
                </div>
                  <SelectWithOther
                    id="worker-emergency-relationship"
                    label="Relationship"
                    value={form.emergencyRelationship}
                    onChange={(val) => setForm((f) => ({ ...f, emergencyRelationship: val }))}
                    options={['Parent', 'Sibling', 'Spouse']}
                    placeholder="— Select relationship —"
                    selectClassName={ADDRESS_SELECT_CLASS}
                    otherPlaceholder="Type custom relationship..."
                  />
                <div className="space-y-2">
                  <Label htmlFor="worker-emergency-phone">Contact number</Label>
                  <Input
                    id="worker-emergency-phone"
                    type="tel"
                    value={form.emergencyPhone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, emergencyPhone: sanitizeEmergencyPhoneInput(e.target.value) }))
                    }
                    placeholder="e.g. 09171234567 or +63 917 123 4567"
                    className="bg-white border-[#4a2c2a]/20"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2 rounded-xl border border-[#4a2c2a]/15 bg-[#f5f1ed]/50 p-4">
              <p className="text-sm font-medium text-[#3e2723]">Residential address · Bataan</p>
              <p className="text-xs text-muted-foreground pb-2">
                Select city then barangay. Street is typed manually (no preset list).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="worker-province-fixed">Province</Label>
                  <Input
                    id="worker-province-fixed"
                    readOnly
                    value={BATAAN_PROVINCE}
                    aria-readonly="true"
                    className="bg-[#e8e2dc] border-[#4a2c2a]/20 text-[#3e2723]"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="worker-city">City / municipality *</Label>
                  <select
                    id="worker-city"
                    value={form.municipality}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        municipality: e.target.value,
                        barangay: isEditing ? f.barangay : '',
                        street: isEditing ? f.street : '',
                        houseNumber: isEditing ? f.houseNumber : '',
                      }))
                    }
                    className={ADDRESS_SELECT_CLASS}
                  >
                    <option value="">— Select city or municipality —</option>
                    {BATAAN_CITIES_AND_TOWNS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="worker-barangay">Barangay *</Label>
                  <select
                    id="worker-barangay"
                    disabled={barangayOptions.length === 0}
                    value={form.barangay}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        barangay: e.target.value,
                        street: isEditing ? f.street : '',
                        houseNumber: isEditing ? f.houseNumber : '',
                      }))
                    }
                    className={ADDRESS_SELECT_CLASS}
                  >
                    <option value="">
                      {form.municipality ? '— Select barangay —' : '— Choose a city first —'}
                    </option>
                    {barangayOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="worker-street">House No. / Street / Building *</Label>
                  <Input
                    id="worker-street"
                    value={form.street || form.houseNumber}
                    onChange={(e) => setForm((f) => ({ ...f, street: e.target.value, houseNumber: e.target.value }))}
                    placeholder="e.g., #42 Rizal Street, Lot 12 Blk 3"
                    className="bg-white border-[#4a2c2a]/20"
                    disabled={!form.barangay}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3 sm:col-span-2">
              <Label htmlFor="worker-photo">Profile photo</Label>
              <div className="flex flex-col gap-3 rounded-xl border border-[#4a2c2a]/15 bg-[#f5f1ed]/50 p-4 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#4a2c2a]/15 bg-white">
                  {form.imageUrl ? (
                    <img
                      src={form.imageUrl}
                      alt="Selected worker"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No photo</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <label htmlFor="worker-photo" className={PHOTO_INPUT_CLASS}>
                      <Upload className="h-4 w-4" />
                      Upload photo
                    </label>
                    {form.imageUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setPhotoError(null);
                          setForm((f) => ({ ...f, imageUrl: '' }));
                        }}
                        className="border-[#4a2c2a]/30"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    id="worker-photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="sr-only"
                  />
                  {photoError ? (
                    <p className="text-xs text-red-600" role="alert">
                      {photoError}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            {isEditing && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="worker-status">Employment status</Label>
                <select
                  id="worker-status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as 'active' | 'inactive' }))
                  }
                  className={ADDRESS_SELECT_CLASS}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>
        </div>
        {formError ? (
          <p className="text-sm text-red-600 px-1" role="alert">
            {formError}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-[#4a2c2a]/30">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={!addressFormReady(form, { fallbackAddress, isEditing }) || saving}
            className="bg-[#2d5016] hover:bg-[#234010] text-white"
          >
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save employee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
