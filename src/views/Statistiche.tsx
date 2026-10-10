import './statistiche.css';
import { useState } from 'react';
import { MONTHS_SHORT, monthName } from '../../shared/dates';
import { euro } from '../../shared/rules';
import { PageHead } from '../components/PageHead';
import { useApp } from '../store';

const MONTHS_LONG = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const meseDi = (m: string) => Number(m.slice(5, 7)) - 1;

function pctNum(n: number, of: number) {
  return of ? Math.round((n / of) * 100) : 0;
}

export function Statistiche() {
  const { state, people, today } = useApp();
  const total = people.length;

  const andamento = state.andamento;
  const corrente = andamento[andamento.length - 1];
  const precedente = andamento.length > 1 ? andamento[andamento.length - 2] : null;
  const delta = corrente && precedente ? corrente.count - precedente.count : null;

  const perCorso = state.courses
    .map(c => ({ c, count: people.filter(p => p.courseId === c.id).length }))
    .sort((a, b) => b.count - a.count || a.c.name.localeCompare(b.c.name, 'it'));
  const top = perCorso[0] && perCorso[0].count > 0 ? perCorso[0] : null;
  const maxCorso = Math.max(1, ...perCorso.map(x => x.count));

  const inRegola = people.filter(p => p.pay.status === 'valido').length;
  const inScadenza = people.filter(p => p.pay.status === 'in_scadenza').length;
  const daPagare = total - inRegola - inScadenza;
  const dist = [
    { key: 'ok', label: 'In regola', count: inRegola, color: 'var(--success)' },
    { key: 'warn', label: 'In scadenza', count: inScadenza, color: 'var(--warning)' },
    { key: 'due', label: 'Da pagare', count: daPagare, color: 'var(--danger)' },
  ];

  return (
    <div className="page st">
      <PageHead page="statistiche" title="Statistiche" />

      <div className="st-top">
        <section className="card st-chart-card" aria-labelledby="st-andamento">
          <div className="card-head">
            <div>
              <h3 id="st-andamento" className="card-title">Andamento iscritti</h3>
              <div className="card-sub">Iscritti attivi alla fine di ogni mese, ultimi {andamento.length} mesi</div>
            </div>
          </div>
          <Andamento />
        </section>

        <div className="st-metrics">
          <div className="metric">
            <div className="metric-label">Iscritti attivi</div>
            <div className="metric-value">{total}</div>
            <div className="metric-note">{state.courses.length === 1 ? 'in 1 corso' : `in ${state.courses.length} corsi`}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Rispetto al mese scorso</div>
            <div className="metric-value st-delta" data-trend={delta === null ? 'none' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}>
              {delta === null ? '—' : <><Trend d={delta} />{delta > 0 ? '+' + delta : delta < 0 ? '−' + Math.abs(delta) : '0'}</>}
            </div>
            <div className="metric-note">
              {precedente ? `${precedente.count} a fine ${MONTHS_LONG[meseDi(precedente.month)]}` : 'Nessun dato precedente'}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">Corso più frequentato</div>
            <div className="metric-value st-metric-text" title={top?.c.name}>{top ? top.c.name : '—'}</div>
            <div className="metric-note">{top ? (top.count === 1 ? '1 iscritto' : `${top.count} iscritti`) + ` · ${pctNum(top.count, total)}% del totale` : 'Nessun iscritto'}</div>
          </div>
          <div className="metric metric-accent">
            <div className="metric-label">Incassato a {monthName(today).toLowerCase()}</div>
            <div className="metric-value">{euro(state.incassoMese)}</div>
            <div className="metric-note"><a href="#/finanze">Dettagli in Finanze</a></div>
          </div>
        </div>
      </div>

      <div className="st-bottom">
        <section className="card" aria-labelledby="st-corsi">
          <div className="card-head">
            <div>
              <h3 id="st-corsi" className="card-title">Iscritti per corso</h3>
              <div className="card-sub">{total === 1 ? '1 iscritto attivo' : `${total} iscritti attivi`}</div>
            </div>
          </div>
          {perCorso.length === 0 ? (
            <div className="empty">Nessun corso.</div>
          ) : (
            <ul className="st-hbars">
              {perCorso.map(({ c, count }) => (
                <li key={c.id} className="st-hbar">
                  <div className="st-hbar-head">
                    <span className="st-hbar-name">{c.name}</span>
                    <span className="st-hbar-val"><strong>{count}</strong><span>{pctNum(count, total)}%</span></span>
                  </div>
                  <div className="st-hbar-track" aria-hidden="true">
                    <div className="st-hbar-fill" style={{ width: count ? `max(6px, ${(count / maxCorso) * 100}%)` : 0 }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="st-pagamenti">
          <div className="card-head">
            <div>
              <h3 id="st-pagamenti" className="card-title">Stato pagamenti</h3>
              <div className="card-sub">Situazione di oggi degli abbonamenti</div>
            </div>
          </div>
          {total === 0 ? (
            <div className="empty">Nessun iscritto attivo.</div>
          ) : (
            <>
              <div className="st-pay-head">
                <span className="st-pay-big">{pctNum(inRegola, total)}%</span>
                <span className="text-muted">in regola con i pagamenti</span>
              </div>
              <div className="st-stack" role="img"
                aria-label={dist.map(d => `${d.label}: ${d.count}`).join(', ')}>
                {dist.filter(d => d.count > 0).map(d => (
                  <div key={d.key} className="st-stack-seg" style={{ background: d.color, flexGrow: d.count }} />
                ))}
              </div>
              <ul className="st-legend">
                {dist.map(d => (
                  <li key={d.key}>
                    <span className="dot" style={{ background: d.color }} />
                    <span className="st-legend-label">{d.label}</span>
                    <span className="st-legend-count">{d.count}</span>
                    <span className="st-legend-pct">{pctNum(d.count, total)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="st-link"><a href="#/finanze">Incassi e pagamenti nel dettaglio in Finanze</a></div>
        </section>
      </div>
    </div>
  );
}

function Trend({ d }: { d: number }) {
  if (d === 0) return null;
  return (
    <svg className="st-trend" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d > 0 ? <path d="M7 17 17 7M9 7h8v8" /> : <path d="M7 7l10 10M17 9v8H9" />}
    </svg>
  );
}

/** Monthly active members: rounded bars, the current month in the accent, a dashed average line. */
function Andamento() {
  const { state } = useApp();
  const [hover, setHover] = useState<number | null>(null);
  const mesi = state.andamento;
  if (mesi.length === 0) return <div className="empty">Ancora nessun dato.</div>;
  const max = Math.max(1, ...mesi.map(m => m.count));
  // Headroom so the value labels never touch the top.
  const scale = max * 1.12;
  const media = mesi.reduce((s, m) => s + m.count, 0) / mesi.length;
  const mediaTxt = (Math.round(media * 10) / 10).toString().replace('.', ',');
  return (
    <div className="st-chart">
      <div className="st-plot" onMouseLeave={() => setHover(null)}>
        {media > 0 && (
          <div className="st-avg" style={{ bottom: `${(media / scale) * 100}%` }} aria-hidden="true" />
        )}
        <ol className="st-cols" aria-label="Iscritti attivi per mese">
          {mesi.map((m, i) => {
            const current = i === mesi.length - 1;
            const label = `${MONTHS_LONG[meseDi(m.month)]} ${m.month.slice(0, 4)}`;
            return (
              <li key={m.month} className="st-col" tabIndex={0} data-current={current} data-hover={hover === i}
                aria-label={`${label}: ${m.count} iscritti${current ? ' (mese in corso)' : ''}`}
                onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                <div className="st-col-area">
                  <div className="st-col-bar" style={{ height: m.count > 0 ? `max(4px, ${(m.count / scale) * 100}%)` : 0 }}>
                    <span className="st-col-val">{m.count}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <ol className="st-axis" aria-hidden="true">
        {mesi.map((m, i) => (
          <li key={m.month} data-current={i === mesi.length - 1}>{MONTHS_SHORT[meseDi(m.month)]}</li>
        ))}
      </ol>
      <div className="st-chart-foot">
        <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--chart-1)' }} />Mese in corso</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--chart-muted)' }} />Mesi precedenti</span>
        <span className="legend-item"><span className="st-dash" />Media del periodo · <strong className="st-avg-val">{mediaTxt}</strong></span>
      </div>
    </div>
  );
}
