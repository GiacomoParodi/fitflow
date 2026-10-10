import * as I from '../icons';
import { Impostazioni } from '../views/Impostazioni';
import { assistente } from './assistente';
import { coreModules } from './core';
import { desktopModule } from './desktop';
import { finanzeModule } from './finanze';
import type { ClientModule } from './types';

/**
 * Installed modules, in sidebar order. To add one: create src/modules/<id>/index.ts exporting a
 * ClientModule and list it here. Impostazioni always sits at the bottom of the sidebar.
 */
export const modules: ClientModule[] = [
  ...coreModules,
  finanzeModule,
  assistente,
  desktopModule,
];

export const settingsPage: ClientModule = {
  id: 'impostazioni', label: 'Impostazioni', kicker: 'Abbonamenti, corsi, aspetto e assistente', View: Impostazioni, icon: I.Gear,
};

/** Pages with a sidebar entry: modules with a View, then Impostazioni. */
export const pages: ClientModule[] = [...modules.filter(m => m.View), settingsPage];

/** Sidebar sections in order of first appearance. */
export function sidebarGroups(): { group: string; items: ClientModule[] }[] {
  const out: { group: string; items: ClientModule[] }[] = [];
  for (const m of modules.filter(x => x.View)) {
    const g = m.group ?? 'Altro';
    let sec = out.find(s => s.group === g);
    if (!sec) out.push(sec = { group: g, items: [] });
    sec.items.push(m);
  }
  return out;
}

/** Short description shown under a page title. */
export function subtitleFor(id: string): string {
  return pages.find(p => p.id === id)?.kicker ?? '';
}
