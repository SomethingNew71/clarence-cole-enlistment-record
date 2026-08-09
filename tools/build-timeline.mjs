/**
 * Folds the morning-report transcription into public/data/timeline.json.
 *
 *   npm run build:timeline
 *
 * Source of truth is transcriptions/pNNN.md — one file per film frame, the same
 * home the orders use. This tool never invents a fact; it maps, merges and counts.
 *
 * Two rules make it safe to re-run:
 *
 *   1. It only ever removes events carrying "generated": true. Hand-authored
 *      events — the discharge, the citation, Special Orders 66 — are untouched.
 *   2. Where a hand-authored event already covers a date, the transcription
 *      ENRICHES it (filling a missing verbatim, strength or frame number) rather
 *      than adding a second event for the same day. The curated title and summary
 *      always win.
 *
 * It also emits public/data/morning-reports.json: the complete day-by-day record,
 * including the routine days that are deliberately kept off the main timeline.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readPages, parseCards } from "./lib/pages.mjs";
import { createPlaceResolver, placeKey } from "./lib/places.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "transcriptions");
const GAZ = resolve(ROOT, "data/gazetteer.json");
const TIMELINE = resolve(ROOT, "public/data/timeline.json");
const FULL = resolve(ROOT, "public/data/morning-reports.json");
const BATTERY = resolve(ROOT, "public/data/battery.json");

const pages = readPages(SRC);

// Every morning-report card on the film, flattened out of the page files.
const raw = pages
  .filter((p) => p.meta.kind === "morning-report")
  .flatMap((p) =>
    parseCards(p.body).map((card) => ({
      page: p.page,
      card: card.card,
      date: card.date,
      station: card.station,
      org: p.meta.unit ?? null,
      events: card.events ?? "",
      personnel: card.personnel,
      em_duty: card.strength?.presentForDuty ?? null,
      em_total: card.strength?.assigned ?? null,
    })),
  );
// Counted, never asserted — the number drifts every time a frame is added.
const FRAMES_TOTAL = 284;
const FRAMES_TRANSCRIBED = new Set(pages.map((p) => p.page)).size;
const FRAMES_REMAINING = FRAMES_TOTAL - FRAMES_TRANSCRIBED;
// Counted for the same reason: pages clear `verified: false` one at a time, and
// a sentence naming which ones are outstanding goes stale on the next pass.
const unverified = (kind) =>
  pages.filter((p) => p.meta.kind === kind && p.meta.verified !== true).length;
const UNVERIFIED_CARDS = unverified("morning-report");
const UNVERIFIED_ORDERS = unverified("order");

const gaz = JSON.parse(readFileSync(GAZ, "utf8"));
const timeline = JSON.parse(readFileSync(TIMELINE, "utf8"));

/* ---------------------------------------------------------------- merge cards */
// The film carries duplicate scans and multi-page reports for a single date.
const byDate = new Map();
for (const r of raw) {
  const prev = byDate.get(r.date);
  if (!prev) {
    byDate.set(r.date, { ...r, personnel: [...(r.personnel ?? [])], pages: [r.page] });
    continue;
  }
  prev.pages.push(r.page);
  for (const p of r.personnel ?? []) {
    if (!prev.personnel.some((q) => q.name === p.name && q.action === p.action)) prev.personnel.push(p);
  }
  const merged = [prev.events, r.events].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  prev.events = merged.join(" ");
  if (r.em_duty != null) prev.em_duty = r.em_duty;
  if (r.em_total != null) prev.em_total = r.em_total;
}
const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

// One card, one day — unless a report genuinely spans frames, which happens with
// continuation sheets and the multi-page corrections. Those declare `covers` in
// their front matter. An undeclared collision means a misread day glyph, which
// also hides a day that then goes missing entirely. Review caught p30 and p36
// that way; the build catches the next one.
const continuations = new Set(
  readPages(SRC).filter((p) => p.meta.covers).map((p) => p.page),
);
const dupes = [...byDate.values()]
  .filter((d) => new Set(d.pages).size > 1)
  .filter((d) => ![...new Set(d.pages)].some((page) => continuations.has(page)))
  .map((d) => `${d.date} appears on frames ${[...new Set(d.pages)].sort((a, b) => a - b).join(", ")}`);
if (dupes.length) {
  for (const d of dupes) console.error(`error ${d}`);
  console.error(
    "Each date must come from one frame. Re-read the day glyph on the frames above.",
  );
  process.exit(1);
}


/* -------------------------------------------------------------------- places */
// Whole-word, longest-match-first, with the two Normandy overrides. Shared with
// the weather fetch through tools/lib/places.mjs so the two cannot drift.
const placeFor = createPlaceResolver(gaz);

