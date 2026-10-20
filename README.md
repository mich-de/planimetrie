# Tavolo da Disegno

Webapp per disegnare planimetrie 2D in locale, ispirata ai pianificatori online
quali Remplanner. Nessuna dipendenza esterna, nessun server: apre direttamente
nel browser e salva tutto nel `localStorage`.

## Avvio

```bash
cd planner
python3 -m http.server 8765        # oppure qualsiasi server statico
# poi apri http://127.0.0.1:8765/
```

Funziona anche aprendo `index.html` direttamente con `file://`
(alcuni browser bloccano l'export PNG da `file://`: in caso usa "Scarica .plan").

## Cosa fa

| Area | Funzioni |
|------|----------|
| **Disegno** | muri a catena (clic sul primo punto = chiusura locale), locale rettangolare, quote, testi |
| **Aperture** | porte (battente, doppia, passaggio), finestre: si agganciano al muro, scorribili lungo esso |
| **Impianti** | prese, interruttori, punti luce |
| **Catalogo** | 48 arredi in 7 categorie con sagome disegnate in pianta, ricerca (termosifone incluso) |
| **Locali** | chiusura automatica del perimetro → nome, area, perimetro, altezza locale (box "S = … mq / H = … cm") |
| **Misure** | tutto in mm, quote in metri, riepilogo superfici (locali, muri, sviluppo) |
| **Quotatura automatica** | catene di quote rosse attorno a ogni locale: nome parete + lunghezza totale e sotto-quote dei tratti liberi tra porte/finestre, calcolate dal disegno |
| **Piani** | barre dei piani in alto a sinistra: aggiungi, rinomina (doppio clic), elimina, ognuno con oggetti e sfondo propri |
| **Vista 3D** | modo 3D: vista assonometrica con muri estrusi, gap porte, vetri finestre e volumi arredi; pan e zoom, solo lettura |
| **Sfondo** | importa un'immagine (es. planimetria scansionata) e traccia sopra |
| **Selezione** | maniglie muri/quote, ridimensiona e ruota arredi, pannello proprietà numerico |
| **Giunzioni** | trascinare un'estremità di muro trascina i muri e i vertici dei locali a contatto; la modifica "segue" i muri collegati |
| **Storico** | annulla/riponi (120 passi), salvataggio automatico, esporta/importa `.plan`, esporta PNG, stampa, CSV riepilogo |
| **Scheda tecnica** | export A4 orizzontale in stile Remplanner: cornice, titolo progetto, planimetria quotata, tabella dei componenti e riquadro riassuntivo (pulsante righello in alto) |

## Scorciatoie

`V` selezione · `W` muro · `R` locale · `Q` quota · `T` testo · `D` porta · `F` finestra ·
`M` magnetismo · `G` griglia · `Ctrl+Z / Ctrl+Shift+Z` annulla/riponi · `Ctrl+S` salva ·
`Canc` elimina · `Esc` annulla strumento/catena · frecce spostano di 10 mm (Shift 100 mm) ·
rotella zoom · barra spaziatrice o tasto centrale per spostare la tavola.

## Struttura

```
index.html        layout + sprite icone SVG
css/style.css     tema (grafite scura + carta chiara, Fraunces/Archivo/IBM Plex Mono)
js/catalog.js     dati arredi + disegno sagome
js/doc.js         modello documento, geometria (GEOM), storico, localStorage
js/render.js      rendering SVG in stile disegno tecnico: muri a tratteggio (poché),
                  arredi verdi con misura, box S/H locali, catene quote automatiche
js/app.js         strumenti, interazioni, pannelli, esportazioni
tests/smoke.html  suite di fumo: 44 asserzioni eseguite in Chrome headless
tests/demo.html   pianta dimostrativa (per screenshot/verifica visiva; #3d attiva il modo 3D)
```

Modello dati: millimetri, `Doc.data = { name, floors: [{ name, bg, objects[] }] }` con oggetti
`wall · room · door · window · furn · socket · switch · light · dim · text`.

## Test

```bash
google-chrome-stable --headless=new --screenshot=/tmp/demo.png \
  --window-size=1400,900 --virtual-time-budget=9000 \
  "http://127.0.0.1:8765/tests/demo.html"
```

`tests/smoke.html` disegna una stanza, inserisce porta, arredo, quota, verifica
undo/redo, zoom, salvataggio, export, giunzioni angolo, piani multipli e vista 3D.
Risultato atteso: `PASS 44/44` ("TUTTO OK").

## Limiti noti

- Vista 3D solo assonometrica (niente rotazione orbit né rendering fotorealistico; apertura porte e impianti non rappresentati in 3D)
- Niente rotazione delle pareti: si disegnano in direzione libera con aggancio a 45°
- L'export PNG usa un canvas: se il browser blocca l'immagine SVG incorporata
  viene scaricato un `.svg` al suo posto
- La scheda tecnica A4 usa font di sistema nel raster (niente webfont dentro l'immagine)
