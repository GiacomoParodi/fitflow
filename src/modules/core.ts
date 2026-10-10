import { Corsi } from '../views/Corsi';
import { Dashboard } from '../views/Dashboard';
import { Statistiche } from '../views/Statistiche';
import type { ClientModule } from './types';

export const coreModules: ClientModule[] = [
  { id: 'dashboard', label: 'Dashboard', kicker: 'Dashboard', View: Dashboard },
  { id: 'corsi', label: 'Corsi', kicker: 'Gestione', View: Corsi },
  { id: 'statistiche', label: 'Statistiche', kicker: 'Numeri', View: Statistiche },
];
