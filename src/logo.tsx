// Logo GymPlan: una "G" a tratto arrotondato con un punto rosso. Gli SVG per i file sono in src/assets/logo/.
// Il marchio non dipende dal colore d'accento scelto dall'utente.
export const LOGO_DOT = '#ff3b30';

/** Marchio da solo: il tratto prende `currentColor`, il punto resta rosso (o `mono` per usare solo currentColor). */
export function LogoMark({ size = 24, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18.1 6.9A8 8 0 1 0 20 12h-7.5" />
      <circle cx="18.1" cy="6.9" r="2.1" fill={mono ? 'currentColor' : LOGO_DOT} stroke="none" />
    </svg>
  );
}

/** Icona dell'app: quadrato arrotondato scuro con il marchio bianco (stessa resa di build/icon.svg). */
export function AppIcon({ size = 30 }: { size?: number }) {
  return (
    <span className="app-icon" style={{ width: size, height: size, borderRadius: size * 0.226 }}>
      <LogoMark size={size * 0.62} />
    </span>
  );
}

/** Logotipo orizzontale: marchio + scritta "GymPlan". */
export function Logotipo({ height = 32 }: { height?: number }) {
  return (
    <span className="logotipo" style={{ fontSize: height * 0.52 }}>
      <LogoMark size={height} />
      <span className="logotipo-testo">GymPlan</span>
    </span>
  );
}
