---
name: transcribe-film-page
description: >
  Transcribe a page of the 153rd Field Artillery Battalion morning-report
  microfilm (cole.pdf) into transcriptions/pNNN.md. Use this whenever the user
  asks to read, transcribe, extract, or "do" any page or range of pages of the
  film — including phrasings like "page 271 has names", "can you read frames
  253-260", "what's on page 300", "add the September rosters", or when they drop
  a page image and ask what it says. Also use it before answering questions
  about who or what is on a given page, since the reading procedure here exists
  to prevent a specific silent error that produces plausible but wrong data.
---

# Transcribing a page of the film

The source is `cole.pdf`: 284 microfilm frames of the battalion's morning
reports and the orders filed with them. Everything read off it lives in
`transcriptions/pNNN.md`, one file per PDF page, and `public/data/roster.json`
is generated from those files.

Read `transcriptions/README.md` first if you have not already — it defines the
file format and the row conventions. This skill is about how to *read* a page
well enough to fill one in.

## The error this procedure exists to prevent

The sheets sit up to about 1.6 degrees off square on the film. Over the width of
a page, that is enough to shift the serial-number column a full row against the
names. Every man then gets his neighbour's serial number.

Nothing about the result looks wrong. The names are real, the numbers are real,
the table is neat, and the data is worthless. This has already happened once in
this project and was caught only because one serial refused to reconcile between
two frames.

So: deskew before you read. Not as a quality improvement — as a correctness
precondition.

## Procedure

### 1. Generate straightened images

```sh
node tools/deskew-page.mjs 266
```

This writes `.work/p266/sheet<N>_band<M>.png` — the page rotated upright,
deskewed by maximising the variance of its row-ink profile, contrast-stretched,
and sliced into bands of roughly a dozen rows. It prints the angle it corrected
for each sheet.

A frame often holds **two sheets side by side**. After the rotation they stack,
and you get `sheet0_*` and `sheet1_*`. Both may be different pages of the same
document — or one may be a duplicate of a neighbouring frame.

**Check the bands are the right way up before reading them.** The frames are
nearly square (594x613pt), so orientation detection has little to go on and does
get it wrong. If the text runs vertically, force it:

```sh
node tools/deskew-page.mjs 236 --rotate 0     # cards already upright
node tools/deskew-page.mjs 248 --rotate -90   # wide order lying on its side
```

A tell: when a card frame is wrongly treated as landscape it splits into two
sheets at `+0.0 deg`, because the two cards read as two horizontal runs. One
upright sheet with a real skew angle is usually the correct reading.

### 2. Read the bands in order

Read each band image. Bands overlap slightly so no row falls in a crack.

If a band comes out unreadable, re-crop that region at higher magnification
rather than guessing. The film is eighty years old and some frames are damaged
at the edge; a row you cannot read is a legitimate outcome.

**Duplicated frames are common in this range.** Frame 219 carries the same two
cards as 218, and 218 is the fainter exposure — worth reading the clean copy and
correcting the other against it, which is how `Malcolm` turned out to be
`Mulcahy`. Give the duplicate its own file with `duplicate_of` set and do not
repeat the rows.

### 3. Identify what the page is

Before transcribing rows, work out what document you are looking at. The two
kinds behave very differently — see `references/document-types.md` for the
anatomy of each and what to pull from them.

Watch for a page that repeats one you have already done. The film photographs
some pages twice. When it does, give the frame its own file with `duplicate_of`
set and do not repeat the rows — the build compares overlapping pages and fails
on disagreement, which is the main reason this project transcribes by page
rather than merging as it goes.

### 4. Write the file

`transcriptions/p266.md`, front matter then a pipe table. Set `verified: false`
on a first pass; only a genuine second read earns `true`, and there is a
separate skill for that.

Three habits that matter more than they look:

**The serial number is the identity key.** Two men share a name often enough;
nobody shares a serial. Get it right or mark it partial.

**Never guess a character.** Write `?` for each unreadable digit — `330?????`,
`3?9?4?74`. A partial serial is honest and the build keeps it out of the
cross-check. A guessed serial is a fabricated person.

**Flag the field, not the row.** The `flags` column names which fields are
shaky: `asn`, `name`, `mos`, `asr`. That tells the next reader where to look
instead of making them re-do everything.

### 5. Build and check

```sh
npm run build:roster
```

It fails on a filename that disagrees with its `page`, a row with no serial, or
two pages recording the same serial differently. Warnings list every partial
serial, which is a useful summary of what is still outstanding on the page.

## Reading conventions

Keep the spelling as typed, including obvious misspellings and inconsistent
abbreviations — `Btry C`, `153d` and `153rd`, `fr dy to TD`. The film is the
record. Corrections and expansions belong in a note or in the site's editorial
prose, never silently in a row.

Rank abbreviations as written: `M Sgt`, `1 Sgt`, `T Sgt`, `S Sgt`, `Sgt`,
`Tec 4`, `Cpl`, `Tec 5`, `Pfc`, `Pvt`, and for officers `CAPT`, `1st Lt`,
`2d Lt`. Officer serials start with `O`.

## What not to infer

These documents are narrower than they look. An order that lists men of a
battalion usually has **no battery column** — so it cannot place anyone in
Battery C, however tempting that is when the whole site is about a Battery C
man. A shared MOS means two men did the same job; it does not mean they served
in the same section or crewed the same gun.

If you want to say something the document does not say, say it in prose on the
site with the reasoning shown, and leave the transcription clean.
