/**
 * Validates public/data/timeline.json. Run before deploying, and after every
 * batch of newly transcribed morning reports:
 *
 *   npm run check:data
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "public/data/timeline.json");
const WEATHER = resolve(ROOT, "public/data/weather.json");
const REPORTS = resolve(ROOT, "public/data/morning-reports.json");

const KINDS = new Set(["movement", "personnel", "combat", "admin", "award", "context"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const errors = [];
const warnings = [];

const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const data = JSON.parse(readFileSync(DATA, "utf8"));
const placeKeys = new Set(Object.keys(data.places ?? {}));
const sourceIds = new Set((data.sources ?? []).map((s) => s.id));
const seenIds = new Set();

for (const [key, place] of Object.entries(data.places ?? {})) {
  if (typeof place.lat !== "number" || place.lat < -90 || place.lat > 90) {
    fail(`place "${key}": lat must be a number between -90 and 90`);
  }
  if (typeof place.lon !== "number" || place.lon < -180 || place.lon > 180) {
    fail(`place "${key}": lon must be a number between -180 and 180`);
  }
  if (!place.name) fail(`place "${key}": missing name`);
}

for (const event of data.events ?? []) {
  const at = `event "${event.id ?? "(no id)"}"`;

  if (!event.id) fail(`${at}: missing id`);
  else if (seenIds.has(event.id)) fail(`${at}: duplicate id`);
  else seenIds.add(event.id);

  if (!ISO_DATE.test(event.date ?? "")) fail(`${at}: date must be YYYY-MM-DD`);
  else if (Number.isNaN(Date.parse(`${event.date}T00:00:00Z`))) fail(`${at}: invalid date`);

  if (!KINDS.has(event.kind)) fail(`${at}: kind "${event.kind}" is not one of ${[...KINDS].join(", ")}`);
  if (!event.title) fail(`${at}: missing title`);

  if (event.place && !placeKeys.has(event.place)) {
    fail(`${at}: place "${event.place}" is not defined in places`);
  }

  if (event.source) {
    if (!sourceIds.has(event.source.id)) fail(`${at}: source "${event.source.id}" is not defined`);
    // Citations into the microfilm run are by frame. Single-sheet documents —
    // the discharge, the citation, loose cards supplied as images — have no
    // frame and are cited by their own source id instead.
    if (event.source.id === "morning-reports" && !Number.isInteger(event.source.page)) {
      fail(`${at}: morning-reports citations need an integer frame number`);
    }
  } else if (!event.pending) {
    warn(`${at}: no source cited`);
  }

  if (event.corroboration && !sourceIds.has(event.corroboration.id)) {
    fail(`${at}: corroboration source "${event.corroboration.id}" is not defined`);
  }

  if (event.dateApproximate && !event.dateNote) {
    warn(`${at}: dateApproximate is set without a dateNote explaining the placement`);
  }

  if (event.strength) {
    const { presentForDuty, absent, assigned } = event.strength;
    if ([presentForDuty, absent, assigned].some((n) => !Number.isInteger(n))) {
      fail(`${at}: strength values must be integers`);
    } else if (presentForDuty + absent !== assigned) {
      warn(`${at}: strength does not balance (${presentForDuty} + ${absent} != ${assigned})`);
    }
  }
}

const dates = (data.events ?? []).map((e) => e.date);
if (dates.some((d, i) => i && d < dates[i - 1])) {
  warn("events are not stored in date order (the site sorts them, but keep the file tidy)");
}

// Every document referenced by a source, and every image a document points at,
// must actually be on disk — a broken plate is worse than no plate.
const docIds = new Set((data.documents ?? []).map((d) => d.id));
for (const source of data.sources ?? []) {
  if (source.document && !docIds.has(source.document)) {
    fail(`source "${source.id}": document "${source.document}" is not defined`);
  }
}
for (const doc of data.documents ?? []) {
  for (const key of ["image", "thumb"]) {
    const rel = doc[key];
    if (!rel) continue;
    if (!existsSync(resolve(ROOT, "public", rel.replace(/^\//, "")))) {
      fail(`document "${doc.id}": ${key} "${rel}" is missing from public/`);
    }
  }
  if (!doc.alt) warn(`document "${doc.id}": no alt text`);
}

for (const campaign of data.campaigns ?? []) {
  if (!ISO_DATE.test(campaign.start ?? "") || !ISO_DATE.test(campaign.end ?? "")) {
    fail(`campaign "${campaign.name}": start and end must be YYYY-MM-DD`);
  } else if (campaign.end < campaign.start) {
    fail(`campaign "${campaign.name}": ends before it starts`);
  }
}

/* ------------------------------------------------------------------ weather */
// Modelled weather is optional — the site renders without the file. What is not
// optional is that a day, if present, names the place it was modelled for, and
// that the place agrees with the record. A weather line under the wrong sky is
// worse than no weather line, and nothing else on the page would reveal it.
let weatherDays = 0;
if (existsSync(WEATHER)) {
  const weather = JSON.parse(readFileSync(WEATHER, "utf8"));
  const cellKeys = new Set(Object.keys(weather.cells ?? {}));
  weatherDays = Object.keys(weather.days ?? {}).length;

  const reports = existsSync(REPORTS) ? JSON.parse(readFileSync(REPORTS, "utf8")) : null;
  const stationFor = new Map((reports?.days ?? []).map((d) => [d.date, d.place]));

  for (const [date, day] of Object.entries(weather.days ?? {})) {
    const at = `weather ${date}`;
    if (!ISO_DATE.test(date)) fail(`${at}: key must be YYYY-MM-DD`);
    if (!day.place) {
      fail(`${at}: no place — a modelled day must say what it was modelled for`);
    } else if (!cellKeys.has(day.place)) {
      fail(`${at}: place "${day.place}" has no grid cell`);
    }
    if (!day.condition) warn(`${at}: WMO code ${day.code} has no wording`);
    if (day.tempMin != null && day.tempMax != null && day.tempMin > day.tempMax) {
      fail(`${at}: minimum temperature above the maximum`);
    }

    // The join the two rooms make at render time, checked here instead of hoped for.
    const station = stationFor.get(date);
    const modelled = weather.cells?.[day.place]?.name;
    if (station && modelled && station !== modelled) {
      fail(`${at}: modelled for ${modelled}, but the battery was at ${station}`);
    }
  }

  for (const [key, cell] of Object.entries(weather.cells ?? {})) {
    if (!cell.name) fail(`weather cell "${key}": missing name`);
    // 0.25 degrees of latitude is about 28 km, so a cell centre this far from
    // the village means the wrong cell, not grid snapping.
    if (cell.offsetKm != null && cell.offsetKm > 30) {
      warn(`weather cell "${key}": grid cell is ${cell.offsetKm} km from the village`);
    }
  }
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);

const pending = (data.events ?? []).filter((e) => e.pending).length;
console.log(
  `${data.events?.length ?? 0} events (${pending} pending), ` +
    `${placeKeys.size} places, ${weatherDays} modelled days, ` +
    `${errors.length} errors, ${warnings.length} warnings`,
);

if (errors.length) process.exit(1);
