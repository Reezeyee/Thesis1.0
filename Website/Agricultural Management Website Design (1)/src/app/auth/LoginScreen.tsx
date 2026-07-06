import { useState, type FormEvent } from 'react';
import { Coffee } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-sm rounded-2xl border border-[#4a2c2a]/15 shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#2d5016] flex items-center justify-center">
            <Coffee className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#3e2723]">Acojido Farm Admin</h1>
            <p className="text-sm text-muted-foreground">Sign in with the same account as the mobile app</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username or email</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              className="bg-white border-[#4a2c2a]/20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="bg-white border-[#4a2c2a]/20"
            />
          </div>
          {(localError || error) && (
            <p className="text-sm text-red-600">{localError ?? error}</p>
          )}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#2d5016] hover:bg-[#234010] text-white"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Uses Firebase project <span className="font-medium">thesis-bbcde</span> — shared with the Android app.
        </p>
      </div>
    </div>
  );
}
