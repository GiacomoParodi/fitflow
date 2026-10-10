import type { Database, Migration } from '../../db';

const SCHEMA = `
CREATE TABLE assistente_agenti (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  descrizione TEXT NOT NULL DEFAULT '',
  compito TEXT NOT NULL,
  modello TEXT NOT NULL DEFAULT '',
  modello_embedding TEXT NOT NULL DEFAULT '',
  prompt_sistema TEXT NOT NULL,
  temperatura REAL NOT NULL,
  top_p REAL NOT NULL,
  top_k INTEGER NOT NULL,
  contesto INTEGER NOT NULL,
  max_risposta INTEGER NOT NULL,
  seed INTEGER,
  ragionamento INTEGER NOT NULL DEFAULT 0,
  fonti TEXT NOT NULL,
  estratti INTEGER NOT NULL,
  predefinito TEXT,
  ordine INTEGER NOT NULL DEFAULT 0,
  aggiornato_il TEXT NOT NULL
);
CREATE TABLE assistente_esercizi (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  livello TEXT NOT NULL,
  attrezzi TEXT NOT NULL,
  dati TEXT NOT NULL,
  testo TEXT NOT NULL
);
CREATE TABLE assistente_documenti (
  id INTEGER PRIMARY KEY,
  origine TEXT NOT NULL,
  partecipante_id INTEGER,
  chiave TEXT,
  titolo TEXT NOT NULL,
  nome_file TEXT NOT NULL,
  mime TEXT NOT NULL,
  dimensione INTEGER NOT NULL,
  percorso TEXT,
  impronta TEXT NOT NULL,
  stato TEXT NOT NULL,
  errore TEXT,
  caratteri INTEGER NOT NULL DEFAULT 0,
  modello_embedding TEXT,
  caricato_il TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_assistente_doc_chiave ON assistente_documenti(chiave) WHERE chiave IS NOT NULL;
CREATE INDEX idx_assistente_doc_partecipante ON assistente_documenti(partecipante_id);
CREATE TABLE assistente_estratti (
  id INTEGER PRIMARY KEY,
  documento_id INTEGER NOT NULL REFERENCES assistente_documenti(id) ON DELETE CASCADE,
  ordine INTEGER NOT NULL,
  testo TEXT NOT NULL,
  vettore BLOB,
  modello_embedding TEXT
);
CREATE INDEX idx_assistente_estratti_doc ON assistente_estratti(documento_id);
CREATE TABLE assistente_programmi (
  id INTEGER PRIMARY KEY,
  partecipante_id INTEGER,
  agente_id INTEGER REFERENCES assistente_agenti(id) ON DELETE SET NULL,
  agente_nome TEXT NOT NULL DEFAULT '',
  titolo TEXT NOT NULL,
  input TEXT NOT NULL,
  contenuto TEXT NOT NULL,
  stato TEXT NOT NULL DEFAULT 'bozza',
  creato_il TEXT NOT NULL,
  aggiornato_il TEXT NOT NULL
);
CREATE INDEX idx_assistente_programmi_partecipante ON assistente_programmi(partecipante_id);
`;

/** Indici di ricerca a testo pieno (FTS5). Se SQLite non ha FTS5 si salta: la ricerca ripiega su LIKE. */
function creaFts(db: Database) {
  try {
    db.exec(`
      CREATE VIRTUAL TABLE assistente_estratti_fts USING fts5(testo, tokenize = 'unicode61 remove_diacritics 2');
      CREATE VIRTUAL TABLE assistente_esercizi_fts USING fts5(eid UNINDEXED, testo, tokenize = 'unicode61 remove_diacritics 2');
    `);
  } catch {
    /* FTS5 non disponibile */
  }
}

export const migrazioni: Migration[] = [
  { id: 'assistente/001-schema-iniziale', up: db => { db.exec(SCHEMA); creaFts(db); } },
];

export function haFts(db: Database): boolean {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'assistente_estratti_fts'").get();
}
