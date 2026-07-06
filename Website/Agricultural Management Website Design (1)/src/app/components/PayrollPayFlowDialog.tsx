import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Banknote, CheckCircle2, Receipt, Smartphone, Wallet } from 'lucide-react';
import type { PayrollPaymentMethod } from '../types/appState';
import { payrollPaymentMethodLabel } from '../lib/profitUi';
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
  const [method, setMethod] = useState<PayrollPaymentMethod | null>(null);
  const [slipRef, setSlipRef] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => {
        setStep('confirm');
        setMethod(null);
        setSlipRef(null);
        setSubmitting(false);
      }, 200);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open]);

  const busy = saving || submitting;

  const close = () => {
    if (busy) return;
    onOpenChange(false);
  };

  const confirmPay = () => setStep('method');

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
      <DialogContent className="sm:max-w-md bg-[#fdfbf7] border-[#4a2c2a]/15 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-[#3e2723]">
            {step === 'confirm' && 'Confirm payroll payment'}
            {step === 'method' && 'Payment method'}
            {step === 'receipt' && 'Payment recorded'}
          </DialogTitle>
          <DialogDescription>
            {step === 'confirm' && `You are about to pay ${target.name} for ${target.periodLabel}.`}
            {step === 'method' && 'Choose how this wage was sent to the worker.'}
            {step === 'receipt' && 'A wage receipt was saved and added to transaction history.'}
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-[200px] py-1">
          <AnimatePresence mode="wait">
            {step === 'confirm' ? (
              <motion.div key="confirm" {...stepMotion} className="space-y-4">
                <div className="rounded-xl border border-[#d4a574]/40 bg-[#fff8ed] px-4 py-3 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-[#b45309] shrink-0 mt-0.5" />
                  <div className="text-sm text-[#5d4037]">
                    <p className="font-medium text-[#3e2723] mb-1">Are you sure you want to pay now?</p>
                    <p>
                      This will mark <span className="font-semibold">{target.name}</span> as paid for{' '}
                      <span className="font-semibold">{target.periodLabel}</span> and cannot be undone from this
                      screen.
                    </p>
                  </div>
                </div>
                <div className="rounded-xl bg-[#f5f1ed] border border-[#4a2c2a]/10 px-4 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-muted-foreground">{target.role}</p>
                    <p className="font-medium text-[#3e2723]">{target.name}</p>
                  </div>
                  <p className="text-xl font-semibold tabular-nums text-[#2d5016]">
                    ₱{target.amount.toLocaleString('en-PH')}
                  </p>
                </div>
              </motion.div>
            ) : null}

            {step === 'method' ? (
              <motion.div key="method" {...stepMotion} className="space-y-3">
                <p className="text-sm text-muted-foreground">What kind of transaction was this?</p>
                <div className="grid gap-2">
                  {METHOD_OPTIONS.map((opt, i) => {
                    const Icon = opt.icon;
                    const selected = method === opt.id;
                    return (
                      <motion.button
                        key={opt.id}
                        type="button"
                        disabled={busy}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => void submitPayment(opt.id)}
                        className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                          selected
                            ? 'border-[#2d5016] bg-[#2d5016]/10 ring-2 ring-[#2d5016]/25'
                            : 'border-[#4a2c2a]/15 bg-white hover:border-[#2d5016]/40 hover:bg-[#f5f1ed]'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            selected ? 'bg-[#2d5016] text-white' : 'bg-[#4a2c2a]/10 text-[#4a2c2a]'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[#3e2723]">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.hint}</p>
                        </div>
                        {submitting && selected ? (
                          <span className="text-xs text-[#2d5016] font-medium animate-pulse">Saving…</span>
                        ) : null}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : null}

            {step === 'receipt' && slipRef && method ? (
              <motion.div key="receipt" {...stepMotion} className="space-y-4">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  className="flex flex-col items-center py-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 18 }}
                    className="w-16 h-16 rounded-full bg-[#2d5016]/15 flex items-center justify-center mb-3"
                  >
                    <CheckCircle2 className="w-9 h-9 text-[#2d5016]" />
                  </motion.div>
                  <p className="text-sm font-medium text-[#3e2723]">Payment successful</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-xl border-2 border-dashed border-[#4a2c2a]/25 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#4a2c2a]/10">
                    <Receipt className="w-5 h-5 text-[#4a2c2a]" />
                    <span className="text-sm font-semibold text-[#3e2723]">
                      {method === 'cash' ? 'Cash wage receipt' : 'Wage receipt'}
                    </span>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Worker</dt>
                      <dd className="font-medium text-[#3e2723] text-right">{target.name}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Period</dt>
                      <dd className="text-right">{target.periodLabel}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Method</dt>
                      <dd className="font-medium text-right">{payrollPaymentMethodLabel(method)}</dd>
                    </div>
                    <div className="flex justify-between gap-2 pt-2 border-t border-[#4a2c2a]/10">
                      <dt className="text-muted-foreground">Amount</dt>
                      <dd className="text-lg font-semibold tabular-nums text-[#2d5016]">
                        ₱{target.amount.toLocaleString('en-PH')}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{method === 'cash' ? 'Cash receipt no.' : 'Receipt no.'}</dt>
                      <dd className="font-mono text-xs text-[#5d4037] text-right break-all">{slipRef}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Date</dt>
                      <dd className="text-right">{target.paycheckDateLabel}</dd>
                    </div>
                  </dl>
                </motion.div>
                <p className="text-xs text-center text-muted-foreground">
                  This receipt appears on the worker card and in Transaction history under Payroll &amp; wages.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'confirm' ? (
            <>
              <Button type="button" variant="outline" onClick={close} disabled={busy} className="border-[#4a2c2a]/30">
                Cancel
              </Button>
              <Button type="button" onClick={confirmPay} className="bg-[#2d5016] hover:bg-[#234010] text-white">
                <Banknote className="w-4 h-4 mr-2" />
                Yes, continue
              </Button>
            </>
          ) : null}
          {step === 'method' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('confirm')}
              disabled={busy}
              className="border-[#4a2c2a]/30"
            >
              Back
            </Button>
          ) : null}
          {step === 'receipt' ? (
            <Button type="button" onClick={close} className="bg-[#2d5016] hover:bg-[#234010] text-white w-full sm:w-auto">
              Done
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
