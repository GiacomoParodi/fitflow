// Ponte sicuro tra la pagina e il processo principale: espone solo window.fitflow.
import { contextBridge, ipcRenderer } from 'electron';
import type { FitflowDesktop } from '../src/desktop';

const api: FitflowDesktop = {
  versione: ipcRenderer.sendSync('fitflow:versione') as string,
  piattaforma: process.platform,
  apriCartellaDati: () => ipcRenderer.invoke('fitflow:apriCartellaDati'),
  creaBackup: () => ipcRenderer.invoke('fitflow:creaBackup'),
  apriCartellaBackup: () => ipcRenderer.invoke('fitflow:apriCartellaBackup'),
  controllaAggiornamenti: () => ipcRenderer.invoke('fitflow:controllaAggiornamenti'),
};

contextBridge.exposeInMainWorld('fitflow', api);
