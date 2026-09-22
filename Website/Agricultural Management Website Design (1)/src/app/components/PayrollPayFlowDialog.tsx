import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, MinusCircle, Plus, Smartphone, Wallet } from 'lucide-react';
import type { PayrollDeductionLine, PayrollPaymentMethod } from '../types/appState';
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
import { Input } from './ui/input';

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
  onComplete: (method: PayrollPaymentMethod, deductions: PayrollDeductionLine[]) => Promise<{ slipRef: string } | null>;
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
  const [deductions, setDeductions] = useState<PayrollDeductionLine[]>([]);
  const [draftReason, setDraftReason] = useState('');
  const [draftAmount, setDraftAmount] = useState('');

  useEffect(() => {
    if (open) {
      setStep('confirm');
      setMethod('cash');
      setSlipRef('');
      setSubmitting(false);
      setDeductions([]);
      setDraftReason('');
      setDraftAmount('');
    }
  }, [open, target]);

  const busy = saving || submitting;

  const deductionsTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
  const netAmount = target ? Math.max(0, target.amount - deductionsTotal) : 0;

  const addDeduction = () => {
    const amount = Number.parseFloat(draftAmount.replace(/[₱,\s]/g, ''));
    if (!draftReason.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setDeductions((prev) => [...prev, { reason: draftReason.trim(), amount }]);
    setDraftReason('');
    setDraftAmount('');
  };

  const removeDeduction = (index: number) => {
    setDeductions((prev) => prev.filter((_, i) => i !== index));
  };

  const submitPayment = async (selected: PayrollPaymentMethod) => {
    if (!target || busy) return;
    setMethod(selected);
    setSubmitting(true);
    const result = await onComplete(selected, deductions);
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
                    {formatCurrency(netAmount)}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Deductions (optional)</p>
                  <p className="text-[11px] text-muted-foreground -mt-1.5">
                    Docked from this paycheck -- e.g. broken equipment, a cash advance.
                  </p>
                  {deductions.length > 0 ? (
                    <div className="space-y-1.5">
                      {deductions.map((d, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5"
                        >
                          <span className="text-xs text-foreground truncate">{d.reason}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono font-semibold text-rose-500">
                              -{formatCurrency(d.amount)}
                            </span>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => removeDeduction(i)}
                              className="text-muted-foreground hover:text-rose-500 disabled:opacity-50 cursor-pointer"
                            >
                              <MinusCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <Input
                      value={draftReason}
                      onChange={(e) => setDraftReason(e.target.value)}
                      placeholder="Reason, e.g. Broke irrigation valve"
                      disabled={busy}
                      className="h-8 text-xs flex-1"
                    />
                    <Input
                      value={draftAmount}
                      onChange={(e) => setDraftAmount(e.target.value)}
                      placeholder="₱"
                      inputMode="decimal"
                      disabled={busy}
                      className="h-8 text-xs w-20"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || !draftReason.trim() || !draftAmount.trim()}
                      onClick={addDeduction}
                      className="h-8 px-2 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {deductions.length > 0 ? (
                    <div className="flex justify-between text-xs pt-1 border-t border-border/50">
                      <span className="text-muted-foreground">Gross {formatCurrency(target.amount)} - Deductions {formatCurrency(deductionsTotal)}</span>
                      <span className="font-semibold text-foreground">Net {formatCurrency(netAmount)}</span>
                    </div>
                  ) : null}
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
                    {formatCurrency(netAmount)} paid
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
                  {deductions.length > 0 ? (
                    <>
                      <div className="flex justify-between pt-1 border-t border-border/50">
                        <span className="text-muted-foreground">Gross:</span>
                        <span className="font-medium text-foreground">{formatCurrency(target.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Deductions:</span>
                        <span className="font-medium text-rose-500">-{formatCurrency(deductionsTotal)}</span>
                      </div>
                    </>
                  ) : null}
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
