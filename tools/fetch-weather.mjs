/**
 * One-time pull of ERA5 reanalysis weather for every day and place in the record.
 *
 *   npm run weather:fetch            # fetch only what is missing
 *   npm run weather:fetch -- --force # refetch everything
 *
 * Writes data/weather.json, which is committed. The war is over; these numbers
 * will not change, so the site never asks the network for them. Nothing here
 * runs in the browser and nothing here runs during `npm run build:weather`.
 *
 * What this is, and what it is not
 * --------------------------------
 * ERA5 is a reanalysis: a modern weather model rerun over the sparse
 * observations that survive from the 1940s. It is not an observation, it is not
 * from the film, and no morning-report card records the weather — the word
 * never appears in 284 frames. Every figure here is therefore *modelled
 * regional* weather, on a grid cell roughly 25 km across, and the site labels
 * it that way wherever it appears.
 *
 * Two consequences are baked into this tool rather than left to the reader:
 *
 *   - Days whose station does not resolve to a place get no weather at all,
 *     rather than weather borrowed from the day before.
 *   - The North Atlantic crossing is skipped. The gazetteer carries one nominal
 *     mid-ocean coordinate for eight days of a moving convoy, and the weather at
 *     a point the ship was not at is worse than no weather.
 *
 * Clock times are fetched in UTC and stored in UTC. Open-Meteo resolves
 * Europe/London to UTC+1 for June 1944, but Britain was on British Double
 * Summer Time (UTC+2) that summer, so its local times are not the times the men
 * kept. build-weather.mjs derives daylight *length* from sunrise and sunset,
 * which no timezone can distort, and publishes no clock time.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPlaceResolver, placeKey } from "./lib/places.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GAZ = resolve(ROOT, "data/gazetteer.json");
const REPORTS = resolve(ROOT, "public/data/morning-reports.json");
const TIMELINE = resolve(ROOT, "public/data/timeline.json");
const OUT = resolve(ROOT, "data/weather.json");

const ENDPOINT = "https://archive-api.open-meteo.com/v1/archive";
const MODEL = "era5";

// ERA5 begins in 1940. He was born in 1906; that event gets no weather.
const EARLIEST = "1940-01-01";

// One request covers a run of dates at one place. Runs split on a gap wider than
// this, so a place occupied twice months apart is not fetched across the void.
const GAP_DAYS = 31;

const DAILY = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "temperature_2m_mean",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "precipitation_sum",
  "rain_sum",
  "snowfall_sum",
  "precipitation_hours",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
  "cloud_cover_mean",
  "sunshine_duration",
  "daylight_duration",
  "sunrise",
  "sunset",
];

const args = process.argv.slice(2);
const FORCE = args.includes("--force");

/* ------------------------------------------------------------ what to fetch */

const gaz = JSON.parse(readFileSync(GAZ, "utf8"));
const placeFor = createPlaceResolver(gaz);

if (!existsSync(REPORTS)) {
  console.error("public/data/morning-reports.json is missing. Run `npm run build:timeline` first.");
  process.exit(1);
}
const reports = JSON.parse(readFileSync(REPORTS, "utf8"));
const timeline = JSON.parse(readFileSync(TIMELINE, "utf8"));

/** date -> { key, name, lat, lon }, one place per day. */
const wanted = new Map();
// Dates deliberately left without weather. Held separately so the curated-event
// pass below cannot quietly reinstate a day the morning reports already ruled out.
const blocked = new Set();
const skipped = { atSea: 0, noPlace: 0, tooEarly: 0 };

const consider = (date, place, key) => {
  if (!place || place.lat == null || place.lon == null) {
    skipped.noPlace += 1;
    blocked.add(date);
    return;
  }
  if (place.country === "At sea") {
    skipped.atSea += 1;
    blocked.add(date);
    return;
  }
  if (date < EARLIEST) {
    skipped.tooEarly += 1;
    blocked.add(date);
    return;
  }
  wanted.set(date, { key, name: place.name, lat: place.lat, lon: place.lon });
};

for (const day of reports.days) {
  const gp = placeFor(day.station, day.date);
  consider(day.date, gp, gp ? placeKey(gp.name) : null);
}

// The curated events outside the morning-report run: enlistment at Fort Sheridan
// and the discharge at Indiantown Gap. Birth in 1906 falls before ERA5 and drops.
for (const e of timeline.events ?? []) {
  if (!e.place || wanted.has(e.date) || blocked.has(e.date)) continue;
  consider(e.date, timeline.places?.[e.place], e.place);
}

/* ------------------------------------------------------- group into requests */

const byPlace = new Map();
for (const [date, p] of wanted) {
  if (!byPlace.has(p.key)) byPlace.set(p.key, { ...p, dates: [] });
  byPlace.get(p.key).dates.push(date);
}

const dayNumber = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);

