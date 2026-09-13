import { useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Coffee, ShieldCheck, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

/**
 * Three soft, blurred color fields that slowly drift and breathe behind the login card --
 * plain bg-background alone read as lifeless. Colors pull from the existing brand tokens
 * (--primary, --accent, --status-success) via Tailwind's bg-color/opacity utilities so this
 * stays on-palette and correct in both light and dark mode automatically. Motion is skipped
 * entirely for prefers-reduced-motion instead of just running slower.
 */
function AmbientBackground() {
  const reduceMotion = useReducedMotion();

  const blobs = [
    { className: 'bg-accent/25 dark:bg-accent/20', size: 420, top: '-8%', left: '-6%', duration: 22 },
    { className: 'bg-primary/20 dark:bg-primary/25', size: 480, top: '55%', left: '70%', duration: 26 },
    { className: 'bg-emerald-500/10', size: 360, top: '65%', left: '-4%', duration: 19 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {blobs.map((blob, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-3xl ${blob.className}`}
          style={{ width: blob.size, height: blob.size, top: blob.top, left: blob.left }}
          animate={
            reduceMotion
              ? undefined
              : {
                  x: [0, 30, -20, 0],
                  y: [0, -25, 20, 0],
                  scale: [1, 1.08, 0.96, 1],
                }
          }
          transition={{ duration: blob.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/** A minimal coffee-bean silhouette -- an oval, simple enough to read at a small, low-opacity size. */
function CoffeeBeanShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 36" className={className} fill="currentColor">
      <path d="M12 0C5.373 0 0 7.163 0 18s5.373 18 12 18 12-7.163 12-18S18.627 0 12 0Z" />
    </svg>
  );
}

/**
 * Small coffee-bean shapes drifting slowly upward with a gentle horizontal sway, fading in and
 * out as they cross the card area -- a themed layer on top of AmbientBackground's color glow.
 * Fixed per-particle values (no Math.random) keep the layout stable across re-renders.
 */
function FloatingBeans() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;

  const beans = [
    { left: '8%', size: 22, duration: 16, delay: 0, sway: 14 },
    { left: '22%', size: 14, duration: 21, delay: 3, sway: -10 },
    { left: '38%', size: 18, duration: 18, delay: 7, sway: 12 },
    { left: '58%', size: 16, duration: 23, delay: 1, sway: -16 },
    { left: '74%', size: 24, duration: 19, delay: 5, sway: 10 },
    { left: '88%', size: 15, duration: 25, delay: 9, sway: -12 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {beans.map((bean, i) => (
        <motion.div
          key={i}
          className="absolute text-primary/15 dark:text-accent/20"
          style={{ left: bean.left, width: bean.size, bottom: '-10%' }}
          animate={{
            y: ['0%', '-130vh'],
            x: [0, bean.sway, 0],
            opacity: [0, 0.8, 0.8, 0],
            rotate: [0, bean.sway > 0 ? 25 : -25],
          }}
          transition={{
            duration: bean.duration,
            delay: bean.delay,
            repeat: Infinity,
            ease: 'linear',
            opacity: { duration: bean.duration, delay: bean.delay, repeat: Infinity, times: [0, 0.15, 0.85, 1] },
          }}
        >
          <CoffeeBeanShape />
        </motion.div>
      ))}
    </div>
  );
}

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

  const reduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen bg-background text-foreground flex items-center justify-center p-4 sm:p-6 transition-colors duration-200 overflow-hidden">
      <AmbientBackground />
      <FloatingBeans />
      <motion.div
        initial={reduceMotion ? undefined : { opacity: 0, y: 16, scale: 0.98 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md bg-card/95 backdrop-blur-md rounded-3xl border border-border/80 shadow-2xl p-6 sm:p-8 space-y-6">
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
      </motion.div>
    </div>
  );
}
