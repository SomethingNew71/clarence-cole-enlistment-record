/**
 * Derives public/data/weather.json from the committed data/weather.json cache.
 *
 *   npm run build:weather
 *
 * Offline and reproducible: the network pull is `npm run weather:fetch`, and it
 * is a separate command for that reason. This step rounds, names the WMO codes,
 * turns sunrise and sunset into a daylight length, and measures how far the ERA5
 * grid cell sits from the village the clerk named.
 *
 * Published in SI. The browser converts, so there is one stored number per fact.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "data/weather.json");
const OUT = resolve(ROOT, "public/data/weather.json");

if (!existsSync(SRC)) {
  console.error("data/weather.json is missing. Run `npm run weather:fetch` first.");
  process.exit(1);
}

const cache = JSON.parse(readFileSync(SRC, "utf8"));

/* ------------------------------------------------------------- WMO wording */
// Plain phrases, lowercase, so they read inside a sentence. The 1940s European
// codes are all that appear; the rest of the table is left out rather than
// guessed at.
const CONDITION = {
  0: "clear",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "freezing fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  56: "freezing drizzle",
  57: "heavy freezing drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  66: "freezing rain",
  67: "heavy freezing rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "light rain showers",
  81: "rain showers",
  82: "violent rain showers",
  85: "light snow showers",
  86: "heavy snow showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
  99: "thunderstorm with heavy hail",
};

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];
const compass = (deg) => (deg == null ? null : COMPASS[Math.round(deg / 22.5) % 16]);

const round = (v, dp = 1) => {
  if (v == null || Number.isNaN(v)) return null;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

/** Great-circle distance in km, to show how far the grid cell sits from the village. */
const distanceKm = (a, b) => {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/* -------------------------------------------------------------------- cells */

const cells = {};
let worstOffset = 0;
for (const [key, cell] of Object.entries(cache.cells)) {
  const offset = round(distanceKm(cell.requested, cell.grid), 1);
  worstOffset = Math.max(worstOffset, offset);
  cells[key] = {
    name: cell.name,
    lat: cell.grid.lat,
    lon: cell.grid.lon,
    elevation: cell.grid.elevation,
    offsetKm: offset,
  };
}

/* --------------------------------------------------------------------- days */

const unknownCodes = new Set();
const days = {};

for (const [date, r] of Object.entries(cache.days)) {
  if (r.weather_code != null && !(r.weather_code in CONDITION)) unknownCodes.add(r.weather_code);

  days[date] = {
    place: r.place,
    code: r.weather_code,
    condition: CONDITION[r.weather_code] ?? null,
    tempMax: round(r.temperature_2m_max),
    tempMin: round(r.temperature_2m_min),
    tempMean: round(r.temperature_2m_mean),
    feelsMax: round(r.apparent_temperature_max),
    feelsMin: round(r.apparent_temperature_min),
    precip: round(r.precipitation_sum),
    rain: round(r.rain_sum),
    snow: round(r.snowfall_sum),
    precipHours: round(r.precipitation_hours, 0),
    windMax: round(r.wind_speed_10m_max),
    gust: round(r.wind_gusts_10m_max),
    windDir: round(r.wind_direction_10m_dominant, 0),
    windFrom: compass(r.wind_direction_10m_dominant),
    cloud: round(r.cloud_cover_mean, 0),
    // Minutes. Sunrise and sunset are fetched in UTC and not published: the tz
    // database offset Open-Meteo applies to 1944 does not account for British
    // Double Summer Time, so the clock times are not the ones the men kept.
    // A duration is immune to that.
    sunshineMin: r.sunshine_duration == null ? null : Math.round(r.sunshine_duration / 60),
    daylightMin: r.daylight_duration == null ? null : Math.round(r.daylight_duration / 60),
  };
}

if (unknownCodes.size) {
  console.warn(
    `warn  WMO codes with no wording: ${[...unknownCodes].sort((a, b) => a - b).join(", ")}`,
  );
}

/* -------------------------------------------------------------------- write */

const payload = {
  meta: {
    title: "Modelled weather for the days and places in the record",
    source: cache.meta.source,
    model: cache.meta.model,
    url: cache.meta.url,
    licence: cache.meta.licence,
    caveat: cache.meta.caveat,
    units: {
      temperature: "°C",
      precipitation: "mm",
      snowfall: "cm",
      wind: "km/h",
      cloud: "%",
      duration: "minutes",
    },
    fetched: cache.meta.fetched,
    days: Object.keys(days).length,
    places: Object.keys(cells).length,
    maxOffsetKm: round(worstOffset, 1),
    omitted: cache.meta.omitted ?? null,
  },
  cells,
  days,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 0)}\n`, "utf8");

const withCondition = Object.values(days).filter((d) => d.condition).length;
console.log(
  `public/data/weather.json: ${payload.meta.days} days at ${payload.meta.places} places · ` +
    `${withCondition} named conditions · grid cell up to ${payload.meta.maxOffsetKm} km from the village`,
);