/* --------------------------------------------------------------- classifying */
const CASUALTY = /killed|wounded|\bLIA\b|injured in action/i;
const RX = {
  combat: /enemy artillery|enemy air|land mine|killed|wounded|\bLIA\b|injured in action/i,
  movement: /\bmoved\b|left .*arrived|arrived at|debark|boarded|march ordered|distance trave?l+ed/i,
  personnel: /promoted|appointed|aptd|reduced|assigned|transferred|trfd|joined|hosp|furlough|leave/i,
};

const kindFor = (day) => {
  const text = `${day.events} ${day.personnel.map((p) => p.action).join(" ")}`;
  if (RX.combat.test(text)) return "combat";
  if (RX.movement.test(day.events)) return "movement";
  if (day.personnel.length && RX.personnel.test(text)) return "personnel";
  return "admin";
};

// Only days that carry something beyond routine occupation reach the main timeline.
const isNotable = (day) => {
  const text = `${day.events} ${day.personnel.map((p) => p.action).join(" ")}`;
  return (
    RX.combat.test(text) ||
    RX.movement.test(day.events) ||
    /adjusted service rating|german .*guns|shipped german|gun tubes|alerted/i.test(day.events) ||
    day.personnel.some((p) => CASUALTY.test(p.action ?? ""))
  );
};

const titleFor = (day, kind, place) => {
  const e = day.events ?? "";
  if (CASUALTY.test(day.personnel.map((p) => p.action).join(" "))) {
    const hit = day.personnel.find((p) => CASUALTY.test(p.action ?? ""));
    if (/killed/i.test(hit.action)) return `${hit.name} killed`;
    return `${hit.name} wounded`;
  }
  if (/enemy artillery/i.test(e)) return "Enemy artillery on the position";
  if (/enemy air/i.test(e)) return "Enemy air action over the position";
  if (/arrived at omaha beach/i.test(e)) return "Lands over Omaha Beach";
  if (/shipped german guns/i.test(e)) return "Hands the German guns to the 269th";
  if (/german .*guns/i.test(e)) return "Training on captured German guns";
  if (/adjusted service rating/i.test(e)) return "Adjusted Service Rating cards issued";
  if (/gun tubes/i.test(e)) return "Changing gun tubes";
  if (/alerted for departure/i.test(e)) return "Alerted for departure";
  if (/march ordered/i.test(e)) return "March ordered";
  if (kind === "movement" && place) return `Moves to ${place.name.split(",")[0]}`;
  if (kind === "movement") return "Displaces to a new position";
  if (day.personnel.length === 1) return `${day.personnel[0].name} — status change`;
  if (day.personnel.length > 1) return `${day.personnel.length} personnel actions`;
  return "Record of events";
};

const summaryFor = (day, kind) => {
  const miles = day.events?.match(/distance trave?l+ed\s+(\d+)\s*mi/i)?.[1];
  if (kind === "movement" && miles) return `The battery moved ${miles} miles to a new position.`;
  if (kind === "combat") return "Recorded under fire, or a man hit, in the day's report.";
  if (day.personnel.length) {
    const n = day.personnel.length;
    return `${n} personnel ${n === 1 ? "action" : "actions"} recorded on the card.`;
  }
  return null;
};

/* --------------------------------------------------------------- build events */
const usedPlaces = new Map();
const generated = [];
const enrichable = new Map();

for (const day of days) {
  const gp = placeFor(day.station, day.date);
  let key = null;
  if (gp) {
    key = placeKey(gp.name);
    if (!usedPlaces.has(key)) {
      usedPlaces.set(key, {
        name: gp.name,
        lat: gp.lat,
        lon: gp.lon,
        ...(gp.country ? { country: gp.country } : {}),
        approximate: true,
        note: "Coordinate is the village named in the station entry; the battery position was within a mile or two of it, as the reports themselves state.",
      });
    }
  }

  const strength =
    day.em_duty != null && day.em_total != null
      ? { presentForDuty: day.em_duty, absent: day.em_total - day.em_duty, assigned: day.em_total }
      : undefined;

  const payload = {
    verbatim: day.events || undefined,
    strength,
    place: key ?? undefined,
    source: { id: "morning-reports", page: day.pages.sort((a, b) => a - b)[0] },
    personnel: day.personnel.length
      ? day.personnel.map((p) => ({
          name: p.name,
          ...(p.grade ? { grade: p.grade } : {}),
          ...(p.serial ? { serial: p.serial } : {}),
          action: p.action,
        }))
      : undefined,
  };

  enrichable.set(day.date, payload);

  if (!isNotable(day)) continue;
  const kind = kindFor(day);
  generated.push({
    id: `${day.date}-mr`,
    date: day.date,
    kind,
    title: titleFor(day, kind, gp),
    ...(key ? { place: key } : {}),
    ...(summaryFor(day, kind) ? { summary: summaryFor(day, kind) } : {}),
    ...payload,
    generated: true,
  });
}

