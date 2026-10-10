import { useEffect, useState } from 'react';
import { PageHead } from '../../components/PageHead';
import { avvisaCambio } from './api';
import { Genera } from './Genera';
import { useStato } from './hooks';
import { Libreria } from './Libreria';
import { Guida } from './Motore';
import { Programmi } from './Programmi';

const SEZIONI = [
  { id: 'genera', label: 'Genera' },
  { id: 'programmi', label: 'Programmi' },
  { id: 'libreria', label: 'Libreria' },
] as const;
type Sezione = (typeof SEZIONI)[number]['id'];

/** Sezione dall'indirizzo: #/assistente/<sezione>?iscritto=… */
function sezioneDaHash(): Sezione {
  const s = window.location.hash.replace(/^#\/?assistente\/?/, '').split(/[?/]/)[0];
  return SEZIONI.some(x => x.id === s) ? s as Sezione : 'genera';
}

export function Avviso() {
  return <div className="ass-disclaimer text-muted">Suggerimenti generati da un modello locale: la valutazione resta del professionista.</div>;
}

export function PaginaAssistente() {
  const [sezione, setSezione] = useState<Sezione>(sezioneDaHash);
  const { data: stato, caricamento, ricarica } = useStato();
  useEffect(() => {
    const h = () => setSezione(sezioneDaHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const vai = (s: Sezione) => { window.location.hash = `/assistente/${s}`; };
  const pronto = stato?.raggiungibile && stato.modelloChatInstallato;

  return (
    <div className="page page-narrow ass-page">
      <PageHead page="assistente" title="Assistente" aside={<Avviso />} />
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Sezioni dell'assistente">
          {SEZIONI.map(s => <button key={s.id} type="button" className="seg-opt" aria-pressed={sezione === s.id} onClick={() => vai(s.id)}>{s.label}</button>)}
        </div>
        {stato && (
          <a className="ass-engine text-muted" href="#/impostazioni" title="Impostazioni del motore AI">
            <span className="ass-dot" data-ok={!!pronto} aria-hidden="true" />
            {pronto ? `Motore locale pronto${stato.modelloChatEffettivo ? ` · ${stato.modelloChatEffettivo}` : ''}` : stato.raggiungibile ? 'Nessun modello installato' : 'Motore AI non attivo'}
          </a>
        )}
      </div>
      {sezione === 'genera' && (
        !stato ? <div className="text-muted ass-small" role="status">{caricamento ? 'Verifica del motore AI…' : 'Stato del motore non disponibile.'}</div>
          : pronto ? <Genera />
            : <Guida stato={stato} verificando={caricamento} onVerifica={() => { avvisaCambio('motore'); void ricarica(); }} />
      )}
      {sezione === 'programmi' && <Programmi />}
      {sezione === 'libreria' && <Libreria />}
    </div>
  );
}
