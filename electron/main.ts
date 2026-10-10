// Processo principale dell'app desktop: avvia il server locale e apre la finestra che lo mostra.
import '../server/quiet';
import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type IpcMainEvent, type IpcMainInvokeEvent, type MenuItemConstructorOptions } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/app';
import { backupDatabase } from '../server/db';
import { checkForUpdates, RELEASES_PAGE } from './updater';

type Server = Awaited<ReturnType<typeof startServer>>;

const here = path.dirname(fileURLToPath(import.meta.url));
// In sviluppo (`npm run desktop`) i dati stanno in una cartella separata, per non toccare quelli dell'app installata.
if (!app.isPackaged) app.setPath('userData', path.join(app.getPath('appData'), 'FitFlow-sviluppo'));
const dataDir = path.join(app.getPath('userData'), 'dati');
const backupDir = path.join(dataDir, 'backup');

// Interfaccia in italiano anche per i controlli nativi (date, orari, menu contestuali).
app.commandLine.appendSwitch('lang', 'it-IT');

let server: Server | null = null;
let win: BrowserWindow | null = null;

/** True only for requests coming from the app's own pages. */
function isLocal(url: string): boolean {
  if (!server) return false;
  try {
    return new URL(url).origin === new URL(server.url).origin;
  } catch {
    return false;
  }
}

function openExternal(url: string) {
  if (/^(https?:|mailto:)/i.test(url)) void shell.openExternal(url);
}

function createWindow(url: string) {
  win = new BrowserWindow({
    title: 'FitFlow',
    width: 1360,
    height: 880,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: '#f3f2f2',
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // Built-in PDF viewer for certificates and documents.
      plugins: true,
    },
  });
  win.once('ready-to-show', () => win?.show());
  win.on('closed', () => { win = null; });

  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url: target }) => {
    // The app's own files (documents, certificates) open in an app window, never in the system browser.
    if (isLocal(target)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1000, height: 800, autoHideMenuBar: true,
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, plugins: true },
        },
      };
    }
    openExternal(target);
    return { action: 'deny' };
  });
  // Document windows opened from the app: same rules, nothing leaves the local server.
  wc.on('did-create-window', child => {
    child.webContents.setWindowOpenHandler(({ url: target }) => { openExternal(target); return { action: 'deny' }; });
    child.webContents.on('will-navigate', (event, target) => { if (!isLocal(target)) { event.preventDefault(); openExternal(target); } });
  });
  wc.on('will-navigate', (event, target) => {
    if (isLocal(target)) return;
    event.preventDefault();
    openExternal(target);
  });
  wc.on('will-redirect', (event, target) => {
    if (!isLocal(target)) event.preventDefault();
  });
  void win.loadURL(url);
}

function focusWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
}

function openFolder(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  return shell.openPath(dir).then(err => { if (err) throw new Error(err); });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const updates: MenuItemConstructorOptions = { label: 'Controlla aggiornamenti…', click: () => void checkForUpdates(true) };
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: 'FitFlow',
      submenu: [
        { role: 'about', label: 'Informazioni su FitFlow' },
        updates,
        { type: 'separator' },
        { role: 'hide', label: 'Nascondi FitFlow' },
        { role: 'hideOthers', label: 'Nascondi altre' },
        { role: 'unhide', label: 'Mostra tutte' },
        { type: 'separator' },
        { role: 'quit', label: 'Esci da FitFlow' },
      ],
    } satisfies MenuItemConstructorOptions] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Apri cartella dati', click: () => void openFolder(dataDir) },
        { label: 'Apri cartella backup', click: () => void openFolder(backupDir) },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Chiudi finestra' } : { role: 'quit', label: 'Esci' },
      ],
    },
    {
      label: 'Modifica',
      submenu: [
        { role: 'undo', label: 'Annulla' },
        { role: 'redo', label: 'Ripeti' },
        { type: 'separator' },
        { role: 'cut', label: 'Taglia' },
        { role: 'copy', label: 'Copia' },
        { role: 'paste', label: 'Incolla' },
        { role: 'selectAll', label: 'Seleziona tutto' },
      ],
    },
    {
      label: 'Vista',
      submenu: [
        { role: 'reload', label: 'Ricarica' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Dimensione reale' },
        { role: 'zoomIn', label: 'Ingrandisci' },
        { role: 'zoomOut', label: 'Riduci' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Schermo intero' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools', label: 'Strumenti per sviluppatori' } satisfies MenuItemConstructorOptions]),
      ],
    },
    {
      label: 'Finestra',
      submenu: isMac
        ? [{ role: 'minimize', label: 'Contrai' }, { role: 'zoom', label: 'Ridimensiona' }, { type: 'separator' }, { role: 'front', label: 'Porta tutto in primo piano' }]
        : [{ role: 'minimize', label: 'Riduci a icona' }],
    },
    {
      role: 'help',
      label: 'Aiuto',
      submenu: [
        ...(isMac ? [] : [updates]),
        { label: 'Pagina delle versioni', click: () => void shell.openExternal(RELEASES_PAGE) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** IPC handlers accept calls only from the app's own page. */
function fromApp(e: IpcMainEvent | IpcMainInvokeEvent) {
  const url = e.senderFrame?.url ?? '';
  if (!isLocal(url)) throw new Error('Richiesta non consentita.');
}

function registerIpc() {
  ipcMain.on('fitflow:versione', e => { e.returnValue = app.getVersion(); });
  ipcMain.handle('fitflow:apriCartellaDati', e => { fromApp(e); return openFolder(dataDir); });
  ipcMain.handle('fitflow:apriCartellaBackup', e => { fromApp(e); return openFolder(backupDir); });
  ipcMain.handle('fitflow:creaBackup', e => {
    fromApp(e);
    if (!server) throw new Error('Il database non è aperto.');
    return backupDatabase(server.data.db, backupDir, 'manuale');
  });
  ipcMain.handle('fitflow:controllaAggiornamenti', e => { fromApp(e); return checkForUpdates(true); });
}

async function start() {
  try {
    server = await startServer({ dataDir, port: 0, host: '127.0.0.1', staticDir: path.join(app.getAppPath(), 'dist') });
  } catch (e) {
    dialog.showErrorBox('FitFlow non si è avviata', `${e instanceof Error ? e.message : String(e)}\n\nCartella dati: ${dataDir}`);
    app.exit(1);
    return;
  }
  if (server.data.migrated.length) console.log(`Database aggiornato: ${server.data.migrated.join(', ')}`);
  console.log(`FitFlow pronta su ${server.url}`);
  console.log(`Dati salvati in ${dataDir}`);
  // Diagnostica per i test automatici (es. avvio senza schermo): verifica che le API rispondano.
  if (process.env.FITFLOW_SELFTEST) {
    const res = await fetch(`${server.url}/api/state`);
    console.log(`SELFTEST /api/state -> ${res.status}`);
  }

  buildMenu();
  createWindow(server.url);
  if (app.isPackaged) setTimeout(() => void checkForUpdates(false), 5000);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusWindow);
  registerIpc();
  void app.whenReady().then(start);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('activate', () => {
    if (server && BrowserWindow.getAllWindows().length === 0) createWindow(server.url);
  });

  // Stop the server (and close the database) before quitting.
  let closing = false;
  app.on('before-quit', event => {
    if (!server || closing) return;
    event.preventDefault();
    closing = true;
    const s = server;
    const timeout = new Promise<void>(resolve => setTimeout(resolve, 3000));
    void Promise.race([s.close(), timeout]).finally(() => {
      server = null;
      app.quit();
    });
  });
}
