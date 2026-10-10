import type { Router } from 'express';
import type { Database, Migration } from '../db';
import type { Store } from '../store';

/** What the host gives each module. */
export interface ModuleContext {
  db: Database;
  /** Root of the user's data (database, certificates, module files). Modules keep files in `<dataDir>/<module id>/`. */
  dataDir: string;
  /** Core data and rules (courses, participants, payments…). */
  core: Store;
  /** Today's date as ISO "YYYY-MM-DD" (overridable in tests). */
  today: () => string;
}

/**
 * A server module. Its router is mounted at /api/<id>; its migrations run at startup, in the order
 * modules are listed in modules/index.ts, so a module may rely on tables of the modules before it.
 */
export interface ServerModule {
  id: string;
  migrations: Migration[];
  createRouter?: (ctx: ModuleContext) => Router;
  /** Called once after migrations, e.g. to seed default data. */
  init?: (ctx: ModuleContext) => void;
  /**
   * Called after a participant is unsubscribed: the module must delete that person's personal data it holds
   * (documents, notes…). Their payments stay in the core for the takings.
   */
  onParticipantRemoved?: (ctx: ModuleContext, participantId: number) => void;
}
