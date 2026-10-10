/** API dell'app desktop (Electron), esposta dal preload. Assente quando FitFlow gira nel browser. */
export interface FitflowDesktop {
  /** Versione dell'app, es. "1.2.0". */
  versione: string;
  /** Sistema operativo: 'darwin' (Mac), 'win32', 'linux'. */
  piattaforma: string;
  apriCartellaDati(): Promise<void>;
  /** Salva una copia del database nella cartella backup e ne restituisce il percorso. */
  creaBackup(): Promise<string>;
  apriCartellaBackup(): Promise<void>;
  /** Controlla se c'è una nuova versione; l'esito viene mostrato in una finestra di dialogo. */
  controllaAggiornamenti(): Promise<void>;
}

declare global {
  interface Window {
    fitflow?: FitflowDesktop;
  }
}
