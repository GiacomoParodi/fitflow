import type { ReactNode } from 'react';
import { pages, subtitleFor } from '../modules';

/**
 * Large page title (Apple "large title"), its subtitle and actions on the right.
 * `subtitle` overrides the module's description; pass null to hide it.
 */
export function PageHead({ page, title, subtitle, aside }: { page: string; title?: string; subtitle?: ReactNode | null; aside?: ReactNode }) {
  const sub = subtitle === undefined ? subtitleFor(page) : subtitle;
  return (
    <header className="page-head">
      <div style={{ minWidth: 0 }}>
        <h1 className="page-title">{title ?? pages.find(p => p.id === page)?.label}</h1>
        {sub && <div className="page-subtitle">{sub}</div>}
      </div>
      {aside && <div className="page-actions">{aside}</div>}
    </header>
  );
}

/** Section heading inside a page. (`num` is kept for compatibility and not shown.) */
export function SectionTitle({ children, tight }: { num?: string; children: ReactNode; tight?: boolean }) {
  return <h2 className="section-title" style={tight ? { marginBottom: 4 } : undefined}>{children}</h2>;
}
