# Transcriptions

One file per PDF page of the morning-report film, named for that page:
`p248.md` is page 248. Everything transcribed from the film lives here, and
nothing else does — `public/data/roster.json` is generated from these files and
must never be edited by hand.

```sh
npm run build:roster     # transcriptions/*.md  ->  public/data/roster.json
```

## File format

A front-matter block between `---` lines, then optional prose, then a pipe
table of rows. Both parts are optional; a page with nothing on it worth
recording can be just front matter.

```markdown
---
page: 248
document: SO 66
kind: order
date: 1945-08-24
covers: order page 1 of 3
verified: true
---

Any notes about this page in prose. The verbatim header text of the document
goes here, if the page carries one.

| grade | name | asn | mos | mco | asr | profile | flags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M Sgt | Blissitte, Urshel A | 6266854 | 502 | 245 | 93 | Q | |
```

### Front-matter keys

| key | meaning |
| --- | --- |
| `page` | PDF page number. Must match the filename. |
| `document` | Short id of the document this page belongs to, e.g. `SO 66`. |
| `kind` | `order`, `morning-report`, or `other`. Drives which builder reads the page. |
| `date` | Date of the document, `YYYY-MM-DD`. |
| `covers` | Which part of the document is on this page. |
| `verified` | `true` once a human has checked the rows against the image. |
| `duplicate_of` | Set when this page repeats another page. Rows are not repeated. |
| `unit` | Source unit, where the document groups men under unit headings. |
| `complete` | `false` if the page is only partly transcribed. |

### Row conventions

- **`asn` is the identity key.** Two men may share a name; nobody shares a serial.
- Use `?` for a character that cannot be read: `330?????`. Do not guess.
- Put the field name in `flags` when a reading is uncertain — `asn`, `name`,
  `mos`, `asr`. Comma-separate several.
- Leave a cell empty when the column is blank on the page.
- Keep the spelling as typed, including obvious misspellings. The film is the
  record; corrections belong in a note, not in the row.

## Comments alongside a page

Questions and findings about a page go in `pNNN-comments.md` — `p259-comments.md`
sits beside `p259.md`. Free-form markdown, no front matter, nothing parses them:
the page loader matches `^p\d+\.md$` exactly, so a comments file is never read as
a transcription.

Use one when there is something a later reader needs and the row cannot carry it:

- A reading checked against the film, and what was found. `p40-comments.md`
  records that the clerk really did write sheet 2G/1, so nobody re-does that work.
- A disagreement between sources that is not settled, and what would settle it.
- A trap. `p265-comments.md` warns that a second man named Cole arrives on that
  order, so nobody matches him to the subject of this site by surname.

Keep them factual and keep the uncertainty. A comment saying "not established" is
worth more than a guess, and the point of writing one is to stop the next reader
repeating an investigation that has already been done.

## A second reading of every serial number

The Archives hold a punch card for nearly every man who entered the Army between
1938 and 1946, converted to a data file of 9,200,232 records keyed on serial
number: the Army Serial Number Electronic File, NARA ID 1263923, Record Group 64.

```sh
npm run check:serials -- --fetch   # 185 MB down, 837 MB on disk, once
npm run check:serials              # report
npm run check:serials -- --write   # report and rewrite data/nara-asn-crosscheck.json
```

The file goes to `.work/nara/`, which is gitignored. The result is committed as
`data/nara-asn-crosscheck.json` so the finding can be read without the download.

A serial read off the film either lands on a card bearing the same name or it
does not. When it does not, the tool searches the card file by name; the man is
usually there one digit away, which names the column to re-read. Findings are
recorded in the comments files for the pages they affect and nowhere applied —
a candidate is a question to put back to the film, not an answer.

Two limits, both real:

- **A missing card is not a disagreement.** About a sixth of the cards were lost
  before the Archives converted them.
- **The card file has its own errors.** NARA compared 377 records against the
  original punch cards and found 5 serials and 18 names wrong.

The tool measures how much a near miss is worth by asking the same question of
the serials the cards confirm: of 187 such serials given with a full name, 2
also have a card of the same name within two digits. A near miss on a rare name
is close to conclusive; one on a common name is not, and the count of men of
that name in the file is reported beside every candidate for that reason.

Where the film gives a surname alone — common on the early morning-report cards
— the same measurement comes out at 5 of 11, so no candidate is offered for
those rows. The disagreement is still reported; the guess is not.

## Why pages, and why duplicates matter

The film photographs some pages twice. Those frames get their own file with
`duplicate_of` set, so the page numbering stays honest and you can always find
the file for a page you are looking at.

Where two pages *do* both carry the same man, the build compares them and fails
on any disagreement. That cross-check is the main reason to transcribe by page
rather than merging as you go.

## Deskew before you read

The sheets sit up to about 1.6 degrees off square on the film. Over the width
of a page that shifts the serial-number column by a full row against the names,
which silently pairs each man with his neighbour's serial. It looks completely
plausible and it is completely wrong.

`tools/deskew-page.mjs` writes straightened, banded images for a page:

```sh
node tools/deskew-page.mjs 248
```

## Morning-report pages

Order pages are one table of men. A morning-report frame is a different shape: it
carries one or two report cards, each a different day, each with its own station,
record of events and strength. So `kind: morning-report` pages use one `## <date>`
section per card instead of a single table.

```markdown
---
page: 104
kind: morning-report
document: Btry C morning reports
unit: Btry C 153rd FA Bn
dates: 1944-12-15, 1944-12-16
cards: 2
verified: false
---

## 1944-12-16

card: R
station: Hurtgen 1/2 Mi W wF0335 Nord de Guerre Zone (Germany)
strength: 96 present for duty, 11 absent, 107 assigned

> In position firing. (Map Lendersdorf 1:25,000 Sheet 5204.)

| grade | name | asn | action | flags |
| --- | --- | --- | --- | --- |
| Pvt | Thompson, John A. | 31611323 | Assigned & joined fr Hq 3d Repl Depot | |
```

- The `>` blockquote is the Record of Events block, verbatim.
- `strength` is the enlisted line: present for duty, absent, assigned.
- The table is personnel *actions*, not a roster. `build-roster.mjs` skips these
  pages entirely — a card is not a roster row — but `build-timeline.mjs` reads
  them, and the Battery C cross-reference matches their serials against the
  orders.
- Same row conventions as the orders: `asn` is the identity key, `?` for a
  character that cannot be read, field names in `flags` when a reading is shaky.

### The station line and the map citation

Two parts of a card carry the battery's position, and both are read by
`build-map-sheets.mjs`. Transcribe them exactly as typed.

- The **station line** gives a place, an offset, a grid reference, and the grid
  system: `Schmidthof 1 Mi N wF8935 Nord de Guerre Zone (Germany)`. Keep the
  case of the reference — `wF` and `WF` are not the same square, and a lower-case
  letter that becomes upper-case moves the position 500 km.
- The **map citation** closes the record of events in brackets:
  `(Map Bonn 1:100,000 Sheet S-1.)`. Keep the sheet designation as written,
  including the punctuation: `S-1`, `10F/5`, `80 SW`.

Do not correct either against the other, or against the previous day. The clerk
copied the station line forward by hand for weeks at a time and it drifts; those
drifts are findings, and `npm run derive:grids` reports every reference whose
square disagrees with the village beside it.

```sh
npm run build:timeline   # morning-report pages -> timeline.json
npm run build:roster     # order pages          -> roster.json
npm run build:maps       # morning-report pages -> map-sheets.json
```

Both builders parse through `tools/lib/pages.mjs`, so the format has one
definition and cannot drift between them.