/* --------------------------------------------------------------------- merge */
const handAuthored = (timeline.events ?? []).filter((e) => !e.generated);
const handDates = new Set(handAuthored.map((e) => e.date));

// Enrich the curated events with what the film adds, without overwriting curation.
let enriched = 0;
for (const e of handAuthored) {
  const add = enrichable.get(e.date);
  if (!add) continue;
  let touched = false;
  if (!e.verbatim && add.verbatim) { e.verbatim = add.verbatim; touched = true; }
  if (!e.strength && add.strength) { e.strength = add.strength; touched = true; }
  if (!e.place && add.place) { e.place = add.place; touched = true; }
  if (add.source?.page != null && (!e.source || e.source.id === "morning-reports") && e.source?.page == null) {
    e.source = { id: "morning-reports", page: add.source.page };
    touched = true;
  }
  if (touched) enriched += 1;
}

const kept = generated.filter((e) => !handDates.has(e.date));
const events = [...handAuthored, ...kept].sort(
  // A total order, and it has to be: `a.generated ? 1 : -1` answered -1 in both
  // directions for two hand-authored events sharing a date, which is not a valid
  // comparator. V8 then sorted the same input differently between runs and the
  // committed timeline.json drifted against its own sources.
  (a, b) =>
    a.date.localeCompare(b.date) ||
    Number(Boolean(a.generated)) - Number(Boolean(b.generated)) ||
    String(a.id).localeCompare(String(b.id)),
);

// Only add place keys the merged events actually reference, and never clobber a
// hand-authored place definition.
const places = { ...(timeline.places ?? {}) };
const referenced = new Set(events.map((e) => e.place).filter(Boolean));
for (const [key, value] of usedPlaces) {
  if (!referenced.has(key)) continue;
  if (!places[key]) places[key] = value;
}

const transcriptionNote = () => {
  if (FRAMES_REMAINING > 0) {
    return `${FRAMES_REMAINING} frames are not yet transcribed, including the occupation from mid-July 1945, the dissolution of the battery, and the sailing home.`;
  }
  const outstanding = [
    UNVERIFIED_CARDS && `${UNVERIFIED_CARDS} morning-report frames`,
    UNVERIFIED_ORDERS && `${UNVERIFIED_ORDERS} order frames`,
  ].filter(Boolean);
  if (outstanding.length === 0) {
    return `All ${FRAMES_TOTAL} frames are transcribed and verified.`;
  }
  return `All ${FRAMES_TOTAL} frames are transcribed. What remains is verification: ${outstanding.join(
    " and ",
  )} have not been through a second reading.`;
};

timeline.events = events;
timeline.places = places;
timeline.meta = {
  ...timeline.meta,
  transcription: {
    framesTranscribed: FRAMES_TRANSCRIBED,
    framesTotal: FRAMES_TOTAL,
    dailyReports: days.length,
    firstDate: days[0].date,
    lastDate: days[days.length - 1].date,
    note: transcriptionNote(),
  },
};

writeFileSync(TIMELINE, `${JSON.stringify(timeline, null, 2)}\n`, "utf8");

/* ------------------------------------------------- the complete daily record */
mkdirSync(dirname(FULL), { recursive: true });
writeFileSync(
  FULL,
  `${JSON.stringify(
    {
      meta: {
        title: "Battery C, 153rd Field Artillery Battalion — daily morning reports",
        note: "Every transcribed card, including the routine days kept off the main timeline. Source of truth is transcriptions/pNNN.md.",
        framesTranscribed: FRAMES_TRANSCRIBED,
        framesTotal: FRAMES_TOTAL,
        count: days.length,
      },
      days: days.map((d) => ({
        date: d.date,
        station: d.station,
        place: placeFor(d.station, d.date)?.name ?? null,
        events: d.events || null,
        personnel: d.personnel,
        strength:
          d.em_duty != null && d.em_total != null
            ? { presentForDuty: d.em_duty, absent: d.em_total - d.em_duty, assigned: d.em_total }
            : null,
        frames: [...new Set(d.pages)].sort((a, b) => a - b),
        notable: isNotable(d),
      })),
    },
    null,
    0,
  )}\n`,
  "utf8",
);

/* ---------------------------------------- what the battery's own numbers say */

/**
 * The clerk's vocabulary for a status change, sorted into kinds.
 *
 * Ordered, and the first match wins, so the specific sits above the general: a
 * correction that reports a wound is a wound, and a man transferred out of a
 * hospital has left the battery whichever word you lead with. The wording is
 * the clerk's, not a scheme imposed on him — every pattern here was read off
 * the film, and `other` reports what none of them caught rather than hiding it.
 */
