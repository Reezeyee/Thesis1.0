import { useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { LocationPicker, type PickedLocation } from '../components/LocationPicker';
import { useAuth } from './AuthProvider';

/**
 * Buyer sign-in / sign-up modal, opened from the Admin LoginScreen's "Shopping for coffee?"
 * link. Buyers are the only self-service role in this app -- Admin, Owner, and Worker accounts
 * are all provisioned by Admin. Sign-in reuses AuthProvider.signIn (it already accepts any raw
 * email), sign-up uses the new AuthProvider.signUpAsBuyer.
 */
export function BuyerAuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { signIn, signUpAsBuyer, resetPassword, error } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setEmail('');
    setPassword('');
    setLocation(null);
    setLocalError(null);
    setResetMessage(null);
  };

  const locationIsValid = (loc: PickedLocation | null): loc is PickedLocation =>
    !!loc && loc.address.trim().length > 0 && (loc.lat !== 0 || loc.lng !== 0);

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
    } catch {
      setLocalError(error ?? 'Could not send the reset email.');
    } finally {
      setResetSubmitting(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'signup' && !locationIsValid(location)) {
      setLocalError('Set your business / pickup location on the map first -- it is required to create a buyer account.');
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    try {
      if (mode === 'signup' && locationIsValid(location)) {
        await signUpAsBuyer(email, password, name, location);
      } else {
        await signIn(email, password);
      }
      onOpenChange(false);
      reset();
    } catch {
      setLocalError(error ?? (mode === 'signup' ? 'Could not create your account.' : 'Sign-in failed.'));
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
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Dela Cruz"
                className="h-10 rounded-xl text-xs"
              />
            </div>
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
              className="h-10 rounded-xl text-xs"
            />
          </div>
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
              disabled={submitting || (mode === 'signup' && !locationIsValid(location))}
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
