import type { ComponentType } from 'react';

/**
 * A client module: one entry in the top bar, plus optional pieces it adds to shared screens.
 * Register it in modules/index.ts. Its server side (if any) answers under /api/<id>.
 */
export interface ClientModule {
  /** Also the URL segment: #/<id> */
  id: string;
  /** Top-bar label. */
  label: string;
  /** Small red label above the page title, after the number ("02 / Gestione"). */
  kicker: string;
  View: ComponentType;
  /** Sections appended to Impostazioni, numbered after the core ones. */
  settings?: { title: string; Component: ComponentType }[];
  /** Sections added to the participant card, above the notes. */
  participantSections?: ComponentType<{ participantId: number }>[];
}