const ACTION_KINDS = [
  { id: "killed", label: "Killed", match: /KILLED IN|\bdied\b|deceased/i },
  { id: "wounded", label: "Wounded or injured in action", match: /\bLIA\b|\bWIA\b|\bSWA\b|WOUNDED IN ACTION|INJURED IN ACTION|\bwound/i },
  { id: "joined", label: "Assigned and joined", match: /assigned\s*&|asgd\s*&|attached and joined|&\s*(jd|joined)\b|\bjoined\b|\basgd not yet jd\b|^jd\b/i },
  { id: "departed", label: "Transferred or departed", match: /\btrfd\b|\btransferred\b|\btrf to\b|attached out|reld\s+at?chd|relieved\s+attached|\bdeparted\b|honorably discharged/i },
  { id: "promoted", label: "Promoted or appointed", match: /\bpromoted\b|\bappointed\b|\baptd\b|\brerated\b/i },
  { id: "reduced", label: "Reduced in grade", match: /\breduced\b|\brd to\b/i },
  { id: "hospital", label: "Sick or injured, to hospital", match: /\bhosp\b|hospital|\bevac\b|clearing station|\bsk\b|\bsick\b/i },
  { id: "returned", label: "Returned to duty", match: /\bto dy\b|\bto duty\b/i },
  { id: "detached", label: "Detached or temporary duty", match: /\bto DS\b|\bto TD\b|detached service|temporary duty/i },
  { id: "leave", label: "Leave or furlough", match: /furlough|\bfur\b|\bleave\b|\bpass\b|rest cent|recreation/i },
  { id: "absent", label: "Absent without leave", match: /\bAWOL\b|confin|arrest/i },
  { id: "duty", label: "Job changed", match: /duty changed|\bdy c(hanged)? \b|\bmos c\b|\bduty:/i },
  { id: "admin", label: "Rations, points and corrections", match: /\brat(ion)?s?\b|\bqtrs\b|\bqrs\b|\bASR\b|^CORRECTION|phy cl/i },
];

const actions = [];
for (const day of days) {
  for (const p of day.personnel) {
    if (!p.action) continue;
    const kind = ACTION_KINDS.find((k) => k.match.test(p.action));
    actions.push({ date: day.date, page: day.pages[0], kind: kind?.id ?? "other", ...p });
  }
}

const tally = (id) => actions.filter((a) => a.kind === id);
const strength = days
  .filter((d) => d.em_duty != null && d.em_total != null)
  .map((d) => ({ date: d.date, present: d.em_duty, assigned: d.em_total }));

mkdirSync(dirname(BATTERY), { recursive: true });
writeFileSync(
  BATTERY,
  `${JSON.stringify(
    {
      meta: {
        title: "Battery C — strength and status changes, read off the morning reports",
        note:
          "Generated by tools/build-timeline.mjs from transcriptions/. The strength line is " +
          "enlisted men only, as the card records it, carried forward on days the clerk wrote " +
          "no change. A status change is one line on a card, so the counts are entries and not " +
          "men: a man who went to hospital and came back is two.",
        firstDate: strength[0]?.date ?? null,
        lastDate: strength[strength.length - 1]?.date ?? null,
      },
      strength,
      actions: {
        total: actions.length,
        kinds: [...ACTION_KINDS, { id: "other", label: "Not classified" }]
          .map(({ id, label }) => {
            const rows = tally(id);
            return {
              id,
              label,
              count: rows.length,
              // One verbatim entry, so a reader can see the wording the count rests on.
              example: rows[0] ? { date: rows[0].date, page: rows[0].page, action: rows[0].action } : null,
            };
          })
          .filter((k) => k.count > 0)
          .sort((a, b) => b.count - a.count),
        // The two deaths and every wound, named. Too few to be a bar and too
        // important to leave as one.
        casualties: actions
          .filter((a) => a.kind === "killed" || a.kind === "wounded")
          .map((a) => ({ date: a.date, page: a.page, name: a.name, kind: a.kind, action: a.action })),
      },
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const miles = days.reduce((sum, d) => {
  const m = [...(d.events ?? "").matchAll(/distance trave?l+ed\s+(\d+)\s*mi/gi)];
  return sum + m.reduce((s, x) => s + Number(x[1]), 0);
}, 0);

console.log(
  `daily reports ${days.length} · timeline events ${events.length} ` +
    `(${handAuthored.length} hand-authored, ${kept.length} from the film, ${enriched} enriched) · ` +
    `places ${Object.keys(places).length} · road miles ${miles} · ` +
    `strength readings ${strength.length} · status changes ${actions.length}`,
);
