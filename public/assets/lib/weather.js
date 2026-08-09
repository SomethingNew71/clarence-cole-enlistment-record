/**
 * Modelled weather, shared by the timeline and the daily record.
 *
 * The numbers are ERA5 reanalysis, not observation, and no morning-report card
 * records the weather — the word appears nowhere in 284 frames. So every line
 * this module builds is marked as modelled, and every caller is expected to
 * keep that mark. Reading a temperature here as something the battery wrote
 * down would be reading the site wrong.
 *
 * Published in SI; converted here. Imperial leads because the men and the
 * family are American, with Celsius alongside for temperature.
 *
 * The load is optional. A room that cannot fetch the file renders without it.
 *
 * Why the icons are drawn here
 * ----------------------------
 * There is no icon font and no CDN, and there is not going to be one. These are
 * hand-drawn line glyphs in a single hidden <symbol> sprite, injected once per
 * page and referenced by <use>. The daily record puts a weather line on 451
 * cards; inlining the paths would put several thousand duplicate <path> nodes in
 * the DOM for no gain. They stroke in currentColor so the palette owns them.
 */

const PATH = "/data/weather.json";
const NS = "http://www.w3.org/2000/svg";

let pending = null;

/** Loads once per page. Resolves to null if the file is unavailable. */
export function loadWeather() {
  if (!pending) {
    pending = fetch(PATH)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return pending;
}

/* ------------------------------------------------------------------- units */

// A true minus, not a hyphen. Half the winter readings are negative and a
// hyphen sets far too short against the figures beside it.
const signed = (n) => (n == null ? null : String(n).replace("-", "−"));

const f = (c) => (c == null ? null : signed(Math.round((c * 9) / 5 + 32)));
const mph = (kmh) => (kmh == null ? null : Math.round(kmh / 1.609344));
const inches = (mm) => (mm == null ? null : mm / 25.4);
const c = (v) => (v == null ? null : signed(Math.round(v)));

/**
 * An en dash closes a range, except where an endpoint is negative — "−8–−3" is
 * unreadable, so those get the word instead. This is the usual typographic rule
 * and not a special case for this site.
 */
const range = (a, b) =>
  String(a).startsWith("−") || String(b).startsWith("−") ? `${a} to ${b}` : `${a}–${b}`;

/**
 * Depth of rain or snow, in inches.
 *
 * Anything under a hundredth of an inch is reported as a trace, which is the
 * convention and is also the only honest option: 0.1 mm of ERA5 drizzle
 * formatted to two places reads "0.00 in", which looks like a bug and says
 * nothing. Below a thousandth there is nothing to report at all.
 */
const depth = (inch) => {
  if (inch == null || inch < 0.001) return null;
  if (inch < 0.01) return "trace";
  if (inch >= 0.1) return `${inch.toFixed(1)} in`;
  return `${inch.toFixed(2)} in`;
};

const hoursMinutes = (min) => {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
};

/* ------------------------------------------------------------------ lookup */

/**
 * Looks up a day, and refuses the lookup when the place does not match.
 *
 * A timeline event can sit at a different place from the battery on the same
 * date. Weather is stored for exactly one place per date, so a mismatch has to
 * return nothing rather than the wrong sky.
 */
export function weatherFor(weather, date, { placeKey, placeName } = {}) {
  const day = weather?.days?.[date];
  if (!day) return null;
  if (placeKey && placeKey !== day.place) return null;
  if (placeName && weather.cells?.[day.place]?.name !== placeName) return null;
  return day;
}

/* ------------------------------------------------------------------- icons */

// Drawn on a 24 grid and shown at 15px, which is the whole constraint: anything
// finer than about 3 grid units disappears. So these carry few marks and long
// ones. An earlier set had six-stroke snowflakes under the cloud and they read
// as a smudge.
//
// The cloud sits high, y 5 to 15, leaving the bottom third clear for whatever
// is falling out of it.
const CLOUD = "M7.2 15h9.4a3.5 3.5 0 0 0 .2-7 5.2 5.2 0 0 0-9.8-1.3A3.7 3.7 0 0 0 7.2 15z";

const ICONS = {
  sun: `<circle cx="12" cy="12" r="4.2"/><path d="M12 2.4v2.3M12 19.3v2.3M21.6 12h-2.3M4.7 12H2.4M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6M18.8 18.8l-1.6-1.6M6.8 6.8 5.2 5.2"/>`,
  // The sun sits clear of the cloud rather than behind it. Overlapped, the disc
  // and the cloud's shoulder merge into one blob below about 20px.
  sunCloud: `<circle cx="7.6" cy="7.4" r="3"/><path d="M7.6 1.6v1.8M1.8 7.4h1.8M3.5 3.3l1.3 1.3M11.7 3.3l-1.3 1.3"/><path d="M11 19.2h7.6a3.1 3.1 0 0 0 .2-6.2 4.6 4.6 0 0 0-8.6-1.1 3.3 3.3 0 0 0 .8 7.3z"/>`,
  cloud: `<path d="${CLOUD}"/>`,
  fog: `<path d="${CLOUD}"/><path d="M5.4 18.6h13.2M8 21.6h8"/>`,
  drizzle: `<path d="${CLOUD}"/><path d="M9.4 17.8v2.4M12 17.8v2.4M14.6 17.8v2.4"/>`,
  rain: `<path d="${CLOUD}"/><path d="M9.6 17.6 8.2 21.8M13 17.6l-1.4 4.2M16.4 17.6 15 21.8"/>`,
  // One large flake rather than a scatter of small ones — at this size a
  // scatter is indistinguishable from drizzle.
  snow: `<path d="${CLOUD}"/><path d="M12 15.8v7.4M8.8 17.6l6.4 3.8M15.2 17.6l-6.4 3.8"/>`,
  storm: `<path d="${CLOUD}"/><path d="M13.4 15.8 9.9 20.8h3.3l-1.9 3.1"/>`,
  // A tube and a bulb, and nothing else. Two scale ticks beside a 15px glyph
  // are three grey specks, and they cost the bulb its silhouette.
  thermometer: `<circle cx="12" cy="17.9" r="3.5"/><path d="M12 14.4V4.6"/><path d="M13.8 7.2h2.2"/>`,
  droplet: `<path d="M12 3.4s5.3 5.6 5.3 9.3a5.3 5.3 0 1 1-10.6 0C6.7 9 12 3.4 12 3.4z"/>`,
  flake: `<path d="M12 2.4v19.2M3.7 7.2l16.6 9.6M20.3 7.2 3.7 16.8"/>`,
  // Rotated per reading, so it points the way the wind was blowing.
  arrow: `<path d="M12 21V4.4"/><path d="M7.4 9 12 4.4 16.6 9"/>`,
  daylight: `<path d="M2.6 19.6h18.8"/><path d="M6.8 19.6a5.2 5.2 0 0 1 10.4 0"/><path d="M12 6V3.4M4.9 9.1 3.4 7.6M19.1 9.1l1.5-1.5"/>`,
};

/** WMO code to glyph. Anything unmapped falls back to the plain cloud. */
function conditionIcon(code) {
  if (code === 0) return "sun";
  if (code === 1 || code === 2) return "sunCloud";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 71 && code <= 77) return "snow";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  return "cloud";
}

