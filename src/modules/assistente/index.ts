import * as I from '../../icons';
import type { ClientModule } from '../types';
import './assistente.css';
import { ImpostazioniAgenti } from './Agenti';
import { CartellaIscritto } from './Cartella';
import { ImpostazioniMotore } from './Motore';
import { PaginaAssistente } from './Pagina';

/** Assistente AI locale: generatore di esercizi, analisi della cartella, libreria. */
export const assistente: ClientModule = {
  id: 'assistente',
  label: 'Assistente',
  kicker: 'Programmi di allenamento e analisi della cartella',
  View: PaginaAssistente,
  icon: I.Sparkles,
  group: 'Strumenti',
  settings: [
    { title: 'Motore AI', Component: ImpostazioniMotore },
    { title: 'Agenti', Component: ImpostazioniAgenti },
  ],
  participantSections: [CartellaIscritto],
};
