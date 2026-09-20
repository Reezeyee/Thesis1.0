import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Coffee } from 'lucide-react';
import type { BuyerFulfillmentMethod } from '../types/appState';

/** How long the popup stays before fading away on its own. */
const VISIBLE_MS = 3200;

// Coffee-farm palette: roasted brown, ripe-cherry orange, gold, cream, leaf green.
const CONFETTI_COLORS = ['#4a2c2a', '#c45c26', '#f5a623', '#fefdfb', '#7a9a5b'];

function fireConfetti() {
  const base = { colors: CONFETTI_COLORS, zIndex: 100, ticks: 220, gravity: 0.9 };
  // Centre pop, then two side cannons a beat later so it feels like a celebration, not a flash.
  confetti({ ...base, particleCount: 70, spread: 75, startVelocity: 42, origin: { x: 0.5, y: 0.55 } });
  window.setTimeout(() => {
    confetti({ ...base, particleCount: 45, angle: 60, spread: 60, startVelocity: 55, origin: { x: 0, y: 0.7 } });
    confetti({ ...base, particleCount: 45, angle: 120, spread: 60, startVelocity: 55, origin: { x: 1, y: 0.7 } });
  }, 180);
}

/**
 * "Thank you" celebration shown right after a buyer places an order: a backdrop, a card that
 * springs in with a checkmark that draws itself, a confetti burst, and a countdown bar. It
 * dismisses itself after VISIBLE_MS (or on click / Escape). With "reduce motion" on, it is a
 * plain fade with no confetti.
 */
export function OrderThankYou({
  open,
  buyerName,
  method,
  onClose,
}: {
  open: boolean;
  buyerName: string;
  method: BuyerFulfillmentMethod;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    if (!reduceMotion) fireConfetti();
    const timer = window.setTimeout(onClose, VISIBLE_MS);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, reduceMotion]);

  const firstName = buyerName.trim().split(/\s+/)[0] || 'friend';
  const message = method === 'delivery'
    ? "We're preparing your coffee and will arrange delivery soon."
    : "We're getting your coffee ready. Pick it up at the farm when we contact you.";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="order-thank-you"
          role="status"
          aria-live="polite"
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4 cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45 } }}
        >
          <motion.div
            className="relative w-full max-w-xs overflow-hidden rounded-3xl bg-card text-card-foreground border border-border/60 shadow-2xl px-6 pt-8 pb-7 text-center"
            initial={reduceMotion ? { opacity: 0 } : { scale: 0.55, y: 40, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { scale: 0.9, y: -16, opacity: 0, transition: { duration: 0.4 } }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
          >
            {/* Badge: a ring that pulses outward, then a check that draws itself. */}
            <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
              {reduceMotion ? null : (
                <motion.span
                  className="absolute inset-0 rounded-full bg-emerald-500/30"
                  initial={{ scale: 0.6, opacity: 0.9 }}
                  animate={{ scale: 1.7, opacity: 0 }}
                  transition={{ duration: 1.1, delay: 0.25, ease: 'easeOut' }}
                />
              )}
              <motion.span
                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40"
                initial={reduceMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.1 }}
              >
                <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <motion.path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    initial={reduceMotion ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.45, delay: 0.35, ease: 'easeOut' }}
                  />
                </svg>
              </motion.span>
            </div>

            <motion.h2
              className="text-xl font-extrabold"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              Thank you, {firstName}!
            </motion.h2>
            <motion.p
              className="mt-1 text-xs text-muted-foreground"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
            >
              Your order has been placed.
            </motion.p>
            <motion.p
              className="mt-2 flex items-start justify-center gap-1.5 text-xs text-foreground/80"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
            >
              <motion.span
                className="mt-0.5 shrink-0"
                animate={reduceMotion ? undefined : { rotate: [0, -12, 12, -8, 0] }}
                transition={{ duration: 0.9, delay: 0.9 }}
              >
                <Coffee className="h-3.5 w-3.5 text-[#c45c26]" />
              </motion.span>
              <span>{message}</span>
            </motion.p>

            {/* Countdown: shrinks over the time the popup stays, so it's clear it will go away. */}
            <div className="absolute inset-x-0 bottom-0 h-1 bg-muted/60">
              <motion.div
                className="h-full origin-left bg-emerald-500"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: VISIBLE_MS / 1000, ease: 'linear' }}
              />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
