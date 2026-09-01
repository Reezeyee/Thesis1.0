import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Banknote, CheckCircle2, Receipt, Smartphone, Wallet } from 'lucide-react';
import type { PayrollPaymentMethod } from '../types/appState';
import { payrollPaymentMethodLabel } from '../lib/profitUi';
import { formatCurrency } from '../lib/currencyFormat';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

export type PayrollPayTarget = {
  workerId: number;
  name: string;
  role: string;
  amount: number;
  periodLabel: string;
  paycheckDateLabel: string;
};

type Step = 'confirm' | 'method' | 'receipt';

const METHOD_OPTIONS: {
  id: PayrollPaymentMethod;
  label: string;
  hint: string;
  icon: typeof Wallet;
}[] = [
  { id: 'cash', label: 'Cash', hint: 'Handed to worker on site with receipt no.', icon: Wallet },
  { id: 'e-money', label: 'E-money', hint: 'GCash, Maya, or similar', icon: Smartphone },
];

type Props = {
  target: PayrollPayTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving?: boolean;
  onComplete: (method: PayrollPaymentMethod) => Promise<{ slipRef: string } | null>;
};

const stepMotion = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.22, ease: 'easeOut' as const },
};

export function PayrollPayFlowDialog({ target, open, onOpenChange, saving = false, onComplete }: Props) {
  const [step, setStep] = useState<Step>('confirm');
  const [method, setMethod] = useState<PayrollPaymentMethod>('cash');
  const [slipRef, setSlipRef] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('confirm');
      setMethod('cash');
      setSlipRef('');
      setSubmitting(false);
    }
  }, [open, target]);

  const busy = saving || submitting;

  const submitPayment = async (selected: PayrollPaymentMethod) => {
    if (!target || busy) return;
    setMethod(selected);
    setSubmitting(true);
    const result = await onComplete(selected);
    setSubmitting(false);
    if (!result) return;
    setSlipRef(result.slipRef);
    setStep('receipt');
  };

  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md bg-card border-border/80 text-card-foreground overflow-hidden rounded-xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground font-heading font-bold text-lg">
            {step === 'confirm' && 'Confirm payroll payment'}
            {step === 'method' && 'Payment method'}
            {step === 'receipt' && 'Payment recorded'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === 'confirm' && `You are about to pay ${target.name} for ${target.periodLabel}.`}
            {step === 'method' && 'Choose how this wage was sent to the worker.'}
            {step === 'receipt' && 'A wage receipt was saved and added to transaction history.'}
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-[200px] py-1">
          <AnimatePresence mode="wait">
            {step === 'confirm' ? (
              <motion.div key="confirm" {...stepMotion} className="space-y-4">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-foreground/90">
                    <p className="font-bold text-foreground mb-1 font-heading">Are you sure you want to pay now?</p>
                    <p>
                      This will mark <span className="font-semibold text-foreground">{target.name}</span> as paid for{' '}
                      <span className="font-semibold text-foreground">{target.periodLabel}</span> and cannot be undone from this
                      screen.
                    </p>
                  </div>
                </div>
                <div className="rounded-xl bg-muted/40 border border-border/60 px-4 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-muted-foreground">{target.role}</p>
                    <p className="font-bold text-foreground font-heading">{target.name}</p>
                  </div>
                  <p className="text-xl font-bold font-mono text-emerald-500">
                    {formatCurrency(target.amount)}
                  </p>
                </div>
              </motion.div>
            ) : null}

            {step === 'method' ? (
              <motion.div key="method" {...stepMotion} className="space-y-3">
                <p className="text-xs text-muted-foreground font-mono">What kind of transaction was this?</p>
                <div className="grid gap-2">
                  {METHOD_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={busy}
                        onClick={() => void submitPayment(opt.id)}
                        className="w-full text-left rounded-xl border border-border/60 p-3 bg-muted/30 hover:border-accent hover:bg-accent/10 transition-all flex items-start gap-3 disabled:opacity-60 cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold font-heading text-foreground">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.hint}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : null}

            {step === 'receipt' ? (
              <motion.div key="receipt" {...stepMotion} className="space-y-4 text-center py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-base font-bold font-heading text-foreground">
                    {formatCurrency(target.amount)} paid
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {target.name} · {target.periodLabel}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/40 border border-border/60 p-3 text-left space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Receipt Ref:</span>
                    <span className="font-mono font-bold text-foreground">{slipRef || 'PAY-REF-LOCAL'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Method:</span>
                    <span className="font-medium text-foreground">{payrollPaymentMethodLabel(method)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paycheck Date:</span>
                    <span className="font-medium text-foreground">{target.paycheckDateLabel}</span>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'confirm' && (
            <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                disabled={busy}
                onClick={() => setStep('method')}
              >
                Continue to pay
              </Button>
            </>
          )}
          {step === 'method' && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => setStep('confirm')}>
              Back
            </Button>
          )}
          {step === 'receipt' && (
            <Button
              type="button"
              className="w-full bg-accent text-accent-foreground font-bold hover:bg-accent/90"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
