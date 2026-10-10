import './statistiche.css';
import { MONTHS_SHORT, monthName } from '../../shared/dates';
import { euro } from '../../shared/rules';
import { PageHead } from '../components/PageHead';
import { useApp } from '../store';

export function Statistiche() {
  const { state, people, today } = useApp();
  const total = people.length;
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0) + '%';

  const maxVal = Math.max(1, ...state.andamento.map(m => m.count));
  const perCorso = state.courses.map(c => ({ c, count: people.filter(p => p.courseId === c.id).length }));
  const top = perCorso.reduce<(typeof perCorso)[number] | null>((a, b) => (!a || b.count > a.count ? b : a), null);

  const inRegola = people.filter(p => p.pay.status === 'valido').length;
  const inScadenza = people.filter(p => p.pay.status === 'in_scadenza').length;
  const daPagare = total - inRegola - inScadenza;
  const dist = [
    { label: 'In regola', count: inRegola, color: 'var(--color-neutral-400)' },
    { label: 'In scadenza', count: inScadenza, color: 'var(--color-accent-300)' },
    { label: 'Da pagare', count: daPagare, color: 'var(--color-accent)' },
  ];

  return (
    <div className="page page-narrow">
      <PageHead page="statistiche" title="Statistiche" />

      <div className="stats-top">
        <div className="col-left">
          <h5 style={{ marginBottom: 12 }}>Andamento iscritti</h5>
          <div className="bars">
            {state.andamento.map((m, i) => (
              <div key={m.month} className="bar-col" title={`${m.count} iscritti`}>
                <div className="bar" data-current={i === state.andamento.length - 1}
                  style={{ height: Math.round((m.count / maxVal) * 100) + '%' }} />
                <div className="bar-label text-muted">{MONTHS_SHORT[Number(m.month.slice(5, 7)) - 1]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="stat-tiles">
          <div className="stat-tile stat-tile-red">
            <div className="label">Incassato a {monthName(today)}</div>
            <div className="stat-big">{euro(state.incassoMese)}</div>
          </div>
          <div className="stat-tile stat-tile-dark">
            <div className="label">Corso in testa</div>
            <div className="stat-mid">{top && top.count > 0 ? top.c.name : '—'}</div>
          </div>
        </div>
      </div>

      <hr className="hr" />

      <div className="cols-2">
        <div className="col-left">
          <h5 style={{ marginBottom: 14 }}>Iscritti per corso</h5>
          <div className="hbars">
            {perCorso.map(({ c, count }) => (
              <div key={c.id}>
                <div className="hbar-head"><span>{c.name}</span><span style={{ fontWeight: 600 }}>{count}</span></div>
                <div className="hbar-track"><div className="hbar-fill" style={{ width: pct(count, total) }} /></div>
              </div>
            ))}
            {perCorso.length === 0 && <div className="empty text-muted">Nessun corso.</div>}
          </div>
        </div>

        <div className="col-right">
          <h5 style={{ marginBottom: 14 }}>Stato pagamenti</h5>
          <div className="stack">
            {dist.map(d => <div key={d.label} style={{ height: '100%', background: d.color, width: pct(d.count, total) }} />)}
          </div>
          <div className="legend">
            {dist.map(d => (
              <div key={d.label} className="legend-item text-muted">
                <div className="legend-dot" style={{ background: d.color }} />
                {d.label} · {d.count}
              </div>
            ))}
          </div>
          <div className="hint"><a href="#/finanze">Incassi e pagamenti nel dettaglio in Finanze →</a></div>
        </div>
      </div>
    </div>
  );
}
