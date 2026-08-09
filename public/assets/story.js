/**
 * The narrative room: the discharge record, the two maps, the chain of command
 * and the campaign bars.
 *
 * The maps are a second concern to the prose. Each is built inside its own try,
 * so a blocked tile host or a Leaflet that never arrived leaves six chapters of
 * text standing.
 */

import { el, formatDate, loadJSON, toTime } from "/assets/lib/format.js";
import { createMap, frame, mapFailed, pinLabels, plot, route } from "/assets/lib/atlas.js";

/** Only where the battery itself was; a man's leave destination is not a position. */
const POSITION_KINDS = new Set(["movement", "combat"]);
const IN_THEATER = (p) => p.lon > -6 && p.lon < 16 && p.lat > 43 && p.lat < 55;

async function main() {
  const data = await loadJSON("/data/timeline.json");
  renderRecord(data);
  renderEnlistmentCard(data);
  renderAttachment(data);
  renderCampaigns(data);
  renderCrossing(data);
  renderTheater(data);
}

/** The discharge form, rendered as the definition list it basically is. */
function renderRecord({ subject }) {
  const host = document.getElementById("record");
  if (!host) return;

  const d = subject.description ?? {};
  const rows = [
    ["Name", subject.name],
    ["Serial number", subject.serial],
    ["Grade", `${subject.rank}, ${subject.branch}`],
    ["Organization", subject.unit],
    ["Military occupation", subject.mos],
    ["Born", `${formatDate(subject.born)}, ${subject.birthplace}`],
    ["Civilian occupation", subject.civilianOccupation],
    ["Home", subject.homeAddress],
    [
      "Entered active service",
      `${formatDate(subject.enteredActiveService.date)}, ${subject.enteredActiveService.place}`,
    ],
    ["Foreign service", subject.lengthOfService?.foreign],
    ["Continental service", subject.lengthOfService?.continental],
    ["Weapons qualification", subject.weaponsQualification],
    ["Wounds received in action", subject.woundsReceived],
    ["Separated", `${formatDate(subject.separated.date)}, ${subject.separated.place}`],
    [
      "Description",
      [d.height, d.weight, `${d.eyes} eyes`, `${d.hair} hair`].filter(Boolean).join(" · "),
    ],
  ].filter(([, value]) => value);

  host.replaceChildren(...definitionList(rows));
}

function definitionList(rows) {
  return rows.map(([label, value]) => {
    const wrap = document.createElement("div");
    wrap.append(el("dt", null, label), el("dd", null, value));
    return wrap;
  });
}

/**
 * The enlistment card, decoded. The Army wrote it in numbers — a state, a
 * county, a place, a trade, all as codes — so each row carries the code it was
 * read from, and a row whose code cannot be resolved says so.
 */
function renderEnlistmentCard({ subject }) {
  const host = document.getElementById("enlistment-card");
  const card = subject.enlistmentCard;
  if (!host || !card) return;

  host.replaceChildren(...definitionList(card.fields));

  const note = document.getElementById("enlistment-card-note");
  if (note) note.textContent = card.film;
}

/** Chain of command on each date we can source one for. */
function renderAttachment({ unit }) {
  const host = document.getElementById("attachment");
  if (!host || !unit.attachments?.length) return;

  const frag = document.createDocumentFragment();
  for (const a of unit.attachments) {
    const block = el("div", "chain");
    block.append(el("p", "chain__head", `${a.label} — ${formatDate(a.asOf)}`));

    const list = el("ol", "chain__list");
    for (const step of [...a.chain, `${unit.battery}, ${unit.designation}`]) {
      list.append(el("li", null, step));
    }
    block.append(list);
    block.append(el("p", "chain__note", a.note));
    frag.append(block);
  }
  host.replaceChildren(frag);
}

/**
 * Campaign bars on a shared time axis, with the period named in the Bronze Star
 * citation drawn behind them so the two can be read against each other.
 */
