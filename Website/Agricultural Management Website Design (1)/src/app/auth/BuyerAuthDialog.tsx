import { useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { FixedSelect } from '../components/ui/FixedSelect';
import { LocationPicker, type PickedLocation } from '../components/LocationPicker';
import { useAuth } from './AuthProvider';
import { authErrorMessage } from './authConfig';
import { isValidPersonName, NAME_ERROR_MESSAGE, sanitizeNameInput } from '../lib/personName';
import { isValidPhone11, PHONE_ERROR_MESSAGE, PHONE_PLACEHOLDER, sanitizePhoneInput } from '../lib/phone';
import { BUYER_TYPE_OPTIONS } from '../lib/buyerRecord';

/**
 * Buyer sign-in / sign-up modal, opened from the Admin LoginScreen's "Shopping for coffee?"
 * link. Buyers are the only self-service role in this app -- Admin, Owner, and Worker accounts
 * are all provisioned by Admin. Sign-in reuses AuthProvider.signIn (it already accepts any raw
 * email), sign-up uses the new AuthProvider.signUpAsBuyer.
 */
export function BuyerAuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { signIn, signUpAsBuyer, resetPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [buyerType, setBuyerType] = useState<string>(BUYER_TYPE_OPTIONS[0]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setPhone('');
    setBuyerType(BUYER_TYPE_OPTIONS[0]);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setLocation(null);
    setLocalError(null);
    setResetMessage(null);
  };

  // Firebase rejects a password under 6 characters (auth/weak-password) -- check it here too so
  // that shows up as inline guidance while typing instead of only after a failed submit.
  const passwordTooShort = mode === 'signup' && password !== '' && password.length < 6;
  const passwordsMismatch = mode === 'signup' && confirmPassword !== '' && password !== confirmPassword;
  const signupPasswordValid = password.length >= 6 && password === confirmPassword;

  // `pinned` = the buyer actually tapped/dragged the map. Typing an address alone leaves the pin at the
  // map's default centre, which would be the wrong location.
  const locationIsValid = (loc: PickedLocation | null): loc is PickedLocation =>
    !!loc && loc.pinned === true && loc.address.trim().length > 0 && (loc.lat !== 0 || loc.lng !== 0);

  const handleForgotPassword = async () => {
    if (!email) {
      setLocalError('Enter your email above first, then tap "Forgot password?" again.');
      return;
    }
    setResetSubmitting(true);
    setLocalError(null);
    setResetMessage(null);
    try {
      await resetPassword(email);
      setResetMessage("If that account exists, we've sent a password reset link to it. Check your inbox (and spam folder).");
    } catch (err) {
      setLocalError(authErrorMessage(err, 'Could not send the reset email.'));
    } finally {
      setResetSubmitting(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'signup' && !locationIsValid(location)) {
      setLocalError('Tap the map to drop a pin on your business / pickup location first -- it is required to create a buyer account.');
      return;
    }
    if (mode === 'signup' && !signupPasswordValid) {
      setLocalError('Enter a password of at least 6 characters, and make sure it matches the confirmation field.');
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    try {
      if (mode === 'signup' && locationIsValid(location)) {
        await signUpAsBuyer(email, password, name, location, phone, buyerType);
      } else {
        await signIn(email, password, 'buyer');
      }
      onOpenChange(false);
      reset();
    } catch (err) {
      setLocalError(authErrorMessage(err, mode === 'signup' ? 'Could not create your account.' : 'Sign-in failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'signup' ? 'Create a buyer account' : 'Buyer sign in'}</DialogTitle>
          <DialogDescription>
            {mode === 'signup'
              ? 'Browse available coffee and place orders directly from the farm.'
              : 'Sign in to browse listings and track your orders.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {mode === 'signup' ? (
            <div className="space-y-1.5">
              <Label htmlFor="buyer-name" className="text-xs font-semibold">Full name</Label>
              <Input
                id="buyer-name"
                value={name}
                onChange={(e) => setName(sanitizeNameInput(e.target.value))}
                placeholder="Juan Dela Cruz"
                autoComplete="name"
                aria-invalid={name.trim() !== '' && !isValidPersonName(name)}
                className={`h-10 rounded-xl text-xs ${name.trim() !== '' && !isValidPersonName(name) ? 'border-rose-500' : ''}`}
              />
              {name.trim() !== '' && !isValidPersonName(name) ? (
                <p className="text-[11px] text-rose-500 font-medium">{NAME_ERROR_MESSAGE}</p>
              ) : null}
            </div>
          ) : null}
          {mode === 'signup' ? (
            <div className="space-y-1.5">
              <Label htmlFor="buyer-phone" className="text-xs font-semibold">Phone number</Label>
              <Input
                id="buyer-phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                placeholder={PHONE_PLACEHOLDER}
                autoComplete="tel"
                aria-invalid={phone !== '' && !isValidPhone11(phone)}
                className={`h-10 rounded-xl text-xs ${phone !== '' && !isValidPhone11(phone) ? 'border-rose-500' : ''}`}
              />
              <p className={`text-[11px] ${phone !== '' && !isValidPhone11(phone) ? 'text-rose-500 font-medium' : 'text-muted-foreground'}`}>
                {phone !== '' && !isValidPhone11(phone) ? PHONE_ERROR_MESSAGE : 'Numbers only, 11 digits starting with 09.'}
              </p>
            </div>
          ) : null}
          {mode === 'signup' ? (
            <FixedSelect
              id="buyer-type"
              label="What best describes you?"
              value={buyerType}
              options={BUYER_TYPE_OPTIONS}
              onChange={setBuyerType}
              selectClassName="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-xs"
            />
          ) : null}
          {mode === 'signup' ? (
            <LocationPicker value={location} onChange={setLocation} id="buyer-signup-location" />
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="buyer-email" className="text-xs font-semibold">Email</Label>
            <Input
              id="buyer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              className="h-10 rounded-xl text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="buyer-password" className="text-xs font-semibold">Password</Label>
              {mode === 'signin' ? (
                <button
                  type="button"
                  onClick={() => void handleForgotPassword()}
                  disabled={resetSubmitting}
                  className="text-[11px] text-muted-foreground hover:text-primary underline cursor-pointer"
                >
                  {resetSubmitting ? 'Sending…' : 'Forgot password?'}
                </button>
              ) : null}
            </div>
            <Input
              id="buyer-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              aria-invalid={passwordTooShort}
              className={`h-10 rounded-xl text-xs ${passwordTooShort ? 'border-rose-500' : ''}`}
            />
            {mode === 'signup' ? (
              <p className={`text-[11px] ${passwordTooShort ? 'text-rose-500 font-medium' : 'text-muted-foreground'}`}>
                At least 6 characters.
              </p>
            ) : null}
          </div>
          {mode === 'signup' ? (
            <div className="space-y-1.5">
              <Label htmlFor="buyer-confirm-password" className="text-xs font-semibold">Confirm password</Label>
              <Input
                id="buyer-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={passwordsMismatch}
                className={`h-10 rounded-xl text-xs ${passwordsMismatch ? 'border-rose-500' : ''}`}
              />
              {passwordsMismatch ? (
                <p className="text-[11px] text-rose-500 font-medium">Passwords do not match.</p>
              ) : null}
            </div>
          ) : null}
          {resetMessage ? (
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
              {resetMessage}
            </p>
          ) : null}
          {localError ? (
            <p className="text-xs font-medium text-rose-500 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
              {localError}
            </p>
          ) : null}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="submit"
              disabled={submitting || (mode === 'signup' && (!locationIsValid(location) || !signupPasswordValid))}
              className="w-full h-10 rounded-xl text-xs font-bold cursor-pointer"
            >
              {submitting
                ? mode === 'signup' ? 'Creating account…' : 'Signing in…'
                : mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
            <button
              type="button"
              onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setLocalError(null); }}
              className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
            >
              {mode === 'signup' ? 'Already have an account? Sign in' : "New here? Create a buyer account"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
