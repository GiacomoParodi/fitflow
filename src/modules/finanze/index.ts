import type { ClientModule } from '../types';
import { Finanze } from './Finanze';

/** Finanze: what has been paid, by whom, for which plan and course, and who still has to pay. */
export const finanzeModule: ClientModule = { id: 'finanze', label: 'Finanze', kicker: 'Economia', View: Finanze };
