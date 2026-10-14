# Contenuti dell'assistente AI

Questa cartella contiene la **base di conoscenza** consultata dall'assistente AI di GymPlan prima di rispondere all'istruttore. Il modello locale è piccolo: la qualità delle risposte dipende in gran parte da questi file.

```
content/
  esercizi.json        libreria di esercizi (formato in shared/esercizi.ts)
  conoscenze/*.md      schede di sapere professionale (principi, popolazioni speciali, segnali d'allarme…)
  README.md            questo file
```

## Libreria esercizi (`esercizi.json`)

Un array JSON formattato con 2 spazi. Ogni elemento rispetta il tipo `Esercizio` di `shared/esercizi.ts` (che è il riferimento: non va modificato da qui).

| Campo | Regole |
|---|---|
| `id` | slug stabile in minuscolo-con-trattini (`squat-a-corpo-libero`). **Non si cambia** dopo la pubblicazione: altri esercizi e, in futuro, i dati salvati possono riferirsi a esso. |
| `nome`, `altriNomi` | nome italiano principale e sinonimi (anche inglesi) utili alla ricerca. Nomi unici. |
| `categoria` | uno dei valori di `CATEGORIE`. |
| `attrezzi` | valori di `ATTREZZI`. **Corpo libero = `[]`**: il tappetino è considerato sempre disponibile e non si elenca. Se un esercizio si fa indifferentemente con due attrezzi (es. manubri o kettlebell) si elencano entrambi. |
| `livello` | `base`, `intermedio` o `avanzato`. |
| `esecuzione` | 2–5 frasi, passo passo. |
| `indicazioni` | 2–4 indicazioni tecniche brevi da dare all'allievo. |
| `erroriComuni`, `cautele` | almeno una voce. Le cautele dicono quando adattare o chiedere un parere sanitario: **mai diagnosi o consigli medici**. |
| `regressioni`, `progressioni` | solo **id esistenti**, mai l'id dell'esercizio stesso; un esercizio non può essere insieme regressione e progressione dello stesso, né progressione di B se B è già sua progressione. |
| `obiettivi` | parole chiave per la ricerca: riusare quelle già presenti (`lombalgia aspecifica`, `postura`, `anziani`, `principianti`, `pilates`, `equilibrio`, `tonificazione glutei`, `core profondo`, `gravidanza`, `post-parto`…) invece di inventarne di nuove simili. |
| `dosaggio` | dosaggio tipico realistico, es. `3 serie × 10–12 ripetizioni, recupero 60 s`. |

### Aggiungere un esercizio

1. Scegliere un `id` nuovo in kebab-case e controllare che non esista già (`grep '"id": "mio-id"' content/esercizi.json`).
2. Aggiungere l'oggetto con **tutti** i campi, nello stesso ordine degli altri.
3. Collegarlo alla sua famiglia: inserire i suoi id nelle `regressioni`/`progressioni` degli esercizi vicini e viceversa (es. piegamento al muro → mani rialzate → sulle ginocchia → classico → piedi rialzati).
4. Eseguire i test (vedi sotto).

### Modificare o eliminare

- Si possono migliorare liberamente testi, cautele, obiettivi e dosaggi.
- Per eliminare un esercizio, rimuovere prima il suo id da tutte le `regressioni`/`progressioni` (i test lo segnalano se ci si dimentica).
- Evitare di rinominare gli `id`.

## Schede di conoscenza (`conoscenze/*.md`)

File Markdown in italiano, uno per argomento, letti dall'assistente **a pezzi**: la ricerca recupera singole sezioni, non il file intero. Regole di scrittura:

- un titolo `#` e almeno tre sezioni `##` con titoli chiari e descrittivi (es. "Posizione supina", non "Altro");
- paragrafi brevi e **autonomi**: ogni sezione deve avere senso anche letta da sola, senza "come detto sopra";
- contenuti prudenti e basati sul consenso consolidato (linee guida OMS, principi ACSM in termini generali); niente numeri o citazioni di cui non si è sicuri;
- l'istruttore adatta e indirizza al medico: niente diagnosi né terapie.

Per aggiungere una scheda basta creare un nuovo file `.md` nella cartella. Nomi di file in kebab-case.

Schede attuali: principi dell'allenamento, struttura della seduta, programmazione per obiettivo, lombalgia e mal di schiena, collo spalle e postura, anziani ed equilibrio, gravidanza e post-parto, principianti e sedentari, segnali d'allarme, adattare gli esercizi agli attrezzi.

## Test

```
npm test          # tutti i test, inclusi tests/esercizi.test.ts
npm run typecheck
```

`tests/esercizi.test.ts` verifica: campi del tipo `Esercizio` presenti e non vuoti, valori di categoria/livello/attrezzi ammessi, id unici in kebab-case, riferimenti di regressioni/progressioni esistenti e coerenti, numero minimo di esercizi per categoria, quota di esercizi a corpo libero, copertura degli attrezzi principali e degli obiettivi più richiesti, presenza e struttura delle schede di conoscenza.
