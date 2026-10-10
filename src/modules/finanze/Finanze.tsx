import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { MONTHS_SHORT, fmt } from '../../../shared/dates';
import { PAY_LABELS } from '../../../shared/rules';
import type { RiepilogoFinanze, VoceMese } from '../../../server/modules/finanze/types';
import { ApiFailure, request } from '../../api';
import { PageHead } from '../../components/PageHead';
import { TAG_CLASS } from '../../derive';
import { useApp } from '../../store';
import { pagamentiCsv, scaricaCsv } from './csv';
import { euroIt, percentIt } from './formato';
import { PERIODI, rangeFor, type PeriodoId, type Range } from './periodi';
import './finanze.css';

const MONTHS_LONG = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const PAGE_SIZE = 50;

function meseLungo(m: string) {
  return `${MONTHS_LONG[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
}

function onActivate(fn: () => void) {
  return (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
}

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

  return (
    <div className="page page-narrow fin">
      <PageHead page="finanze" title="Finanze" />

      <div className="fin-filters">
        <div className="seg fin-periods" role="group" aria-label="Periodo">
          {PERIODI.map(p => (
            <button key={p.id} type="button" className="seg-opt" aria-pressed={periodo === p.id} onClick={() => choosePeriodo(p.id)}>{p.label}</button>
          ))}
        </div>
        <div className="fin-filter-row">
          {periodo === 'personalizzato' && (
            <>
              <div className="field">
                <label htmlFor="fin-dal">Dal</label>
                <input id="fin-dal" className="input" type="date" value={custom.dal} max={custom.al || undefined}
                  onChange={e => setCustom({ ...custom, dal: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="fin-al">Al</label>
                <input id="fin-al" className="input" type="date" value={custom.al} min={custom.dal || undefined}
                  onChange={e => setCustom({ ...custom, al: e.target.value })} />
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="fin-corso">Corso</label>
            <select id="fin-corso" className="input" value={corso} onChange={e => setCorso(e.target.value)}>
              <option value="">Tutti i corsi</option>
              {(data?.opzioni.corsi ?? state.courses.map(c => ({ id: c.id, nome: c.name }))).map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fin-abb">Abbonamento</label>
            <select id="fin-abb" className="input" value={abbonamento} onChange={e => setAbbonamento(e.target.value)}>
              <option value="">Tutti gli abbonamenti</option>
              {(data?.opzioni.abbonamenti ?? state.plans.map(p => p.name)).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {(corso || abbonamento) && (
            <button type="button" className="btn btn-ghost fin-reset" onClick={() => { setCorso(''); setAbbonamento(''); }}>Togli filtri</button>
          )}
        </div>
        <div className="fin-range text-muted">
          Dal {fmt(range.dal)} al {fmt(range.al)}
        </div>
      </div>

      {error && <div className="error-box" role="alert" style={{ marginBottom: 20 }}>{error}</div>}

      {!data ? (!error && <div className="text-muted" role="status">Caricamento…</div>) : (
        <>
          <div className="fin-kpis">
            <div className="stat-tile stat-tile-red">
              <div className="label">Incassato</div>
              <div className="stat-big">{euroIt(data.totali.incassato)}</div>
            </div>
            <div className="stat-tile fin-tile-mid">
              <div className="label">Pagamenti</div>
              <div className="stat-big">{data.totali.pagamenti}</div>
            </div>
            <div className="stat-tile stat-tile-dark">
              <div className="label">Persone che hanno pagato</div>
              <div className="stat-big">{data.totali.persone}</div>
            </div>
            <div className="stat-tile stat-tile-dark">
              <div className="label">Importo medio</div>
              <div className="stat-big">{data.totali.pagamenti ? euroIt(data.totali.medio) : '—'}</div>
            </div>
          </div>

          <div className="stats-top fin-top">
            <div className="col-left">
              <h5 style={{ marginBottom: 12 }}>Incassato per mese</h5>
              <Grafico mesi={data.mesi} />
            </div>
            <div className="col-right">
              <Situazione data={data} />
            </div>
          </div>

          <hr className="hr" />

          <div className="fin-cols">
            <div className="col-left">
              <h5 style={{ marginBottom: 14 }}>Abbonamenti più venduti</h5>
              <Abbonamenti data={data} />
            </div>
            <div className="col-right">
              <h5 style={{ marginBottom: 6 }}>Per corso</h5>
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
                {data.corsi.length === 0 && <div className="empty text-muted">Nessun corso.</div>}
              </div>
              <div className="hint text-muted">Iscritti = attivi oggi. Per iscritto = incassato nel periodo diviso gli iscritti attivi.</div>
            </div>
          </div>

          <hr className="hr" />

          <h5 style={{ marginBottom: 6 }}>Chi deve pagare</h5>
          <div className="section-desc text-muted">Situazione di oggi degli iscritti attivi{corso || abbonamento ? ' (con i filtri scelti)' : ''}: chi ha l'abbonamento scaduto o in scadenza.</div>
          {data.situazione.elenco.length === 0 ? (
            <div className="empty text-muted">Tutti in regola.</div>
          ) : (
            <div className="scroll-x">
              <table className="table fin-table">
                <thead>
                  <tr><th>Nome</th><th>Corso</th><th>Abbonamento</th><th>Pagato fino al</th><th>Stato</th></tr>
                </thead>
                <tbody>
                  {data.situazione.elenco.map(p => (
                    <tr key={p.id} className="row-link" tabIndex={0} onClick={() => apriIscritto(p.id, p.courseId)}
                      onKeyDown={onActivate(() => apriIscritto(p.id, p.courseId))}>
                      <td className="fin-strong">{p.nome}</td>
                      <td>{p.corso}</td>
                      <td>{p.abbonamento ?? '—'}</td>
                      <td className="nowrap">{fmt(p.pagatoFino)}</td>
                      <td><span className={TAG_CLASS[p.stato] + ' nowrap'}>{PAY_LABELS[p.stato]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <hr className="hr" />

          <div className="toolbar">
            <h5 style={{ margin: 0 }}>Pagamenti del periodo</h5>
            <div className="toolbar-group">
              <label htmlFor="fin-cerca" className="sr-only">Cerca per nome</label>
              <input id="fin-cerca" className="input fin-search" type="search" placeholder="Cerca per nome…" value={cerca} onChange={e => setCerca(e.target.value)} />
              <button type="button" className="btn btn-secondary nowrap" onClick={esporta} disabled={pagamenti.length === 0}>Esporta CSV</button>
            </div>
          </div>
          {pagamenti.length === 0 ? (
            <div className="empty text-muted">{cerca ? 'Nessun pagamento trovato.' : 'Nessun pagamento in questo periodo.'}</div>
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
                          {p.ritiratoIl && <div className="cell-sub text-muted">Disiscritto il {fmt(p.ritiratoIl)}</div>}
                        </td>
                        <td>{p.corso}</td>
                        <td>{p.abbonamento}</td>
                        <td className="nowrap">{fmt(p.dal)} – {fmt(p.al)}</td>
                        <td className="num fin-strong">{euroIt(p.importo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="fin-list-foot text-muted">
                <span>{pagamenti.length === 1 ? '1 pagamento' : `${pagamenti.length} pagamenti`} · {euroIt(pagamenti.reduce((s, p) => s + p.importo, 0))}</span>
                {pagamenti.length > mostra && (
                  <button type="button" className="btn btn-ghost" onClick={() => setMostra(mostra + PAGE_SIZE * 4)}>Mostra altri</button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Grafico({ mesi }: { mesi: VoceMese[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...mesi.map(m => m.incassato));
  const evidenziati = mesi.filter(m => m.nelPeriodo);
  // With a short period, its months carry their value on top; otherwise values show on hover.
  const etichetteFisse = evidenziati.length <= 3;
  const totale = evidenziati.reduce((s, m) => s + m.incassato, 0);
  return (
    <>
      <div className="bars fin-bars" role="list" aria-label="Incassato per mese" onMouseLeave={() => setHover(null)}>
        {mesi.map(m => {
          const show = hover === m.mese || (hover === null && etichetteFisse && m.nelPeriodo);
          return (
            <div key={m.mese} role="listitem" className="bar-col fin-bar-col" tabIndex={0}
              aria-label={`${meseLungo(m.mese)}: ${euroIt(m.incassato)}, ${m.pagamenti} pagamenti`}
              onMouseEnter={() => setHover(m.mese)} onFocus={() => setHover(m.mese)} onBlur={() => setHover(null)}>
              <div className="fin-bar-area">
                <div className="bar" data-current={m.nelPeriodo} data-hover={hover === m.mese}
                  style={{ height: m.incassato > 0 ? `max(3px, ${(m.incassato / max) * 100}%)` : 0 }}>
                  {show && (
                    <div className="fin-bar-value" data-tip={hover === m.mese}>
                      <strong>{euroIt(m.incassato)}</strong>
                      {hover === m.mese && <span>{meseLungo(m.mese)} · {m.pagamenti} {m.pagamenti === 1 ? 'pagamento' : 'pagamenti'}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="bar-label text-muted">
                {MONTHS_SHORT[Number(m.mese.slice(5, 7)) - 1]}
                {(m.mese.endsWith('-01') || m === mesi[0]) && <span className="fin-year">{m.mese.slice(2, 4)}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="legend fin-legend">
        <div className="legend-item text-muted"><div className="legend-dot" style={{ background: 'var(--color-accent)' }} />Periodo scelto · {euroIt(totale)}</div>
        {evidenziati.length < mesi.length && (
          <div className="legend-item text-muted"><div className="legend-dot" style={{ background: 'var(--color-accent-300)' }} />Mesi precedenti</div>
        )}
      </div>
    </>
  );
}

function Situazione({ data }: { data: RiepilogoFinanze }) {
  const s = data.situazione;
  const pct = (n: number) => (s.attivi ? (n / s.attivi) * 100 : 0) + '%';
  const dist = [
    { label: 'In regola', count: s.inRegola, color: 'var(--color-neutral-400)' },
    { label: 'In scadenza', count: s.inScadenza, color: 'var(--color-accent-300)' },
    { label: 'Da pagare', count: s.daPagare, color: 'var(--color-accent)' },
  ];
  return (
    <>
      <h5 style={{ marginBottom: 4 }}>Situazione di oggi</h5>
      <div className="section-desc text-muted">{s.attivi === 1 ? '1 iscritto attivo' : `${s.attivi} iscritti attivi`}</div>
      <div className="fin-sit">
        {dist.map(d => (
          <div key={d.label} className="fin-sit-item">
            <div className="fin-sit-num" data-severe={d.label === 'Da pagare' && d.count > 0}>{d.count}</div>
            <div className="label text-muted">{d.label}</div>
          </div>
        ))}
      </div>
      <div className="stack" aria-hidden="true">
        {dist.map(d => <div key={d.label} className="fin-stack-seg" style={{ background: d.color, width: pct(d.count) }} />)}
      </div>
      <div className="legend">
        {dist.map(d => (
          <div key={d.label} className="legend-item text-muted"><div className="legend-dot" style={{ background: d.color }} />{d.label}</div>
        ))}
      </div>
    </>
  );
}

function Abbonamenti({ data }: { data: RiepilogoFinanze }) {
  const max = Math.max(0, ...data.abbonamenti.map(a => a.totale));
  if (data.abbonamenti.length === 0) return <div className="empty text-muted">Nessun abbonamento.</div>;
  return (
    <ol className="hbars fin-rank">
      {data.abbonamenti.map((a, i) => (
        <li key={a.nome}>
          <div className="hbar-head">
            <span><span className="fin-rank-num">{i + 1}</span> <span className="fin-strong">{a.nome}</span></span>
            <span className="fin-strong">{euroIt(a.totale)}</span>
          </div>
          <div className="hbar-track">
            <div className="hbar-fill fin-hbar-fill" style={{ width: max ? (a.totale / max) * 100 + '%' : 0 }} />
          </div>
          <div className="fin-rank-sub text-muted">
            {a.pagamenti === 1 ? '1 pagamento' : `${a.pagamenti} pagamenti`} · {percentIt(a.quota)} dell'incassato · {a.iscrittiAttivi === 1 ? '1 iscritto lo ha oggi' : `${a.iscrittiAttivi} iscritti lo hanno oggi`}
          </div>
        </li>
      ))}
    </ol>
  );
}
