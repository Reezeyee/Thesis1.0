import { useState } from 'react';
import { Camera, X } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';

/**
 * The rider's proof-of-delivery photo for one order. The photo lives in its own document
 * (delivery_proofs/{orderId}) so it is only downloaded when someone asks to see it -- Admin, the buyer
 * whose order it is, or the rider (firestore.rules enforces who may read it).
 */
export function DeliveryProofPhoto({ orderId, takenAtLabel }: { orderId: string; takenAtLabel?: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [photo, setPhoto] = useState('');
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (state === 'ready') {
      setOpen(true);
      return;
    }
    setState('loading');
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.DELIVERY_PROOFS, orderId));
      const data = snap.data();
      const src = typeof data?.photo === 'string' ? data.photo : '';
      // Only ever render a JPEG data URL (firestore.rules enforces the same on write).
      if (!src.startsWith('data:image/jpeg;base64,')) throw new Error('no photo');
      setPhoto(src);
      setState('ready');
      setOpen(true);
    } catch {
      setState('error');
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void load()}
        disabled={state === 'loading'}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline cursor-pointer disabled:opacity-60"
      >
        <Camera className="w-3.5 h-3.5" />
        {state === 'loading' ? 'Loading photo…' : 'View delivery photo'}
        {takenAtLabel ? <span className="font-normal text-muted-foreground no-underline"> · {takenAtLabel}</span> : null}
      </button>
      {state === 'error' ? <p className="text-[11px] text-rose-500">The delivery photo couldn't be loaded.</p> : null}

      {open && photo ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-label="Proof of delivery photo"
          onClick={() => setOpen(false)}
        >
          <div className="relative max-h-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Close photo"
              onClick={() => setOpen(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-background text-foreground shadow flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={photo} alt="Proof of delivery" className="max-h-[80vh] w-auto rounded-xl shadow-2xl" />
            <p className="mt-2 text-center text-xs text-white/90">Proof of delivery{takenAtLabel ? ` · ${takenAtLabel}` : ''}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
