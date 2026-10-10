import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startServer } from '../server/app';
import { serverModules } from '../server/modules';
import { creaModuloAssistente } from '../server/modules/assistente';
import { costruisciPrompt } from '../server/modules/assistente/generazione/contesto';
import { validaProgramma } from '../server/modules/assistente/generazione/schema';
import { stimaToken } from '../server/modules/assistente/conoscenza/testo';
import { OllamaProvider } from '../server/modules/assistente/providers/ollama';
import { OpenAICompatProvider } from '../server/modules/assistente/providers/openai';
import type { EsercizioTrovato } from '../server/modules/assistente/conoscenza/esercizi';
import { parseJsonTollerante, type EventoGenerazione, type RisultatoRicerca } from '../shared/assistente';
import { ESERCIZI_PROVA, avviaMotoreFinto, cartellaContenutiProva, docxConParagrafi, leggiNdjson, type MotoreFinto } from './assistente-helpers';

const PROGRAMMA = {
  titolo: 'Seduta per la schiena',
  obiettivo: 'Mobilità e controllo lombare',
  durata: '40 minuti',
  riscaldamento: [{ id: 'gatto-mucca', nome: 'Gatto-mucca', serie: '2', ripetizioni: '8', recupero: '30 s', indicazioni: 'Lento', motivazione: 'Mobilità' }],
  parteCentrale: [
    { id: 'ponte-glutei', nome: 'Ponte glutei', serie: '3', ripetizioni: '12', recupero: '45 s', indicazioni: 'Bacino neutro', motivazione: 'Glutei' },
    { id: '', nome: 'Air squat', serie: '3', ripetizioni: '10', recupero: '60 s', indicazioni: '', motivazione: '' },
    { id: 'plank-inventato', nome: 'Plank laterale su fitball', serie: '2', ripetizioni: '20 s', recupero: '30 s', indicazioni: '', motivazione: '' },
  ],
  defaticamento: [],
  avvertenze: ['Dolore notturno: inviare al medico'],
  fonti: ['Libreria esercizi'],
};

describe('JSON del modello', () => {
  it('interpreta JSON sporco, con code fence, virgole finali o incompleto (streaming)', () => {
    expect(parseJsonTollerante('Ecco: ```json\n{"a": 1, "b": [1, 2,],}\n``` fine')).toEqual({ a: 1, b: [1, 2] });
    expect(parseJsonTollerante('{"titolo": "Sedu')).toEqual({ titolo: 'Sedu' });
    expect(parseJsonTollerante('{"titolo": "X", "parteCentrale": [{"nome": "Squat", "serie": "3"}, {"nom')).toEqual({ titolo: 'X', parteCentrale: [{ nome: 'Squat', serie: '3' }, {}] });
    expect(parseJsonTollerante('{"a": {"b": [1, 2], "c": "te')).toEqual({ a: { b: [1, 2], c: 'te' } });
    expect(parseJsonTollerante('nessun json')).toBeNull();
  });

  it('valida gli id degli esercizi contro la libreria e segnala quelli fuori libreria', () => {
    const lib = {
      get: (id: string) => ESERCIZI_PROVA.find(e => e.id === id) ?? null,
      perNome: (n: string) => ESERCIZI_PROVA.find(e => [e.nome, ...e.altriNomi].some(x => x.toLowerCase() === n.toLowerCase())) ?? null,
      conta: () => ESERCIZI_PROVA.length,
    } as unknown as Parameters<typeof validaProgramma>[1];
    const v = validaProgramma('```json\n' + JSON.stringify(PROGRAMMA) + '\n```', lib)!;
    const pc = v.contenuto.parteCentrale;
    expect(pc.map(e => [e.id, e.fuoriLibreria])).toEqual([['ponte-glutei', false], ['squat-a-corpo-libero', false], [null, true]]);
    expect(v.avvisi[0]).toMatch(/fuori libreria.*Plank laterale su fitball/);
    expect(v.contenuto.avvertenze).toEqual(['Dolore notturno: inviare al medico']);
    expect(validaProgramma('{"titolo": "vuoto"}', lib)).toBeNull();
    expect(validaProgramma('non json', lib)).toBeNull();
  });
});

