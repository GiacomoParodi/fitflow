import { useId, useMemo, useState } from 'react';
import type { Documento } from '../../../shared/assistente';
import type { Esercizio } from '../../../shared/esercizi';
import { CloseButton, Dialog } from '../../components/Dialog';
import * as I from '../../icons';
import { useApp } from '../../store';
import { ass, avvisaCambio, messaggio } from './api';
import { fmtByte, fmtData, useDati, useIntervallo } from './hooks';
import * as X from './icone';

const STATO: Record<Documento['stato'], { label: string; tono: string }> = {
  in_attesa: { label: 'In coda', tono: 'spento' },
  elaborazione: { label: 'Indicizzazione…', tono: 'lavoro' },
  pronto: { label: 'Pronto', tono: 'ok' },
  senza_testo: { label: 'Nessun testo', tono: 'avviso' },
  errore: { label: 'Errore', tono: 'errore' },
};

const ACCEPT = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown';

/** Etichette leggibili per le categorie della libreria. */
const CATEGORIA: Record<string, string> = {
  forza: 'Forza', core: 'Core', cardio: 'Cardio', pliometria: 'Pliometria', mobilita: 'Mobilità', stretching: 'Stretching',
  equilibrio: 'Equilibrio', posturale: 'Posturale', respirazione: 'Respirazione',
};
export const nomeCategoria = (c: string) => CATEGORIA[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Icona del tipo di file: un quadratino con l'estensione. */
export function IconaFile({ nome, base }: { nome: string; base?: boolean }) {
  if (base) return <span className="ass-file" data-tipo="base" aria-hidden="true"><X.Libro size={15} /></span>;
  const ext = (nome.split('.').pop() ?? '').toLowerCase();
  const tipo = ext === 'pdf' ? 'pdf' : ext === 'docx' || ext === 'doc' ? 'doc' : 'txt';
  return <span className="ass-file" data-tipo={tipo} aria-hidden="true">{ext.slice(0, 4).toUpperCase() || 'FILE'}</span>;
}

/** Elenco dei documenti (libreria generale o cartella di un iscritto) con caricamento ed eliminazione. */
export function ListaDocumenti({ partecipanteId, compatta }: { partecipanteId: number | null; compatta?: boolean }) {
  const { notify } = useApp();
  const docs = useDati(() => ass.documenti(partecipanteId ?? 'generale'), [partecipanteId], ['documenti']);
  const [caricando, setCaricando] = useState(0);
  const [errore, setErrore] = useState('');
  const inLavoro = (docs.data ?? []).some(d => d.stato === 'in_attesa' || d.stato === 'elaborazione');
  useIntervallo(() => { void docs.ricarica(); }, 1500, inLavoro);

  const carica = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    setErrore('');
    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) { setErrore(`"${f.name}" supera i 20 MB.`); continue; }
      setCaricando(n => n + 1);
      try { await ass.caricaDocumento(f, partecipanteId); } catch (err) { setErrore(`${f.name}: ${messaggio(err)}`); }
      setCaricando(n => n - 1);
    }
    avvisaCambio('documenti');
  };
  const elimina = async (d: Documento) => {
    if (!window.confirm(`Eliminare "${d.titolo}"? Il file viene cancellato da questo computer.`)) return;
    try { await ass.eliminaDocumento(d.id); avvisaCambio('documenti'); } catch (e) { notify(messaggio(e)); }
  };

  const tutti = docs.data ?? [];
  const list = tutti.filter(d => d.origine === 'caricato');
  const base = tutti.filter(d => d.origine === 'base');
  const riga = (d: Documento) => (
    <li key={d.id} className="ass-doc-row">
      <IconaFile nome={d.nomeFile} base={d.origine === 'base'} />
      <div className="ass-row-main">
        <div className="ass-row-title" title={d.nomeFile}>{d.titolo}</div>
        <div className="ass-row-sub">
          {d.origine === 'base' ? 'Scheda di conoscenza' : `${fmtByte(d.dimensione)} · ${fmtData(d.caricatoIl)}`}
          {d.stato === 'pronto' && ` · ${d.estratti} estratti${d.estrattiConVettore ? ' · ricerca per significato' : ''}`}
        </div>
        {d.errore && <div className={d.stato === 'pronto' ? 'ass-row-sub' : 'warn-text'}>{d.errore}</div>}
      </div>
      <span className="ass-state" data-tono={STATO[d.stato].tono}>
        {STATO[d.stato].tono === 'lavoro' ? <span className="ass-spinner" aria-hidden="true" /> : <span className="ass-dot" data-stato={STATO[d.stato].tono} aria-hidden="true" />}
        {STATO[d.stato].label}
      </span>
      {d.origine === 'caricato' && (
        <div className="ass-row-tools">
          <a className="btn btn-icon btn-ghost" href={ass.urlDocumento(d.id)} target="_blank" rel="noreferrer" aria-label={`Apri ${d.titolo}`} title="Apri"><X.Occhio size={15} /></a>
          <button type="button" className="btn btn-icon btn-ghost ass-danger-icon" aria-label={`Elimina ${d.titolo}`} title="Elimina" onClick={() => elimina(d)}><I.Trash /></button>
        </div>
      )}
    </li>
  );
  return (
    <div className="ass-docs">
      {list.length > 0 && (
        <ul className="ass-rows" aria-label={partecipanteId ? 'Documenti della cartella' : 'Documenti della libreria'}>{list.map(riga)}</ul>
      )}
      {!docs.caricamento && list.length === 0 && (
        <div className="ass-docs-empty">
          <X.Documento size={18} />
          <span>{partecipanteId ? 'Nessun documento nella cartella.' : 'Nessun documento caricato: aggiungi manuali, dispense o linee guida.'}</span>
        </div>
      )}
      <div className="ass-docs-bar">
        <label className={`btn ${compatta ? 'btn-ghost' : 'btn-secondary'}`}>
          <I.Upload /> {caricando ? 'Caricamento…' : compatta ? 'Carica documento' : 'Carica documenti'}
          <input type="file" className="sr-only" accept={ACCEPT} multiple onChange={carica} />
        </label>
        <span className="ass-help">PDF con testo, Word (.docx), .txt o .md · max 20 MB</span>
      </div>
      {errore && <div className="error-box" role="alert">{errore}</div>}
      {base.length > 0 && (
        <details className="ass-details ass-docs-base">
          <summary><X.Freccia size={14} /> Schede di conoscenza incluse in GymPlan <span className="ass-seg-count">{base.length}</span></summary>
          <ul className="ass-rows" aria-label="Schede di conoscenza">{base.map(riga)}</ul>
        </details>
      )}
      {docs.errore && <div className="error-box" role="alert">{docs.errore}</div>}
    </div>
  );
}

