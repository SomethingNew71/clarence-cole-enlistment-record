# clarence-cole-enlistment-record

Documentary site for Sgt Clarence J. Cole (36106875), Battery C, 153rd Field
Artillery Battalion, ETO 1944–45. Six static pages served by a Cloudflare Worker
— vanilla ES modules, no framework, no build step for the HTML. Not part of the
CMDIY ecosystem: no Supabase, no daisyUI, no Font Awesome, no Nuxt.

The site once made no external request at all. It now makes exactly one kind:
CARTO Voyager map tiles, fetched by Leaflet when a map comes into view. Leaflet
itself and both typefaces are vendored under `public/assets/`, so the tiles are
the whole of it. Do not add a second — no CDN, no analytics, no embedded font
service.

This repository is the merge of two independent efforts — the documentary frame
built from the family papers, and a full transcription of the morning-report
microfilm. Read `README.md` first; it documents the data contracts.

## Load-bearing invariants

**`transcriptions/pNNN.md` is the source of truth for everything read off the
film** — orders and morning-report cards alike, one file per frame, `kind` in the
front matter deciding which builder reads it. `public/data/timeline.json` holds
*both* hand-authored events and events generated from those pages. Generated events carry `"generated": true` and are
destroyed and rebuilt by `npm run build:timeline`. Editing one in `timeline.json`
loses the change on the next build. Edit the page file.

`build:timeline` also writes `public/data/battery.json` — the daily strength line
and every status change sorted by the clerk's own wording. It is wholly generated
and holds nothing hand-authored, so it is rebuilt from scratch each run: edit the
page files or the `ACTION_KINDS` table in the builder, never the JSON.

**The build must never touch hand-authored events.** `build-timeline.mjs` filters
on the `generated` flag alone. If you change that filter you can silently delete
the discharge, the citation and Special Orders 66 — the parts with no other copy.

**Enrich, don't duplicate.** Where a curated event and the film cover the same
date, the build fills the curated event's missing `verbatim` / `strength` /
frame number and suppresses the generated one. Curated title and summary win.
This is deliberate: the two efforts overlap on about a dozen dates and the point
of the merge was to reconcile them, not to print both.

**Gazetteer matching is whole-word, longest-match-first**
(`createPlaceResolver()` in `tools/lib/places.mjs`). A naive `includes()` made
`"Ger"` (Ger, Manche) match every station string ending `(Germany)`, silently
relocating three months of the war to Normandy. If you add a short place name,
check the map afterwards. The timeline build and the weather fetch both resolve
through this one function so a station cannot land in two places at once.

**38 of the 495 days have a station the gazetteer does not resolve** — the
Camp Pittsburgh spellings, "Nord de Guerre Zone (Germany)", "Hershausen wG8188",
"Enroute To Assembly Area", "Calas Staging Area". They appear on the timeline
with no place and get no weather. Fixing them means checking each against the
map, not pattern-matching the spelling.

**Two early-Normandy dates carry no place name in the station field** — the clerk
wrote only "APO 230 France" and named the position in the record of events. These
resolve through `gazetteer.json` → `overrides`, keyed by date range, each with a
`why`.

**Serial numbers are probable, not authoritative.** Transcribed from microfilm;
several are corrected by the battery itself in later entries. `roster.json`
deliberately keys on serial, so a misread digit yields two records for one man.
That is a faithful artifact — do not merge by name similarity. The `batteryC`
cross-reference marks these `probable` and names both readings rather than
picking a winner.

**Historical accuracy outranks completeness or polish.** This site makes claims
about real people who died. Every dated claim carries its microfilm frame. If a
reading is uncertain it stays uncertain (`pending`, `approximate`, `uncertain`,
`status: "inferred"`). Never fill a gap from a secondary history — single-source
fidelity to the documents is the whole premise.

**The weather is the one thing on the site that is not from a document, and it
is marked as such everywhere it appears.** ERA5 is a reanalysis: a modern model
rerun over the sparse observations that survive from the 1940s, on a grid cell
about 25 km across. The cards never mention the weather — the word appears
nowhere in 284 frames — so nothing here corroborates the film or is corroborated
by it. `weatherNode()` in `public/assets/lib/weather.js` emits the `modelled`
tag as part of the line, not as an option a caller can drop; keep it that way.
Three rules follow, and all three are already enforced:

- **A modelled day names the place it was modelled for**, and `check:data` fails
  if that place disagrees with the station the battery actually gave. A weather
  line under the wrong sky is invisible on the page and wrong in the record.
- **No weather is better than borrowed weather.** Days with an unresolved
  station get none. Neither does the Atlantic crossing — the gazetteer holds one
  nominal mid-ocean point for eight days of a moving convoy.
- **No clock times are published.** Open-Meteo resolves Europe/London to UTC+1
  for June 1944, but Britain was on British Double Summer Time, so its sunrise
  is an hour out. Everything is fetched and stored in UTC, and only the *length*
  of daylight is shown, which no timezone can distort.

**Corrections are content.** The battery filed them constantly, sometimes
retracting an entry months later. Preserved verbatim, not silently applied.

## How the site is written

Museum-label English. Short declarative sentences, concrete facts, no figures of
speech. A visitor should be able to read any paragraph once and know what it
says.

Three habits to avoid, all of which had to be removed from the site after they
crept in:

- **Drama.** The cards were once "the spine of this site", the battalion was
  "taken apart and put back together", a town was "broken". Say what happened.
- **Hedging.** "Both may be in the frames still to be read" says less than "the
  frames covering that period have not been read." Marking a reading uncertain is
  not hedging — that is the premise of the site — but say it once, plainly, and
  do not argue for it.
- **Self-commentary.** Do not tell the reader that the work is careful, that a
  scan is credited, or that something is decoded "for the first time". The credit
  line and the citation are visible; a sentence about them adds nothing.

The same applies to code comments. Explain why a thing is done, not how
conscientious it was to do it.

## Six rooms, one stylesheet

`/` is the entrance; `/story/`, `/timeline/`, `/maps/`, `/battalion/` and
`/archive/` are the rooms. Each is a plain `index.html` carrying the nav and the
colophon inline, plus one module named for it — `assets/story.js` and so on.
There is no template step, so a change to the shared chrome is a change to seven
files including `404.html`. That is the price of having no build; do not
introduce one to avoid it.

`assets/style.css` is the whole design system and the only stylesheet. Five of
the modules — `graph.js`, `record.js`, `sheets.js`, `battery.js`,
`lib/weather.js` — emit their own markup and are restyled entirely through the
class names they already write. Do not edit them to change how something looks.

`battery.js` is the exception to that in one respect: its strength chart is sized
in JavaScript, at the container's measured pixel width, and redrawn on resize. A
fixed viewBox scaled by CSS renders an 11px label at 5px on a phone. Changing the
chart's size is a change to that module, not to the stylesheet.

`.weather` deliberately does not look like `.entry__verbatim`. The verbatim block
carries a solid accent rule and is the document's own words; the weather line
carries a dotted neutral rule and is not from the film at all. Making the two
resemble each other would erase the only visual difference between what the
battery wrote and what a model reconstructed.

**The weather glyphs are the only icons on the site**, and there is no icon font
to add one to. They live as a hidden `<symbol>` sprite that `lib/weather.js`
injects once per page, referenced by `<use>` — the daily record draws a weather
strip on 451 cards, and inlining the paths would put thousands of duplicate
nodes in the DOM. Two things about them are easy to undo by accident:

- **The sprite holds geometry only.** `fill`, `stroke` and `stroke-width` are
  inherited properties set on `.wx__icon` in the stylesheet, which is how they
  reach the shadow content. Moving them onto the `<symbol>` would win over the
  CSS and put the drawing weight beyond the design system's reach.
- **They are drawn on a 24 grid and shown at 15px**, so anything finer than
  about three grid units vanishes. An earlier set had six-stroke snowflakes and
  two-tick thermometers, and both read as grey smudges. The condition *word* sits
  next to the glyph, so the glyph only needs a distinct silhouette.

Nothing lighter than `--color-neutral-600` appears in the weather strip. That is
the muted floor the rest of the site already uses; `neutral-500` on this paper is
2.4:1, which would be a new low rather than a match.

