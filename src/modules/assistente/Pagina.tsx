import { useEffect, useState } from 'react';
import { PageHead } from '../../components/PageHead';
import { avvisaCambio } from './api';
import { Avviso } from './Contenuto';
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

export function PaginaAssistente() {
  const [sezione, setSezione] = useState<Sezione>(sezioneDaHash);
  const { data: stato, caricamento, ricarica } = useStato();
  useEffect(() => {
    const h = () => setSezione(sezioneDaHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const vai = (s: Sezione) => { window.location.hash = `/assistente/${s}`; };
  const pronto = !!(stato?.raggiungibile && stato.modelloChatInstallato);
  const livello = pronto ? 'ok' : stato?.raggiungibile ? 'avviso' : 'spento';

  return (
    <div className="page ass-page">
      <PageHead page="assistente" title="Assistente" aside={(
        <>
          {stato && (
            <a className="ass-engine" href="#/impostazioni/motore-ai" title="Impostazioni del motore AI">
              <span className="ass-dot" data-stato={livello} aria-hidden="true" />
              <span>
                {pronto ? <>Motore locale pronto{stato.modelloChatEffettivo && <span className="ass-engine-model"> · {stato.modelloChatEffettivo}</span>}</>
                  : stato.raggiungibile ? 'Nessun modello installato' : 'Motore AI non attivo'}
              </span>
            </a>
          )}
          <div className="seg ass-nav" role="group" aria-label="Sezioni dell'assistente">
            {SEZIONI.map(s => <button key={s.id} type="button" className="seg-opt" aria-pressed={sezione === s.id} onClick={() => vai(s.id)}>{s.label}</button>)}
          </div>
        </>
      )} />
      {sezione === 'genera' && (
        !stato ? <div className="ass-loading" role="status"><span className="ass-spinner" aria-hidden="true" />{caricamento ? 'Verifica del motore AI…' : 'Stato del motore non disponibile.'}</div>
          : pronto ? <Genera />
            : <Guida stato={stato} verificando={caricamento} onVerifica={() => { avvisaCambio('motore'); void ricarica(); }} />
      )}
      {sezione === 'programmi' && <Programmi />}
      {sezione === 'libreria' && <Libreria />}
      <Avviso className="ass-disclaimer-page" />
    </div>
  );
}
