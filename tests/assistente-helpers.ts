// Strumenti per i test dell'assistente: motore finto (Ollama / OpenAI), file di prova, contenuti.
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import type { Esercizio } from '../shared/esercizi';

// ─── File di prova ─────────────────────────────────────────────────────

/** PDF minimo con una riga di testo per pagina (Helvetica, testo ASCII). */
export function pdfConTesto(pagine: string[]): Buffer {
  const objs: string[] = [];
  const pageIds = pagine.map((_, i) => 3 + i * 2);
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pagine.length} >>`;
  const fontId = 3 + pagine.length * 2;
  pagine.forEach((t, i) => {
    const pid = pageIds[i];
    const esc = t.replace(/([()\\])/g, '\\$1');
    const stream = `BT /F1 12 Tf 50 750 Td (${esc}) Tj ET`;
    objs[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${pid + 1} 0 R >>`;
    objs[pid + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objs[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = Buffer.byteLength(out);
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** PDF senza testo (come una scansione). */
export function pdfSenzaTesto(): Buffer {
  return pdfConTesto(['']);
}

/** ZIP "stored" (senza compressione), sufficiente per un .docx. */
function zip(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name);
    const crc = zlib.crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18); local.writeUInt32LE(f.data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, name, f.data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0, 8); c.writeUInt16LE(0, 10);
    c.writeUInt16LE(0, 12); c.writeUInt16LE(0, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(f.data.length, 20); c.writeUInt32LE(f.data.length, 24);
    c.writeUInt16LE(name.length, 28); c.writeUInt16LE(0, 30); c.writeUInt16LE(0, 32); c.writeUInt16LE(0, 34); c.writeUInt16LE(0, 36);
    c.writeUInt32LE(0, 38); c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + f.data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cd, end]);
}