On the two pages with maps, `leaflet.css` is linked **before** `style.css`. Our
rules for the tooltips, the zoom control and the tile grade are single-class
selectors that tie with Leaflet's own; ours have to come second to win. Swapping
the order silently restores white tooltip boxes and ungraded tiles.

Fonts are self-hosted variable woff2 in `assets/fonts`, latin and latin-ext, one
file per family and style. `font-weight: 300 700` in the `@font-face` is not a
mistake: 400 and 600 are the same file.

The palette is fixed and `color-scheme: light` is declared. This is a printed
page; there is no dark variant and adding one is a design decision, not a fix.

## Verify after data changes

```sh
npm run build:timeline && npm run build:roster && npm run build:weather && npm run check:data
```

`check:data` fails on structural errors and warns on strength figures that do not
balance. It is the gate before `npm run deploy`.

All four run offline. The only command that touches the network is
`npm run weather:fetch`, and it is separate for that reason — see below.

## Weather is fetched once, then built like anything else

```sh
npm run weather:fetch     # network; incremental, --force to refetch everything
npm run build:weather     # offline; data/weather.json -> public/data/weather.json
```

`data/weather.json` is the committed record of what was pulled, faithful to the
API response. `public/data/weather.json` is derived from it and is what the site
serves. The war is over and these numbers will not change, so the browser never
asks anyone for them — the site still makes exactly one kind of external
request, and it is still CARTO map tiles.

Rerun `weather:fetch` only after the gazetteer gains a place or the transcription
gains a date; it skips everything already cached. It reads
`public/data/morning-reports.json`, so run `build:timeline` first.

## Check the page, not just the build

A clean `check:data` says the data is well formed, not that the site renders. Run
it and look:

```sh
npm run dev
```

Then drive it with a browser. Three failures have reached the deployed site and
all three were invisible to the build: a `position: sticky` rule that was never
scoped to its breakpoint, so on a phone the text scrolled over the pinned image;
map labels sized in CSS pixels inside a viewBox measured in degrees, so a 9px
label rendered nine degrees wide; and two source links with no separator between
them. Check narrow widths, check dark mode, and scroll lazy-loaded images into
view before believing they loaded.

## Deploying, and checking it landed

`npm run deploy` publishes to Cloudflare Workers. The account comes from
`wrangler login` or from `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID`.
Nothing about an account is committed, so each clone deploys to its own.

For about a minute after a deploy, assets return intermittent 404s and stale
copies while the edge fills. That is normal and it settles on its own. Do not
read an early 404 as a broken deploy, and do not redeploy to "fix" it.

Verify by checksum against the live URL rather than by eye, and check the whole
response — a checksum from one request and a `grep` from another can hit
different edge nodes and disagree. Retry a few times before believing a mismatch.

## Map images are derived, not source

`public/images/maps/` is generated. Each sheet in `data/map-series.json` that has
an image records `sourceFile`, the archive scan it came from, and
`npm run maps:fetch` rebuilds the plate and the preview from that. The derived
files are committed so a fresh clone serves the maps with nothing run.

`npm run maps:upload -- --bucket <name>` puts them in R2 for anyone who would
rather not serve them from the repository. It uses whichever account wrangler is
authenticated to. Switching the site over is one field, `imageBase`, which the
build prefixes onto every image URL. Empty means the repository copies, and that
is the default.

**Never publish a URL that has not been fetched.** Every link in
`map-series.json` was checked before it went in. Two answer 403 and 503 from some
networks, and carry a `status` field saying so, which the page prints — a live
lead that will not open from here is worth more than a silent omission. A
constructed URL that looks right is worth nothing.

## Transcription status

**All 284 frames are transcribed.** 269 morning-report pages, 10 order
pages, and 5 that duplicate another frame. Don't quote a number from memory — run
`npm run build:timeline` and `npm run build:roster`, which count the files.

Two orders: Special Orders 66 (frames 248–252, verified) and Special Orders 226
(frames 265–270, first pass, 24 serials still incomplete). `.claude/skills/`
carries the procedure for both a first pass and the second reading that clears
`verified: false`.

