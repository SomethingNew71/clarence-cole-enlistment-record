# Sergeant Clarence Cole — a documentary record

A timeline of Sergeant Clarence Cole, Battery C, 153rd Field Artillery Battalion,
in the European Theater of Operations, built from his discharge papers, his
Bronze Star citation, and the battalion's own paperwork.

Served as static assets by a Cloudflare Worker. Nothing about an account is
committed, so each clone deploys to its own — see [Running it](#running-it).

## Status

The frame of the service is complete and sourced end to end: induction, sailing,
arrival in England, the Bronze Star citation period, the five campaign credits,
the return, and the discharge.

Transcribed from the film:

| Frames | What | State |
| --- | --- | --- |
| 1–247, 253–264, 271–284 | Battery C morning reports — 495 daily reports, 2 May 1944 to 10 October 1945 | first pass, except frames 218 and 219 |
| 248–252 | Special Orders 66 — 142 men out, to the 70th Inf Div | verified |
| 265–270 | Special Orders 226 — 241 men in, from the 29th Inf Div | first pass |

All 284 frames are transcribed. What remains is the second reading. Frames 218
and 219 are the same two cards photographed twice, read against each other, and
verified; every other morning-report card is a first pass, as is Special Orders
226, where twenty-four men still have an incomplete serial number.

Four primary sources, all agreeing where they overlap:

| Source | What it gives |
| --- | --- |
| Enlisted Record and Report of Separation (WD AGO 53-55) | Serial number, dates, campaigns, decorations, service abroad |
| Bronze Star citation | The cited period, the countries, and what he actually did |
| Battery C morning reports | Day-by-day movement, positions, strength, and personnel actions |
| Special Orders 66 and 226 | Who left the battalion in August, and who replaced them in September |

## Where the sources meet

Recorded as data in `timeline.json` → `crossReferences`, not just asserted here:

- The discharge and the morning report of 3 May 1944 give the same sailing date,
  eighteen months and two clerks apart.
- The Bronze Star cited period, 30 June 1944 – 15 March 1945, opens on the day
  the battery landed over Omaha Beach (frame 17) and closes on the day it moved
  into the Remagen bridgehead across the Rhine (frame 151). The citation brackets
  the battery's combat record exactly.
- The Ardennes order of battle puts the battalion under XVIII Airborne Corps on
  1 January 1945; the morning report for that day puts Battery C at Werbomont, on
  the northern shoulder of the Bulge.
- Neither special order carries a battery column, so neither can place a man in
  Battery C on its own. Cross-matching serials against the Battery C morning
  reports resolves **19 of the 383** — 13 confirmed on an exact match, 6 probable
  where the two readings differ by a digit or two. None of the 241 men on SO 226
  match, which is what you would expect: they arrived in September, after the
  transcribed cards end.

The cross-reference has also caught real errors in both directions. The
independent reading of SO 66 corrected `35013798` from *Kolosxi* to **McKoski**
in the morning-report transcription, and exposed an internal inconsistency where
the same man was written *Frehnheiser* on one card and *Frohnheiser* on another.

## Running it

```sh
npm install
npm run dev      # local server at http://localhost:8787
npm run deploy   # publish to Cloudflare
```

`npm run deploy` needs a Cloudflare account — either `wrangler login`, or a
`CLOUDFLARE_API_TOKEN` with the *Edit Cloudflare Workers* permission plus
`CLOUDFLARE_ACCOUNT_ID` in the environment.

## Layout

```
wrangler.jsonc            assets-only Worker config
transcriptions/           EVERYTHING read off the film, one file per PDF page
                          kind: order          -> roster.json
                          kind: morning-report -> timeline.json
data/gazetteer.json       place name to coordinate, phase bands, station overrides
data/map-series.json      GSGS series catalogue, and where each sheet can be found
public/                   everything served
  index.html              Home — the hero and the five rooms
  story/    timeline/     one directory per room, each a plain index.html
  maps/     battalion/    with the shared nav and colophon inline
  archive/
  assets/style.css        the whole design system: tokens, chrome, every room
  assets/home.js          one module per room, named for its page
  assets/story.js         the discharge record, both maps, the campaign bars
  assets/timeline.js      the merged event list and its filters
  assets/maps.js          the positions map; frames sheets.js
  assets/battalion.js     wires graph.js and writes the two notes under it
  assets/archive.js       the documents and the sources; fires record.js
  assets/lib/format.js    dates and small DOM helpers, shared by the rooms
  assets/lib/atlas.js     the themed Leaflet map, and which labels can be pinned
  assets/graph.js         the roster network: force layout, no libraries
  assets/record.js        the full day-by-day record, loaded on demand
  assets/sheets.js        the map sheets and the decoded firing positions
  assets/fonts/           Cormorant Garamond and Lora, self-hosted woff2
  assets/vendor/          Leaflet 1.9.4, vendored — no CDN
  data/timeline.json      curated events + events built from the film
  data/morning-reports.json  generated — the complete daily record
  data/roster.json        generated from transcriptions/ — do not edit
  data/map-sheets.json    generated — sheets named, positions decoded
  data/geo/theater.json   generated coastline — no longer read by the site
  images/                 scanned documents, web-sized plus thumbnails
tools/build-geo.mjs       rebuilds theater.json from Natural Earth data
tools/lib/pages.mjs       the page format, parsed in one place
tools/lib/grids.mjs       Lambert Zone I and Nord de Guerre -> WGS 84
tools/build-roster.mjs    order pages -> roster.json, + Battery C match
tools/build-timeline.mjs  morning-report pages -> timeline.json
tools/build-map-sheets.mjs  map citations + grid refs -> map-sheets.json
tools/derive-grid-squares.mjs  recovers the lettered squares from the reports
tools/compare-transcription.mjs  second-reader diff for a page
tools/deskew-page.mjs     straightened, banded images for a page
tools/check-data.mjs      validates timeline.json
```

## Transcriptions

Everything read off the film lives in `transcriptions/`, **one file per PDF
page**, named for the page — orders and morning-report cards alike. See
[`transcriptions/README.md`](transcriptions/README.md) for the file format and
the row conventions.

```sh
node tools/deskew-page.mjs 248   # straightened, banded images to read from
npm run build:roster             # transcriptions/*.md -> public/data/roster.json

# second-reader pass, to move a page from verified:false to true
node tools/compare-transcription.mjs 266 .work/p266-second-read.md
```

Two skills in `.claude/skills/` carry the procedure, including the reasons behind
the parts that look fussy: **transcribe-film-page** for a first pass and
**verify-transcription** for the second reading.

The build fails on a filename that disagrees with its `page`, a row with no
serial number, or two pages recording the same serial differently — that last one
is the point of splitting by page.

### Does the skew problem affect the morning reports?

Less than it affects the orders, and it has been checked rather than assumed.
The failure mode needs many adjacent rows for a shifted column to pair each man
with his neighbour's serial. Of the 403 cards on frames 1–218, **370 carry two or
fewer serial-bearing rows** and are structurally immune; 14 carry six or more.
The count has not been rerun over the frames transcribed since.
The worst of them, frame 113 — twenty men promoted on 1 January 1945 — was
re-read against the image and every name-to-serial pairing is correct. The cards
are typed on printed rules that bound each row, which is what saves them.

That is not a clean bill of health. Only frames 218 and 219 have been second-read
by the `verify-transcription` procedure. The rest should not be treated as
verified until they have been.

## The timeline, and which file to edit

`timeline.json` holds two kinds of event, and the distinction matters:

- **Hand-authored events** — the birth, the induction, the citation, the special
  orders, the discharge. Edit these directly in `public/data/timeline.json`. They
  carry no `generated` flag and the build never touches them.
- **Generated events** — everything read off the morning reports. These carry
  `"generated": true`. **Do not edit them in `timeline.json`; they are rebuilt and
  your change will be lost.** Edit the page file in `transcriptions/` and rerun:

```sh
npm run build:timeline
npm run check:data
```

`build:timeline` removes every event flagged `generated`, rebuilds them from the
JSONL, and leaves hand-authored events alone. Where a hand-authored event already
covers a date, the transcription *enriches* it — filling a missing `verbatim`,
`strength` or frame number — rather than adding a second event for the same day.
The curated title and summary always win.

Only days that changed something reach the main timeline. The rest are still
transcribed and still shipped, in `public/data/morning-reports.json`, and render
in the *daily record* section.

### The card format

One file per frame, one `## <date>` section per card, documented in
[`transcriptions/README.md`](transcriptions/README.md). Duplicate scans and
multi-page reports are merged by date at build time.

New places go in `data/gazetteer.json` under `places`. Matching is on whole words,
longest match first — which is why `"Ger"` (the Manche village) does not swallow
every station string ending `(Germany)`. That bug relocated three months of the
war to Normandy before it was caught; the ordering is load-bearing.

## Map images

The sheet images under `public/images/maps/` are derived, not source. Each sheet
in `data/map-series.json` that has an image records `sourceFile` — the URL of the
full archive scan — and the derivation runs from that:

```sh
npm run maps:fetch              # only what is missing
npm run maps:fetch -- --force   # re-derive everything
```

That downloads each original (600 dpi, 100 MB and up), writes a 3000 px plate and
a 1400 px preview as WebP, and deletes the original. 3000 px was chosen against
the 600 dpi scan: every village name and spot height on a 1:100,000 sheet is still
legible, at roughly half the bytes of 4000 px. Needs Python 3 with Pillow, the
same requirement as `tools/deskew-page.mjs`.

The derived files are committed, so a fresh clone serves the maps without running
anything. The page loads previews and links through to the full plate — under a
megabyte of imagery for the section, rather than twelve.

### Serving them from R2 instead

Optional, and account-specific — a fork runs this against its own Cloudflare
account, since nothing about an account is baked into this repository:

```sh
npx wrangler login                                     # or CLOUDFLARE_API_TOKEN
npm run maps:upload -- --bucket <name> --dry-run       # see what would go
npm run maps:upload -- --bucket <name> --create        # create it and upload
```

Then turn on public access for the bucket (Cloudflare dashboard → R2 → the bucket
→ Settings → Public access, or attach a custom domain), put that base URL into
`imageBase` in `data/map-series.json`, and rebuild:

```jsonc
{ "imageBase": "https://pub-xxxxxxxx.r2.dev" }
```

```sh
npm run build:maps
```

Leaving `imageBase` empty keeps the copies in this repository, which is the
default and works fine. Nothing breaks by never touching R2.

## Conventions

- **Cite everything.** Every dated claim carries the microfilm frame it came from.
- **Mark uncertainty.** `pending: true`, `approximate: true`, `uncertain: [...]`,
  `verified: false` and `status: "inferred"` exist so the site can show gaps
  honestly. Use `?` for a character that cannot be read. Do not guess.
- **`verbatim` is transcription, `summary` is editorial.** Keep the original
  wording and abbreviations in `verbatim`.
- **Corrections are content.** The battery filed them constantly, sometimes
  retracting an entry months later. Preserved as written, not silently applied.
- **`asn` is the identity key.** Two men may share a name; nobody shares a serial.

## Maps

The three maps — the Atlantic crossing, the advance, and the firing positions —
are Leaflet over CARTO Voyager raster tiles, graded warm in CSS so the basemap
sits inside the page. Leaflet is vendored under `public/assets/vendor`; the tiles
are the one thing on the site fetched from a third party at view time, and the
OpenStreetMap and CARTO attribution stays on the map for that reason.

A permanent label is pinned to a position only where it fits. Positions come in
clusters — four of the eight the battery held longest are inside thirty miles of
Aachen — so `pinLabels()` in `assets/lib/atlas.js` places each candidate in turn,
most deserving first, measures where the label actually landed, and drops it back
to a hover label if it covers one already placed. Separation in kilometres is the
wrong test: a label runs sideways from its pin and its width is in pixels.

`theater.json` is derived from Natural Earth 1:50m country boundaries (public
domain), clipped, simplified, and committed. It fed the hand-drawn SVG renderer
that Leaflet replaced, and nothing reads it now; `npm run build:geo` still
rebuilds it. Both are kept against the SVG maps being wanted back.

### The sheets the battery worked from

Almost every card closes its record of events by naming the map in use, and opens
its station line with a position on that map:

```
station: Schmidthof 1 Mi N wF8935 Nord de Guerre Zone (Germany)
> In position firing. (Map Bonn 1:100,000 Sheet S-1.)
```

`npm run build:maps` collects both into `public/data/map-sheets.json`: 25 sheets
across 351 cards, and the 47 distinct grid references given on them.

Two grid systems appear, and the station line says which — Lambert Zone I through
Normandy, the Nord de Guerre zone from the Seine onward. `tools/lib/grids.mjs`
converts either to WGS 84. Both are Lambert conformal conics on nineteenth-century
French ellipsoids, and both need a geocentric datum shift at the end; skipping it
puts a Nord de Guerre position about a kilometre and a half out, which looks right
on a map of Europe and is wrong on a map of a village.

The **lettered squares are derived, not looked up**. A station line that names a
village and gives a reference fixes the corner of the square that reference sits
in; every village the film puts in the same square has to agree. Seven villages
between Tohogne and Aachen fix one, six between Saint-Clair-sur-l'Elle and
Domfront fix another, and the corners come out on exact 100 km multiples, which
nothing in the arithmetic forced them to do.

```sh
npm run build:maps      # transcriptions/*.md -> public/data/map-sheets.json
npm run derive:grids    # re-derive the squares, and check every reference
```

That derivation is also the error check, and the battalion ran it first: on
20 January 1945 it corrected a position it had been reporting for four days,
`vK6597` to `vP6597`, and `derive:grids` finds the same disagreement on its own.
Thirteen references decode cleanly to a place that contradicts the village
written beside them — `wK8935` is a perfectly good reference to a point in Saxony,
four hundred kilometres from the Schmidthof it is written next to. Those are
carried as `disputed`, listed on the site and deliberately **not plotted**. Which
half of each is wrong is a question for a second reading of the film.

### Including the maps themselves

`data/map-series.json` is the hand-authored half: which GSGS series each sheet
belongs to, on what basis, and where a copy can be found. Only one series is
named outright on the film — GSGS 4040, in that same January correction — so
every other identification is marked `inferred` and the site says so.

The maps are out of copyright; Crown copyright on wartime GSGS sheets has long
expired. What is *not* free is any particular scan, so no sheet image is
reproduced here that has not been traced to a source we can use. Add sources to a
sheet's `sources` array as they are found. `build-map-sheets.mjs` fails on a sheet
the film names that the catalogue does not list, so the catalogue cannot quietly
fall behind the transcription.

## Continuous integration

`.github/workflows/ci.yml` rebuilds the roster, the timeline and the map-sheet
register from the transcriptions on every pull request, validates
`timeline.json`, re-derives the grid squares and fails if any has moved against
`tools/lib/grids.mjs`, and fails if the committed files under `public/data` no
longer match their sources.

It does **not** deploy. Cloudflare's Git integration already deploys `main` on
push; a second deploy path would race it. The workflow carries a commented
`deploy` job for the day you'd rather GitHub owned that.

## Still to do

- Second-read the morning-report cards; only frames 218 and 219 have been through
  `verify-transcription`
- Second-read Special Orders 226, frames 265–270. Frame 269 is done — see
  [`transcriptions/p269-comments.md`](transcriptions/p269-comments.md) — and
  turned up a two-row MOS/ASR column shift, so read the other five with the
  columns checked row by row, and with `--rotate -90`
- **Get a better scan of frames 265–270.** The twenty-four incomplete serials on
  SO 226 cannot be resolved from the present one. The embedded image is
  1813 × 1802 pixels for a whole sheet, the carbon failed across the serial
  column while the columns beside it stayed crisp, and none of the twenty-four
  men appears in the Battery C morning reports, so there is no second source.
  This is a fetch-something-new task, not a read-harder one
- Adjudicate the nine `probable` Battery C matches, where the two readings of a
  serial differ by a digit or two: Andrews, Griffith, Adams, Lee, Mays, Holland,
  Agee, Cole (James E), Hickman
- The Bronze Star general orders number and award date. **Confirmed absent from
  all 284 frames**, which leaves the battalion's general orders at NARA
- The battalion's calibre, stated rather than inferred. `unit.weapon` reads the
  evidence as tractor-drawn medium or heavy artillery and says plainly that this
  is an inference
- Re-read the 13 disputed grid references on the film. Each decodes cleanly to a
  place the same line contradicts, and a second reading would settle whether the
  letters or the place name is the error
- Trace a usable scan for the remaining 22 map sheets, and record it in
  `data/map-series.json`
- `data/gazetteer.json` has "Herzhausen, Hesse" at the wrong Herzhausen: the
  reference `G8188` puts the battery 14 km away, at the one on the Edersee

## History

Two independent efforts merged into this repository: the documentary frame built
from the family papers, and a full transcription of the morning-report microfilm.
The pre-merge Nuxt implementation of the transcription side is preserved on the
`nuxt-transcription` branch; it is not deployed.
