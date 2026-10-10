import type { ReactNode } from 'react';

export function PageHead({ kicker, title, aside }: { kicker: string; title: string; aside?: ReactNode }) {
  const head = (
    <div>
      <div className="kicker">{kicker}</div>
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
