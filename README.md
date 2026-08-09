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
  reports resolves **41 of the 383** — 32 confirmed on an exact match, 9 probable
  where the two readings differ by a digit or two. Twelve of the 241 men on
  SO 226 match, which is fewer than the order's length suggests: they arrived in
  September, at the end of the transcribed run.

The cross-reference has also caught real errors in both directions. The
independent reading of SO 66 corrected `35013798` from *Kolosxi* to **McKoski**
in the morning-report transcription, and exposed an internal inconsistency where
the same man was written *Frehnheiser* on one card and *Frohnheiser* on another.

A third source now checks the same field from outside the film. The Archives
hold a punch card for nearly every man who entered the Army between 1938 and
1946, converted to a data file of 9,200,232 records keyed on serial number
(NARA ID 1263923). `npm run check:serials` looks up all 524 serials read off the
transcriptions and writes `data/nara-asn-crosscheck.json`.

| | |
| --- | --- |
| land on a card of the same name | 198 |
| same man, spelt differently | 60 |
| land on a different man | 100 |
| no card of that serial | 166 |

For 62 of the disagreements the man named on the film is on a card one or two
digits from the serial as read, which names the column to re-read. Verified
Special Orders 66 produces those at 11 per cent of its checkable serials;
first-pass Special Orders 226 at 25 — the clearest measure yet of what a second
reading is worth.

Nothing it finds has been applied. A missing card is not a disagreement: a sixth
of the cards were lost before conversion. And the card file has its own errors —
NARA compared 377 records against the original punch cards and found 5 serials
and 18 names wrong. The film decides; the check says where to look.

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
data/weather.json         the ERA5 pull, as fetched — committed, never refetched
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
  assets/battalion.js     wires battery.js and graph.js, and the notes under them
  assets/battery.js       Battery C's strength line, status changes and casualties
  assets/archive.js       the documents and the sources; fires record.js
  assets/lib/format.js    dates and small DOM helpers, shared by the rooms
  assets/lib/atlas.js     the themed Leaflet map, and which labels can be pinned
  assets/lib/weather.js   the modelled-weather strip: icon sprite, readings, tag
  assets/graph.js         the roster network: force layout, no libraries
  assets/record.js        the full day-by-day record, loaded on demand
  assets/sheets.js        the map sheets and the decoded firing positions
  assets/fonts/           Cormorant Garamond and Lora, self-hosted woff2
  assets/vendor/          Leaflet 1.9.4, vendored — no CDN
  data/timeline.json      curated events + events built from the film
  data/morning-reports.json  generated — the complete daily record
  data/battery.json       generated — strength by day, status changes by kind
  data/roster.json        generated from transcriptions/ — do not edit
  data/map-sheets.json    generated — sheets named, positions decoded
  data/weather.json       generated — modelled weather, keyed by date
  data/geo/theater.json   generated coastline — no longer read by the site
  images/                 scanned documents, web-sized plus thumbnails
tools/build-geo.mjs       rebuilds theater.json from Natural Earth data
tools/lib/pages.mjs       the page format, parsed in one place
tools/lib/grids.mjs       Lambert Zone I and Nord de Guerre -> WGS 84
tools/build-roster.mjs    order pages -> roster.json, + Battery C match
tools/build-timeline.mjs  morning-report pages -> timeline.json
tools/build-map-sheets.mjs  map citations + grid refs -> map-sheets.json
tools/lib/places.mjs      station -> place, matched in one place
tools/fetch-weather.mjs   the one-time ERA5 pull (the only tool using the network)
tools/build-weather.mjs   data/weather.json -> public/data/weather.json
tools/derive-grid-squares.mjs  recovers the lettered squares from the reports
tools/compare-transcription.mjs  second-reader diff for a page
tools/nara-asn-crosscheck.mjs  every serial against the Archives' card file
data/nara-asn-crosscheck.json  its result, committed so the download is optional
tools/nara-catalog-grep.mjs  searches NARA's catalogue export, OCR included
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
war to Normandy before it was caught; the ordering is load-bearing. The matcher
lives in `tools/lib/places.mjs` and both the timeline build and the weather fetch
use it, so a station resolves the same way in both.

