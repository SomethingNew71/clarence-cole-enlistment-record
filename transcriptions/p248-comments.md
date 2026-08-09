# p248 — comments

Special Orders 66, Hq 153rd FA Bn, 24 August 1945. Frames 248–252, verified.

## Cole is not on this list

His 36106875 appears nowhere in the 142 names, and he had 80 points, which was
inside the band of men being sent home that month. He was on leave at Treebeek
from 19 to 25 August, and this order is dated the 24th. Whether that is why he
was left off is not established and should not be asserted.

He left the battalion eleven days later by a different route — SO 71, to the 3rd
Reinforcement Depot. See `p259-comments.md`.

## The order names commands the site did not otherwise know

`Auth: VOCG XXIII Corps & 32d F.A. Brigade` is the only place either formation is
stated outright. It upgraded the August chain of command from an inference drawn
from a leave order to a fact.

## Frames 249 and 251 duplicate pages transcribed elsewhere

Both are marked `duplicate_of`. Not waste: 249 is square on the film where 248 is
1.6 degrees off, and comparing them is how the serial-column shift on 248 was
caught. Where two frames carry the same man the build compares them and fails on
disagreement.

## Checked against the Army Serial Number file

Every serial on this order was looked up in the Army Serial Number Electronic
File, the Archives' converted punch cards for men entering the Army 1938–46
(NARA ID 1263923). Run `npm run check:serials`; the full result is in
`data/nara-asn-crosscheck.json`.

Ninety of the serials here are complete enough to look up. Twenty-four have no
card — about a sixth of the cards were lost before the Archives converted them,
so that is silence, not disagreement. Of the remaining sixty-six:

- 46 land on a card bearing the same name.
- 12 land on the same man spelt differently. The card reads *Bartnikowski* for
  the order's *Barthikowski*, *Percoski* for *Fercoski*, *Reichl* for *Reichi*,
  *McAlister* for *McAlester*. Neither spelling is authoritative; both are typed
  copies of something handwritten.
- 7 land on a different man, and the man named here is on a card one or two
  digits away.

| frame | name as typed | serial as read | card of that man | column | who holds the serial read | men of that name in the file |
| --- | --- | --- | --- | --- | --- | --- |
| 248 | Bronsing, John J | `34287995` | `34287997` | 8 | Collins Frank H | 1 |
| 248 | Andrews, Paul W | `35200371` | `35208371` | 5 | no card of that serial | 48 |
| 250 | Rowell, William A | `14046885` | `14016885` | 4 | House Richard L | 34 |
| 250 | Lee, Obert G | `36215654` | `36246654` | 4 and 5 | Haese August H | 1 |
| 250 | Phillips, Edwin J | `39085965` | `33085965` | 2 | Nunn Reid E | 41 |
| 251 | Poteat, Coy M | `33517335` | `33519335` | 5 | no card of that serial | 2 |
| 252 | Ruck, Thomas H | `20342109` | `20341109` | 5 | no card of that serial | 1 |

One more, `35577210` for Barker, Alston D on frame 248, lands on Ruiz Lupe T and
there is no Alston Barker anywhere in the nine million cards. The name is in
question as well as the serial.

These are candidates for a re-read, not corrections. Nothing here has been
applied to `p248.md` or its sister frames. The column named is where to look on
the image.