// ─── Esercizi ──────────────────────────────────────────────────────────

function Voce({ titolo, voci }: { titolo: string; voci: string[] }) {
  if (!voci.length) return null;
  return <section className="ass-sec"><h4 className="ass-sec-title">{titolo}</h4><ul className="ass-list">{voci.map((v, i) => <li key={i}>{v}</li>)}</ul></section>;
}

export function SchedaEsercizio({ id, onClose }: { id: string; onClose: () => void }) {
  const [cur, setCur] = useState(id);
  const e = useDati(() => ass.esercizio(cur), [cur]);
  const hid = useId();
  const x = e.data;
  const link = (ids: string[]) => ids.map(i => (
    <button key={i} type="button" className="chip ass-chip-sm" onClick={() => setCur(i)}>{maiuscola(i.replace(/-/g, ' '))}</button>
  ));
  return (
    <Dialog onClose={onClose} className="ass-ex-dialog" labelledBy={hid} zIndex={130}>
      <div className="dialog-head">
        <div>
          <div className="ass-article-kicker">{x ? `${nomeCategoria(x.categoria)} · livello ${x.livello}` : 'Esercizio'}</div>
          <div className="dialog-title" id={hid}>{x?.nome ?? (e.errore ? 'Esercizio non trovato' : 'Caricamento…')}</div>
          {x && x.altriNomi.length > 0 && <div className="ass-row-sub">Anche: {x.altriNomi.join(', ')}</div>}
        </div>
        <CloseButton onClick={onClose} />
      </div>
      {e.errore && <div className="error-box" role="alert">{e.errore}</div>}
      {x && (
        <>
          <div className="ass-ex-facts">
            <div><div className="ass-fact-label">Attrezzi</div><div className="ass-fact-value">{x.attrezzi.length ? x.attrezzi.map(maiuscola).join(', ') : 'Corpo libero'}</div></div>
            {x.dosaggio && <div><div className="ass-fact-label">Dosaggio tipico</div><div className="ass-fact-value tabular">{x.dosaggio}</div></div>}
            {x.muscoliPrincipali.length > 0 && (
              <div className="ass-ex-facts-wide">
                <div className="ass-fact-label">Muscoli</div>
                <div className="ass-tags">
                  {x.muscoliPrincipali.map(m => <span key={m} className="tag tag-accent">{m}</span>)}
                  {x.muscoliSecondari.map(m => <span key={m} className="tag tag-neutral">{m}</span>)}
                </div>
              </div>
            )}
          </div>
          <div className="ass-ex-body">
            <div className="ass-ex-col">
              {x.esecuzione && <section className="ass-sec"><h4 className="ass-sec-title">Esecuzione</h4><p className="ass-prose">{x.esecuzione}</p></section>}
              <Voce titolo="Indicazioni" voci={x.indicazioni} />
              <Voce titolo="Errori comuni" voci={x.erroriComuni} />
            </div>
            <div className="ass-ex-col">
              {x.cautele.length > 0 && (
                <div className="ass-callout" role="note">
                  <X.Avviso size={16} />
                  <div><div className="ass-callout-title">Cautele</div><ul className="ass-list">{x.cautele.map((v, i) => <li key={i}>{v}</li>)}</ul></div>
                </div>
              )}
              <Voce titolo="Utile per" voci={x.obiettivi} />
              {x.regressioni.length > 0 && <section className="ass-sec"><h4 className="ass-sec-title">Più facile</h4><div className="ass-tags">{link(x.regressioni)}</div></section>}
              {x.progressioni.length > 0 && <section className="ass-sec"><h4 className="ass-sec-title">Più difficile</h4><div className="ass-tags">{link(x.progressioni)}</div></section>}
            </div>
          </div>
        </>
      )}
    </Dialog>
  );
}

