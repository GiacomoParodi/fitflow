// Aggiornamenti dell'app.
// - Windows (app installata): electron-updater scarica e installa la nuova versione dalle release GitHub.
// - Mac (app non firmata, Squirrel.Mac non può aggiornarla) e sviluppo: controlla l'ultima release
//   su GitHub e propone di aprire la pagina di download.
// I dati stanno in userData, fuori dall'app: un aggiornamento non li tocca.
// Se il repository è privato GitHub non risponde senza accesso: il controllo manuale apre allora la
// pagina delle versioni nel browser (dove l'utente ha fatto l'accesso), quello all'avvio resta in silenzio.
import { app, BrowserWindow, dialog, net, shell, type MessageBoxOptions } from 'electron';
import electronUpdater from 'electron-updater';
import { isNewer } from './version';

const OWNER = 'GiacomoParodi';
const REPO = 'fitflow';
export const RELEASES_PAGE = `https://github.com/${OWNER}/${REPO}/releases`;
const LATEST_API = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;

let running: Promise<void> | null = null;

/** Checks for a new version. `manual`: the user asked, so report every outcome (errors included). */
export function checkForUpdates(manual: boolean): Promise<void> {
  if (!running) {
    const useUpdater = process.platform === 'win32' && app.isPackaged;
    running = (useUpdater ? viaElectronUpdater(manual) : viaGitHubApi(manual))
      .catch(e => {
        console.error('Controllo aggiornamenti non riuscito:', e);
        if (manual) return offerReleasesPage();
      })
      .finally(() => { running = null; });
  }
  return running;
}

async function message(opts: MessageBoxOptions): Promise<number> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const options: MessageBoxOptions = { title: 'FitFlow', buttons: ['OK'], ...opts };
  const res = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
  return res.response;
}

/** Used when GitHub can't be asked directly (private repository, no connection): check in the browser. */
async function offerReleasesPage() {
  const choice = await message({
    type: 'info',
    message: 'Controlla le nuove versioni sulla pagina di GitHub.',
    detail: `Stai usando FitFlow ${app.getVersion()}. Si apre la pagina delle versioni (serve aver fatto l'accesso a GitHub): `
      + `se ce n'è una più recente, scarica l'installer per il tuo computer e aprilo. I tuoi dati restano al loro posto.`,
    buttons: ['Apri la pagina delle versioni', 'Annulla'],
    defaultId: 0,
    cancelId: 1,
  });
  if (choice === 0) await shell.openExternal(RELEASES_PAGE);
}

function upToDate() {
  return message({ type: 'info', message: 'FitFlow è aggiornata.', detail: `Stai usando l'ultima versione (${app.getVersion()}).` });
}

async function viaElectronUpdater(manual: boolean) {
  const { autoUpdater } = electronUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const result = await autoUpdater.checkForUpdates();
  const version = result?.updateInfo.version;
  if (!result || !version || !result.isUpdateAvailable || !isNewer(version, app.getVersion())) {
    if (manual) await upToDate();
    return;
  }

  const choice = await message({
    type: 'question',
    message: `È disponibile FitFlow ${version}. Scaricare e installare?`,
    detail: `Versione in uso: ${app.getVersion()}. I tuoi dati non vengono toccati dall'aggiornamento.`,
    buttons: ['Scarica e installa', 'Più tardi'],
    defaultId: 0,
    cancelId: 1,
  });
  if (choice !== 0) return;

  const win = BrowserWindow.getAllWindows()[0];
  const onProgress = (p: { percent: number }) => win?.setProgressBar(p.percent / 100);
  autoUpdater.on('download-progress', onProgress);
  try {
    await autoUpdater.downloadUpdate();
  } catch (e) {
    // The user explicitly agreed to download: always tell them it failed.
    await message({ type: 'warning', message: 'Download dell\'aggiornamento non riuscito.', detail: 'Verifica la connessione a Internet e riprova da Aiuto → Controlla aggiornamenti.' });
    console.error(e);
    return;
  } finally {
    autoUpdater.off('download-progress', onProgress);
    win?.setProgressBar(-1);
  }

  const restart = await message({
    type: 'info',
    message: 'Aggiornamento scaricato. Riavvia ora per aggiornare.',
    detail: 'Se scegli "Più tardi", l\'aggiornamento verrà installato alla prossima chiusura di FitFlow.',
    buttons: ['Riavvia ora', 'Più tardi'],
    defaultId: 0,
    cancelId: 1,
  });
  if (restart === 0) autoUpdater.quitAndInstall();
}

async function viaGitHubApi(manual: boolean) {
  const res = await net.fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'FitFlow' } });
  if (res.status === 404) {
    // Private repository (or no release yet): GitHub won't tell us without signing in.
    if (manual) await offerReleasesPage();
    return;
  }
  if (!res.ok) throw new Error(`GitHub ha risposto ${res.status}`);
  const release = await res.json() as { tag_name?: string; html_url?: string };
  const version = (release.tag_name ?? '').replace(/^v/i, '');
  if (!version || !isNewer(version, app.getVersion())) {
    if (manual) await upToDate();
    return;
  }

  const isMac = process.platform === 'darwin';
  const file = isMac ? `FitFlow-${version}-${process.arch === 'arm64' ? 'arm64' : 'x64'}.dmg` : '';
  const detail = isMac
    ? `Stai usando la versione ${app.getVersion()}.\n\n`
      + `Come aggiornare:\n`
      + `1. Scarica il file ${file} dalla pagina che si apre${process.arch === 'arm64' ? ' (Mac con chip Apple M1, M2…)' : ' (Mac con processore Intel)'}.\n`
      + `2. Chiudi FitFlow, apri il file scaricato e trascina FitFlow nella cartella Applicazioni, scegliendo "Sostituisci".\n\n`
      + `I tuoi dati (iscritti, pagamenti, certificati) restano al loro posto: non vengono toccati.`
    : `Stai usando la versione ${app.getVersion()}. Scarica la nuova versione dalla pagina che si apre: i tuoi dati restano al loro posto.`;
  const choice = await message({
    type: 'info',
    message: `È disponibile FitFlow ${version}.`,
    detail,
    buttons: ['Apri la pagina di download', 'Più tardi'],
    defaultId: 0,
    cancelId: 1,
  });
  if (choice === 0) await shell.openExternal(release.html_url || RELEASES_PAGE);
}
