import { ParticipantDialog } from './components/ParticipantDialog';
import { pages } from './modules';
import { AppProvider, useApp, type Tab } from './store';

function TopBar({ current }: { current: Tab | null }) {
  return (
    <nav className="nav topbar" aria-label="Sezioni">
      <div className="nav-brand"><span className="brand-dot" />FITFLOW</div>
      {pages.map(p => (
        <a key={p.id} href={`#/${p.id}`} aria-current={current === p.id ? 'page' : undefined}>{p.label}</a>
      ))}
    </nav>
  );
}

function Shell() {
  const { route, participantId } = useApp();
  const Page = pages.find(p => p.id === route.tab)?.View;
  return (
    <>
      <TopBar current={route.tab} />
      <main>
        {Page && <Page key={route.tab} />}
      </main>
      {participantId !== null && <ParticipantDialog key={participantId} id={participantId} />}
    </>
  );
}

export function App() {
  return (
    <div className="app">
      <AppProvider>
        {(ready, error) => ready ? <Shell /> : (
          <>
            <TopBar current={null} />
            <div className="page text-muted" role={error ? 'alert' : 'status'}>{error ?? 'Caricamento…'}</div>
          </>
        )}
      </AppProvider>
    </div>
  );
}
