import { useState } from 'react';

type Azione = 'dati' | 'backup' | 'cartellaBackup' | 'aggiornamenti';

/** Messages from the main process arrive as "Error invoking remote method '…': Error: <testo>". */
function cleanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^Error invoking remote method '[^']*': (Error: )?/, '') || 'Operazione non riuscita.';
}

/** Impostazioni → App desktop. Rendered only inside the Electron app (window.fitflow exists). */
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
    <>
      <div className="section-desc text-muted">
        Versione {desktop.versione}. I dati restano su questo computer, fuori dall'app: un aggiornamento non li tocca.
        Per sicurezza, ogni tanto crea un backup e copialo su una chiavetta o un altro disco.
      </div>
      <div className="btn-row-8" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" disabled={busy !== null}
          onClick={() => run('dati', () => desktop.apriCartellaDati())}>Apri cartella dati</button>
        <button type="button" className="btn btn-secondary" disabled={busy !== null}
          onClick={() => run('backup', async () => `Backup salvato in ${await desktop.creaBackup()}`)}>
          {busy === 'backup' ? 'Backup in corso…' : 'Crea backup ora'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy !== null}
          onClick={() => run('cartellaBackup', () => desktop.apriCartellaBackup())}>Apri cartella backup</button>
        <button type="button" className="btn btn-secondary" disabled={busy !== null}
          onClick={() => run('aggiornamenti', () => desktop.controllaAggiornamenti())}>
          {busy === 'aggiornamenti' ? 'Controllo in corso…' : 'Controlla aggiornamenti'}
        </button>
      </div>
      {info && <div className="empty text-muted" role="status" style={{ wordBreak: 'break-all' }}>{info}</div>}
      {error && <div className="error-box settings-error" role="alert">{error}</div>}
    </>
  );
}
