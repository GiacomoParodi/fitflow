import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openData, type OpenedData } from '../server/app';
import { serverModules } from '../server/modules';
import { creaModuloAssistente } from '../server/modules/assistente';
import { estraiTesto, suddividi, tipoFile } from '../server/modules/assistente/conoscenza/estrazione';
import { queryFts } from '../server/modules/assistente/conoscenza/testo';
import type { Assistente } from '../server/modules/assistente/servizio';
import {
  avviaMotoreFinto, cartellaContenutiProva, docxConParagrafi, pdfConTesto, pdfSenzaTesto, type MotoreFinto,
} from './assistente-helpers';

describe('estrazione del testo', () => {
  it('legge TXT (anche Windows-1252), DOCX e PDF; nessun testo da un PDF scansionato', async () => {
    expect(await estraiTesto(Buffer.from('Ciao\r\n\r\n\r\nmondo  con   spazi'), 'a.txt')).toBe('Ciao\n\nmondo con spazi');
    expect(await estraiTesto(Buffer.from([0x70, 0x65, 0x72, 0xf2]), 'b.txt')).toBe('però');
    expect(await estraiTesto(Buffer.from('# Titolo\n\nTesto'), 'c.md')).toBe('# Titolo\n\nTesto');
    expect(await estraiTesto(docxConParagrafi(['Referto: lombalgia cronica', 'Evitare carichi assiali']), 'r.docx'))
      .toBe('Referto: lombalgia cronica\n\nEvitare carichi assiali');
    expect(await estraiTesto(pdfConTesto(['Dolore al ginocchio destro', 'Seconda pagina']), 'r.pdf')).toBe('Dolore al ginocchio destro\n\nSeconda pagina');
    expect(await estraiTesto(pdfSenzaTesto(), 's.pdf')).toBe('');
  });

  it('rifiuta i formati non supportati e i file rovinati', async () => {
    expect(() => tipoFile('foto.png')).toThrow(/Formato non supportato/);
    expect(() => tipoFile('vecchio.doc')).toThrow(/\.docx/);
    await expect(estraiTesto(Buffer.from('non è uno zip'), 'x.docx')).rejects.toThrow(/Word/);
    await expect(estraiTesto(Buffer.from('non è un pdf'), 'x.pdf')).rejects.toThrow(/PDF/);
  });

  it('suddivide in estratti di ~800 caratteri con sovrapposizione, tagliando a fine frase', () => {
    const frase = (i: number) => `Questa è la frase numero ${i} con qualche parola in più per allungarla.`;
    const text = Array.from({ length: 60 }, (_, i) => frase(i)).join(' ');
    const parts = suddividi(text, 800, 150);
    expect(parts.length).toBeGreaterThan(4);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(800);
    for (const p of parts.slice(0, -1)) expect(p.endsWith('.')).toBe(true);
    // sovrapposizione: l'inizio di ogni estratto compare alla fine del precedente
    for (let i = 1; i < parts.length; i++) expect(parts[i - 1]).toContain(parts[i].slice(0, 30));
    expect(parts.join(' ')).toContain(frase(59));
    expect(suddividi('breve')).toEqual(['breve']);
    expect(suddividi('  ')).toEqual([]);
  });

  it('costruisce query FTS con prefissi, senza parole vuote', () => {
    expect(queryFts('Il dolore alle ginocchia')).toBe('"dolor"* OR "ginocc"*');
    expect(queryFts('di e il')).toBeNull();
  });
});

