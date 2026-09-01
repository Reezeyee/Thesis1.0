import { useState, type FormEvent } from 'react';
import { Coffee, Sparkles, User, ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function LoginScreen() {
  const { signIn, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    try {
      await signIn(username, password);
    } catch {
      setLocalError(error ?? 'Sign-in failed. Check username and password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickWorkerSignIn = async () => {
    setSubmitting(true);
    setLocalError(null);
    try {
      await signIn('workerstaffacojido@gmail.com', 'Parm012345');
    } catch {
      try {
        await signIn('acojidostaff@coffeefarm.local', 'acojid012345');
      } catch {
        setLocalError('Worker sign-in failed. Please enter credentials manually.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAdminSignIn = async () => {
    setSubmitting(true);
    setLocalError(null);
    try {
      await signIn('farmacojido@gmail.com', 'Farm012345');
    } catch {
      setLocalError('Admin sign-in failed. Please enter credentials manually.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 sm:p-6 transition-colors duration-200">
      <div className="w-full max-w-md bg-card/95 backdrop-blur-md rounded-3xl border border-border/80 shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header Branding */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-black flex items-center justify-center font-bold shadow-md flex-shrink-0">
            <Coffee className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold font-heading text-foreground tracking-tight">
              Acojido Coffee Farm
            </h1>
            <p className="text-xs text-muted-foreground">Field Worker & Farm Operations Portal</p>
          </div>
        </div>

        {/* Quick One-Tap Worker Access */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Fast Worker Access
            </span>
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              Demo Worker
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Sign in directly to the Field Worker Scanner & Attendance App
          </p>
          <Button
            type="button"
            disabled={submitting}
            onClick={handleQuickWorkerSignIn}
            className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs shadow-sm flex items-center justify-center gap-2"
          >
            <User className="w-4 h-4" />
            Sign In as Field Worker (Juan Dela Cruz)
            <ArrowRight className="w-3.5 h-3.5 ml-auto" />
          </Button>
        </div>

        {/* Divider */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-border/70" />
          <span className="flex-shrink mx-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Or Sign In With Account
          </span>
          <div className="flex-grow border-t border-border/70" />
        </div>

        {/* Credentials Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs font-semibold text-foreground">
              Username or email
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. worker, admin, or email"
              autoComplete="username"
              className="bg-background border-border/80 h-11 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold text-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="bg-background border-border/80 h-11 rounded-xl text-xs"
            />
          </div>

          {(localError || error) && (
            <p className="text-xs font-medium text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              {localError ?? error}
            </p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
          >
            {submitting ? 'Authenticating…' : 'Sign In'}
          </Button>
        </form>

        {/* Admin Quick Switch Footer */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <button
            type="button"
            onClick={handleQuickAdminSignIn}
            className="hover:text-amber-500 transition-colors underline text-[11px]"
          >
            Admin Sign-in
          </button>
          <span className="text-[11px] font-mono text-muted-foreground/70">
            Firebase: thesis-bbcde
          </span>
        </div>
      </div>
    </div>
  );
}