What remains is verification, not transcription. Frames 218 and 219 are the only
morning-report pages through `verify-transcription` — the same two cards were
photographed twice and read against each other. Every other card, and the
September order, is a first pass. `build:timeline` counts the `verified` front
matter and writes the current figures into `meta.transcription.note`.

Working from the source PDF: `cole.pdf` is gitignored and symlinked in locally —
63 MB, and not ours to commit. `tools/deskew-page.mjs` renders and straightens a
frame; pass `--rotate 0` when a card frame comes out sideways.

## On Sergeant Cole

The film names him on three frames, all from the occupation: 243 (20 August 1945,
five days' leave at Treebeek), 246 (25 August, returned), and **259 (5 September,
transferred out of Battery C** to the 3rd Reinforcement Depot under SO 71). He
appears nowhere in frames 1–218.

That silence is expected, not a gap: morning reports name a soldier only on a
*status change*. Do not add speculative first-person narration, and do not imply
the day-by-day record documents his individual days. The framing — his battery's
war, to the day, as the frame his service sits inside — is deliberate.

Two things the completed transcription changed, and which earlier drafts of this
file and the site got wrong:

- **He did not stay with Battery C to the end.** He left on 5 September 1945, a
  month before he sailed. The site said otherwise until frame 259 was read.
- **His MOS is recorded twice and differently.** The 5 September card gives 845;
  the discharge gives Squad Leader, 653. Both are shown rather than reconciled.

He is not on Special Orders 66, despite 80 points putting him in range of the men
being sent home in August. The site states that explicitly rather than leaving it
as an absence.

## One format, one parser

`tools/lib/pages.mjs` defines the page format and both builders parse through it,
so orders and cards cannot drift apart. `build-roster.mjs` skips
`kind: morning-report` pages — a card is not a roster row — and
`build-timeline.mjs` reads only those. Adding a page of either kind needs no
build change.

`tools/lib/places.mjs` does the same job for stations: one matcher, one slug,
one alias table, used by `build-timeline.mjs` and `fetch-weather.mjs`. A second
copy of that regex would let a station resolve to one village on the timeline and
its neighbour in the weather, and nothing on the page would show it.

Frame counts are computed from the files, never asserted in prose or constants.
An earlier hardcoded 218 was wrong by eight frames for weeks.

## The skew problem, and the morning reports

`transcriptions/README.md` warns that sheets sit up to ~1.6 degrees off square,
which over a wide order shifts the serial column by a full row and silently pairs
each man with his neighbour's serial. That warning is real and applies to orders.

For morning-report cards it was checked, not assumed: of the 403 cards on frames
1–218, 370 carry two or fewer serial-bearing rows and cannot exhibit the failure;
14 carry six or more. The count has not been rerun over the frames added since.
Frame 113, the worst (twenty men promoted 1 January 1945), was re-read against the
image and every pairing is correct — the cards are typed on printed rules that
bound each row. Do not extend that finding into a claim that the cards are
verified. Only frames 218 and 219 have been through `verify-transcription`.

## Cross-reference is a bug-finder, not just a feature

Matching the orders against the morning reports on serial number has already
corrected `35013798` from *Kolosxi* to *McKoski* and caught the same man written
*Frehnheiser* and *Frohnheiser* on different cards. When the two sources disagree,
that is a finding to adjudicate against the film — not noise to smooth over.

`npm run check:serials` widens that to a source outside the film: the Army Serial
Number Electronic File, the Archives' converted punch cards for every man
entering the Army 1938–46, keyed on serial number. It reads 524 serials off the
transcriptions and finds 62 where the man named is on a card one or two digits
from the serial as read — which names the column to re-read. Verified Special
Orders 66 produces those at 11 per cent; first-pass Special Orders 226 at 25.

Nothing it finds is applied. Findings live in `data/nara-asn-crosscheck.json` and
in the comments files for the pages they affect, as candidates for a re-read. A
missing card means nothing — a sixth of the cards were lost before conversion —
and the card file has its own error rate, which NARA measured and publishes.
Neither source outranks the other; the film decides, and the tool says where to
look.
