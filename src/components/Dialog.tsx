import { useEffect, useRef, type ReactNode } from 'react';
import * as I from '../icons';

/** Modal over a backdrop: closes on backdrop click and Escape, keeps focus inside while open. */
export function Dialog({ onClose, className, labelledBy, zIndex, children }: {
  onClose: () => void; className: string; labelledBy: string; zIndex: number; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Only the topmost dialog reacts; the certificate viewer handles its own Escape.
      const dialogs = document.querySelectorAll('.dialog');
      if (e.key === 'Escape' && dialogs[dialogs.length - 1] === ref.current && !document.querySelector('.viewer')) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);

  return (
    <div className="dialog-backdrop" style={{ zIndex }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="btn btn-icon" aria-label="Chiudi" onClick={onClick}><I.X size={16} /></button>;
}
