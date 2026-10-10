import './viewer.css';
import { useEffect, useRef } from 'react';
import { fmt } from '../../shared/dates';
import type { CertFile } from '../../shared/types';
import { api } from '../api';
import * as I from '../icons';

/** Full-window document viewer (like Preview / Quick Look): translucent toolbar over a dark stage. */
export function CertViewer({ participantId, owner, file, onClose }: { participantId: number; owner: string; file: CertFile; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), iframe')];
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      if (!ref.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }); };
  }, []);

  const src = api.certUrl(participantId, file.uploadedAt + file.size);
  const isPdf = file.mime === 'application/pdf';
  const kb = Math.max(1, Math.round(file.size / 1024));

  return (
    <div ref={ref} className="viewer" role="dialog" aria-modal="true" aria-label={`Certificato medico di ${owner}`}>
      <div className="viewer-bar">
        <div className="viewer-file-icon" aria-hidden="true"><I.FileCheck /></div>
        <div className="viewer-title">
          <div className="viewer-name" title={file.name}>{file.name}</div>
          <div className="viewer-meta">Certificato medico · {owner} · {isPdf ? 'PDF' : 'Immagine'}, {kb} KB · {fmt(file.uploadedAt)}</div>
        </div>
        <div className="viewer-actions">
          <a className="btn btn-secondary" href={api.certUrl(participantId, file.uploadedAt + file.size, true)} download={file.name}>
            <I.Download /> Scarica
          </a>
          <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>Chiudi</button>
        </div>
      </div>
      <div className="viewer-stage" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
        {isPdf
          ? <iframe className="viewer-doc viewer-pdf" src={src} title={`Certificato medico di ${owner}`} />
          : <img className="viewer-doc" src={src} alt={`Certificato medico di ${owner}`} />}
      </div>
    </div>
  );
}
