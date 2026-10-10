import './dialog-sheet.css';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import * as I from '../icons';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/** Lets CloseButton (and anything inside a dialog) close it with the exit animation. */
const DialogCtx = createContext<((then: () => void) => void) | null>(null);

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Modal window over a dimmed, blurred backdrop.
 * - Closes on backdrop click and Escape (only the topmost dialog reacts, and none while the certificate viewer is open).
 * - Keeps Tab focus inside, focuses the window (or a field rendered with `autoFocus`) on open, gives focus back on close.
 * - Plays a short exit animation when closed from the backdrop, Escape, `CloseButton` or `useDialogClose()`.
 *
 * `variant`:
 * - `"center"` (default): classic window centred on screen; size it with `className` (`dialog-wide`, `dialog-form`…).
 * - `"sheet"`: inspector panel docked to the right at full height (600px, full width under 700px) that slides in
 *   from the right edge. The panel itself scrolls: put a `.dialog-sheet-bar` first for a sticky translucent title bar,
 *   then the content inside `.dialog-sheet-body`.
 */
export function Dialog({ onClose, className = '', labelledBy, zIndex, variant = 'center', children }: {
  onClose: () => void; className?: string; labelledBy: string; zIndex: number; variant?: 'center' | 'sheet'; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  /** Plays the exit animation, then runs `then` (normally the parent's onClose). */
  const animateClose = useCallback((then: () => void) => {
    if (closingRef.current) return;
    if (reducedMotion()) return then();
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(then, variant === 'sheet' ? 190 : 130);
  }, [variant]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // Keep a field that asked for autoFocus; otherwise focus the window itself.
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true });

    const isTopmost = () => {
      const dialogs = document.querySelectorAll('.dialog');
      return dialogs[dialogs.length - 1] === ref.current && !document.querySelector('.viewer');
    };
    const onKey = (e: KeyboardEvent) => {
      const box = ref.current;
      if (!box || !isTopmost()) return;
      if (e.key === 'Escape') { e.preventDefault(); animateClose(() => closeRef.current()); return; }
      if (e.key !== 'Tab') return;
      // Focus trap: cycle through the visible controls of this window (not of a nested one).
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter(el => el.closest('.dialog') === box && el.getClientRects().length > 0);
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement;
      if (!box.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && (active === first || active === box)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }); };
  }, [animateClose]);

  const sheet = variant === 'sheet';
  return (
    <DialogCtx.Provider value={animateClose}>
      <div className={`dialog-backdrop${sheet ? ' dialog-backdrop-sheet' : ''}`} data-closing={closing || undefined} style={{ zIndex }}
        onMouseDown={e => { if (e.target === e.currentTarget) animateClose(() => closeRef.current()); }}>
        <div ref={ref} className={`dialog${sheet ? ' dialog-sheet' : ''} ${className}`.trim()} role="dialog" aria-modal="true"
          aria-labelledby={labelledBy} tabIndex={-1}>
          {children}
        </div>
      </div>
    </DialogCtx.Provider>
  );
}

/** Closes the surrounding dialog with its exit animation (a plain call outside a Dialog). */
export function useDialogClose(): (then: () => void) => void {
  return useContext(DialogCtx) ?? (then => then());
}

export function CloseButton({ onClick, label = 'Chiudi' }: { onClick: () => void; label?: string }) {
  const close = useDialogClose();
  return (
    <button type="button" className="btn btn-icon dialog-close" aria-label={label} title={label} onClick={() => close(onClick)}>
      <I.X size={15} />
    </button>
  );
}
