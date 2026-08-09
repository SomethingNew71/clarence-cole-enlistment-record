---
name: verify-transcription
description: >
  Second-reader pass over an already-transcribed page of the morning-report
  film, to move it from verified:false to verified:true. Use this whenever the
  user asks to check, verify, double-check, proof, confirm or "go over" a page
  or its transcription, mentions a page being unverified or a first pass, asks
  whether the names or serial numbers are right, or asks to resolve the
  question-mark serials. Also use it before publishing or citing figures from a
  page whose front matter still says verified:false.
---

# Verifying a transcribed page

A page in `transcriptions/` starts life as `verified: false`. That flag is not
decoration — the site reads it, tells visitors which pages are a first pass, and
declines to present unchecked readings as confirmed. Clearing it is a claim that
two independent readings of the page agree.

## Why blind, and why it matters here

The failure mode on this film is not sloppiness. It is a skewed sheet shifting
the serial-number column against the names, which produces a table that is
internally tidy, entirely plausible, and wrong in every row.

You cannot catch that by proofreading. Proofreading against an existing
transcription anchors you to it: you see `Hall, Donald R — 7022078`, you glance
at the image, the shapes are roughly there, you tick it off. The error survives.

So read the page again from scratch, without looking at the existing file, and
let a script find the disagreements. Two readings that were made independently
and agree are real evidence. One reading checked against itself is not.

## Procedure

### 1. Regenerate the images

```sh
node tools/deskew-page.mjs 266
```

Note the angle it reports. A page that needed more than about half a degree of
correction is exactly the kind that produces column shift, and deserves extra
care on the serial column.

### 2. Read it again, cold

Do not open `transcriptions/p266.md` yet. Read the band images and write a fresh
table to a scratch file — `.work/p266-second-read.md` is the convention, and
`.work/` is gitignored.

Only the table matters; front matter can be omitted. Use the same columns as the
committed file so they can be compared.

If you genuinely cannot avoid having seen the original — you transcribed it
yourself earlier in the same session, say — say so rather than claiming a blind
read. A same-reader second pass still catches things, but it is weaker evidence,
and the honest move is to note it in the page file rather than silently claim
full verification.

### 3. Compare

```sh
node tools/compare-transcription.mjs 266 .work/p266-second-read.md
```

It matches rows on serial number, falls back to position for rows whose serial
is partial, and prints every field-level disagreement.

### 4. Resolve every difference against the image

A disagreement means at least one of the two readings is wrong. Go back to the
image and decide which — do not pick one because it looks tidier or because it
was there first.

Some disagreements are informative in themselves. A single field differing on
one row is ordinary misreading. **Several consecutive rows disagreeing on the
same column is the signature of column shift**, and means one whole reading is
misaligned. Re-crop that stretch at higher magnification before deciding.

If neither reading can be defended, the honest resolution is a `?` and a flag,
not a coin flip.

### 5. Check the serials against the Archives

```sh
npm run check:serials -- --fetch   # once; 185 MB down, 837 MB on disk
npm run check:serials
```

This looks up every serial on the page in the Army Serial Number Electronic File,
the Archives' converted punch cards for men entering the Army 1938–46. A serial
that lands on a card bearing a different name, when the man himself is on a card
one digit away, is a misread digit and the report names the column.

It is a third reading, not a verdict. A missing card means nothing — a sixth of
the cards were lost before conversion — and the card file has its own errors.
Resolve every flagged row against the image the same way as step 4, and if the
image supports the transcription against the card, say so in the page's comments
file so nobody re-runs the investigation.

The comments files for frames 248, 265 and 121 show the form.

### 6. Clear the flag

Once the two readings agree, or every difference has been resolved against the
image:

```sh
npm run build:roster    # must stay at 0 errors
```

Then set `verified: true` in the page's front matter and rebuild. The site picks
the change up automatically — the provenance note lists which pages have been
read twice, so this is directly visible to visitors.

Delete the scratch file, or leave it in `.work/`; either way it is not committed.

## Resolving partial serials

Pages with damaged edges carry serials like `3?9?4?74`. These are the most
valuable thing to fix, because a partial serial cannot act as an identity key —
the build deliberately keeps those rows out of the cross-check, so they get no
protection from it.

Worth trying, in rough order of effort:

- Re-crop just that row at high magnification. Band images are sized for reading
  a dozen rows at once, not for squeezing one damaged digit.
- Check whether the man appears on another page. Duplicated frames and men named
  in both an order and a morning report give you a second look at the same
  number.
- Use the shape of the number. Wartime Army serials are regular: eight digits
  for most enlistees, seven for earlier Regular Army, `O`-prefixed for officers,
  and the leading digits encode the service command a man enlisted through, so
  neighbours on a roster often share a prefix.

That last one is a hint about where to look, not a licence to fill in a digit.
If it still cannot be read, it stays `?`. An incomplete record is a smaller
problem than a confident wrong one — the whole point of the flag system is that
the site can show a gap honestly.