/** One hidden sprite per page, holding every glyph exactly once. */
function ensureSprite() {
  if (document.getElementById("wx-sprite")) return;
  const sprite = document.createElementNS(NS, "svg");
  sprite.id = "wx-sprite";
  sprite.setAttribute("aria-hidden", "true");
  sprite.setAttribute("focusable", "false");
  // Not display:none — that has historically broken <use> references. Clipped
  // to nothing instead, which every engine handles.
  sprite.setAttribute(
    "style",
    "position:absolute;width:0;height:0;overflow:hidden",
  );
  // Geometry only. fill, stroke and stroke-width are inherited properties, so
  // they are set once in CSS on .wx__icon and reach the shadow content from
  // there — which keeps the drawing weight a stylesheet decision, not one
  // baked into this file where the rest of the design system cannot see it.
  sprite.innerHTML = Object.entries(ICONS)
    .map(([name, body]) => `<symbol id="wx-${name}" viewBox="0 0 24 24">${body}</symbol>`)
    .join("");
  document.body.prepend(sprite);
}

function iconNode(name, rotateDeg) {
  ensureSprite();
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "wx__icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (rotateDeg != null) svg.style.transform = `rotate(${rotateDeg}deg)`;
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", `#wx-${name}`);
  svg.append(use);
  return svg;
}

/* ---------------------------------------------------------------- readings */

/**
 * The day as discrete readings rather than a sentence: each one an icon, a
 * value, and the name of what is being measured for anyone who cannot see the
 * icon. Callers render them; nothing here decides layout.
 */
