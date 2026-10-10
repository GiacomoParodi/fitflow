// Icone a linea del modulo Assistente (stile Lucide / SF Symbols), oltre a quelle di src/icons.tsx.
import type { ReactNode } from 'react';

function Icona({ size = 16, children, width = 1.8 }: { size?: number; children: ReactNode; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

type P = { size?: number };

export const Scintille = ({ size }: P) => (
  <Icona size={size}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></Icona>
);
export const Stampante = ({ size }: P) => (
  <Icona size={size}><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></Icona>
);
export const Matita = ({ size }: P) => (
  <Icona size={size}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Icona>
);
export const Occhio = ({ size }: P) => (
  <Icona size={size}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icona>
);
export const Rigenera = ({ size }: P) => (
  <Icona size={size}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></Icona>
);
export const Avviso = ({ size }: P) => (
  <Icona size={size}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></Icona>
);
export const Info = ({ size }: P) => (
  <Icona size={size}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Icona>
);
export const Cerca = ({ size }: P) => (
  <Icona size={size}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icona>
);
export const Libro = ({ size }: P) => (
  <Icona size={size}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></Icona>
);
export const Persona = ({ size }: P) => (
  <Icona size={size}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0 1 14 0v1" /></Icona>
);
export const Orologio = ({ size }: P) => (
  <Icona size={size}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icona>
);
export const Copia = ({ size }: P) => (
  <Icona size={size}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></Icona>
);
export const Freccia = ({ size }: P) => (
  <Icona size={size}><path d="m9 18 6-6-6-6" /></Icona>
);
export const Chip = ({ size }: P) => (
  <Icona size={size}><rect x="5" y="5" width="14" height="14" rx="3" /><path d="M9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></Icona>
);
export const Documento = ({ size }: P) => (
  <Icona size={size}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></Icona>
);
export const Manubrio = ({ size }: P) => (
  <Icona size={size}><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /></Icona>
);
export const Download = ({ size }: P) => (
  <Icona size={size}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Icona>
);
