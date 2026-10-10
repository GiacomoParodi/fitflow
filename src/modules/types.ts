import type { ComponentType } from 'react';

/**
 * A client module: usually one entry in the sidebar (when it has a View), plus optional pieces it
 * adds to shared screens. A module without View only contributes settings or participant sections.
 * Register it in modules/index.ts. Its server side (if any) answers under /api/<id>.
 */
export interface ClientModule {
  /** Also the URL segment: #/<id> */
  id: string;
  /** Sidebar label (required with View). */
  label?: string;
  /** Short description shown under the page title. */
  kicker?: string;
  /** The page. Modules without a View get no sidebar entry. */
  View?: ComponentType;
  /** Sidebar icon (16–17px line icon) and group heading. */
  icon?: ComponentType<{ size?: number }>;
  group?: string;
  /** Sections appended to Impostazioni. */
  settings?: { title: string; Component: ComponentType }[];
  /** Sections added to the participant card, above the notes. */
  participantSections?: ComponentType<{ participantId: number }>[];
}