## The weather, which is not a source

Every dated claim on this site comes off the film except one: the line marked
**modelled** on the timeline and on each card of the daily record.

The morning reports never mention the weather. The word does not appear in any of
the 284 frames. So the weather is not a corroboration of anything and nothing
corroborates it — it is context, added because 451 of these days are a gun
battery sitting in one place, and the sky is what changed.

It is [ERA5](https://open-meteo.com/en/docs/historical-weather-api) via the
Open-Meteo archive: a modern weather model rerun over the sparse observations
that survive from the 1940s. Reanalysis, not observation, and regional rather
than local — a grid cell roughly 25 km across, which can sit up to 16 km from the
village the clerk named. `public/data/weather.json` records the cell used, its
elevation, and that offset, for every place.

```sh
npm run build:timeline    # weather:fetch reads its output
npm run weather:fetch     # the only command here that touches the network
npm run build:weather
```

`data/weather.json` is the pull, committed and faithful to the API response;
`public/data/weather.json` is derived from it and is what the site serves. A
fresh clone serves the weather with nothing run and the browser never makes the
request — the site still makes exactly one kind of external request, and it is
still map tiles. `weather:fetch` is incremental; pass `--force` to refetch.

It renders as a row of discrete readings — sky, temperature, precipitation,
wind, daylight — each an icon and a figure, rather than a sentence. The glyphs
are hand-drawn line SVG in a `<symbol>` sprite injected once per page; there is
no icon font and no CDN, and adding one would break the site's single-request
rule. The wind arrow is rotated to the bearing and points the way the wind was
blowing, which is the direction it came *from* turned about.

Five decisions are worth knowing before changing any of it:

- **A day names the place it was modelled for**, and `npm run check:data` fails
  if that place disagrees with the station on the card. A weather line under the
  wrong sky would look completely normal on the page.
- **Days with an unresolved station get nothing**, rather than the previous day's
  weather. That is 38 of the 495.
- **The Atlantic crossing gets nothing.** The gazetteer holds a single nominal
  mid-ocean coordinate, and eight days of a moving convoy are not at it.
- **No clock times are published.** Open-Meteo puts Europe/London at UTC+1 for
  June 1944, but Britain was on British Double Summer Time, so its sunrise is an
  hour out. Everything is fetched and stored in UTC and only the *length* of
  daylight is shown.
- **Rain or snow under a hundredth of an inch reads "trace"**, the convention,
  because 0.1 mm of modelled drizzle formatted to two places reads "0.00 in" —
  which looks like a bug and tells the reader nothing. 34 days are traces.

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

`.github/workflows/ci.yml` rebuilds the roster, the timeline, the map-sheet
register and the modelled weather on every pull request, validates
`timeline.json`, re-derives the grid squares and fails if any has moved against
`tools/lib/grids.mjs`, and fails if the committed files under `public/data` no
longer match their sources. Every step is offline — `weather:fetch` is the only
command that uses the network and CI never runs it.

It does **not** deploy. Cloudflare's Git integration already deploys `main` on
push; a second deploy path would race it. The workflow carries a commented
`deploy` job for the day you'd rather GitHub owned that.

## Still to do

- Second-read the morning-report cards; only frames 218 and 219 have been through
  `verify-transcription`. `npm run check:serials` names 16 rows on the others
  where the serial disagrees with the Archives' card file
- Second-read Special Orders 226, frames 265–270, and resolve the twenty-four
  incomplete serials. `check:serials` flags 39 of its 158 checkable serials as
  one or two digits from a card of the same man, against 11 per cent on verified
  Special Orders 66
- Adjudicate the nine `probable` Battery C matches, where the two readings of a
  serial differ by a digit or two: Andrews, Griffith, Adams, Lee, Mays, Holland,
  Agee, Cole (James E), Hickman
- The Bronze Star general orders number and award date. **Confirmed absent from
  all 284 frames.** Two places to look, both now identified by file designator —
  see *The battalion's own records at College Park* below
- The battalion's calibre, stated rather than inferred. `unit.weapon` reads the
  evidence as tractor-drawn medium or heavy artillery and says plainly that this
  is an inference. `FABN-153-0.1`, the battalion's own unit history, would settle
  it, and there is a candidate reading already — see below
- Re-read the 13 disputed grid references on the film. Each decodes cleanly to a
  place the same line contradicts, and a second reading would settle whether the
  letters or the place name is the error
- Trace a usable scan for the remaining 22 map sheets, and record it in
  `data/map-series.json`
- `data/gazetteer.json` has "Herzhausen, Hesse" at the wrong Herzhausen: the
  reference `G8188` puts the battery 14 km away, at the one on the Edersee
- Resolve the 38 days whose station the gazetteer does not match — the four
  Camp Pittsburgh spellings, "Nord de Guerre Zone (Germany)", "Hershausen
  wG8188", "Enroute To Assembly Area", "Calas Staging Area". They carry no place
  on the timeline and no weather. Rerun `weather:fetch` once they resolve

## The battalion's own records at College Park

The National Archives publish their whole catalogue as a bulk export on S3,
`s3://nara-national-archives-catalog` (us-east-2, public, no credentials). It is
JSONL by record group, and it carries a field the Catalog API does not search:
`extractedText`, the OCR of every digitised page.

```sh
node tools/nara-catalog-grep.mjs 407 'FABN.?153-|FAGP.?79-0'
```

That streams RG 407 — 12.3 GB, about ninety seconds — and finds the index card
for the battalion in the *Index to World War II Operations Reports*:

```
153rd Field Arty Bn
  FABN-153-0.1    History 15 Nov 42 – Nov 45
  FABN-153-0.3    A/A Rpt – Jun 44, Apr, Jun, Aug 45      (item 5071)
  FABN-153-1.13   General Orders 1943–45
```

The same sweep gives the parent formations the site already names on other
evidence, and the box list from the series description:

```
79th Field Artillery Group          Boxes 16576–16578
  FAGP-79-0.1     Unit History Jun 1940 – Jun 1946
  FAGP-79-0.3     After Action Rpt w/ Jnl May–Jul 45
  FAGP-79-0.7     Unit Jnl Jul–Sep 44, May 45             (item 48786)
  FAGP-79-1.13    General Orders 1942–43, 45–46

32nd Field Artillery Brigade        Boxes 16480–16484
  FABR-32-0.3     Rpt w/ Unit Journal 18 Jun 44 – May 45  (item 49524)
  FABR-32-1.13    General Orders – 14 May 45              (item 49161)
```

**Box 15969** covers `FABN-148-0.3 June 1944` through `FABN-154-0.7 January 1946`,
so all three battalion files sit in it. None of this is digitised; it is ordered
or read on site at College Park. `FABN-153-1.13` and `FABR-32-1.13` are the two
places the Bronze Star order should be.

### One identification to settle first

The same OCR sweep turns up a 153rd Field Artillery Battalion in the 1st Cavalry
Division's own after-action reports:

> On 15 November 1942 the 153d Field Artillery Battalion (105mm Howitzer)
> Motorized was formed at Fort Bliss, Texas. Cadres were furnished from the 61st
> and 82nd Field Artillery … This Battalion never returned to the 1st Cavalry
> Division.

and, separately, that it was "relieved from assignment to the 1st Cavalry
Division and reassigned to the Third Army". The index card above dates our
battalion's history from the same day, 15 November 1942, and ours was
non-divisional in the ETO — which fits a battalion stripped off a division and
handed to an army.

Against that, the same sweep finds "153rd FA Bn" in XI Corps and 32nd Infantry
Division records on Leyte in late 1944, when Battery C was in Germany. Those may
be OCR errors for another number, or a second unit. **Do not carry the 105mm
reading into `unit.weapon` until the identification is settled.** `FABN-153-0.1`
settles it, and that is the first thing to read in Box 15969.

## History

Two independent efforts merged into this repository: the documentary frame built
from the family papers, and a full transcription of the morning-report microfilm.
The pre-merge Nuxt implementation of the transcription side is preserved on the
`nuxt-transcription` branch; it is not deployed.
