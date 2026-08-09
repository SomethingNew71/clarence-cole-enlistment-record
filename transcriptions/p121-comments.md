# p121 — comments

## Earl F. Lyman's serial is read three ways across the film

| frame | document | reading |
| --- | --- | --- |
| 121 | morning report, 15 December 1944, joined from the 3rd Replacement Depot | `39146694` |
| 193 | morning report, 1 June 1945, appointed Pfc | `39161194` |
| 250 | Special Orders 66, verified | `39161694` |

The two morning-report frames disagree with each other and with the order. Until
now nothing settled it: the build compares rows only where the serials agree, so
three readings of one man passed through as three men.

The Army Serial Number Electronic File (NARA ID 1263923) holds exactly one Earl
F. Lyman in nine million cards. His serial is `39161694`, roll 1400 frame 6.166
— the reading on Special Orders 66. Frame 193 is one digit from it, in column 6;
frame 121 is two, in columns 4 and 5.

So the verified order is right and both cards were misread. Neither has been
changed. Frame 193 is the smaller question and should be re-read first.

`npm run check:serials` reproduces this; `data/nara-asn-crosscheck.json` carries
both rows.