describe('base di conoscenza', () => {
  let dir: string;
  let content: string;
  let data: OpenedData;
  let a: Assistente;
  let motore: MotoreFinto;

  beforeAll(async () => { motore = await avviaMotoreFinto(); });
  afterAll(() => motore.close());

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-kb-'));
    content = cartellaContenutiProva();
    const mod = creaModuloAssistente({ contentDir: content, ramGb: 8 });
    data = openData(dir, [serverModules[0], mod], () => '2026-10-10');
    a = mod.istanza(data.db)!;
  });
  afterEach(async () => {
    await a.documenti.attendi();
    a.ferma();
    data.close();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(content, { recursive: true, force: true });
  });

  it('carica la libreria esercizi e la cerca per testo, attrezzi, livello, obiettivo', () => {
    expect(a.libreria.conta()).toBe(5);
    expect(a.libreria.cerca({ q: 'glutei' }).map(e => e.id)).toEqual(expect.arrayContaining(['ponte-glutei', 'squat-a-corpo-libero']));
    // senza attrezzi: solo corpo libero (il tappetino si dà per scontato)
    expect(a.libreria.cerca({ attrezzi: [] }).map(e => e.id).sort()).toEqual(['burpee', 'gatto-mucca', 'ponte-glutei', 'squat-a-corpo-libero']);
    expect(a.libreria.cerca({ attrezzi: ['tappetino'], livello: 'Base' }).map(e => e.id).sort()).toEqual(['gatto-mucca', 'ponte-glutei', 'squat-a-corpo-libero']);
    const lomb = a.libreria.cerca({ obiettivo: 'lombalgia', attrezzi: ['tappetino', 'manubri'], livello: 'intermedio', limitazioni: 'lombalgia acuta' });
    expect(lomb.slice(0, 2).map(e => e.id).sort()).toEqual(['gatto-mucca', 'ponte-glutei']);
    expect(lomb.find(e => e.id === 'stacco-rumeno-manubri')?.cauteleRilevanti).toEqual(['Lombalgia acuta: evitare']);
    expect(a.libreria.perNome('air squat')?.id).toBe('squat-a-corpo-libero');
    expect(a.libreria.filtri().attrezzi).toEqual(['tappetino', 'manubri']);
  });

  it('aggiorna la libreria per id e ignora file mancanti, vuoti o non validi', () => {
    fs.writeFileSync(path.join(content, 'esercizi.json'), JSON.stringify([{ id: 'burpee', nome: 'Burpee modificato' }, { nome: 'senza id' }]));
    expect(a.libreria.carica(content)).toEqual({ caricati: 1, scartati: 1 });
    expect(a.libreria.conta()).toBe(1);
    expect(a.libreria.get('burpee')?.nome).toBe('Burpee modificato');
    fs.writeFileSync(path.join(content, 'esercizi.json'), '[]');
    expect(a.libreria.carica(content).caricati).toBe(0);
    expect(a.libreria.conta()).toBe(1);
    expect(a.libreria.carica(path.join(content, 'manca')).caricati).toBe(0);
    fs.writeFileSync(path.join(content, 'esercizi.json'), '{rotto');
    expect(() => a.libreria.carica(content)).not.toThrow();
  });

  it('indicizza schede di conoscenza e documenti caricati; ricerca testuale', async () => {
    await a.documenti.attendi();
    const base = a.documenti.elenco(null).filter(d => d.origine === 'base');
    expect(base.map(d => d.titolo).sort()).toEqual(['Lombalgia aspecifica', 'Riscaldamento']);
    expect(base.every(d => d.stato === 'pronto')).toBe(true);
    expect(() => a.documenti.elimina(base[0].id)).toThrow(/non si possono eliminare/);

    const doc = a.documenti.carica(docxConParagrafi(['Referto ortopedico.', 'Condropatia rotulea al ginocchio sinistro: evitare squat profondi.']), 'Referto Rossi.docx', null);
    expect(doc.stato).toBe('in_attesa');
    await a.documenti.attendi();
    expect(a.documenti.get(doc.id)).toMatchObject({ stato: 'pronto', estratti: 1, titolo: 'Referto Rossi' });

    const scan = a.documenti.carica(pdfSenzaTesto(), 'scansione.pdf', null);
    await a.documenti.attendi();
    expect(a.documenti.get(scan.id)).toMatchObject({ stato: 'senza_testo' });
    expect(a.documenti.get(scan.id).errore).toMatch(/Nessun testo trovato/);

    const r = await a.documenti.cerca('ginocchia e squat', { conoscenze: true, documenti: true }, 5);
    expect(r[0].documento).toBe('Referto Rossi');
    const r2 = await a.documenti.cerca('dolore notturno lombare', { conoscenze: true }, 5);
    expect(r2[0].documento).toBe('Lombalgia aspecifica');
    // fuori ambito: i documenti generali non compaiono se non richiesti
    expect((await a.documenti.cerca('ginocchio', { conoscenze: true }, 5)).some(x => x.documento === 'Referto Rossi')).toBe(false);

    a.documenti.elimina(doc.id);
    expect(await a.documenti.cerca('condropatia', { documenti: true }, 5)).toEqual([]);
    expect(() => a.documenti.carica(Buffer.from('x'), 'foto.jpg', null)).toThrow(/Formato/);
  });

  it('cartella per iscritto, sincronizzazione delle schede e vettori con il modello di embedding', async () => {
    a.impostazioni.aggiorna({ url: motore.url });
    a.invalidaCache();
    const course = a.core.createCourse({ name: 'Pilates', giorni: [1], orario: '09:00', capienza: 10 });
    const pid = a.core.createParticipant({ courseId: course, name: 'Anna', phone: '1', livello: 'Base', note: '', planId: a.core.plans()[0].id, iscrizioneScadenza: null, certScadenza: null, paid: false });
    const d = a.documenti.carica(Buffer.from('Questionario: la signora riferisce mal di schiena la mattina.'), 'questionario.txt', pid);
    a.documenti.reindicizza();
    await a.documenti.attendi();
    expect(a.documenti.elenco(pid).map(x => x.id)).toEqual([d.id]);
    expect(a.documenti.elenco(null).some(x => x.id === d.id)).toBe(false);
    expect(a.documenti.get(d.id)).toMatchObject({ estrattiConVettore: 1, modelloEmbedding: 'embeddinggemma:latest' });

    // ricerca per significato: "schiena" trova il documento anche senza FTS sulla parola esatta della query
    const r = await a.documenti.cerca('schiena mattina', { partecipanteId: pid }, 3);
    expect(r.map(x => x.documentoId)).toEqual([d.id]);
    expect(await a.documenti.cerca('schiena', { partecipanteId: pid + 1 }, 3)).toEqual([]);

    // modifica e rimozione delle schede di conoscenza
    fs.writeFileSync(path.join(content, 'conoscenze', 'riscaldamento.md'), '# Riscaldamento aggiornato\n\nNuovo testo.');
    fs.rmSync(path.join(content, 'conoscenze', 'lombalgia.md'));
    a.documenti.sincronizzaConoscenze(content);
    await a.documenti.attendi();
    expect(a.documenti.elenco(null).filter(x => x.origine === 'base').map(x => x.titolo)).toEqual(['Riscaldamento aggiornato']);
  });
});
