import { useState } from 'react';

type Azione = 'dati' | 'backup' | 'cartellaBackup' | 'aggiornamenti';

/** Messages from the main process arrive as "Error invoking remote method '…': Error: <testo>". */
function cleanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^Error invoking remote method '[^']*': (Error: )?/, '') || 'Operazione non riuscita.';
}

/**
 * Impostazioni → App desktop. Rendered only inside the Electron app (window.fitflow exists).
 * Uses the grouped-row classes of Impostazioni (imp-group, imp-row: src/views/impostazioni.css).
 */
export function DesktopSettings() {
  const desktop = window.fitflow;
  const [busy, setBusy] = useState<Azione | null>(null);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  if (!desktop) return null;

  const run = async (azione: Azione, fn: () => Promise<string | void>) => {
    setBusy(azione);
    setError('');
    setInfo('');
    try {
      const out = await fn();
      if (out) setInfo(out);
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="imp-body">
      <div className="imp-group-wrap">
        <h3 className="imp-group-title">GymPlan</h3>
        <div className="imp-group">
          <div className="imp-row">
            <div className="imp-row-text">
              <span className="imp-row-label">Versione</span>
              <div className="imp-row-hint">Un aggiornamento non tocca i tuoi dati.</div>
            </div>
            <span className="imp-version">{desktop.versione}</span>
          </div>
          <div className="imp-row">
            <div className="imp-row-text"><span className="imp-row-label">Aggiornamenti</span></div>
            <button type="button" className="btn btn-secondary" disabled={busy !== null}
              onClick={() => run('aggiornamenti', () => desktop.controllaAggiornamenti())}>
              {busy === 'aggiornamenti' ? 'Controllo in corso…' : 'Controlla aggiornamenti'}
            </button>
          </div>
        </div>
      </div>

      <div className="imp-group-wrap">
        <h3 className="imp-group-title">Dati e backup</h3>
        <div className="imp-group">
          <div className="imp-row">
            <div className="imp-row-text">
              <span className="imp-row-label">Cartella dati</span>
              <div className="imp-row-hint">I dati restano su questo computer, fuori dall'app.</div>
            </div>
            <button type="button" className="btn btn-secondary" disabled={busy !== null}
              onClick={() => run('dati', () => desktop.apriCartellaDati())}>Apri cartella dati</button>
          </div>
          <div className="imp-row">
            <div className="imp-row-text">
              <span className="imp-row-label">Backup</span>
              <div className="imp-row-hint">Una copia del database nella cartella backup.</div>
            </div>
            <div className="imp-desk-buttons">
              <button type="button" className="btn btn-secondary" disabled={busy !== null}
                onClick={() => run('cartellaBackup', () => desktop.apriCartellaBackup())}>Apri cartella backup</button>
              <button type="button" className="btn btn-primary" disabled={busy !== null}
                onClick={() => run('backup', async () => `Backup salvato in ${await desktop.creaBackup()}`)}>
                {busy === 'backup' ? 'Backup in corso…' : 'Crea backup ora'}
              </button>
            </div>
          </div>
          {info && <div className="info-box imp-desk-msg" role="status">{info}</div>}
          {error && <div className="error-box imp-desk-msg" role="alert">{error}</div>}
        </div>
        <div className="imp-group-foot">Per sicurezza, ogni tanto crea un backup e copialo su una chiavetta o un altro disco.</div>
      </div>
    </div>
  );
}
