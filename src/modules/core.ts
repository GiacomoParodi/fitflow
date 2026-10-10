import * as I from '../icons';
import { Corsi } from '../views/Corsi';
import { Dashboard } from '../views/Dashboard';
import { Statistiche } from '../views/Statistiche';
import type { ClientModule } from './types';

export const coreModules: ClientModule[] = [
  { id: 'dashboard', label: 'Dashboard', kicker: 'La giornata a colpo d\'occhio', View: Dashboard, icon: I.Dashboard, group: 'Gestione' },
  { id: 'corsi', label: 'Corsi', kicker: 'Iscritti, presenze e scadenze', View: Corsi, icon: I.Users, group: 'Gestione' },
  { id: 'statistiche', label: 'Statistiche', kicker: 'Andamento degli iscritti e dei pagamenti', View: Statistiche, icon: I.Chart, group: 'Analisi' },
];
