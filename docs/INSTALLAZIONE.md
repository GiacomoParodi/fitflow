# Installare GymPlan

GymPlan è un programma gratuito per gestire i corsi di ginnastica. Funziona sul tuo computer, anche senza Internet: i dati non vengono mandati da nessuna parte.

Funziona su:

- **Windows** 10 e 11;
- **Ubuntu** 22.04 e 24.04 (e altre distribuzioni Debian a 64 bit);
- **Mac** con chip Apple (M1, M2, M3, M4…) e Mac con processore Intel.

## 1. Scaricare il programma

1. Apri la pagina delle versioni: **https://github.com/GiacomoParodi/fitflow/releases/latest** (il repository è privato: serve aver fatto l'accesso a GitHub con l'account che lo possiede)
2. In fondo alla pagina, nella sezione **Assets**, scarica il file giusto per il tuo computer:

| Computer | File da scaricare |
| --- | --- |
| Windows | `GymPlan-Setup-X.Y.Z.exe` |
| Mac con chip Apple (M1, M2, M3…) | `GymPlan-X.Y.Z-arm64.dmg` |
| Mac con processore Intel | `GymPlan-X.Y.Z-x64.dmg` |
| Ubuntu / Debian | `GymPlan-X.Y.Z-amd64.deb` |

(`X.Y.Z` è il numero della versione, per esempio `1.2.0`.)

**Non sai che Mac hai?** Clicca sulla mela (menu Apple) in alto a sinistra → **Informazioni su questo Mac**. Se alla voce "Chip" c'è scritto "Apple M…" scarica `arm64`; se c'è "Processore … Intel" scarica `x64`.

## 2a. Installare su Windows

1. Fai doppio clic sul file `GymPlan-Setup-….exe` appena scaricato.
2. Windows potrebbe mostrare una finestra blu **"Windows ha protetto il PC"** (SmartScreen). Succede perché GymPlan è gratuito e non ha un certificato a pagamento, non perché sia pericoloso. Per proseguire:
   1. clicca sulla scritta **Altre informazioni**;
   2. clicca sul pulsante **Esegui comunque**.
3. L'installazione è automatica e dura pochi secondi. Alla fine GymPlan si apre da solo e trovi l'icona sul Desktop e nel menu Start.

Non servono permessi di amministratore.

## 2b. Installare su Mac

1. Fai doppio clic sul file `.dmg` appena scaricato: si apre una finestra.
2. Trascina l'icona di **GymPlan** sulla cartella **Applicazioni**.
3. Apri la cartella **Applicazioni** e fai doppio clic su **GymPlan**.

### La prima volta: "Impossibile aprire GymPlan"

Al primo avvio il Mac blocca GymPlan perché non è firmato con un certificato Apple a pagamento. Compare un messaggio come *"Impossibile aprire GymPlan perché Apple non può verificare…"*. Clicca **Fine** (o **OK**), poi:

1. apri **Impostazioni di Sistema** (la rotella grigia nel Dock, oppure menu Apple → Impostazioni di Sistema);
2. nella colonna a sinistra scegli **Privacy e sicurezza**;
3. scorri in basso fino alla sezione **Sicurezza**: c'è scritto che "GymPlan" è stato bloccato;
4. clicca **Apri comunque** e conferma con la password del Mac (o Touch ID);
5. nella finestra che compare clicca ancora **Apri comunque**.

Va fatto solo la prima volta: dopo GymPlan si apre normalmente.

### Se compare "GymPlan è danneggiato e non può essere aperto"

Non è davvero danneggiato: il Mac mette un "segno di quarantena" sui programmi scaricati da Internet e a volte, per quelli non firmati da Apple, mostra questo messaggio. Si toglie così:

1. clicca **Annulla** (non "Sposta nel Cestino");
2. assicurati di aver già trascinato GymPlan in **Applicazioni**;
3. apri il **Terminale**: Finder → **Applicazioni** → **Utility** → **Terminale** (oppure premi `Cmd ⌘ + Spazio`, scrivi `Terminale` e premi Invio);
4. copia questa riga, incollala nel Terminale e premi **Invio**:

   ```
   xattr -cr /Applications/GymPlan.app
   ```

   Non compare nessun messaggio: è normale, vuol dire che ha funzionato;
5. chiudi il Terminale e apri di nuovo GymPlan da Applicazioni (se richiesto, segui anche i passi di "Apri comunque" qui sopra).

## 2c. Installare su Ubuntu

1. Scarica `GymPlan-X.Y.Z-amd64.deb`.
2. Apri il **Terminale** nella cartella Scaricati e scrivi (ti chiede la password del computer):
   ```
   sudo apt install ./GymPlan-X.Y.Z-amd64.deb
   ```
   In alternativa fai doppio clic sul file e scegli **Installa** in "Centro software" / "App Center".
