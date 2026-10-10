import { AppProvider, useApp, type Tab } from './store';
import { Dashboard } from './views/Dashboard';
import { Corsi } from './views/Corsi';
import { Statistiche } from './views/Statistiche';
import { Impostazioni } from './views/Impostazioni';
import { ParticipantDialog } from './components/ParticipantDialog';

const NAV: { tab: Tab; label: string }[] = [
  { tab: 'dashboard', label: 'Dashboard' },
  { tab: 'corsi', label: 'Corsi' },
  { tab: 'statistiche', label: 'Statistiche' },
  { tab: 'impostazioni', label: 'Impostazioni' },
];

function TopBar({ current }: { current: Tab | null }) {
  return (
    <nav className="nav topbar" aria-label="Sezioni">
      <div className="nav-brand"><span className="brand-dot" />GESTIONE CORSI</div>
      {NAV.map(n => (
        <a key={n.tab} href={`#/${n.tab}`} aria-current={current === n.tab ? 'page' : undefined}>{n.label}</a>
      ))}
    </nav>
  );
}

function Shell() {
  const { route, participantId } = useApp();
  return (
    <>
      <TopBar current={route.tab} />
      <main>
        {route.tab === 'dashboard' && <Dashboard />}
        {route.tab === 'corsi' && <Corsi />}
        {route.tab === 'statistiche' && <Statistiche />}
        {route.tab === 'impostazioni' && <Impostazioni />}
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
