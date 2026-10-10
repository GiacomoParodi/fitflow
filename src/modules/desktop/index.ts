import type { ClientModule } from '../types';
import { DesktopSettings } from './DesktopSettings';

/** Sezione "App desktop" in Impostazioni: c'è solo dentro l'app Electron (window.fitflow). */
export const desktopModule: ClientModule = {
  id: 'desktop',
  settings: typeof window !== 'undefined' && window.fitflow
    ? [{ title: 'App desktop', Component: DesktopSettings }]
    : [],
};
