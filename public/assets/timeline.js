/**
 * The timeline room.
 *
 * Battalion events and the wider war merged into one date-sorted list. The event
 * type is carried by the marker on the rail and by a label after the date; the
 * styling for both lives in style.css, keyed off the `entry--{kind}` class.
 */

import { el, formatDate, loadJSON } from "/assets/lib/format.js";
import { loadWeather, weatherFor, weatherNode } from "/assets/lib/weather.js";

const KIND_LABELS = {
  movement: "Movement",
  combat: "Combat",
  personnel: "Personnel",
  admin: "Service record",
  award: "Award",
  context: "The wider war",
};

async function main() {
  // Weather is an addition to the record, not part of it, so it loads alongside
  // and a failure leaves the timeline intact.
  const [data, weather] = await Promise.all([loadJSON("/data/timeline.json"), loadWeather()]);
  const entries = mergedEntries(data);
  const list = document.getElementById("timeline-list");
  const count = document.getElementById("entry-count");

  const draw = (filter) => {
    const shown = filter === "all" ? entries : entries.filter((e) => e.kind === filter);
    list.replaceChildren(...shown.map((entry) => entryNode(entry, weather)));
    if (count) {
      count.textContent = `${shown.length} ${shown.length === 1 ? "entry" : "entries"}`;
    }
  };

  const chips = [...document.querySelectorAll(".chip[data-filter]")];
  for (const chip of chips) {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.toggle("is-on", c === chip));
      draw(chip.dataset.filter);
    });
  }

  draw("all");
}

/** Merge unit events and wider-war context into one date-sorted list. */
function mergedEntries({ events, context, places, sources }) {
  const titleOf = (id) => sources.find((s) => s.id === id)?.title ?? null;
  const unitEntries = events.map((e) => ({
    ...e,
    placeKey: e.place ?? null,
    place: e.place ? places[e.place] : null,
    sourceTitle: e.source ? titleOf(e.source.id) : null,
    corroborationTitle: e.corroboration ? titleOf(e.corroboration.id) : null,
  }));
  const contextEntries = context.map((c) => ({ ...c, kind: "context" }));
  return [...unitEntries, ...contextEntries].sort((a, b) => a.date.localeCompare(b.date));
}

function entryNode(entry, weather) {
  const li = el("li", `entry entry--${entry.kind}`);
  if (entry.pending) li.classList.add("entry--pending");

  li.append(el("span", "entry__dot"));

  const date = el("p", "entry__date");
  date.append(
    entry.dateApproximate ? `about ${formatDate(entry.date)}` : formatDate(entry.date),
  );
  const label = KIND_LABELS[entry.kind];
  if (label) date.append(el("span", "entry__kind", label));
  li.append(date);

  li.append(el("h3", "entry__title", entry.title));

  if (entry.summary) li.append(el("p", "entry__summary", entry.summary));
  if (entry.dateNote) li.append(el("p", "entry__note", entry.dateNote));
  if (entry.verbatim) li.append(el("blockquote", "entry__verbatim", entry.verbatim));

  // After the card's own words, never inside them: the quote is the document,
  // this is not.
  const day = weatherFor(weather, entry.date, { placeKey: entry.placeKey });
  const sky = day ? weatherNode(day, { className: "weather entry__weather" }) : null;
  if (sky) li.append(sky);

  const meta = metaNode(entry);
  if (meta) li.append(meta);
  return li;
}

function metaNode(entry) {
  const bits = [];
  if (entry.pending) bits.push(el("span", "tag", "not yet verified"));
  if (entry.dateNote) bits.push(el("span", "tag", "date inferred"));
  // Where the battery was, when that differs from where the event happened.
  if (entry.locationText) bits.push(el("span", null, entry.locationText));
  if (entry.place) bits.push(el("span", null, entry.place.name));
  if (entry.strength) {
    bits.push(
      el(
        "span",
        null,
        `${entry.strength.presentForDuty} present for duty of ${entry.strength.assigned} assigned`,
      ),
    );
  }
  if (entry.source) bits.push(el("span", null, citeText(entry.sourceTitle, entry.source)));
  if (entry.corroboration) {
    bits.push(
      el("span", null, `Corroborated by the ${entry.corroborationTitle ?? "record"}`),
    );
  }
  if (!bits.length) return null;

  const wrap = el("p", "entry__meta");
  wrap.append(...bits);
  return wrap;
}

/** Morning reports are cited by microfilm frame; everything else by title alone. */
function citeText(title, source) {
  const name = title ?? "Source";
  return source.page ? `${name}, frame ${source.page}` : name;
}

main().catch((err) => {
  console.error(err);
  const list = document.getElementById("timeline-list");
  if (list) list.textContent = "The timeline data could not be loaded.";
});
