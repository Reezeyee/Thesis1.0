import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, MessageSquareText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

export interface TempPasswordReveal {
  displayName: string;
  email: string;
  tempPassword: string;
  phoneNumber?: string;
  smsBody: string;
}

/**
 * Shown right after an admin approves a worker's password reset. Displays the brand-new
 * temporary password the backend just set (via the Firebase Admin SDK) so the admin can copy it
 * or, if the worker has a phone number on file, text it to them in one tap. Styled to match the
 * site's coffee-farm palette and the same enter/exit animation used by every other dialog here
 * (Radix Dialog's built-in fade + zoom, see ui/dialog.tsx).
 */
export function TempPasswordModal({
  data,
  onClose,
}: {
  data: TempPasswordReveal | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!data) setCopied(false);
  }, [data]);

  const handleCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, insecure context) -- the password is still visible
      // on screen, so this is a soft failure.
    }
  };

  const handleTextViaSms = () => {
    if (!data?.phoneNumber) return;
    window.open(`sms:${data.phoneNumber}?body=${encodeURIComponent(data.smsBody)}`, '_blank');
  };

  return (
    <Dialog
      open={!!data}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-3xl border border-border/70 bg-card p-0 shadow-2xl duration-300">
        {data ? (
          <div className="p-6 sm:p-7">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#6b21a8]/15 text-[#6b21a8]">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6b21a8]/25" />
                <KeyRound className="relative z-10 h-7 w-7" />
              </div>
              <DialogTitle className="text-lg font-bold font-heading text-foreground">
                New Temporary Password
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-muted-foreground">
                For <span className="font-semibold text-foreground">{data.displayName}</span>
                {data.email ? ` · ${data.email}` : ''}
              </DialogDescription>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-[#6b21a8]/30 bg-[#6b21a8]/5 px-4 py-4 animate-in fade-in zoom-in-95 duration-300">
              <span className="break-all font-mono text-lg font-bold tracking-widest text-[#3e2723] dark:text-[#f5e9df]">
                {data.tempPassword}
              </span>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#6b21a8]/30 bg-white/70 px-2.5 py-1.5 text-xs font-bold text-[#6b21a8] transition-all active:scale-95 hover:bg-white dark:bg-black/20 dark:hover:bg-black/30"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
              Shown once -- make sure it reaches {data.displayName.split(' ')[0] || 'the worker'}{' '}
              now. They'll be asked to set their own password right after logging in with it.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              {data.phoneNumber ? (
                <button
                  type="button"
                  onClick={handleTextViaSms}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2d5016] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-95 hover:bg-[#1b3310]"
                >
                  <MessageSquareText className="h-4 w-4" /> Text to {data.phoneNumber}
                </button>
              ) : (
                <p className="text-center text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  No phone number on file -- copy the password above and relay it yourself.
                </p>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl border border-border/70 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
