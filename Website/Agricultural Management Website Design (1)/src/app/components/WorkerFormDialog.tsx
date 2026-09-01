import { useState, type ChangeEvent, type Dispatch, type SetStateAction, useMemo } from 'react';
import { KeyRound, Upload, X, AlertCircle, Info, ShieldCheck, Camera } from 'lucide-react';
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
import {
  isAtLeast18,
  calculateMaxBirthDate,
  isValidEmergencyPhone,
  isValidPhone11,
  sanitizeEmergencyPhoneInput,
  sanitizePhoneInput,
  isValidNamePart,
  ACCEPTED_NAME_CHARS_DESCRIPTION,
  type WorkerFormDraft,
} from '../lib/workerUi';

const ADDRESS_SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent';

const PHOTO_INPUT_CLASS =
  'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent/90';

const MAX_PHOTO_SIZE = 640;
const PHOTO_QUALITY = 0.82;

export function addressFormReady(
  form: WorkerFormDraft,
  opts?: { isEditing?: boolean },
): boolean {
  const isEditing = opts?.isEditing ?? false;

  const validFirstName = form.firstName.trim().length > 0 && isValidNamePart(form.firstName);
  const validMiddleInitial = !form.middleInitial.trim() || isValidNamePart(form.middleInitial, true);
  const validLastName = form.lastName.trim().length > 0 && isValidNamePart(form.lastName);
  const validNickname = !form.nickname.trim() || isValidNamePart(form.nickname);

  const validBirthday = isAtLeast18(form.birthday);
  const validPhone = isValidPhone11(form.phone);

  const validAddress =
    form.addressLine1.trim().length > 0 &&
    form.municipality.trim().length > 0 &&
    form.barangay.trim().length > 0;

  const validEmergencyName = !form.emergencyName.trim() || isValidNamePart(form.emergencyName);
  const validEmergencyPhone = isValidEmergencyPhone(form.emergencyPhone);

  // Profile photo is REQUIRED for registration; for editing, must have an existing or new photo
  const validPhoto = isEditing ? true : Boolean(form.imageUrl && form.imageUrl.trim().length > 0);

  return (
    validFirstName &&
    validMiddleInitial &&
    validLastName &&
    validNickname &&
    validBirthday &&
    validPhone &&
    validAddress &&
    validEmergencyName &&
    validEmergencyPhone &&
    validPhoto
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
  formError,
}: Props) {
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Dynamic minimum birthdate for >= 18 years old
  const maxBirthDate = useMemo(() => calculateMaxBirthDate(), []);

  const barangayOptions = useMemo(() => {
    return form.municipality.trim() !== '' ? getBarangaysForCity(form.municipality) : [];
  }, [form.municipality]);

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

  const isFormValid = addressFormReady(form, { isEditing });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl bg-card text-card-foreground border-border/80 rounded-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground font-heading">
            {isEditing ? 'Edit Employee Information' : 'Register New Farm Employee'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Complete the form below to register the worker. Worker ID is automatically generated.
          </DialogDescription>
        </DialogHeader>

        {/* Name Guidelines Header Alert */}
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-accent-foreground">
            <Info className="w-4 h-4 text-accent shrink-0" />
            <span>Name Format & Acceptance Guidelines</span>
          </div>
          <p className="text-muted-foreground leading-relaxed pl-5">
            Please enter the employee's name following the designated fields (First Name, Middle Initial, Last Name). Accepted special characters: apostrophes ('), hyphens (-), and periods (.) for initials.
          </p>
        </div>

        <div className="grid gap-5 py-2">
          {/* Section 1: Full Name Fields */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-heading">
                1. Employee Name
              </span>
              <span className="text-[11px] text-muted-foreground">
                Sample: Jose P. Rizal
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* First Name */}
              <div className="sm:col-span-5 space-y-1.5">
                <Label htmlFor="worker-first-name" className="text-xs font-semibold">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="worker-first-name"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  placeholder="Sample: Jose"
                  className={`bg-background/90 text-sm ${
                    form.firstName && !isValidNamePart(form.firstName)
                      ? 'border-destructive focus-visible:ring-destructive'
                      : ''
                  }`}
                />
                {form.firstName && !isValidNamePart(form.firstName) && (
                  <p className="text-[11px] text-destructive font-medium">
                    Only letters, hyphens (-), and apostrophes (') allowed.
                  </p>
                )}
              </div>

              {/* Middle Initial */}
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="worker-middle-initial" className="text-xs font-semibold">
                  M.I.
                </Label>
                <Input
                  id="worker-middle-initial"
                  maxLength={3}
                  value={form.middleInitial}
                  onChange={(e) => setForm((f) => ({ ...f, middleInitial: e.target.value }))}
                  placeholder="Sample: P."
                  className={`bg-background/90 text-sm ${
                    form.middleInitial && !isValidNamePart(form.middleInitial, true)
                      ? 'border-destructive focus-visible:ring-destructive'
                      : ''
                  }`}
                />
              </div>

              {/* Last Name */}
              <div className="sm:col-span-5 space-y-1.5">
                <Label htmlFor="worker-last-name" className="text-xs font-semibold">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="worker-last-name"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  placeholder="Sample: Rizal"
                  className={`bg-background/90 text-sm ${
                    form.lastName && !isValidNamePart(form.lastName)
                      ? 'border-destructive focus-visible:ring-destructive'
                      : ''
                  }`}
                />
                {form.lastName && !isValidNamePart(form.lastName) && (
                  <p className="text-[11px] text-destructive font-medium">
                    Only letters, hyphens (-), and apostrophes (') allowed.
                  </p>
                )}
              </div>

              {/* Nickname (Optional with clear instructions) */}
              <div className="sm:col-span-12 space-y-1.5 pt-1">
                <Label htmlFor="worker-nickname" className="text-xs font-semibold flex items-center justify-between">
                  <span>Nickname <span className="text-muted-foreground font-normal">(Optional)</span></span>
                  <span className="text-[11px] text-muted-foreground font-normal">Preferred alias used on field radios/badges</span>
                </Label>
                <Input
                  id="worker-nickname"
                  value={form.nickname}
                  onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
                  placeholder="Sample: Pepe"
                  className="bg-background/90 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Personal & Role Details */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-heading">
              2. Personal & Contact Information
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Birthday with dynamic age validation */}
              <div className="space-y-1.5">
                <Label htmlFor="worker-birthday" className="text-xs font-semibold flex items-center justify-between">
                  <span>Birthday <span className="text-destructive">*</span></span>
                  <span className="text-[10px] text-muted-foreground font-normal">Min. 18 years old</span>
                </Label>
                <Input
                  id="worker-birthday"
                  type="date"
                  max={maxBirthDate}
                  value={form.birthday}
                  onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
                  className={`bg-background/90 text-sm ${
                    form.birthday && !isAtLeast18(form.birthday)
                      ? 'border-destructive focus-visible:ring-destructive'
                      : ''
                  }`}
                />
                {form.birthday && !isAtLeast18(form.birthday) ? (
                  <p className="text-[11px] text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Error: Employee must be at least 18 years old (born on or before {maxBirthDate}).
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Must be born on or before {maxBirthDate}.
                  </p>
                )}
              </div>

              {/* Sex */}
              <SelectWithOther
                id="worker-sex"
                label="Sex"
                value={form.sex}
                onChange={(val) => setForm((f) => ({ ...f, sex: val }))}
                options={['Female', 'Male', 'Prefer not to say']}
                placeholder="— Select sex —"
                selectClassName={ADDRESS_SELECT_CLASS}
                otherPlaceholder="Sample: Custom sex..."
              />

              {/* Phone Number */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="worker-phone" className="text-xs font-semibold flex items-center justify-between">
                  <span>Contact Phone Number <span className="text-destructive">*</span></span>
                  <span className="text-[10px] text-muted-foreground font-normal">Sample: 09171234567</span>
                </Label>
                <Input
                  id="worker-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: sanitizePhoneInput(e.target.value) }))
                  }
                  placeholder="Sample: 09171234567"
                  className={`bg-background/90 text-sm ${
                    form.phone && !isValidPhone11(form.phone)
                      ? 'border-destructive focus-visible:ring-destructive'
                      : ''
                  }`}
                />
                {form.phone && !isValidPhone11(form.phone) ? (
                  <p className="text-[11px] text-destructive font-medium">
                    Phone number must be strictly 11 digits starting with 09 (Sample: 09171234567).
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Format: 11 digits starting with 09.
                  </p>
                )}
              </div>

              {/* Role */}
              <div className="sm:col-span-2">
                <SelectWithOther
                  id="worker-role"
                  label="Assigned Role"
                  value={form.role}
                  onChange={(val) => setForm((f) => ({ ...f, role: val }))}
                  options={['Picker', 'Sorter', 'Field Supervisor', 'Operator', 'Quality Inspector', 'Agronomist']}
                  selectClassName={ADDRESS_SELECT_CLASS}
                  otherPlaceholder="Sample: Machine Technician"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Address Form */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-heading">
                3. Address
              </span>
              <span className="text-[11px] text-muted-foreground">
                Province: {BATAAN_PROVINCE}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* City / Municipality */}
              <div className="space-y-1.5">
                <Label htmlFor="worker-city" className="text-xs font-semibold">
                  City / Municipality <span className="text-destructive">*</span>
                </Label>
                <select
                  id="worker-city"
                  value={form.municipality}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      municipality: e.target.value,
                      barangay: '',
                    }))
                  }
                  className={ADDRESS_SELECT_CLASS}
                >
                  <option value="">— Select City / Municipality —</option>
                  {BATAAN_CITIES_AND_TOWNS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Barangay */}
              <div className="space-y-1.5">
                <Label htmlFor="worker-barangay" className="text-xs font-semibold">
                  Barangay <span className="text-destructive">*</span>
                </Label>
                <select
                  id="worker-barangay"
                  disabled={barangayOptions.length === 0}
                  value={form.barangay}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      barangay: e.target.value,
                    }))
                  }
                  className={ADDRESS_SELECT_CLASS}
                >
                  <option value="">
                    {form.municipality ? '— Select Barangay —' : '— Choose City first —'}
                  </option>
                  {barangayOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Province (Auto-associated) */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="worker-province-fixed" className="text-xs font-semibold">
                  Province
                </Label>
                <Input
                  id="worker-province-fixed"
                  readOnly
                  value={form.province || BATAAN_PROVINCE}
                  aria-readonly="true"
                  className="bg-muted/70 text-sm font-medium text-foreground cursor-not-allowed"
                />
              </div>

              {/* Address Line 1 */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="worker-address-1" className="text-xs font-semibold flex items-center justify-between">
                  <span>Address Line 1 <span className="text-destructive">*</span></span>
                  <span className="text-[10px] text-muted-foreground font-normal">House / Bldg / Street / Lot / Blk</span>
                </Label>
                <Input
                  id="worker-address-1"
                  value={form.addressLine1}
                  onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                  placeholder="Sample: #42 Rizal Street, Building A, Lot 12 Blk 3"
                  className="bg-background/90 text-sm"
                />
              </div>

              {/* Address Line 2 */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="worker-address-2" className="text-xs font-semibold flex items-center justify-between">
                  <span>Address Line 2 <span className="text-muted-foreground font-normal">(Optional)</span></span>
                  <span className="text-[10px] text-muted-foreground font-normal">Subdivision / Village / Floor / Landmark</span>
                </Label>
                <Input
                  id="worker-address-2"
                  value={form.addressLine2}
                  onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
                  placeholder="Sample: Villa Dolores Subdivision, 2nd Floor"
                  className="bg-background/90 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Emergency Contact */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-heading">
              4. Emergency Contact
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="worker-emergency-name" className="text-xs font-semibold">
                  Contact Person Full Name
                </Label>
                <Input
                  id="worker-emergency-name"
                  value={form.emergencyName}
                  onChange={(e) => setForm((f) => ({ ...f, emergencyName: e.target.value }))}
                  placeholder="Sample: Maria Santos"
                  className="bg-background/90 text-sm"
                />
              </div>

              <SelectWithOther
                id="worker-emergency-relationship"
                label="Relationship"
                value={form.emergencyRelationship}
                onChange={(val) => setForm((f) => ({ ...f, emergencyRelationship: val }))}
                options={['Parent', 'Spouse', 'Sibling', 'Guardian', 'Child', 'Relative']}
                placeholder="— Select relationship —"
                selectClassName={ADDRESS_SELECT_CLASS}
                otherPlaceholder="Sample: Friend / Neighbor"
              />

              <div className="space-y-1.5">
                <Label htmlFor="worker-emergency-phone" className="text-xs font-semibold">
                  Emergency Phone Number
                </Label>
                <Input
                  id="worker-emergency-phone"
                  type="tel"
                  value={form.emergencyPhone}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      emergencyPhone: sanitizeEmergencyPhoneInput(e.target.value),
                    }))
                  }
                  placeholder="Sample: 09181234567"
                  className="bg-background/90 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Profile Photo (REQUIRED FOR REGISTRATION) */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="worker-photo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
                5. Profile Photo <span className="text-destructive font-black">* (Required)</span>
              </Label>
              {!form.imageUrl ? (
                <span className="px-2 py-0.5 rounded-md bg-destructive/15 text-destructive text-[10px] font-bold">
                  Photo Required
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Photo Attached
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-border/70 bg-background/80 p-4">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/50">
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt="Selected worker"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Camera className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Required</span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Upload a clear, front-facing profile photo for worker identity and attendance verification.
                </p>
                <div className="flex flex-wrap gap-2">
                  <label htmlFor="worker-photo-upload" className={PHOTO_INPUT_CLASS}>
                    <Upload className="h-4 w-4" />
                    {form.imageUrl ? 'Change Photo' : 'Upload Profile Photo *'}
                  </label>
                  {form.imageUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPhotoError(null);
                        setForm((f) => ({ ...f, imageUrl: '' }));
                      }}
                      className="border-border/80 text-xs"
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  ) : null}
                </div>
                <Input
                  id="worker-photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="sr-only"
                />
                {photoError ? (
                  <p className="text-xs text-destructive font-medium" role="alert">
                    {photoError}
                  </p>
                ) : null}
                {!form.imageUrl && (
                  <p className="text-[11px] text-destructive font-semibold">
                    * A profile photo is required to complete employee registration.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Account Creation Notice */}
          {!isEditing ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <KeyRound className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-emerald-700 dark:text-emerald-300">
                  Automated Mobile Credentials
                </p>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  Upon saving, login credentials (worker Gmail & temporary password) will be automatically provisioned for field attendance and crop scanning.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="worker-status" className="text-xs font-semibold">
                Employment Status
              </Label>
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

        {formError ? (
          <p className="text-xs text-destructive font-medium px-1 flex items-center gap-1.5" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {formError}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border/80"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={!isFormValid || saving}
            className="bg-[#2d5016] hover:bg-[#234010] text-white font-bold"
          >
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Register Employee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
