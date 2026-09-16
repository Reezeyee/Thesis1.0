import { useState } from 'react';
import { MailCheck, LogOut, RefreshCw, Send } from 'lucide-react';
import { useAuth, type AuthSession } from '../auth/AuthProvider';
import { Button } from './ui/button';

/**
 * Blocks the Buyer Storefront until a self-registered buyer confirms their email address.
 * Buyer is the only role that creates its own account (see AuthProvider.signUpAsBuyer), so
 * this is the one place in the app that needs an email-ownership check -- Admin/Owner/Farm
 * Staff accounts are provisioned directly in Firebase Console and are trusted as-is.
 */
export function BuyerVerifyEmailGate({
  session,
  onSignOut,
}: {
  session: AuthSession;
  onSignOut: () => void;
}) {
  const { resendVerificationEmail, refreshEmailVerified } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [notYet, setNotYet] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCheck = async () => {
    setChecking(true);
    setErrorMsg(null);
    setNotYet(false);
    try {
      await refreshEmailVerified();
      // If still unverified after the refresh, session.emailVerified will simply stay false
      // and this component keeps rendering -- surface that explicitly so it doesn't look stuck.
      setNotYet(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not check verification status.');
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setErrorMsg(null);
    setResent(false);
    try {
      await resendVerificationEmail();
      setResent(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not resend the verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
          <MailCheck className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold font-heading text-foreground">Verify your email</h2>
        <p className="text-xs text-muted-foreground">
          We sent a confirmation link to <span className="font-semibold text-foreground">{session.email}</span>.
          Open it, then come back here and check again -- you'll need to confirm your email before you can
          browse the storefront or place an order.
        </p>

        {notYet && !checking ? (
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
            Still not verified yet. Check your inbox (and spam folder), then try again.
          </p>
        ) : null}
        {resent ? (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
            Verification email resent.
          </p>
        ) : null}
        {errorMsg ? (
          <p className="text-xs font-medium text-rose-500 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">{errorMsg}</p>
        ) : null}

        <div className="pt-2 flex flex-col gap-2">
          <Button
            onClick={() => void handleCheck()}
            disabled={checking}
            className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking…' : "I've verified — Check again"}
          </Button>
          <Button
            onClick={() => void handleResend()}
            disabled={resending}
            variant="outline"
            className="w-full h-11 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <Send className="w-4 h-4 mr-1.5" /> {resending ? 'Sending…' : 'Resend verification email'}
          </Button>
          <Button
            onClick={onSignOut}
            variant="ghost"
            className="w-full h-9 rounded-xl text-xs font-semibold cursor-pointer text-muted-foreground"
          >
            <LogOut className="w-4 h-4 mr-1.5" /> Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
