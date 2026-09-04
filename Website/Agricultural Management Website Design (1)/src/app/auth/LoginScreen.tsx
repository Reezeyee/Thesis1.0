import { useState, type FormEvent } from 'react';
import { Coffee, ShieldCheck, Lock, ArrowRight } from 'lucide-react';
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
      setLocalError(error ?? 'Sign-in failed. Check administrator username and password.');
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold font-heading text-foreground tracking-tight">
                Acojido Coffee Farm
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider">
                Admin
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Farm Administrator Management Portal</p>
          </div>
        </div>

        {/* Admin Isolation Notice */}
        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 flex items-center gap-3 text-xs">
          <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-muted-foreground">
            Administrative access only. Field workers must use the dedicated Mobile Scanner & Attendance App.
          </p>
        </div>

        {/* Credentials Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-username" className="text-xs font-semibold text-foreground">
              Administrator Username or Email
            </Label>
            <Input
              id="admin-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin or farmacojido@gmail.com"
              autoComplete="username"
              className="bg-background border-border/80 h-11 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password" className="text-xs font-semibold text-foreground">
              Password
            </Label>
            <Input
              id="admin-password"
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
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-xs cursor-pointer"
          >
            {submitting ? 'Authenticating Administrator…' : 'Sign In as Administrator'}
          </Button>
        </form>

        {/* Admin Sign-in Quick Helper & Firebase Info */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <button
            type="button"
            onClick={handleQuickAdminSignIn}
            className="hover:text-amber-500 transition-colors underline text-[11px] cursor-pointer"
          >
            Auto-fill Admin Sign-in
          </button>
          <span className="text-[11px] font-mono text-muted-foreground/70">
            Admin Portal
          </span>
        </div>
      </div>
    </div>
  );
}
