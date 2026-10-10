import { Impostazioni } from '../views/Impostazioni';
import { coreModules } from './core';
import { finanzeModule } from './finanze';
import type { ClientModule } from './types';

/**
 * Installed modules, in top-bar order. To add one: create src/modules/<id>/index.ts exporting a
 * ClientModule and list it here. Impostazioni always comes last.
 */
export const modules: ClientModule[] = [
  ...coreModules,
  finanzeModule,
];

const settingsPage: ClientModule = { id: 'impostazioni', label: 'Impostazioni', kicker: 'Configurazione', View: Impostazioni };

export const pages: ClientModule[] = [...modules, settingsPage];

/** "02 / Gestione" */
export function kickerFor(id: string): string {
  const i = pages.findIndex(p => p.id === id);
  return `${String(i + 1).padStart(2, '0')} / ${pages[i]?.kicker ?? ''}`;
}
