import { useEffect, useMemo, useState } from 'react';
import { MONTHS_SHORT, fmt } from '../../../shared/dates';
import { PAY_LABELS, type Status } from '../../../shared/rules';
import type { DaPagare, RiepilogoFinanze, VoceMese } from '../../../server/modules/finanze/types';
import { ApiFailure, request } from '../../api';
import { PageHead } from '../../components/PageHead';
import { TAG_CLASS } from '../../derive';
import { useApp } from '../../store';
import { assePulito } from './asse';
import { pagamentiCsv, scaricaCsv } from './csv';
import { euroIt, percentIt } from './formato';
import { PERIODI, rangeFor, type PeriodoId, type Range } from './periodi';
import './finanze.css';

const MONTHS_LONG = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const PAGE_SIZE = 50;

function meseLungo(m: string) {
  return `${MONTHS_LONG[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
}

const plurale = (n: number, uno: string, molti: string) => (n === 1 ? `1 ${uno}` : `${n} ${molti}`);

export function Finanze() {
  const { state, today, go, openParticipant } = useApp();
  const [periodo, setPeriodo] = useState<PeriodoId>('mese');
  const [custom, setCustom] = useState<Range>(() => rangeFor('mese', today));
  const [corso, setCorso] = useState('');
  const [abbonamento, setAbbonamento] = useState('');
  const [data, setData] = useState<RiepilogoFinanze | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cerca, setCerca] = useState('');
  const [mostra, setMostra] = useState(PAGE_SIZE);

  const range = periodo === 'personalizzato' ? custom : rangeFor(periodo, today);

  useEffect(() => {
    // Check the custom dates here, so a half-typed range doesn't hit the server.
    if (!range.dal || !range.al) { setError('Scegli la data di inizio e di fine.'); return; }
    if (range.dal > range.al) { setError('La data di inizio deve venire prima della data di fine.'); return; }
    let live = true;
    const q = new URLSearchParams({ dal: range.dal, al: range.al });
    if (corso) q.set('corso', corso);
    if (abbonamento) q.set('abbonamento', abbonamento);
    request<RiepilogoFinanze>('GET', '/finanze/riepilogo?' + q.toString()).then(
      d => { if (live) { setData(d); setError(null); } },
      e => { if (live) setError(e instanceof ApiFailure ? e.message : 'Impossibile caricare i dati.'); },
    );
    return () => { live = false; };
    // `state` changes after any payment or enrolment: reload so the numbers stay current.
  }, [range.dal, range.al, corso, abbonamento, state]);

  useEffect(() => setMostra(PAGE_SIZE), [range.dal, range.al, corso, abbonamento, cerca]);

  const choosePeriodo = (id: PeriodoId) => {
    if (id === 'personalizzato' && periodo !== 'personalizzato') setCustom(range);
    setPeriodo(id);
  };

  const pagamenti = useMemo(() => {
    const q = cerca.trim().toLocaleLowerCase('it');
    return !data ? [] : q ? data.pagamenti.filter(p => p.nome.toLocaleLowerCase('it').includes(q)) : data.pagamenti;
  }, [data, cerca]);

  const apriIscritto = (id: number, courseId: number) => { go('corsi', courseId); openParticipant(id); };

  const esporta = () => {
    const nome = `pagamenti_${range.dal}_${range.al}.csv`;
    scaricaCsv(nome, pagamentiCsv(pagamenti));
  };

  const periodi = (
    <div className="seg fin-periods" role="group" aria-label="Periodo">
      {PERIODI.map(p => (
        <button key={p.id} type="button" className="seg-opt" aria-pressed={periodo === p.id} onClick={() => choosePeriodo(p.id)}>{p.label}</button>
      ))}
    </div>
  );

  return (
    <div className="page fin">
      <PageHead page="finanze" title="Finanze" aside={periodi} />

      <div className="fin-filters">
        <div className="fin-filter-group">
          {periodo === 'personalizzato' && (
            <>
              <label className="fin-filter" htmlFor="fin-dal">
                <span>Dal</span>
                <input id="fin-dal" className="input" type="date" value={custom.dal} max={custom.al || undefined}
                  onChange={e => setCustom({ ...custom, dal: e.target.value })} />
              </label>
              <label className="fin-filter" htmlFor="fin-al">
                <span>Al</span>
                <input id="fin-al" className="input" type="date" value={custom.al} min={custom.dal || undefined}
                  onChange={e => setCustom({ ...custom, al: e.target.value })} />
              </label>
              <span className="fin-filter-sep" aria-hidden="true" />
            </>
          )}
          <label className="fin-filter" htmlFor="fin-corso">
            <span>Corso</span>
            <select id="fin-corso" className="input" value={corso} onChange={e => setCorso(e.target.value)}>
              <option value="">Tutti i corsi</option>
              {(data?.opzioni.corsi ?? state.courses.map(c => ({ id: c.id, nome: c.name }))).map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
          <label className="fin-filter" htmlFor="fin-abb">
            <span>Abbonamento</span>
            <select id="fin-abb" className="input" value={abbonamento} onChange={e => setAbbonamento(e.target.value)}>
              <option value="">Tutti gli abbonamenti</option>
              {(data?.opzioni.abbonamenti ?? state.plans.map(p => p.name)).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {(corso || abbonamento) && (
            <button type="button" className="btn btn-ghost" onClick={() => { setCorso(''); setAbbonamento(''); }}>Togli filtri</button>
          )}
        </div>
        <div className="fin-range">
          <CalendarIcon />
          <span>Dal {fmt(range.dal)} al {fmt(range.al)}</span>
        </div>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}

      {!data ? (!error && <div className="card empty" role="status">Caricamento…</div>) : (
        <div className="fin-body">
          <div className="fin-kpis">
            <div className="metric metric-accent">
              <div className="metric-label">Incassato</div>
              <div className="metric-value">{euroIt(data.totali.incassato)}</div>
              <div className="metric-note">nel periodo scelto</div>
            </div>
            <div className="metric">
              <div className="metric-label">Pagamenti</div>
              <div className="metric-value">{data.totali.pagamenti}</div>
              <div className="metric-note">registrati nel periodo</div>
            </div>
            <div className="metric">
              <div className="metric-label">Persone che hanno pagato</div>
              <div className="metric-value">{data.totali.persone}</div>
              <div className="metric-note">anche chi si è poi disiscritto</div>
            </div>
            <div className="metric">
              <div className="metric-label">Importo medio</div>
              <div className="metric-value">{data.totali.pagamenti ? euroIt(data.totali.medio) : '—'}</div>
              <div className="metric-note">per pagamento</div>
            </div>
          </div>

          <div className="fin-row fin-row-main">
            <section className="card fin-chart-card" aria-labelledby="fin-mesi">
              <div className="card-head">
                <div>
                  <h3 id="fin-mesi" className="card-title">Incassato per mese</h3>
                  <div className="card-sub">Passa sopra una barra per vedere il dettaglio del mese</div>
                </div>
              </div>
              <Grafico mesi={data.mesi} />
            </section>
            <section className="card" aria-labelledby="fin-oggi">
              <Situazione data={data} />
            </section>
          </div>

          <div className="fin-row fin-row-split">
            <section className="card" aria-labelledby="fin-abbonamenti">
              <div className="card-head">
                <div>
                  <h3 id="fin-abbonamenti" className="card-title">Abbonamenti più venduti</h3>
                  <div className="card-sub">Per incassato nel periodo</div>
                </div>
              </div>
              <Abbonamenti data={data} />
            </section>
            <section className="card card-flush fin-table-card" aria-labelledby="fin-corsi">
              <div className="card-head fin-card-head">
                <div>
                  <h3 id="fin-corsi" className="card-title">Per corso</h3>
                  <div className="card-sub">Iscritti = attivi oggi. Per iscritto = incassato nel periodo diviso gli iscritti attivi.</div>
                </div>
              </div>
              {data.corsi.length === 0 ? <div className="empty">Nessun corso.</div> : (
                <div className="scroll-x">
                  <table className="table fin-table">
                    <thead>
                      <tr><th>Corso</th><th className="num">Incassato</th><th className="num">Pagamenti</th><th className="num">Iscritti</th><th className="num">Per iscritto</th></tr>
                    </thead>
                    <tbody>
                      {data.corsi.map(c => (
                        <tr key={c.id}>
                          <td className="fin-strong">{c.nome}</td>
                          <td className="num fin-strong">{euroIt(c.incassato)}</td>
                          <td className="num">{c.pagamenti}</td>
                          <td className="num">{c.iscrittiAttivi}</td>
                          <td className="num">{c.medioPerIscritto === null ? '—' : euroIt(c.medioPerIscritto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section className="card card-flush" aria-labelledby="fin-dovuti">
            <div className="card-head fin-card-head">
              <div>
                <h3 id="fin-dovuti" className="card-title">Chi deve pagare</h3>
                <div className="card-sub">Situazione di oggi degli iscritti attivi{corso || abbonamento ? ' (con i filtri scelti)' : ''}: chi ha l'abbonamento scaduto o in scadenza.</div>
              </div>
            </div>
            <DaPagareElenco elenco={data.situazione.elenco} onOpen={p => apriIscritto(p.id, p.courseId)} />
          </section>

          <section className="card card-flush" aria-labelledby="fin-pagamenti">
            <div className="card-head fin-card-head fin-pay-head">
              <div>
                <h3 id="fin-pagamenti" className="card-title">Pagamenti del periodo</h3>
                <div className="card-sub">{plurale(pagamenti.length, 'pagamento', 'pagamenti')} · {euroIt(pagamenti.reduce((s, p) => s + p.importo, 0))}{cerca.trim() ? ' (ricerca)' : ''}</div>
              </div>
              <div className="fin-pay-tools">
                <div className="fin-search">
                  <SearchIcon />
                  <label htmlFor="fin-cerca" className="sr-only">Cerca per nome</label>
                  <input id="fin-cerca" className="input" type="search" placeholder="Cerca per nome" value={cerca} onChange={e => setCerca(e.target.value)} />
                </div>
                <button type="button" className="btn btn-secondary" onClick={esporta} disabled={pagamenti.length === 0}>
                  <DownloadIcon />Esporta CSV
                </button>
              </div>
            </div>
            {pagamenti.length === 0 ? (
              <div className="empty fin-empty">
                <SearchIcon size={22} />
                <div>{cerca ? 'Nessun pagamento trovato.' : 'Nessun pagamento in questo periodo.'}</div>
              </div>
            ) : (
              <>
                <div className="scroll-x">
                  <table className="table fin-table">
                    <thead>
                      <tr><th>Data</th><th>Iscritto</th><th>Corso</th><th>Abbonamento</th><th>Periodo coperto</th><th className="num">Importo</th></tr>
                    </thead>
                    <tbody>
                      {pagamenti.slice(0, mostra).map(p => (
                        <tr key={p.id}>
                          <td className="nowrap">{fmt(p.data)}</td>
                          <td>
                            <div className="fin-strong">{p.nome}</div>
                            {p.ritiratoIl && <div className="cell-sub">Disiscritto il {fmt(p.ritiratoIl)}</div>}
                          </td>
                          <td>{p.corso}</td>
                          <td>{p.abbonamento}</td>
                          <td className="nowrap text-muted">{fmt(p.dal)} – {fmt(p.al)}</td>
                          <td className="num fin-strong">{euroIt(p.importo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="fin-list-foot">
                  <span>{mostra < pagamenti.length ? `Mostrati ${mostra} di ${pagamenti.length}` : plurale(pagamenti.length, 'pagamento', 'pagamenti')} · Totale {euroIt(pagamenti.reduce((s, p) => s + p.importo, 0))}</span>
                  {pagamenti.length > mostra && (
                    <button type="button" className="btn btn-ghost" onClick={() => setMostra(mostra + PAGE_SIZE * 4)}>Mostra altri</button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Grafico({ mesi }: { mesi: VoceMese[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const asse = assePulito(Math.max(0, ...mesi.map(m => m.incassato)));
  const top = asse[asse.length - 1];
  const evidenziati = mesi.filter(m => m.nelPeriodo);
  // With a short period, its months carry their value on top; otherwise values show on hover.
  const etichetteFisse = evidenziati.length <= 3;
  const totale = evidenziati.reduce((s, m) => s + m.incassato, 0);
  if (mesi.length === 0) return <div className="empty">Nessun dato.</div>;
  return (
    <div className="fin-chart">
      <div className="fin-plot-wrap">
        <div className="fin-yaxis" aria-hidden="true">
          {asse.map(t => <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>{euroIt(t)}</span>)}
        </div>
        <div className="fin-plot">
          {asse.map(t => <div key={t} className="fin-grid" data-zero={t === 0} style={{ bottom: `${(t / top) * 100}%` }} aria-hidden="true" />)}
          <div className="fin-bars" role="list" aria-label="Incassato per mese" onMouseLeave={() => setHover(null)}>
            {mesi.map((m, i) => {
              const show = hover === m.mese || (hover === null && etichetteFisse && m.nelPeriodo);
              const tip = hover === m.mese;
              const edge = i === 0 ? 'start' : i === mesi.length - 1 ? 'end' : undefined;
              return (
                <div key={m.mese} role="listitem" className="fin-bar-col" tabIndex={0}
                  aria-label={`${meseLungo(m.mese)}: ${euroIt(m.incassato)}, ${m.pagamenti} pagamenti`}
                  onMouseEnter={() => setHover(m.mese)} onFocus={() => setHover(m.mese)} onBlur={() => setHover(null)}>
                  <div className="fin-bar" data-current={m.nelPeriodo} data-hover={tip}
                    style={{ height: m.incassato > 0 ? `max(3px, ${(m.incassato / top) * 100}%)` : 0 }}>
                    {show && (
                      <div className="fin-bar-value" data-tip={tip} data-edge={edge}>
                        {tip ? (
                          <>
                            <span className="fin-tip-month">{meseLungo(m.mese)}</span>
                            <strong>{euroIt(m.incassato)}</strong>
                            <span className="fin-tip-sub">{plurale(m.pagamenti, 'pagamento', 'pagamenti')}</span>
                          </>
                        ) : <strong>{euroIt(m.incassato)}</strong>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="fin-xaxis" aria-hidden="true">
        {mesi.map((m, i) => (
          <span key={m.mese} data-current={m.nelPeriodo}>
            {MONTHS_SHORT[Number(m.mese.slice(5, 7)) - 1]}
            {(m.mese.endsWith('-01') || i === 0) && <span className="fin-year">{m.mese.slice(2, 4)}</span>}
          </span>
        ))}
      </div>
      <div className="fin-legend">
        <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--chart-1)' }} />Periodo scelto · <strong className="fin-legend-val">{euroIt(totale)}</strong></span>
        {evidenziati.length < mesi.length && (
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--chart-muted)' }} />Mesi precedenti</span>
        )}
      </div>
    </div>
  );
}

const STATI = [
  { key: 'inRegola', label: 'In regola', color: 'var(--success)' },
  { key: 'inScadenza', label: 'In scadenza', color: 'var(--warning)' },
  { key: 'daPagare', label: 'Da pagare', color: 'var(--danger)' },
] as const;

function Situazione({ data }: { data: RiepilogoFinanze }) {
  const s = data.situazione;
  const dist = STATI.map(d => ({ ...d, count: s[d.key] }));
  const pct = (n: number) => (s.attivi ? Math.round((n / s.attivi) * 100) : 0);
  return (
    <>
      <div className="card-head">
        <div>
          <h3 id="fin-oggi" className="card-title">Situazione di oggi</h3>
          <div className="card-sub">{plurale(s.attivi, 'iscritto attivo', 'iscritti attivi')}</div>
        </div>
      </div>
      <div className="fin-sit">
        <Anello dist={dist} totale={s.attivi} />
        <ul className="fin-sit-legend">
          {dist.map(d => (
            <li key={d.key}>
              <span className="dot" style={{ background: d.color }} />
              <span className="fin-sit-label">{d.label}</span>
              <span className="fin-sit-count">{d.count}</span>
              <span className="fin-sit-pct">{pct(d.count)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** Donut with one segment per payment state, a 2px gap between segments. */
function Anello({ dist, totale }: { dist: { key: string; label: string; color: string; count: number }[]; totale: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const visibili = dist.filter(d => d.count > 0);
  const gap = visibili.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <div className="fin-ring">
      <svg viewBox="0 0 132 132" role="img" aria-label={dist.map(d => `${d.label}: ${d.count}`).join(', ')}>
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--fill-2)" strokeWidth="14" />
        {totale > 0 && visibili.map(d => {
          const len = (d.count / totale) * c;
          const el = (
            <circle key={d.key} cx="66" cy="66" r={r} fill="none" stroke={d.color} strokeWidth="14"
              strokeDasharray={`${Math.max(0.5, len - gap)} ${c}`} strokeDashoffset={-offset} transform="rotate(-90 66 66)" />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="fin-ring-center">
        <strong>{totale}</strong>
        <span>attivi</span>
      </div>
    </div>
  );
}

function Abbonamenti({ data }: { data: RiepilogoFinanze }) {
  const max = Math.max(0, ...data.abbonamenti.map(a => a.totale));
  if (data.abbonamenti.length === 0) return <div className="empty">Nessun abbonamento venduto nel periodo.</div>;
  return (
    <ol className="fin-rank">
      {data.abbonamenti.map((a, i) => (
        <li key={a.nome}>
          <span className="fin-rank-num" data-first={i === 0}>{i + 1}</span>
          <div className="fin-rank-body">
            <div className="fin-rank-head">
              <span className="fin-rank-name">{a.nome}</span>
              <span className="fin-rank-total">{euroIt(a.totale)}</span>
            </div>
            <div className="fin-rank-track" aria-hidden="true">
              <div className="fin-rank-fill" style={{ width: max && a.totale > 0 ? `max(4px, ${(a.totale / max) * 100}%)` : 0 }} />
            </div>
            <div className="fin-rank-sub">
              {plurale(a.pagamenti, 'pagamento', 'pagamenti')} · {percentIt(a.quota)} dell'incassato · {a.iscrittiAttivi === 1 ? '1 iscritto lo ha oggi' : `${a.iscrittiAttivi} iscritti lo hanno oggi`}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

const GRUPPI: { titolo: string; stati: Status[] }[] = [
  { titolo: 'Da pagare', stati: ['scaduto', 'mancante'] },
  { titolo: 'In scadenza', stati: ['in_scadenza'] },
];

function DaPagareElenco({ elenco, onOpen }: { elenco: DaPagare[]; onOpen: (p: DaPagare) => void }) {
  if (elenco.length === 0) {
    return (
      <div className="empty fin-empty">
        <span className="fin-empty-ok" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <div>Tutti in regola.</div>
      </div>
    );
  }
  const gruppi = GRUPPI.map(g => ({ ...g, righe: elenco.filter(p => g.stati.includes(p.stato)) })).filter(g => g.righe.length > 0);
  return (
    <div className="fin-due">
      <div className="fin-due-cols" aria-hidden="true">
        <span>Nome</span><span>Corso</span><span>Abbonamento</span><span>Pagato fino al</span><span>Stato</span><span />
      </div>
      {gruppi.map(g => (
        <div key={g.titolo} className="fin-due-group" role="group" aria-label={g.titolo}>
          <div className="fin-due-title">{g.titolo} <span>{g.righe.length}</span></div>
          <ul className="fin-due-list">
            {g.righe.map(p => (
              <li key={p.id}>
                <button type="button" className="fin-due-row" onClick={() => onOpen(p)}
                  aria-label={`${p.nome}, ${p.corso}: ${PAY_LABELS[p.stato]}. Apri la scheda`}>
                  <span className="fin-due-name">
                    <span className="fin-strong">{p.nome}</span>
                    <span className="fin-due-sub">{p.corso} · {p.abbonamento ?? 'Nessun abbonamento'}</span>
                  </span>
                  <span className="fin-due-cell">{p.corso}</span>
                  <span className="fin-due-cell">{p.abbonamento ?? '—'}</span>
                  <span className="fin-due-date">{p.pagatoFino ? fmt(p.pagatoFino) : 'Mai pagato'}</span>
                  <span><span className={TAG_CLASS[p.stato]}>{PAY_LABELS[p.stato]}</span></span>
                  <ChevronIcon />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SearchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg className="fin-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="fin-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
