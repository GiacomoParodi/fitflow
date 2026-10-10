// Strumenti di ricerca: parole chiave, query FTS5, vettori.

const STOP = new Set(`a ad al allo ai agli all agl alla alle con col coi da dal dallo dai dagli dall dagl dalla dalle di del dello dei degli
dell degl della delle in nel nello nei negli nell negl nella nelle su sul sullo sui sugli sull sugl sulla sulle per tra fra
e ed o od ma se che chi cui non come dove quando anche più piu meno molto poco tanto questo questa questi queste quello
quella quelli quelle il lo la i gli le un uno una mio mia tuo tua suo sua nostro vostro loro essere avere fare è sono ha
hanno era erano sia stato stata può puo deve devono senza sopra sotto dopo prima ogni tutto tutti tutte altro altri
circa così cosi già gia ancora solo sempre mai bene volte volta per esempio es`.split(/\s+/));

/** Minuscolo senza accenti. */
export function normalizza(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Parole significative (senza articoli, preposizioni…), uniche, nell'ordine in cui compaiono. */
export function paroleChiave(q: string, max = 24): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of normalizza(q).split(/[^a-z0-9]+/)) {
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

/** Radice grezza per l'italiano: "ginocchia"/"ginocchio" → "ginocc", così il prefisso le trova entrambe. */
export function radice(w: string): string {
  return w.length > 6 ? w.slice(0, Math.max(5, w.length - 3)) : w.length > 4 ? w.slice(0, w.length - 1) : w;
}

/** Query FTS5 in OR con prefissi; null se non ci sono parole utili. */
export function queryFts(q: string): string | null {
  const words = paroleChiave(q);
  if (!words.length) return null;
  return words.map(w => `"${radice(w)}"*`).join(' OR ');
}

/** Punteggio di ripiego senza FTS5: quante radici compaiono nel testo. */
export function punteggioLike(text: string, words: string[]): number {
  const t = normalizza(text);
  let s = 0;
  for (const w of words) if (t.includes(radice(w))) s += 1;
  return s;
}

export function versoBlob(v: number[]): Uint8Array {
  return new Uint8Array(new Float32Array(v).buffer);
}

export function daBlob(b: Uint8Array): Float32Array {
  // Copia per garantire l'allineamento a 4 byte.
  const copy = new Uint8Array(b.byteLength);
  copy.set(b);
  return new Float32Array(copy.buffer);
}

export function coseno(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Stima prudente dei token per testi in italiano (≈ 3,5 caratteri per token). */
export function stimaToken(s: string): number {
  return Math.ceil(s.length / 3.5);
}

/** Taglia un testo a circa `maxTokens`, preferibilmente a fine frase. */
export function tronca(s: string, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens * 3.5);
  if (s.length <= maxChars) return s;
  const cut = s.slice(0, maxChars);
  const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
  return (dot > maxChars * 0.6 ? cut.slice(0, dot + 1) : cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : maxChars)).trim() + ' […]';
}
