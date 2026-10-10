import path from 'node:path';
import { ApiError } from '../../../store';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const TIPI: Record<string, { mime: string; label: string }> = {
  '.pdf': { mime: 'application/pdf', label: 'PDF' },
  '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word' },
  '.txt': { mime: 'text/plain', label: 'Testo' },
  '.md': { mime: 'text/markdown', label: 'Markdown' },
  '.markdown': { mime: 'text/markdown', label: 'Markdown' },
};

/** Estensione supportata del file, oppure errore chiaro. */
export function tipoFile(nome: string): { ext: string; mime: string } {
  const ext = path.extname(nome).toLowerCase();
  if (ext === '.doc') throw new ApiError(415, 'I file .doc (Word vecchio formato) non sono supportati: salvalo come .docx o PDF.');
  const t = TIPI[ext];
  if (!t) throw new ApiError(415, 'Formato non supportato: carica un file PDF, Word (.docx), .txt o .md.');
  return { ext, mime: t.mime };
}

/** Testo leggibile: spazi normalizzati, a capo doppi per i paragrafi. */
export function pulisciTesto(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/­/g, '')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/[ ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function decodificaTesto(buf: Buffer): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  // Molti file .txt di Windows sono in Windows-1252: se l'UTF-8 ha caratteri sostitutivi si prova quello.
  if (utf8.includes('�')) {
    try { return new TextDecoder('windows-1252').decode(buf); } catch { /* resta utf-8 */ }
  }
  return utf8.replace(/^﻿/, '');
}

async function testoPdf(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  let doc;
  try {
    doc = await getDocumentProxy(new Uint8Array(buf), { verbosity: 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/password/i.test(msg)) throw new ApiError(422, 'Il PDF è protetto da password: caricane una versione senza protezione.');
    throw new ApiError(422, 'Il PDF non si riesce a leggere: potrebbe essere danneggiato.');
  }
  const { text } = await extractText(doc, { mergePages: false });
  return (text as string[]).join('\n\n');
}

async function testoDocx(buf: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  try {
    const r = await (mammoth.default ?? mammoth).extractRawText({ buffer: buf });
    return r.value;
  } catch {
    throw new ApiError(422, 'Il file Word non si riesce a leggere: potrebbe essere danneggiato o non essere un .docx.');
  }
}

/** Estrae il testo di un documento (PDF con testo, DOCX, TXT, MD). Non fa OCR. */
export async function estraiTesto(buf: Buffer, nome: string): Promise<string> {
  const { ext } = tipoFile(nome);
  let raw: string;
  if (ext === '.pdf') raw = await testoPdf(buf);
  else if (ext === '.docx') raw = await testoDocx(buf);
  else raw = decodificaTesto(buf);
  return pulisciTesto(raw);
}

/**
 * Suddivide il testo in estratti di circa `size` caratteri con sovrapposizione, tagliando di preferenza
 * a fine paragrafo o frase.
 */
export function suddividi(text: string, size = 800, overlap = 150): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= size) return [t];
  const out: string[] = [];
  let start = 0;
  while (start < t.length) {
    let end = Math.min(start + size, t.length);
    if (end < t.length) {
      const window = t.slice(start, end);
      const min = Math.floor(size * 0.5);
      const para = window.lastIndexOf('\n\n');
      const sentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('.\n'), window.lastIndexOf('; '), window.lastIndexOf('? '), window.lastIndexOf('! '));
      const space = window.lastIndexOf(' ');
      const cut = para >= min ? para : sentence >= min ? sentence + 1 : space >= min ? space : window.length;
      end = start + cut;
    }
    const piece = t.slice(start, end).trim();
    if (piece) out.push(piece);
    if (end >= t.length) break;
    // Riparte poco prima, all'inizio di una parola.
    let next = Math.max(end - overlap, start + 1);
    const sp = t.indexOf(' ', next);
    if (sp > 0 && sp < end) next = sp + 1;
    start = next;
  }
  return out;
}
