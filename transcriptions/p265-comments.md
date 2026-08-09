# p265 — comments

Special Orders 226, Hq 29th Infantry Division, 11 September 1945. Frames 265–270.
This file covers the order as a whole; frames 268 and 269 have comments of their
own for what is specific to them.

## What the order is

The mirror of SO 66. Where August sent the battalion's high-point men home, this
assigns 276 low-point men from the 29th Infantry Division, which was itself going
home. Almost everyone leaving on SO 66 had 78 points or more; almost everyone
arriving here had fewer.

Authority is Seventh US Army; the order is signed by command of Major General
Gerhardt.

## State of the reading

Every frame has now had its grades, names, serials, MOS and ASR read against the
film. That pass found a two-row MOS/ASR column shift on 269, an eight-row shift
on 268, two errors on 270, and thirty-five men on this frame who had never been
transcribed at all. See [`p268-comments.md`](p268-comments.md) and
[`p269-comments.md`](p269-comments.md).

The frames still say `verified: false`. The pass compared the film against the
committed table rather than reading it blind, which is weaker evidence than the
two independent readings `verify-transcription` asks for.

**Twenty-seven serials across the order are not fully legible**, carried as `?`
characters. A partial serial cannot act as an identity key, so the build keeps
those rows out of the cross-check and they get none of its protection. They
cannot be resolved from this scan at all — `p269-comments.md` sets out why, and
what would be needed instead.

## Watch for the second Cole

`Pfc James E Cole 36857203` arrives on this order, on frame 267. No relation is
established and none should be implied. Match on serial, never on surname.

## Checked against the Army Serial Number file

Every serial on this order was looked up in the Army Serial Number Electronic
File (NARA ID 1263923). Run `npm run check:serials`; the full result is in
`data/nara-asn-crosscheck.json`, and the figures below should be recomputed from
it rather than quoted — they have been stale once already.

Of the order's serials, 171 are complete enough to look up and land on a card.
Ninety land on a card bearing the same name, thirty on the same man spelt
differently, and fifty-one on a different man. Seventy have no card at all, which
is silence rather than disagreement.

Of the fifty-one, **thirty-one put the man named here on a card one or two digits
from the serial as read**, which names the column to re-read:

| frame | name as typed | serial as read | card of that man | column |
| --- | --- | --- | --- | --- |
| 265 | Reves, Archie C | `17006687` | `17008687` | 5 |
| 266 | Agee, Jr, Ivy C | `34520807` | `34526887` | 5 and 7 |
| 266 | Getson, Joseph J | `35161985` | `35161895` | 6 and 7 |
| 266 | Goodman, Julian F | `34788437` | `34783437` | 5 |
| 266 | Jeffery, Alvin F | `36294755` | `36294725` | 7 |
| 266 | Kemnitz, John F | `35083865` | `39083865` | 2 |
| 266 | Mattingly, Simon E | `36208874` | `38209874` | 2 and 5 |
| 266 | Stover, Grady W | `14020252` | `14029252` | 5 |
| 267 | Bowker, Carl D | `34980119` | `34988149` | 5 and 7 |
| 267 | Chaplin, Frank W | `33446510` | `33046510` | 3 |
| 267 | Ignatosky, Vincent J | `33186012` | `33188012` | 5 |
| 267 | Johnson, George G | `35507440` | `33567440` | 2 and 4 |
| 267 | Snyder, George W | `33590336` | `33598336` | 5 |
| 267 | Tobianski, Carl S | `35539025` | `35539925` | 6 |
| 267 | Vassar, Donald W | `36292401` | `36292481` | 7 |
| 268 | Conklin, Donald E | `32602758` | `32603958` | 5 and 6 |
| 268 | Deal, Richard P | `35623806` | `35623886` | 7 |
| 268 | Hickman, Lester W | `39197929` | `39197529` | 6 |
| 268 | Hoffman, William N | `33501691` | `33561691` | 4 |
| 268 | Mann, Richard W | `17125062` | `17125862` | 6 |
| 268 | Rauch, Clarence P | `33487744` | `33487764` | 7 |
| 268 | Reed, Harry L | `35621405` | `35621465` | 7 |
| 268 | Rogers, William R | `35720679` | `35720659` | 7 |
| 268 | Root, Donald J | `42112024` | `42112029` | 8 |
| 269 | Carpenter, Jesse I | `15312342` | `15382342` | 4 |
| 269 | Cosko, Leslie G | `15101905` | `15101906` | 8 |
| 269 | Dawson, Wilbur D | `15015743` | `15019743` | 5 |
| 269 | Lipp, Samuel | `12135300` | `12135309` | 8 |
| 269 | Story, Jack Y | `34589587` | `34587587` | 5 |
| 269 | Wittenauer, Austin T | `36441005` | `36441605` | 6 |
| 270 | Slaughter, James E | `34860326` | `34880326` | 4 |

The remaining twenty land on a different man with nothing near. For nine of them
the name as typed appears nowhere in the nine million cards — McSpeddon William
D, Rosen Jesse, Nebroski Frank, Tomkinson Warren C, Pitt Malcom R, Trogel Thomas
W, Biagioli Remiro, Knode Richard G, Tellos Ernesto V — so both fields are in
question on those rows.

## What the card file settles about Agee

`Sgt Ivy C Agee Jr` is one of the nine `probable` Battery C matches, and the
three sources now converge on him.

| source | serial |
| --- | --- |
| Morning report, frame 272 | `3452?8?7` — smudged in the middle |
| Special Orders 226, frame 266 | `34520807` |
| Army Serial Number file, AGEE IVY C JR | `34526887` |

The card fills exactly the two positions the morning-report clerk's smudge hid,
and it disagrees with the order at exactly those two positions — which are also
where the order's own film is faint under magnification. Read together that makes
`34526887` the likely serial and the order the misreading.

It is not applied. The film decides here as everywhere, and the film is not
legible enough at those two columns to overturn a reading on its own. What has
changed is that this is no longer an open question about which of two
transcriptions is wrong: it is a question with an answer that a better scan of
frame 266 would confirm.

## Nothing here has been applied

A missing card is not a disagreement: about a sixth of the cards were lost before
conversion. The card file has its own errors — NARA compared 377 records against
the original punch cards and found 5 serials and 18 names wrong. The film
decides; the check says where to look.
