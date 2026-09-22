import { useEffect, useState, type ChangeEvent } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { User as UserIcon, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { useAuth } from '../auth/AuthProvider';
import { authErrorMessage } from '../auth/authConfig';
import { isValidPersonName, NAME_ERROR_MESSAGE, sanitizeNameInput } from '../lib/personName';

const MAX_PHOTO_SIZE = 320;
const PHOTO_QUALITY = 0.85;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read the selected photo.'));
    image.src = src;
  });
}

/** Resizes/compresses to a small square-ish JPEG data URL -- stored directly on the buyer's Firestore doc (no Firebase Storage in this project; mirrors AttendanceRecord.faceSnapshotBase64). */
async function fileToProfilePhoto(file: File): Promise<string> {
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
  if (!context) throw new Error('Could not prepare the selected photo.');
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
}

/**
 * Self-service "My Profile" modal for a signed-in buyer: edit display name, upload/remove a
 * profile photo, change email (sends a confirm link to the new address -- see
 * AuthProvider.changeEmail), and change password. Each section saves independently so a mistake
 * in one field doesn't block the others.
 */
export function BuyerProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { session, user, updateDisplayName, updateBuyerPhoto, changeEmail, changePassword } = useAuth();

  const [name, setName] = useState(session?.displayName ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setName(session?.displayName ?? '');
    setNewEmail('');
    setEmailPassword('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setNameMessage(null);
    setNameError(null);
    setEmailMessage(null);
    setEmailError(null);
    setPasswordMessage(null);
    setPasswordError(null);
    void (async () => {
      const snap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
      setPhotoBase64((snap.data()?.photoBase64 as string | undefined) ?? null);
    })();
  }, [open, user, session?.displayName]);

  const handleSaveName = async () => {
    setNameSaving(true);
    setNameError(null);
    setNameMessage(null);
    try {
      await updateDisplayName(name);
      setNameMessage('Name updated.');
    } catch (err) {
      setNameError(authErrorMessage(err, 'Could not update your name.'));
    } finally {
      setNameSaving(false);
    }
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoLoading(true);
    setPhotoError(null);
    try {
      const resized = await fileToProfilePhoto(file);
      await updateBuyerPhoto(resized);
      setPhotoBase64(resized);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not update your photo.');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoLoading(true);
    setPhotoError(null);
    try {
      await updateBuyerPhoto(null);
      setPhotoBase64(null);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not remove your photo.');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleSaveEmail = async () => {
    setEmailSaving(true);
    setEmailError(null);
    setEmailMessage(null);
    try {
      await changeEmail(newEmail, emailPassword);
      setEmailMessage(`Confirmation link sent to ${newEmail.trim()}. Your sign-in email changes once you click it.`);
      setNewEmail('');
      setEmailPassword('');
    } catch (err) {
      setEmailError(authErrorMessage(err, 'Could not update your email.'));
    } finally {
      setEmailSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordMessage(null);
    try {
      await changePassword(newPassword, currentPassword);
      setPasswordMessage('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(authErrorMessage(err, 'Could not update your password.'));
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
          <DialogDescription>Update your name, photo, email, or password.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Photo */}
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={photoBase64 ?? undefined} alt={session.displayName} />
              <AvatarFallback>
                <UserIcon className="w-6 h-6 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <label
                  htmlFor="buyer-profile-photo"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-semibold cursor-pointer hover:bg-muted"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {photoLoading ? 'Uploading…' : photoBase64 ? 'Change photo' : 'Upload photo'}
                </label>
                {photoBase64 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={photoLoading}
                    onClick={() => void handleRemovePhoto()}
                    className="h-8 text-xs"
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Remove
                  </Button>
                ) : null}
              </div>
              <Input
                id="buyer-profile-photo"
                type="file"
                accept="image/*"
                onChange={(e) => void handlePhotoChange(e)}
                className="sr-only w-px h-px"
              />
              {photoError ? <p className="text-[11px] text-rose-500 font-medium">{photoError}</p> : null}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5 pt-4 border-t border-border/60">
            <Label htmlFor="buyer-profile-name" className="text-xs font-semibold">Display name</Label>
            <div className="flex gap-2">
              <Input
                id="buyer-profile-name"
                value={name}
                onChange={(e) => setName(sanitizeNameInput(e.target.value))}
                className="h-9 rounded-lg text-xs flex-1"
              />
              <Button
                type="button"
                size="sm"
                disabled={nameSaving || !name.trim() || name.trim() === session.displayName}
                onClick={() => void handleSaveName()}
                className="h-9 text-xs"
              >
                {nameSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
            {name.trim() !== '' && !isValidPersonName(name) ? (
              <p className="text-[11px] text-rose-500 font-medium">{NAME_ERROR_MESSAGE}</p>
            ) : null}
            {nameMessage ? <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{nameMessage}</p> : null}
            {nameError ? <p className="text-[11px] text-rose-500 font-medium">{nameError}</p> : null}
          </div>

          {/* Email */}
          <div className="space-y-1.5 pt-4 border-t border-border/60">
            <Label className="text-xs font-semibold">Email</Label>
            <p className="text-[11px] text-muted-foreground">Current: {session.email}</p>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="New email address"
              autoComplete="email"
              className="h-9 rounded-lg text-xs"
            />
            <Input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="Current password (to confirm)"
              autoComplete="current-password"
              className="h-9 rounded-lg text-xs"
            />
            <Button
              type="button"
              size="sm"
              disabled={emailSaving || !newEmail.trim() || !emailPassword}
              onClick={() => void handleSaveEmail()}
              className="h-9 text-xs w-full"
            >
              {emailSaving ? 'Sending confirmation…' : 'Update email'}
            </Button>
            {emailMessage ? <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{emailMessage}</p> : null}
            {emailError ? <p className="text-[11px] text-rose-500 font-medium">{emailError}</p> : null}
          </div>

          {/* Password */}
          <div className="space-y-1.5 pt-4 border-t border-border/60">
            <Label className="text-xs font-semibold">Password</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              autoComplete="current-password"
              className="h-9 rounded-lg text-xs"
            />
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              className="h-9 rounded-lg text-xs"
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className="h-9 rounded-lg text-xs"
            />
            <Button
              type="button"
              size="sm"
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              onClick={() => void handleSavePassword()}
              className="h-9 text-xs w-full"
            >
              {passwordSaving ? 'Saving…' : 'Update password'}
            </Button>
            {passwordMessage ? <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{passwordMessage}</p> : null}
            {passwordError ? <p className="text-[11px] text-rose-500 font-medium">{passwordError}</p> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
