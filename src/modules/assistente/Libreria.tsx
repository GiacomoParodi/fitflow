import { useId, useMemo, useState } from 'react';
import type { Documento } from '../../../shared/assistente';
import type { Esercizio } from '../../../shared/esercizi';
import { CloseButton, Dialog } from '../../components/Dialog';
import * as I from '../../icons';
import { useApp } from '../../store';
import { ass, avvisaCambio, messaggio } from './api';
import { fmtByte, fmtData, useDati, useIntervallo } from './hooks';

const STATO: Record<Documento['stato'], { label: string; cls: string }> = {
  in_attesa: { label: 'In coda', cls: 'tag tag-outline' },
  elaborazione: { label: 'Indicizzazione…', cls: 'tag tag-outline' },
  pronto: { label: 'Pronto', cls: 'tag tag-neutral' },
  senza_testo: { label: 'Nessun testo', cls: 'tag tag-accent' },
  errore: { label: 'Errore', cls: 'tag tag-accent' },
};

const ACCEPT = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown';

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

  const list = docs.data ?? [];
  return (
    <div className="ass-stack-sm">
      {list.length > 0 && (
        <ul className="ass-docs" aria-label={partecipanteId ? 'Documenti della cartella' : 'Documenti della libreria'}>
          {list.map(d => (
            <li key={d.id} className="ass-doc">
              <div className="file-icon" data-has-file={d.stato === 'pronto'} aria-hidden="true"><I.FileCheck /></div>
              <div className="file-info">
                <div className="file-name" title={d.nomeFile}>{d.titolo}</div>
                <div className="text-muted ass-small">
                  {d.origine === 'base' ? 'Scheda di conoscenza' : `${d.nomeFile.split('.').pop()?.toUpperCase()} · ${fmtByte(d.dimensione)} · ${fmtData(d.caricatoIl)}`}
                  {d.stato === 'pronto' && ` · ${d.estratti} estratti${d.estrattiConVettore ? ' · ricerca per significato' : ''}`}
                </div>
                {d.errore && <div className={d.stato === 'pronto' ? 'text-muted ass-small' : 'warn-text'}>{d.errore}</div>}
              </div>
              <span className={`${STATO[d.stato].cls} nowrap`}>{STATO[d.stato].label}</span>
              {d.origine === 'caricato' && (
                <div className="btn-row">
                  <a className="btn btn-icon btn-secondary" href={ass.urlDocumento(d.id)} target="_blank" rel="noreferrer" aria-label={`Apri ${d.titolo}`} title="Apri"><I.Eye /></a>
                  <button type="button" className="btn btn-icon btn-secondary" aria-label={`Elimina ${d.titolo}`} title="Elimina" onClick={() => elimina(d)}><I.Trash /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!docs.caricamento && list.length === 0 && (
        <div className="text-muted ass-small">{partecipanteId ? 'Nessun documento nella cartella.' : 'Nessun documento caricato.'}</div>
      )}
      <div className="ass-row">
        <label className="btn btn-secondary">
          <I.Upload /> {caricando ? 'Caricamento…' : compatta ? 'Carica documento' : 'Carica documenti'}
          <input type="file" className="sr-only" accept={ACCEPT} multiple onChange={carica} />
        </label>
        <span className="text-muted ass-small">PDF con testo, Word (.docx), .txt o .md · max 20 MB</span>
      </div>
      {errore && <div className="error-box" role="alert">{errore}</div>}
      {docs.errore && <div className="error-box" role="alert">{docs.errore}</div>}
    </div>
  );
}

// ─── Esercizi ──────────────────────────────────────────────────────────

function Voce({ titolo, voci }: { titolo: string; voci: string[] }) {
  if (!voci.length) return null;
  return <div><div className="label text-muted ass-sub">{titolo}</div><ul className="ass-list">{voci.map((v, i) => <li key={i}>{v}</li>)}</ul></div>;
}

export function SchedaEsercizio({ id, onClose }: { id: string; onClose: () => void }) {
  const [cur, setCur] = useState(id);
  const e = useDati(() => ass.esercizio(cur), [cur]);
  const hid = useId();
  const x = e.data;
  const link = (ids: string[]) => ids.map(i => (
    <button key={i} type="button" className="tag tag-neutral ass-tag-btn" onClick={() => setCur(i)}>{i.replace(/-/g, ' ')}</button>
  ));
  return (
    <Dialog onClose={onClose} className="dialog-wide" labelledBy={hid} zIndex={130}>
      <div className="dialog-head">
        <div>
          <div className="label text-muted">{x ? `${x.categoria} · livello ${x.livello}` : 'Esercizio'}</div>
          <div className="dialog-title" id={hid}>{x?.nome ?? (e.errore ? 'Esercizio non trovato' : 'Caricamento…')}</div>
          {x && x.altriNomi.length > 0 && <div className="text-muted ass-small">Anche: {x.altriNomi.join(', ')}</div>}
        </div>
        <CloseButton onClick={onClose} />
      </div>
      {e.errore && <div className="error-box" role="alert">{e.errore}</div>}
      {x && (
        <div className="ass-stack">
          <div className="ass-tags">
            <span className="tag tag-neutral">{x.attrezzi.length ? x.attrezzi.join(', ') : 'corpo libero'}</span>
            {x.muscoliPrincipali.map(m => <span key={m} className="tag tag-accent">{m}</span>)}
            {x.muscoliSecondari.map(m => <span key={m} className="tag tag-outline">{m}</span>)}
          </div>
          {x.esecuzione && <div><div className="label text-muted ass-sub">Esecuzione</div><div className="note-text">{x.esecuzione}</div></div>}
          {x.dosaggio && <div className="ass-small"><strong>Dosaggio tipico:</strong> {x.dosaggio}</div>}
          <Voce titolo="Indicazioni" voci={x.indicazioni} />
          <Voce titolo="Errori comuni" voci={x.erroriComuni} />
          {x.cautele.length > 0 && <div className="ass-callout"><Voce titolo="Cautele" voci={x.cautele} /></div>}
          <Voce titolo="Utile per" voci={x.obiettivi} />
          {(x.regressioni.length > 0 || x.progressioni.length > 0) && (
            <div className="form-2">
              {x.regressioni.length > 0 && <div><div className="label text-muted ass-sub">Più facile</div><div className="ass-tags">{link(x.regressioni)}</div></div>}
              {x.progressioni.length > 0 && <div><div className="label text-muted ass-sub">Più difficile</div><div className="ass-tags">{link(x.progressioni)}</div></div>}
            </div>
          )}
        </div>
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
  const list = useMemo(() => (res.data ?? []).filter((e: Esercizio) => (!livello || e.livello === livello)
    && (!attrezzo || (attrezzo === ATTREZZO_LIBERO ? e.attrezzi.length === 0 : e.attrezzi.includes(attrezzo as Esercizio['attrezzi'][number])))), [res.data, livello, attrezzo]);

  if (filtri.data?.totale === 0) {
    return <div className="text-muted ass-small">La libreria esercizi è vuota: verrà caricata da <code className="ass-code">content/esercizi.json</code> al prossimo avvio.</div>;
  }
  return (
    <div className="ass-stack">
      <form className="ass-filters" onSubmit={e => { e.preventDefault(); setCerca(q); }} role="search">
        <div className="field ass-grow">
          <label htmlFor={`${id}-q`}>Cerca</label>
          <input id={`${id}-q`} className="input" type="search" value={q} placeholder="Nome, muscolo, obiettivo…" onChange={e => { setQ(e.target.value); if (!e.target.value) setCerca(''); }} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-c`}>Categoria</label>
          <select id={`${id}-c`} className="input" value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option value="">Tutte</option>
            {filtri.data?.categorie.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-a`}>Attrezzo</label>
          <select id={`${id}-a`} className="input" value={attrezzo} onChange={e => setAttrezzo(e.target.value)}>
            <option value="">Tutti</option>
            <option value={ATTREZZO_LIBERO}>Corpo libero</option>
            {filtri.data?.attrezzi.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-l`}>Livello</label>
          <select id={`${id}-l`} className="input" value={livello} onChange={e => setLivello(e.target.value)}>
            <option value="">Tutti</option>
            {filtri.data?.livelli.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">Cerca</button>
      </form>
      <div className="text-muted ass-small" role="status">{res.caricamento ? 'Ricerca…' : `${list.length} esercizi${filtri.data ? ` su ${filtri.data.totale}` : ''}`}</div>
      <div className="ass-ex-grid">
        {list.map(e => (
          <button key={e.id} type="button" className="clickable course-card ass-ex-card" onClick={() => setScheda(e.id)}>
            <div className="course-card-name">{e.nome}</div>
            <div className="course-card-meta">{e.categoria} · {e.livello} · {e.attrezzi.length ? e.attrezzi.join(', ') : 'corpo libero'}</div>
            {e.muscoliPrincipali.length > 0 && <div className="course-card-meta">{e.muscoliPrincipali.join(', ')}</div>}
          </button>
        ))}
      </div>
      {scheda && <SchedaEsercizio id={scheda} onClose={() => setScheda(null)} />}
    </div>
  );
}

export function Libreria() {
  return (
    <div className="ass-stack">
      <section>
        <h3 className="section-title"><span className="num">A</span> Documenti</h3>
        <div className="section-desc text-muted">
          Manuali, dispense e linee guida da cui l'assistente può prendere spunto. I documenti delle singole persone si caricano nella loro scheda (Cartella e programmi).
        </div>
        <ListaDocumenti partecipanteId={null} />
      </section>
      <hr className="hr" />
      <section>
        <h3 className="section-title"><span className="num">B</span> Esercizi</h3>
        <EsploraEsercizi />
      </section>
    </div>
  );
}