export function readings(day) {
  const out = [];
  if (!day) return out;

  if (day.condition) {
    out.push({ icon: conditionIcon(day.code), label: "Conditions", value: day.condition });
  }

  if (day.tempMin != null && day.tempMax != null) {
    const item = {
      icon: "thermometer",
      label: "Temperature",
      value: `${range(f(day.tempMin), f(day.tempMax))} °F`,
      aside: `${range(c(day.tempMin), c(day.tempMax))} °C`,
    };
    // Wind chill, and only when the wind is actually taking something off the
    // reading. Three degrees is the point at which it stops being rounding.
    if (day.feelsMin != null && day.tempMin - day.feelsMin >= 3) {
      item.note = `felt ${f(day.feelsMin)} °F`;
    }
    out.push(item);
  }

  // snowfall_sum is centimetres; everything else falling is millimetres.
  const snow = depth(inches((day.snow ?? 0) * 10));
  if (snow) out.push({ icon: "flake", label: "Snowfall", value: snow });

  const rain = depth(inches(day.rain));
  if (rain) {
    out.push({
      icon: "droplet",
      label: "Rainfall",
      value: rain,
      // A duration means nothing against a trace, and reads oddly beside it.
      ...(day.precipHours && rain !== "trace" ? { note: `over ${day.precipHours} h` } : {}),
    });
  }

  // Only when it would have been felt. Below this the wind is not part of the day.
  if (day.windMax != null && (day.windMax >= 24 || (day.gust ?? 0) >= 40)) {
    out.push({
      icon: "arrow",
      // The gazetteer records the direction the wind came FROM; the arrow points
      // the way it was going, which is that bearing turned about.
      rotate: day.windDir == null ? null : (day.windDir + 180) % 360,
      label: "Wind",
      value: `${day.windFrom ? `${day.windFrom} ` : ""}${mph(day.windMax)} mph`,
      ...(day.gust != null && day.gust - day.windMax >= 8
        ? { note: `gusting ${mph(day.gust)}` }
        : {}),
    });
  }

  const daylight = hoursMinutes(day.daylightMin);
  if (daylight) out.push({ icon: "daylight", label: "Daylight", value: daylight });

  return out;
}

/** The same readings as one string, for a tooltip or a screen reader. */
export function describe(day) {
  return readings(day).map((r) =>
    [r.value, r.aside && `(${r.aside})`, r.note].filter(Boolean).join(" "),
  );
}

/** The sentence explaining what these numbers are, used as hover text. */
export const CAVEAT =
  "ERA5 reanalysis, not an observation. A modern weather model rerun over the " +
  "sparse surviving records of the 1940s, for a grid cell roughly 25 km across. " +
  "The morning reports never record the weather.";

/**
 * Builds the weather strip: the tag, then one item per reading.
 *
 * The tag is not decoration. It is the only thing here telling a reader that
 * these figures did not come off the film, so it is not optional and it is not
 * separable from the numbers.
 */
export function weatherNode(day, { className = "weather" } = {}) {
  const items = readings(day);
  if (!items.length) return null;

  const wrap = document.createElement("p");
  wrap.className = className;

  const tag = document.createElement("span");
  tag.className = "tag weather__tag";
  tag.textContent = "modelled";
  tag.title = CAVEAT;
  wrap.append(tag);
  wrap.append(srText(". "));

  for (const item of items) {
    const span = document.createElement("span");
    span.className = "wx";
    span.append(iconNode(item.icon, item.rotate));

    // Named for anyone who cannot see the glyph. The icon alone is ambiguous
    // between snowfall and cold, and between wind and direction.
    span.append(srText(`${item.label}: `));

    const value = document.createElement("span");
    value.className = "wx__value";
    value.textContent = item.value;
    span.append(value);

    if (item.aside) {
      span.append(srText(", "));
      const aside = document.createElement("span");
      aside.className = "wx__aside";
      aside.textContent = item.aside;
      span.append(aside);
    }
    if (item.note) {
      span.append(srText(", "));
      const note = document.createElement("span");
      note.className = "wx__note";
      note.textContent = item.note;
      span.append(note);
    }

    span.append(srText(". "));
    wrap.append(span);
  }

  return wrap;
}

/**
 * Punctuation only a screen reader hears.
 *
 * The gaps between the figures are flexbox `gap`, which is not a character, so
 * the accessible name ran together as "17–27 °F−8 to −3 °Cfelt 10 °F". These
 * put the pauses back without putting anything on the page.
 */
function srText(text) {
  const span = document.createElement("span");
  span.className = "sr-only";
  span.textContent = text;
  return span;
}
