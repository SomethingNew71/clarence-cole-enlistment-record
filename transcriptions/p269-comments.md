# p269 — comments

Special Orders 226, Hq 29th Infantry Division, 11 September 1945, page 5 of the
order. The `111th FA Bn` list ends partway down and `110th FA Bn` begins.

## The frame has to be turned the other way

`deskew-page.mjs 269` picks the wrong rotation on this frame and reports a
confident `+0.0 deg` for it, because the auto-detection maximises row-ink
variance and the sideways image happens to score well. Read it with:

```sh
node tools/deskew-page.mjs 269 --rotate -90
```

which reports `+1.2 deg` over six bands. That 1.2 degrees is inside the range
that shifts a column against the names, so this page needed the MOS and ASR
columns checked row by row rather than sampled. They were.

## Three corrections from the second read

**A two-row column shift.** `Dawson` and `Dutton` carried the MOS and ASR of the
row below them. The film reads:

| row | film | was recorded as |
| --- | --- | --- |
| Dawson, Wilbur D | 641 / 82 | 605 / 81 |
| Dutton, Albert C | 605 / 81 | 186 / 67 |
| Hill, Edward O | 186 / 67 | 186 / 67 — correct |

Two consecutive rows sharing an MOS and an ASR is what exposed it. Wigman and
Weaver above, and Kleiden, Lipp and Olenic below, are all correct, so the shift
is confined to these two rows: one value was dropped at Weaver and every row
resynchronised at Hill.

**`Hill, Edward C` is `Hill, Edward O`.** The initial is a closed round O, and
sets differently from the C in `Albert C Dutton` two rows above.

**`Dutton, Albert C` carried a nine-character serial**, `3?07?0968`. No US Army
serial has nine digits — enlisted numbers are seven or eight, officers carry an
`O` prefix — so the reading was wrong however the digits fell. Measured against
the three known eight-digit serials in the same block, Dutton's field is 7.8
characters wide, where those three measure 7.4, 7.5 and 9.0. It is an eight, and
none of the eight can be read, so it is now `????????`. The earlier reading is
recorded here rather than in the table, because it asserted a digit count the
film does not support.

`Hill` gained a digit in the other direction: the serial opens with a legible
`1`, so `????????` became `1???????`.

## The remaining partial serials cannot be read from this scan

Fourteen rows on this page still carry `?`. That is not for want of trying, and
re-cropping will not fix it:

- **The scan is the ceiling.** The embedded image for this frame is 1813 × 1802
  pixels for the whole sheet. `deskew-page.mjs` renders at scale 4.2, which is
  already about 2500 pixels wide — past native. Rendering at scale 11 produces a
  6785-pixel image containing no more information than the 1813-pixel one, and
  the extra size reads as sharpness while adding nothing. Work from the embedded
  bitmap if you want the real thing.
- **The failure is in the ink, not the resolution.** On the affected rows the MOS
  and ASR columns to the right are crisp while the serial is a smear. The
  typewriter's carbon failed across the serial column on this sheet. There is
  nothing under the smear to recover.
- **There is no second source.** All 24 surnames carrying a partial serial across
  SO 226 were checked against every personnel row in the transcribed Battery C
  morning reports. None of them appear. That is expected — these men were posted
  to the 29th Division in September 1945, not to Battery C — but it does close
  the one avenue that resolved serials elsewhere on this site.

What would actually settle them is a better scan of frames 265–270 from NARA.
Until then they stay `?`, and the build keeps them out of the cross-reference,
which is the correct behaviour rather than a gap to be filled.