3. Avvia **GymPlan** dall'elenco delle applicazioni (tasto Super, poi scrivi "GymPlan").

Il pacchetto `.deb` installa anche il profilo di sicurezza richiesto da Ubuntu 24.04: senza, le app come GymPlan non partono.

**Alternativa senza installazione:** il file `GymPlan-X.Y.Z-x86_64.AppImage` si avvia con un doppio clic dopo averlo reso eseguibile (clic destro → Proprietà → "Consenti l'esecuzione come programma"). Su Ubuntu 22.04 serve `sudo apt install libfuse2`; su 24.04 è più semplice usare il `.deb`.

**Assistente AI su Ubuntu:** installa Ollama dal Terminale con `curl -fsSL https://ollama.com/install.sh | sh` (parte da solo all'avvio del computer).

## 3. Dove sono i miei dati

Tutti i dati (corsi, iscritti, pagamenti, presenze, certificati medici) stanno in una cartella **dati** sul tuo computer, separata dal programma:

| Sistema | Cartella |
| --- | --- |
| Windows | `C:\Users\<il tuo nome>\AppData\Roaming\GymPlan\dati` |
| Mac | `/Users/<il tuo nome>/Library/Application Support/GymPlan/dati` |
| Ubuntu | `~/.config/GymPlan/dati` (cartella nascosta: in File premi Ctrl+H per vederla) |

Il modo più semplice per aprirla: in GymPlan vai in **Impostazioni → App desktop → Apri cartella dati** (oppure dal menu **File → Apri cartella dati**).

Dentro trovi:

- `fitflow.sqlite`: il database con tutti i dati;
- `certificati/`: i file dei certificati medici;
- `backup/`: le copie di sicurezza del database.

Disinstallare o aggiornare GymPlan **non** cancella questa cartella.

## 4. Backup e ripristino

**Backup veloce (solo il database):** in **Impostazioni → App desktop** clicca **Crea backup ora**. Una copia del database viene salvata nella cartella `dati/backup/`, con data e ora nel nome. Il pulsante **Apri cartella backup** la mostra.

GymPlan fa anche da solo una copia in `dati/backup/` prima di ogni aggiornamento che modifica il database (file che iniziano con `pre-aggiornamento-`).

**Backup completo (consigliato ogni tanto):** chiudi GymPlan e copia l'intera cartella `dati` su una chiavetta USB, un disco esterno o un servizio come iCloud Drive, Google Drive o OneDrive. Così salvi anche i certificati medici.

**Ripristinare un backup completo:**

1. chiudi GymPlan (su Mac: menu GymPlan → Esci da GymPlan);
2. rinomina la cartella `dati` attuale (per esempio in `dati-vecchi`) invece di cancellarla;
3. copia al suo posto la cartella `dati` del backup;
4. riapri GymPlan.

**Ripristinare un backup veloce** (un file `.sqlite` della cartella `backup`):

1. chiudi GymPlan;
2. nella cartella `dati`, rinomina `fitflow.sqlite` in `fitflow-vecchio.sqlite`; se ci sono anche i file `fitflow.sqlite-wal` e `fitflow.sqlite-shm`, spostali nella stessa cartella di riserva o cancellali (sono file temporanei del database vecchio);
3. copia il file di backup nella cartella `dati` e rinominalo in `fitflow.sqlite`;
4. riapri GymPlan.

Per spostare GymPlan su un altro computer: installalo sul nuovo computer, aprilo e chiudilo una volta, poi ripristina lì un backup completo.

## 5. Aggiornamenti

Il repository è **privato**, quindi GymPlan non può vedere da solo se c'è una versione nuova: lo controlli tu.

1. In GymPlan apri **Impostazioni → App desktop → Controlla aggiornamenti** (oppure dal menu: Mac **GymPlan → Controlla aggiornamenti…**, Windows **Aiuto → Controlla aggiornamenti…**). Si apre la pagina delle versioni su GitHub.
2. Se c'è una versione più recente di quella che usi (la vedi in Impostazioni → App desktop), scarica l'installer per il tuo computer:
   - **Windows:** scarica `GymPlan-Setup-X.Y.Z.exe`, chiudi GymPlan e aprilo: sostituisce la versione installata.
   - **Ubuntu:** scarica il nuovo `.deb` e installalo come la prima volta (`sudo apt install ./GymPlan-X.Y.Z-amd64.deb`): sostituisce la versione installata.
   - **Mac:** scarica il `.dmg` (lo stesso tipo che avevi scelto la prima volta), chiudi GymPlan, aprilo e trascina GymPlan in **Applicazioni** scegliendo **Sostituisci**. Se al primo avvio della nuova versione il Mac la blocca di nuovo, ripeti i passi del punto 2b.

In ogni caso **i tuoi dati restano dove sono**: gli aggiornamenti cambiano solo il programma. Se la nuova versione deve modificare il database, prima ne salva una copia in `dati/backup/`.
