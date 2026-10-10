import type { ComponentType } from 'react';

/**
 * A client module: usually one entry in the top bar (when it has a View), plus optional pieces it
 * adds to shared screens. A module without View only contributes settings or participant sections.
 * Register it in modules/index.ts. Its server side (if any) answers under /api/<id>.
 */
export interface ClientModule {
  /** Also the URL segment: #/<id> */
  id: string;
  /** Top-bar label (required with View). */
  label?: string;
  /** Small red label above the page title, after the number ("02 / Gestione"). */
  kicker?: string;
  /** The page. Modules without a View get no top-bar entry. */
  View?: ComponentType;
  /** Sections appended to Impostazioni, numbered after the core ones. */
  settings?: { title: string; Component: ComponentType }[];
  /** Sections added to the participant card, above the notes. */
  participantSections?: ComponentType<{ participantId: number }>[];
}
