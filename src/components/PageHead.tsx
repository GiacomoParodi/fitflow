import type { ReactNode } from 'react';
import { kickerFor } from '../modules';

/** Page title with its numbered kicker ("02 / Gestione"), derived from the page's position in the top bar. */
export function PageHead({ page, title, aside }: { page: string; title: string; aside?: ReactNode }) {
  const head = (
    <div>
      <div className="kicker">{kickerFor(page)}</div>
      <h1 className="page-title">{title}</h1>
    </div>
  );
  return aside
    ? <div className="page-head page-head-row">{head}{aside}</div>
    : <div className="page-head">{head}</div>;
}

export function SectionTitle({ num, children, tight }: { num: string; children: ReactNode; tight?: boolean }) {
  return (
    <h3 className="section-title" style={tight ? { marginBottom: 6 } : undefined}>
      <span className="num">{num}</span> {children}
    </h3>
  );
}
