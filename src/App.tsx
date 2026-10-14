import { useEffect, useRef } from 'react';
import { ParticipantDialog } from './components/ParticipantDialog';
import { AppIcon } from './logo';
import { pages, settingsPage, sidebarGroups } from './modules';
import { AppProvider, useApp, type Tab } from './store';

// Mac desktop app: the window's traffic lights sit over the sidebar (see .is-mac-desktop in app.css).
if (window.fitflow?.piattaforma === 'darwin') document.documentElement.classList.add('is-mac-desktop');

function Sidebar({ current }: { current: Tab | null }) {
  const link = (p: (typeof pages)[number]) => {
    const Icon = p.icon;
    return (
      <a key={p.id} className="sidebar-link" href={`#/${p.id}`} aria-current={current === p.id ? 'page' : undefined} title={p.label}>
        {Icon && <Icon />}<span>{p.label}</span>
      </a>
    );
  };
  return (
    <nav className="sidebar" aria-label="Sezioni">
      <div className="sidebar-brand">
        <AppIcon />
        <span className="sidebar-brand-text">
          <div className="sidebar-brand-name">GymPlan</div>
          <div className="sidebar-brand-sub">Corsi di ginnastica</div>
        </span>
      </div>
      {sidebarGroups().map(g => (
        <div key={g.group} role="group" aria-label={g.group}>
          <div className="sidebar-group">{g.group}</div>
          {g.items.map(link)}
        </div>
      ))}
      <div className="sidebar-spacer" />
      {link(settingsPage)}
      {window.fitflow && <div className="sidebar-foot">Versione {window.fitflow.versione}</div>}
    </nav>
  );
}

/** Applies the appearance settings (light/dark/auto, accent color) to the whole page. */
function useAppearance() {
  const { state } = useApp();
  const { tema, accento } = state.settings;
  useEffect(() => {
    const root = document.documentElement;
    if (tema === 'chiaro') root.dataset.theme = 'light';
    else if (tema === 'scuro') root.dataset.theme = 'dark';
    else delete root.dataset.theme;
    if (accento && accento !== 'blu') root.dataset.accent = accento;
    else delete root.dataset.accent;
  }, [tema, accento]);
}

function Shell() {
  const { route, participantId } = useApp();
  useAppearance();
  const Page = pages.find(p => p.id === route.tab)?.View;
  const content = useRef<HTMLElement>(null);
  // A new page starts at the top, like switching sections in a Mac app.
  useEffect(() => { content.current?.scrollTo(0, 0); }, [route.tab]);
  return (
    <div className="app-shell">
      <Sidebar current={route.tab} />
      <main className="content" ref={content}>
        {Page && <Page key={route.tab} />}
      </main>
      {participantId !== null && <ParticipantDialog key={participantId} id={participantId} />}
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      {(ready, error) => ready ? <Shell /> : (
        <div className="app-shell">
          <Sidebar current={null} />
          <main className="content">
            <div className="app-loading" role={error ? 'alert' : 'status'}>{error ?? 'Caricamento…'}</div>
          </main>
        </div>
      )}
    </AppProvider>
  );
}