/** Contiguous-enough date runs, so one place occupied twice is two requests. */
const runsFor = (dates) => {
  const sorted = [...dates].sort();
  const runs = [];
  for (const date of sorted) {
    const last = runs[runs.length - 1];
    if (last && dayNumber(date) - dayNumber(last.end) <= GAP_DAYS) {
      last.end = date;
      continue;
    }
    runs.push({ start: date, end: date });
  }
  return runs;
};

const jobs = [];
for (const [key, place] of byPlace) {
  for (const run of runsFor(place.dates)) jobs.push({ key, place, ...run });
}

/* ----------------------------------------------------------------- existing */

const prior = !FORCE && existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const days = { ...(prior?.days ?? {}) };
const cells = { ...(prior?.cells ?? {}) };

// A cached day is only reusable if it was fetched for the same place.
for (const [date, row] of Object.entries(days)) {
  const want = wanted.get(date);
  if (!want || want.key !== row.place) delete days[date];
}

const outstanding = jobs.filter((job) =>
  byPlace
    .get(job.key)
    .dates.some((d) => d >= job.start && d <= job.end && !days[d]),
);

console.log(
  `${wanted.size} days at ${byPlace.size} places · ${jobs.length} runs · ` +
    `${outstanding.length} to fetch, ${jobs.length - outstanding.length} already cached`,
);
if (skipped.noPlace || skipped.atSea || skipped.tooEarly) {
  console.log(
    `skipping ${skipped.noPlace} days whose station does not resolve, ` +
      `${skipped.atSea} at sea, ${skipped.tooEarly} before ERA5 begins`,
  );
}

/* ------------------------------------------------------------------- fetch */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, attempt = 1) {
  let res;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch (err) {
    if (attempt >= 4) throw err;
    await sleep(attempt * 2000);
    return getJSON(url, attempt + 1);
  }
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 4) throw new Error(`${res.status} after ${attempt} attempts`);
    await sleep(attempt * 5000);
    return getJSON(url, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

let fetched = 0;
for (const [i, job] of outstanding.entries()) {
  const url =
    `${ENDPOINT}?latitude=${job.place.lat}&longitude=${job.place.lon}` +
    `&start_date=${job.start}&end_date=${job.end}` +
    `&daily=${DAILY.join(",")}&models=${MODEL}&timezone=UTC`;

  const data = await getJSON(url);
  const d = data.daily;
  if (!d?.time?.length) throw new Error(`no daily block for ${job.key} ${job.start}..${job.end}`);

  cells[job.key] = {
    name: job.place.name,
    requested: { lat: job.place.lat, lon: job.place.lon },
    grid: { lat: data.latitude, lon: data.longitude, elevation: data.elevation },
  };

  let kept = 0;
  for (const [row, date] of d.time.entries()) {
    if (wanted.get(date)?.key !== job.key) continue;
    const out = { place: job.key };
    for (const v of DAILY) out[v] = d[v]?.[row] ?? null;
    days[date] = out;
    kept += 1;
  }

  fetched += 1;
  console.log(
    `  [${i + 1}/${outstanding.length}] ${job.key} ${job.start}..${job.end} — ${kept} days`,
  );
  // The archive API is free and unmetered for this volume. Be a good guest.
  if (i < outstanding.length - 1) await sleep(400);
}

/* ------------------------------------------------------------------- write */

const sortedDays = Object.fromEntries(Object.entries(days).sort(([a], [b]) => a.localeCompare(b)));
const sortedCells = Object.fromEntries(Object.entries(cells).sort(([a], [b]) => a.localeCompare(b)));

const payload = {
  meta: {
    title: "ERA5 reanalysis weather for the days and places in the record",
    source: "Open-Meteo Historical Weather API",
    url: "https://open-meteo.com/en/docs/historical-weather-api",
    model: "ECMWF ERA5 global reanalysis, approximately 25 km grid",
    endpoint: ENDPOINT,
    licence: "Open-Meteo data under CC BY 4.0; ERA5 under the Copernicus licence.",
    timezone: "UTC",
    caveat:
      "Reanalysis, not observation. A model rerun over the sparse surviving records of the 1940s, " +
      "reported for a grid cell of roughly 25 km, not for the battery position. No morning-report " +
      "card records the weather; none of this comes from the film.",
    fetched: new Date().toISOString().slice(0, 10),
    daily: DAILY,
    days: Object.keys(sortedDays).length,
    places: Object.keys(sortedCells).length,
    omitted: {
      unresolvedStation: skipped.noPlace,
      atSea: skipped.atSea,
      beforeEra5: skipped.tooEarly,
    },
  },
  cells: sortedCells,
  days: sortedDays,
};

writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(
  `data/weather.json: ${payload.meta.days} days at ${payload.meta.places} places ` +
    `(${fetched} runs fetched this pass)`,
);