const ATTREZZO_LIBERO = '__corpo_libero__';

function EsploraEsercizi() {
  const id = useId();
  const filtri = useDati(ass.filtriEsercizi, []);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState('');
  const [livello, setLivello] = useState('');
  const [attrezzo, setAttrezzo] = useState('');
  const [cerca, setCerca] = useState('');
  const res = useDati(() => ass.esercizi({ q: cerca, categoria }), [cerca, categoria]);
  const [scheda, setScheda] = useState<string | null>(null);
  const [quanti, setQuanti] = useState(48);
  const list = useMemo(() => (res.data ?? []).filter((e: Esercizio) => (!livello || e.livello === livello)
    && (!attrezzo || (attrezzo === ATTREZZO_LIBERO ? e.attrezzi.length === 0 : e.attrezzi.includes(attrezzo as Esercizio['attrezzi'][number])))), [res.data, livello, attrezzo]);

  if (filtri.data?.totale === 0) {
    return <div className="ass-docs-empty">La libreria esercizi è vuota: verrà caricata da <code className="ass-code">content/esercizi.json</code> al prossimo avvio.</div>;
  }
  return (
    <div className="ass-section">
      <form className="ass-filters" onSubmit={e => { e.preventDefault(); setCerca(q); }} role="search">
        <div className="ass-search">
          <X.Cerca size={15} />
          <label htmlFor={`${id}-q`} className="sr-only">Cerca</label>
          <input id={`${id}-q`} className="input" type="search" value={q} placeholder="Cerca per nome, muscolo, obiettivo…" onChange={e => { setQ(e.target.value); if (!e.target.value) setCerca(''); }} />
        </div>
        <div className="seg" role="group" aria-label="Livello">
          <button type="button" className="seg-opt" aria-pressed={livello === ''} onClick={() => setLivello('')}>Tutti i livelli</button>
          {filtri.data?.livelli.map(l => <button key={l} type="button" className="seg-opt" aria-pressed={livello === l} onClick={() => setLivello(l)}>{maiuscola(l)}</button>)}
        </div>
        <label htmlFor={`${id}-a`} className="sr-only">Attrezzo</label>
        <select id={`${id}-a`} className="input ass-auto" value={attrezzo} onChange={e => setAttrezzo(e.target.value)}>
          <option value="">Tutti gli attrezzi</option>
          <option value={ATTREZZO_LIBERO}>Corpo libero</option>
          {filtri.data?.attrezzi.map(c => <option key={c} value={c}>{maiuscola(c)}</option>)}
        </select>
        <button type="submit" className="btn btn-secondary">Cerca</button>
      </form>
      <div className="ass-chips" role="group" aria-label="Categoria">
        <button type="button" className="chip" aria-pressed={categoria === ''} onClick={() => setCategoria('')}>Tutte</button>
        {filtri.data?.categorie.map(c => <button key={c} type="button" className="chip" aria-pressed={categoria === c} onClick={() => setCategoria(c)}>{nomeCategoria(c)}</button>)}
      </div>
      <div className="ass-count" role="status">{res.caricamento ? 'Ricerca…' : `${list.length} esercizi${filtri.data ? ` su ${filtri.data.totale}` : ''}`}</div>
      {list.length > 0 ? (
        <div className="ass-ex-grid">
          {list.slice(0, quanti).map(e => (
            <button key={e.id} type="button" className="ass-ex-card" onClick={() => setScheda(e.id)}>
              <span className="ass-ex-card-top">
                <span className="ass-ex-card-cat" data-cat={e.categoria}>{nomeCategoria(e.categoria)}</span>
                <span className="ass-ex-card-lvl">{maiuscola(e.livello)}</span>
              </span>
              <span className="ass-ex-card-name">{e.nome}</span>
              {e.muscoliPrincipali.length > 0 && <span className="ass-ex-card-meta">{maiuscola(e.muscoliPrincipali.join(', '))}</span>}
              <span className="ass-ex-card-foot"><X.Manubrio size={13} /> {e.attrezzi.length ? e.attrezzi.join(', ') : 'corpo libero'}</span>
            </button>
          ))}
        </div>
      ) : !res.caricamento && (
        <div className="ass-docs-empty"><X.Cerca size={18} /><span>Nessun esercizio con questi filtri.</span></div>
      )}
      {list.length > quanti && (
        <div className="ass-more"><button type="button" className="btn btn-secondary" onClick={() => setQuanti(n => n + 48)}>Mostra altri ({list.length - quanti})</button></div>
      )}
      {scheda && <SchedaEsercizio id={scheda} onClose={() => setScheda(null)} />}
    </div>
  );
}

export function Libreria() {
  return (
    <div className="ass-section ass-libreria">
      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Documenti</h2>
            <div className="card-sub">Manuali, dispense e linee guida da cui l'assistente può prendere spunto. I documenti delle singole persone si caricano nella loro scheda (Cartella e programmi).</div>
          </div>
        </div>
        <ListaDocumenti partecipanteId={null} />
      </section>
      <section>
        <h2 className="section-title">Esercizi</h2>
        <EsploraEsercizi />
      </section>
    </div>
  );
}
