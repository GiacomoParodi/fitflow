import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openData, type OpenedData } from '../server/app';
import { serverModules } from '../server/modules';
import { creaModuloAssistente } from '../server/modules/assistente';
import { AGENTI_PREDEFINITI } from '../server/modules/assistente/agenti';
import type { Assistente } from '../server/modules/assistente/servizio';
import { ipLocale, validaUrlLocale } from '../server/modules/assistente/urlLocale';
import { chatConsigliato, consigliati, risolviChat, risolviEmbedding } from '../server/modules/assistente/modelli';

let dir: string;
let data: OpenedData;
let a: Assistente;

function apri() {
  const mod = creaModuloAssistente({ contentDir: null, ramGb: 8 });
  data = openData(dir, [serverModules[0], mod], () => '2026-10-10');
  a = mod.istanza(data.db)!;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-agenti-'));
  apri();
});
afterEach(() => {
  a.ferma();
  data.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('agenti', () => {
  it('crea i due agenti predefiniti al primo avvio, con prompt in italiano e cautele mediche', () => {
    const list = a.agenti.elenco();
    expect(list.map(x => x.nome)).toEqual(['Generatore di esercizi', 'Analisi cartella']);
    expect(list.map(x => x.compito)).toEqual(['genera_programma', 'analizza_cartella']);
    for (const ag of list) {
      expect(ag.promptSistema).toMatch(/medico/);
      expect(ag.promptSistema).toMatch(/diagnosi/);
      expect(ag.promptSistema).toMatch(/fonti/);
      expect(ag.modello).toBe('');
      expect(ag.fonti).toEqual({ esercizi: true, conoscenze: true, documenti: true, cartella: true });
    }
  });

  it('crea, modifica, duplica ed elimina; i predefiniti eliminati non tornano da soli', () => {
    const base = a.agenti.elenco()[0];
    const nuovo = a.agenti.crea({ ...base, nome: 'Pilates', compito: 'libero', temperatura: 0.8, seed: 42 });
    expect(nuovo).toMatchObject({ nome: 'Pilates', compito: 'libero', temperatura: 0.8, seed: 42, predefinito: null });

    const mod = a.agenti.aggiorna(nuovo.id, { topK: 20, fonti: { esercizi: false }, seed: '' });
    expect(mod.topK).toBe(20);
    expect(mod.seed).toBeNull();
    expect(mod.fonti.esercizi).toBe(false);
    expect(mod.temperatura).toBe(0.8);

    const copia = a.agenti.duplica(nuovo.id);
    expect(copia.nome).toBe('Pilates (copia)');
    expect(copia.id).not.toBe(nuovo.id);

    a.agenti.elimina(base.id);
    a.ferma(); data.close(); apri();
    expect(a.agenti.elenco().map(x => x.nome)).toEqual(['Analisi cartella', 'Pilates', 'Pilates (copia)']);
  });

  it('valida i parametri con messaggi chiari', () => {
    const base = a.agenti.elenco()[0];
    expect(() => a.agenti.aggiorna(base.id, { temperatura: 3 })).toThrow(/Temperatura/);
    expect(() => a.agenti.aggiorna(base.id, { topP: 0 })).toThrow(/Top P/);
    expect(() => a.agenti.aggiorna(base.id, { contesto: 512 })).toThrow(/Contesto/);
    expect(() => a.agenti.aggiorna(base.id, { contesto: 4096, maxRisposta: 3000 })).toThrow(/metà del contesto/);
    expect(() => a.agenti.aggiorna(base.id, { nome: ' ' })).toThrow(/nome/);
    expect(() => a.agenti.aggiorna(base.id, { compito: 'altro' })).toThrow(/Compito/);
    expect(() => a.agenti.aggiorna(base.id, { modello: 'qwen 3' })).toThrow(/spazi/);
    expect(() => a.agenti.get(999)).toThrow(/non trovato/);
  });

  it('ripristina i predefiniti senza toccare gli agenti dell\'utente', () => {
    const [gen, an] = a.agenti.elenco();
    a.agenti.aggiorna(gen.id, { promptSistema: 'cambiato', temperatura: 1.5 });
    a.agenti.elimina(an.id);
    a.agenti.crea({ ...gen, nome: 'Mio' });
    const list = a.agenti.ripristina();
    expect(list.find(x => x.id === gen.id)).toMatchObject({ temperatura: AGENTI_PREDEFINITI[0].temperatura, promptSistema: AGENTI_PREDEFINITI[0].promptSistema });
    expect(list.map(x => x.nome).sort()).toEqual(['Analisi cartella', 'Generatore di esercizi', 'Mio']);
  });
});

describe('impostazioni e URL locali', () => {
  it('accetta solo indirizzi di questo computer o della rete locale', () => {
    for (const ok of ['http://127.0.0.1:11434', 'http://localhost:11434/', 'http://192.168.1.20:11434', 'http://10.0.0.5:1234/v1',
      'http://172.20.1.1:8080', 'http://[::1]:11434', 'http://mac-mini.local:11434', 'https://ollama.localhost']) {
      expect(() => validaUrlLocale(ok)).not.toThrow();
    }
    expect(validaUrlLocale('http://localhost:11434/')).toBe('http://localhost:11434');
    for (const ko of ['http://api.openai.com', 'https://8.8.8.8', 'http://172.32.0.1', 'http://example.com:11434', 'ftp://127.0.0.1', 'non un url', 'http://user:pw@127.0.0.1']) {
      expect(() => validaUrlLocale(ko)).toThrow();
    }
    expect(() => validaUrlLocale('https://api.openai.com')).toThrow(/non è un indirizzo locale/);
    expect(ipLocale('fd12:3456::1')).toBe(true);
    expect(ipLocale('2001:4860::8888')).toBe(false);
  });

  it('salva le impostazioni validate', () => {
    expect(a.impostazioni.get()).toMatchObject({ provider: 'ollama', url: 'http://127.0.0.1:11434', modelloChat: '' });
    a.impostazioni.aggiorna({ provider: 'openai', url: 'http://127.0.0.1:1234/', modelloChat: 'gemma3:4b' });
    expect(a.impostazioni.get()).toMatchObject({ provider: 'openai', url: 'http://127.0.0.1:1234', modelloChat: 'gemma3:4b' });
    expect(() => a.impostazioni.aggiorna({ url: 'https://example.com' })).toThrow(/locale/);
    expect(() => a.impostazioni.aggiorna({ provider: 'cloud' })).toThrow();
  });
});

describe('modelli consigliati', () => {
  const inst = (nomi: string[]) => nomi.map(nome => ({ nome, dimensione: 1, famiglia: '', parametri: '', quantizzazione: '', embedding: /embed/.test(nome) }));

  it('sceglie in base alla memoria e a cosa è installato', () => {
    expect(chatConsigliato(8)).toBe('qwen3.5:4b');
    expect(chatConsigliato(6)).toBe('qwen3.5:2b');
    expect(chatConsigliato(4)).toBe('gemma3:1b');
    const list = consigliati(8, inst(['gemma3:4b', 'embeddinggemma:latest']));
    expect(list.find(m => m.nome === 'qwen3.5:4b')).toMatchObject({ consigliato: true, installato: false, adatto: true });
    expect(list.find(m => m.nome === 'gemma3:4b')).toMatchObject({ consigliato: false, installato: true });
    expect(list.find(m => m.nome === 'embeddinggemma')).toMatchObject({ consigliato: true, installato: true, tipo: 'embedding' });
    expect(list.find(m => m.nome === 'qwen3.5:9b')?.adatto).toBe(false);
  });

  it('risolve il modello automatico', () => {
    expect(risolviChat('', inst(['gemma3:4b', 'qwen3.5:4b', 'embeddinggemma:latest']), 8)).toBe('qwen3.5:4b');
    expect(risolviChat('', inst(['llama3.2:3b', 'gemma3:4b']), 8)).toBe('gemma3:4b');
    expect(risolviChat('', inst(['llama3.2:3b']), 8)).toBe('llama3.2:3b');
    expect(risolviChat('', inst(['nomic-embed-text:latest']), 8)).toBeNull();
    expect(risolviChat('mio:1b', inst([]), 8)).toBe('mio:1b');
    expect(risolviEmbedding('', inst(['qwen3.5:4b', 'nomic-embed-text:latest', 'embeddinggemma:latest']))).toBe('embeddinggemma:latest');
    expect(risolviEmbedding('', inst(['qwen3.5:4b']))).toBeNull();
  });
});
