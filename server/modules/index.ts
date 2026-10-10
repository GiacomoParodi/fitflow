import { coreMigrations } from '../store';
import { assistente } from './assistente';
import { finanzeModule } from './finanze';
import type { ServerModule } from './types';

const core: ServerModule = { id: 'core', migrations: coreMigrations };

/**
 * Installed server modules, in migration order (core first).
 * To add a module: create server/modules/<id>/index.ts exporting a ServerModule and list it here.
 */
export const serverModules: ServerModule[] = [
  core,
  finanzeModule,
  assistente,
];