function renderCampaigns({ campaigns, events }) {
  const host = document.getElementById("campaigns-chart");
  if (!host || !campaigns?.length) return;

  const min = Math.min(...campaigns.map((c) => toTime(c.start)));
  const max = Math.max(...campaigns.map((c) => toTime(c.end)));
  const span = max - min;
  const pct = (t) => ((t - min) / span) * 100;

  const cited = events.find((e) => e.id === "1944-06-30-combat");
  const citedEnd = events.find((e) => e.id === "1945-03-15-cited-end");

  const frag = document.createDocumentFragment();

  if (cited && citedEnd) {
    const band = el("div", "campaigns__band");
    band.style.left = `${pct(toTime(cited.date))}%`;
    band.style.width = `${pct(toTime(citedEnd.date)) - pct(toTime(cited.date))}%`;
    band.title = "Period named in the Bronze Star citation";
    frag.append(band);
  }

  for (const campaign of campaigns) {
    const row = el("div", "campaign");
    row.append(el("span", "campaign__name", campaign.name));
    row.append(
      el(
        "span",
        "campaign__dates",
        `${formatDate(campaign.start)} – ${formatDate(campaign.end)}`,
      ),
    );

    const track = el("span", "campaign__track");
    const bar = el("span", "campaign__bar");
    bar.style.left = `${pct(toTime(campaign.start))}%`;
    bar.style.width = `${Math.max(1.2, pct(toTime(campaign.end)) - pct(toTime(campaign.start)))}%`;
    track.append(bar);
    row.append(track);

    frag.append(row);
  }

  host.replaceChildren(frag);
}

/** The Atlantic. No labels — there is nothing out there to name. */
function renderCrossing({ places }) {
  const host = document.getElementById("map-crossing");
  if (!host) return;
  try {
    const map = createMap(host, { labels: false });
    // Indicative track, not the convoy's actual route.
    const track = [
      [places.nype.lat, places.nype.lon],
      [43.5, -60],
      [47, -40],
      [50, -20],
      [51.4, -6],
      [51.5, -3],
    ];
    route(map, track);
    const ends = [
      [plot(map, places.nype, { radius: 5 }), "New York"],
      [plot(map, { lat: 51.5, lon: -3 }, { radius: 5 }), "United Kingdom"],
    ];
    map.fitBounds([
      [36, -76],
      [58, 10],
    ]);
    pinLabels(ends);
  } catch (err) {
    console.error(err);
    mapFailed(host, "The crossing map could not be loaded.");
  }
}

/**
 * The advance. One point per position, in the order the battery first reached
 * it — the events repeat a place for every day spent there, and plotting each
 * one would stack dozens of pins on the same village.
 */
function renderTheater({ places, events }) {
  const host = document.getElementById("map-theater");
  if (!host) return;

  const ordered = [];
  const seen = new Set();
  for (const e of [...events].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!POSITION_KINDS.has(e.kind) || e.pending) continue;
    const place = e.place && places[e.place];
    if (!place || !IN_THEATER(place) || seen.has(e.place)) continue;
    seen.add(e.place);
    ordered.push({ key: e.place, ...place });
  }

  // Label only the positions held longest, or the map illegibly fills with type.
  const dwell = new Map();
  for (const e of events) if (e.place) dwell.set(e.place, (dwell.get(e.place) ?? 0) + 1);

  try {
    const map = createMap(host);
    const latlngs = ordered.map((p) => [p.lat, p.lon]);
    route(map, latlngs);

    const markers = new Map();
    for (const p of ordered) {
      markers.set(p, plot(map, p, { title: p.name.split(",")[0] }));
    }
    frame(map, latlngs, [
      [43, -6],
      [55, 16],
    ]);

    const byDwell = [...ordered].sort(
      (a, b) => (dwell.get(b.key) ?? 0) - (dwell.get(a.key) ?? 0),
    );
    pinLabels(
      byDwell.map((p) => [markers.get(p), p.name.split(",")[0]]),
      { max: 8 },
    );
  } catch (err) {
    console.error(err);
    mapFailed(host, "The theater map could not be loaded.");
  }
}

main().catch((err) => {
  console.error(err);
  const host = document.getElementById("record");
  if (host) host.textContent = "The service record could not be loaded.";
});
