import './viewer.css';
import { useEffect } from 'react';
import type { CertFile } from '../../shared/types';
import { api } from '../api';
import * as I from '../icons';

export function CertViewer({ participantId, owner, file, onClose }: { participantId: number; owner: string; file: CertFile; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const src = api.certUrl(participantId, file.uploadedAt + file.size);
  const isPdf = file.mime === 'application/pdf';

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`Certificato medico di ${owner}`}>
      <div className="viewer-bar">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="kicker">Certificato medico · {owner}</div>
          <div className="file-name">{file.name}</div>
        </div>
        <a className="btn btn-secondary" href={api.certUrl(participantId, file.uploadedAt + file.size, true)} download={file.name}>
          <I.Download /> Scarica
        </a>
        <button type="button" className="btn btn-primary" onClick={onClose} autoFocus><I.X /> Chiudi</button>
      </div>
      <div className="viewer-body">
        {isPdf
          ? <iframe src={src} title="Certificato" />
          : <img src={src} alt="Certificato medico" />}
      </div>
    </div>
  );
}