describe('contesto entro il limite', () => {
  const esercizio = (i: number): EsercizioTrovato => ({
    ...ESERCIZI_PROVA[0], id: `es-${i}`, nome: `Esercizio ${i}`, obiettivi: ['forza', 'tonificazione'], punteggio: 100 - i, cauteleRilevanti: [],
  });
  const estratto = (i: number): RisultatoRicerca => ({
    estrattoId: i, documentoId: i, documento: `Documento ${i}`, origine: 'caricato', partecipanteId: null, testo: `Estratto ${i}. ` + 'parola '.repeat(110), punteggio: 1 / (i + 1),
  });

  it('riserva la risposta e tiene i più pertinenti, accorciando o escludendo gli altri', () => {
    const p = costruisciPrompt({
      promptSistema: 'Sei un esperto.', formato: 'Rispondi in JSON.', contesto: 2048, maxRisposta: 512,
      richiesta: 'Seduta per la schiena', scheda: 'Nome: Anna\nNote: ' + 'x '.repeat(2000),
      esercizi: Array.from({ length: 60 }, (_, i) => esercizio(i)), estratti: Array.from({ length: 20 }, (_, i) => estratto(i)),
    });
    const totale = p.messages.reduce((n, m) => n + stimaToken(m.content), 0);
    expect(totale + 512).toBeLessThanOrEqual(2048);
    expect(p.tagliati).toBeGreaterThan(0);
    expect(p.eserciziInclusi[0]).toBe('es-0');
    expect(p.eserciziInclusi.length).toBeLessThan(60);
    expect(p.estrattiInclusi[0]).toBe(0);
    expect(p.messages[1].content).toMatch(/## Richiesta\nSeduta per la schiena$/);
    expect(p.messages[0].content).toBe('Sei un esperto.\n\nRispondi in JSON.');
    expect(p.fonti.slice(0, 3)).toEqual(['Scheda dell\'iscritto', 'Libreria esercizi', 'Documento 0']);
    // la scheda lunghissima viene accorciata
    expect(p.messages[1].content).toContain('[…]');
  });

  it('con un contesto ampio include tutto', () => {
    const p = costruisciPrompt({
      promptSistema: 'S', formato: '', contesto: 32768, maxRisposta: 1024, richiesta: 'R', scheda: null,
      esercizi: [esercizio(1)], estratti: [estratto(1), estratto(2)],
    });
    expect(p.tagliati).toBe(0);
    expect(p.estrattiInclusi).toEqual([1, 2]);
  });

  it('errore chiaro se il contesto non basta', () => {
    expect(() => costruisciPrompt({ promptSistema: 'x'.repeat(5000), formato: '', contesto: 2048, maxRisposta: 1000, richiesta: 'R', scheda: null, esercizi: [], estratti: [] }))
      .toThrow(/finestra di contesto/);
  });
});

describe('motori', () => {
  let motore: MotoreFinto;
  beforeAll(async () => { motore = await avviaMotoreFinto({ risposta: '{"ok": true}' }); });
  afterAll(() => motore.close());

  const req = { model: 'qwen3.5:4b', messages: [{ role: 'user' as const, content: 'ciao' }], think: false, options: { temperature: 0.3, top_p: 0.9, top_k: 40, num_ctx: 4096, num_predict: 256, seed: 7 }, format: { type: 'object' } };

  it('Ollama: versione, modelli, chat in streaming con opzioni, embedding, download', async () => {
    const p = new OllamaProvider(motore.url);
    expect(await p.version()).toBe('0.12.6');
    expect((await p.listModels()).map(m => [m.nome, m.embedding])).toEqual([['embeddinggemma:latest', true], ['qwen3.5:4b', false]]);
    let text = '';
    for await (const ch of p.chat(req)) text += ch.content ?? '';
    expect(text).toBe('{"ok": true}');
    expect(motore.ultimaChat).toMatchObject({ model: 'qwen3.5:4b', stream: true, think: false, format: { type: 'object' }, options: { num_ctx: 4096, num_predict: 256, seed: 7, top_k: 40 } });
    expect((await p.embed('embeddinggemma', ['a b c', 'd']))).toHaveLength(2);
    await expect(async () => { for await (const _ of p.chat({ ...req, model: 'manca:1b' })) { /* */ } }).rejects.toThrow(/non è scaricato/);
    const steps = [];
    for await (const s of p.pull!('gemma3:1b')) steps.push(s);
    expect(steps.at(-1)?.status).toBe('success');
    expect(steps[1]).toMatchObject({ completed: 300, total: 1000 });
    await expect(async () => { for await (const _ of p.pull!('inesistente:1b')) { /* */ } }).rejects.toThrow(/non esiste/);
  });

  it('compatibile OpenAI: modelli, chat SSE, embedding', async () => {
    const p = new OpenAICompatProvider(motore.url);
    expect((await p.listModels()).map(m => m.nome)).toContain('qwen3.5:4b');
    let text = '';
    let done;
    for await (const ch of p.chat(req)) { text += ch.content ?? ''; if (ch.done) done = ch; }
    expect(text).toBe('{"ok": true}');
    expect(done).toMatchObject({ promptTokens: 80, outputTokens: 40, doneReason: 'stop' });
    expect(motore.ultimaChat).toMatchObject({ max_tokens: 256, seed: 7, temperature: 0.3, stream: true });
    expect(await p.embed('x', ['uno', 'due'])).toHaveLength(2);
  });

  it('motore spento: messaggio chiaro', async () => {
    const p = new OllamaProvider('http://127.0.0.1:9');
    await expect(p.version()).rejects.toThrow(/non risponde su http:\/\/127\.0\.0\.1:9: controlla che sia installato e avviato/);
  });
});

describe('API /api/assistente', () => {
  let dir: string;
  let content: string;
  let motore: MotoreFinto;
  let server: Awaited<ReturnType<typeof startServer>>;
  const api = (p: string, init?: RequestInit) => fetch(server.url + '/api/assistente' + p, init);
  const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-api-'));
    content = cartellaContenutiProva();
    motore = await avviaMotoreFinto({ risposta: JSON.stringify(PROGRAMMA) });
    server = await startServer({ dataDir: dir, port: 0, modules: [serverModules[0], creaModuloAssistente({ contentDir: content, ramGb: 8 })], today: () => '2026-10-10' });
    expect((await api('/impostazioni', json('PUT', { url: motore.url }))).status).toBe(200);
  });
  afterEach(async () => {
    await server.close();
    await motore.close();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(content, { recursive: true, force: true });
  });

  async function iscritto(note = '') {
    const s = server.data.store;
    const c = s.createCourse({ name: 'Functional', giorni: [2], orario: '18:00', capienza: 10 });
    return s.createParticipant({ courseId: c, name: 'Luca Neri', phone: '1', livello: 'Base', note, planId: s.plans()[0].id, iscrizioneScadenza: null, certScadenza: '2026-01-01', paid: false });
  }

  it('stato, impostazioni non locali rifiutate, modelli consigliati', async () => {
    const st = await (await api('/stato')).json();
    expect(st).toMatchObject({ raggiungibile: true, versione: '0.12.6', modelloChatInstallato: true, modelloEmbeddingInstallato: true, eserciziInLibreria: 5 });
    const bad = await api('/impostazioni', json('PUT', { url: 'https://api.example.com' }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/non è un indirizzo locale/);
    const cons = await (await api('/modelli/consigliati')).json();
    expect(cons.modelli.find((m: { nome: string }) => m.nome === 'qwen3.5:4b')).toMatchObject({ installato: true, consigliato: true });
  });

  it('genera un programma in streaming e lo salva', async () => {
    const pid = await iscritto('Lombalgia aspecifica da anni');
    const agenti = await (await api('/agenti')).json();
    const res = await api('/genera', json('POST', {
      agenteId: agenti[0].id, partecipanteId: pid, obiettivo: 'mobilità della schiena', durata: '40 minuti', attrezzi: ['tappetino'], livello: 'Base', limitazioni: 'lombalgia', note: '',
    }));
    expect(res.headers.get('content-type')).toMatch(/ndjson/);
    const events = await leggiNdjson<EventoGenerazione>(res);
    expect(events[0]).toMatchObject({ tipo: 'contesto', modello: 'qwen3.5:4b' });
    expect(events.filter(e => e.tipo === 'testo').length).toBeGreaterThan(1);
    const ris = events.find(e => e.tipo === 'risultato') as Extract<EventoGenerazione, { tipo: 'risultato' }>;
    expect(ris.contenuto.tipo).toBe('programma');
    expect(ris.avvisi.join(' ')).toMatch(/Certificato medico scaduto/);
    expect(ris.avvisi.join(' ')).toMatch(/fuori libreria/);
    expect(events.at(-1)).toEqual({ tipo: 'fine' });

    // contesto inviato al modello: scheda, esercizi filtrati per attrezzi/livello, schede di conoscenza
    const sent = motore.ultimaChat as { messages: { content: string }[]; format: unknown; think: boolean; options: Record<string, number> };
    const user = sent.messages[1].content;
    expect(user).toContain('Nome: Luca Neri');
    expect(user).toContain('id "ponte-glutei"');
    expect(user).not.toContain('stacco-rumeno-manubri'); // manubri non disponibili
    expect(user).not.toContain('id "burpee"'); // livello avanzato
    expect(user).toContain('«Lombalgia aspecifica» (scheda di conoscenza)');
    expect(sent.format).toMatchObject({ type: 'object' });
    expect(sent.think).toBe(false);
    expect(sent.options).toMatchObject({ num_ctx: 8192, num_predict: 2048, temperature: 0.4 });

    const saved = await (await api('/programmi', json('POST', { partecipanteId: pid, agenteId: agenti[0].id, contenuto: ris.contenuto, input: { obiettivo: 'x' } }))).json();
    expect(saved).toMatchObject({ partecipanteId: pid, stato: 'bozza', titolo: 'Seduta per la schiena', agenteNome: 'Generatore di esercizi' });
    const upd = await (await api(`/programmi/${saved.id}`, json('PUT', { stato: 'approvato', contenuto: { ...saved.contenuto, note: 'ok' } }))).json();
    expect(upd).toMatchObject({ stato: 'approvato', contenuto: { note: 'ok' } });
    expect(await (await api(`/programmi?iscritto=${pid}`)).json()).toHaveLength(1);
    expect(await (await api('/programmi?iscritto=generale')).json()).toHaveLength(0);
    expect((await api(`/programmi/${saved.id}`, { method: 'DELETE' })).status).toBe(200);
    expect(await (await api('/programmi')).json()).toHaveLength(0);
  });

  it('analizza la cartella usando i documenti dell\'iscritto', async () => {
    const pid = await iscritto();
    const up = await api('/documenti', { method: 'POST', body: new Uint8Array(docxConParagrafi(['Referto: protrusione discale L4-L5. Evitare carichi assiali.'])), headers: { 'X-File-Name': encodeURIComponent('Referto Neri.docx'), 'X-Participant-Id': String(pid) } });
    expect(up.status).toBe(201);
    const doc = await up.json();
    for (let i = 0; i < 50 && (await (await api(`/documenti/${doc.id}`)).json()).stato !== 'pronto'; i++) await new Promise(r => setTimeout(r, 20));
    expect(await (await api(`/documenti?iscritto=${pid}`)).json()).toHaveLength(1);

    motore.risposta = JSON.stringify({ titolo: 'Analisi', sintesi: 'Persona sedentaria.', puntiAttenzione: ['Protrusione L4-L5'], obiettiviSuggeriti: ['Controllo del tronco'], eserciziConsigliati: [{ id: 'ponte-glutei', nome: 'Ponte glutei', motivazione: 'carico basso' }], daVerificareConMedico: ['Certificato scaduto'], fonti: ['Referto Neri'] });
    motore.thinkingInvece = true; // il JSON arriva nel "ragionamento" (bug noto di alcuni modelli)
    const agenti = await (await api('/agenti')).json();
    const events = await leggiNdjson<EventoGenerazione>(await api('/genera', json('POST', { agenteId: agenti[1].id, partecipanteId: pid })));
    const ris = events.find(e => e.tipo === 'risultato') as Extract<EventoGenerazione, { tipo: 'risultato' }>;
    expect(ris.contenuto).toMatchObject({ tipo: 'analisi', puntiAttenzione: ['Protrusione L4-L5'], eserciziConsigliati: [{ id: 'ponte-glutei', fuoriLibreria: false }] });
    expect((motore.ultimaChat as { messages: { content: string }[] }).messages[1].content).toContain('protrusione discale');

    // senza iscritto: errore prima dello streaming
    const err = await api('/genera', json('POST', { agenteId: agenti[1].id }));
    expect(err.status).toBe(400);
    expect((await err.json()).error).toMatch(/Scegli l'iscritto/);
  });

  it('si interrompe quando il client chiude la connessione', async () => {
    motore.pausa = 40;
    motore.pezzi = 40;
    const agenti = await (await api('/agenti')).json();
    const ac = new AbortController();
    const res = await api('/genera', { ...json('POST', { agenteId: agenti[0].id, obiettivo: 'forza' }), signal: ac.signal });
    const reader = res.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain('"tipo":"contesto"');
    await reader.read();
    ac.abort();
    for (let i = 0; i < 50 && !motore.interrotto; i++) await new Promise(r => setTimeout(r, 20));
    expect(motore.interrotto).toBe(true);
  });

  it('errori chiari: modello non scaricato, motore spento, risposta non valida', async () => {
    const agenti = await (await api('/agenti')).json();
    await api(`/agenti/${agenti[0].id}`, json('PUT', { modello: 'llama9:70b' }));
    let r = await api('/genera', json('POST', { agenteId: agenti[0].id, obiettivo: 'forza' }));
    expect(r.status).toBe(404);
    expect((await r.json()).error).toMatch(/"llama9:70b" non è scaricato/);

    await api(`/agenti/${agenti[0].id}`, json('PUT', { modello: '' }));
    motore.risposta = 'Mi dispiace, non posso.';
    const events = await leggiNdjson<EventoGenerazione>(await api('/genera', json('POST', { agenteId: agenti[0].id, obiettivo: 'forza' })));
    expect(events.at(-1)).toMatchObject({ tipo: 'errore', messaggio: expect.stringMatching(/formato atteso/) });

    await api('/impostazioni', json('PUT', { url: 'http://127.0.0.1:9' }));
    r = await api('/genera', json('POST', { agenteId: agenti[0].id, obiettivo: 'forza' }));
    expect(r.status).toBe(503);
    expect((await r.json()).error).toMatch(/non risponde/);
    const st = await (await api('/stato')).json();
    expect(st).toMatchObject({ raggiungibile: false });
  });

  it('scarica un modello con avanzamento', async () => {
    const events = await leggiNdjson<{ tipo: string; completato?: number }>(await api('/modelli/scarica', json('POST', { nome: 'gemma3:1b' })));
    expect(events.some(e => e.tipo === 'avanzamento' && e.completato === 300)).toBe(true);
    expect(events.at(-1)).toEqual({ tipo: 'fine' });
    expect(motore.modelli).toContain('gemma3:1b');
    const ko = await leggiNdjson<{ tipo: string; messaggio?: string }>(await api('/modelli/scarica', json('POST', { nome: 'inesistente:1b' })));
    expect(ko.at(-1)).toMatchObject({ tipo: 'errore', messaggio: expect.stringMatching(/non esiste/) });
  });

  it('documenti: formati non supportati e file troppo grandi', async () => {
    let r = await api('/documenti', { method: 'POST', body: new Uint8Array(Buffer.from('x')), headers: { 'X-File-Name': 'foto.png' } });
    expect(r.status).toBe(415);
    expect((await r.json()).error).toMatch(/Formato non supportato/);
    r = await api('/documenti', { method: 'POST', body: new Uint8Array(21 * 1024 * 1024), headers: { 'X-File-Name': 'grande.txt' } });
    expect(r.status).toBe(413);
  });
});