export function docxConParagrafi(paragrafi: string[]): Buffer {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${paragrafi.map(p => `<w:p><w:r><w:t xml:space="preserve">${esc(p)}</w:t></w:r></w:p>`).join('')}
</w:body></w:document>`;
  return zip([
    { name: '[Content_Types].xml', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`) },
    { name: '_rels/.rels', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`) },
    { name: 'word/document.xml', data: Buffer.from(doc) },
  ]);
}

// ─── Contenuti di prova ────────────────────────────────────────────────

const es = (e: Partial<Esercizio> & Pick<Esercizio, 'id' | 'nome'>): Esercizio => ({
  altriNomi: [], categoria: 'forza', attrezzi: [], muscoliPrincipali: [], muscoliSecondari: [], livello: 'base',
  esecuzione: '', indicazioni: [], erroriComuni: [], cautele: [], regressioni: [], progressioni: [], obiettivi: [], dosaggio: '', ...e,
});

export const ESERCIZI_PROVA: Esercizio[] = [
  es({ id: 'squat-a-corpo-libero', nome: 'Squat a corpo libero', altriNomi: ['Air squat'], muscoliPrincipali: ['quadricipiti', 'glutei'], obiettivi: ['tonificazione gambe', 'forza'], cautele: ['Dolore al ginocchio: ridurre la profondità'], dosaggio: '3 × 12' }),
  es({ id: 'ponte-glutei', nome: 'Ponte glutei', categoria: 'core', attrezzi: ['tappetino'], muscoliPrincipali: ['glutei'], obiettivi: ['lombalgia aspecifica', 'postura'] }),
  es({ id: 'stacco-rumeno-manubri', nome: 'Stacco rumeno con manubri', attrezzi: ['manubri'], livello: 'intermedio', obiettivi: ['catena posteriore'], cautele: ['Lombalgia acuta: evitare'] }),
  es({ id: 'gatto-mucca', nome: 'Gatto-mucca', categoria: 'mobilita', attrezzi: ['tappetino'], obiettivi: ['mobilità colonna', 'lombalgia aspecifica'] }),
  es({ id: 'burpee', nome: 'Burpee', categoria: 'cardio', livello: 'avanzato', obiettivi: ['resistenza'] }),
];

export function cartellaContenutiProva(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-content-'));
  fs.writeFileSync(path.join(dir, 'esercizi.json'), JSON.stringify(ESERCIZI_PROVA));
  fs.mkdirSync(path.join(dir, 'conoscenze'));
  fs.writeFileSync(path.join(dir, 'conoscenze', 'lombalgia.md'), '# Lombalgia aspecifica\n\nNella lombalgia aspecifica il movimento graduale è utile. Evitare carichi assiali pesanti nella fase acuta. Segnali d\'allarme: dolore notturno, perdita di forza alle gambe, febbre: inviare al medico.');
  fs.writeFileSync(path.join(dir, 'conoscenze', 'riscaldamento.md'), '# Riscaldamento\n\nIl riscaldamento dura 5-10 minuti con mobilità articolare e attivazione cardiovascolare leggera.');
  return dir;
}

// ─── Motore finto ──────────────────────────────────────────────────────

/** Embedding deterministico: parole → 64 dimensioni. Testi con parole in comune risultano simili. */
export function embeddingFinto(text: string): number[] {
  const v = new Array(64).fill(0);
  for (const w of text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).filter(x => x.length > 3)) {
    const stem = w.slice(0, 5);
    let h = 0;
    for (const c of stem) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    v[h % 64] += 1;
  }
  return v;
}

export interface MotoreFinto {
  url: string;
  modelli: string[];
  /** Testo restituito da /api/chat (diviso in pezzi). */
  risposta: string;
  /** Pausa tra i pezzi, in ms. */
  pausa: number;
  pezzi: number;
  ultimaChat: Record<string, unknown> | null;
  chiamateEmbed: number;
  /** true quando il client ha chiuso la connessione a metà risposta. */
  interrotto: boolean;
  thinkingInvece: boolean;
  close: () => Promise<void>;
}

function leggiCorpo(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise(resolve => {
    let s = '';
    req.on('data', c => { s += c; });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); } });
  });
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const nomeCompleto = (n: string) => (n.includes(':') ? n : n + ':latest');

/** Server HTTP locale che imita Ollama (/api/*) e un server compatibile OpenAI (/v1/*). */
export async function avviaMotoreFinto(opts: Partial<Pick<MotoreFinto, 'modelli' | 'risposta' | 'pausa' | 'pezzi'>> = {}): Promise<MotoreFinto> {
  const m: MotoreFinto = {
    url: '', modelli: opts.modelli ?? ['qwen3.5:4b', 'embeddinggemma:latest'], risposta: opts.risposta ?? '{}', pausa: opts.pausa ?? 0, pezzi: opts.pezzi ?? 6,
    ultimaChat: null, chiamateEmbed: 0, interrotto: false, thinkingInvece: false, close: async () => {},
  };
  const installato = (n: unknown) => typeof n === 'string' && m.modelli.some(x => nomeCompleto(x) === nomeCompleto(n));

  async function stream(res: http.ServerResponse, pieces: string[], line: (p: string, last: boolean) => string) {
    let closed = false;
    res.on('close', () => { if (!res.writableFinished) { closed = true; m.interrotto = true; } });
    for (let i = 0; i < pieces.length; i++) {
      if (closed) return;
      res.write(line(pieces[i], i === pieces.length - 1));
      if (m.pausa) await sleep(m.pausa);
    }
    res.end();
  }
  const dividi = (s: string) => {
    const size = Math.max(1, Math.ceil(s.length / m.pezzi));
    const out: string[] = [];
    for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
    return out.length ? out : [''];
  };

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '';
    const json = (status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.method === 'GET' && url === '/api/version') return json(200, { version: '0.12.6' });
    if (req.method === 'GET' && url === '/api/tags') {
      return json(200, { models: m.modelli.map(n => ({ name: nomeCompleto(n), size: 3_000_000_000, details: { family: n.includes('embed') ? 'gemma3' : 'qwen3', parameter_size: '4B', quantization_level: 'Q4_K_M' } })) });
    }
    if (req.method === 'POST' && url === '/api/chat') {
      const body = await leggiCorpo(req);
      m.ultimaChat = body;
      if (!installato(body.model)) return json(404, { error: `model '${body.model}' not found` });
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      const pieces = dividi(m.risposta);
      const key = m.thinkingInvece ? 'thinking' : 'content';
      return stream(res, pieces, (p, last) => JSON.stringify({ message: { role: 'assistant', [key]: p }, done: false }) + '\n'
        + (last ? JSON.stringify({ message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop', prompt_eval_count: 100, eval_count: 50 }) + '\n' : ''));
    }
    if (req.method === 'POST' && url === '/api/embed') {
      const body = await leggiCorpo(req);
      if (!installato(body.model)) return json(404, { error: `model '${body.model}' not found` });
      m.chiamateEmbed++;
      const input = Array.isArray(body.input) ? body.input as string[] : [String(body.input)];
      return json(200, { model: body.model, embeddings: input.map(embeddingFinto) });
    }
    if (req.method === 'POST' && url === '/api/pull') {
      const body = await leggiCorpo(req);
      const name = String(body.model);
      if (name.startsWith('inesistente')) return json(200, { error: 'pull model manifest: file does not exist' });
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      const lines = [{ status: 'pulling manifest' }, { status: 'pulling abc', total: 1000, completed: 300 }, { status: 'pulling abc', total: 1000, completed: 1000 }, { status: 'success' }];
      for (const l of lines) { res.write(JSON.stringify(l) + '\n'); if (m.pausa) await sleep(m.pausa); }
      m.modelli.push(name);
      return res.end();
    }
    // OpenAI compatibile
    if (req.method === 'GET' && url === '/v1/models') return json(200, { object: 'list', data: m.modelli.map(id => ({ id, object: 'model' })) });
    if (req.method === 'POST' && url === '/v1/chat/completions') {
      const body = await leggiCorpo(req);
      m.ultimaChat = body;
      if (!installato(body.model)) return json(404, { error: { message: `model ${body.model} not found` } });
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const pieces = dividi(m.risposta);
      return stream(res, pieces, (p, last) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: p }, finish_reason: null }] })}\n\n`
        + (last ? `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 80, completion_tokens: 40 } })}\n\ndata: [DONE]\n\n` : ''));
    }
    if (req.method === 'POST' && url === '/v1/embeddings') {
      const body = await leggiCorpo(req);
      const input = Array.isArray(body.input) ? body.input as string[] : [String(body.input)];
      return json(200, { data: input.map((t, index) => ({ index, embedding: embeddingFinto(t) })) });
    }
    json(404, { error: 'not found' });
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  m.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  m.close = () => new Promise(r => { server.closeAllConnections(); server.close(() => r()); });
  return m;
}

/** Legge uno stream NDJSON fino alla fine. */
export async function leggiNdjson<T>(res: Response): Promise<T[]> {
  const text = await res.text();
  return text.split('\n').filter(Boolean).map(l => JSON.parse(l) as T);
}
