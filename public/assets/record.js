/**
 * The complete day-by-day morning-report record.
 *
 * The main timeline carries only the days that changed something. This is
 * everything: 397 cards including the long stretches where the entry reads
 * "in position firing" and nothing else. Those days are the texture of the war
 * a gun battery actually fought, so they are shown rather than summarised away.
 *
 * Loaded on demand from /data/morning-reports.json and rendered in batches —
 * the whole record in the DOM at once is several thousand nodes for no gain.
 */

import { loadWeather, weatherFor, weatherNode } from "/assets/lib/weather.js";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const formatDate = (iso) => DATE_FMT.format(new Date(`${iso}T00:00:00Z`));

const BATCH = 120;

export async function renderDailyRecord(host, { search, status, more }) {
  // The record is the point; the weather is an addition to it. Fetched together,
  // but only the record is allowed to fail the render.
  const [res, weather] = await Promise.all([fetch("/data/morning-reports.json"), loadWeather()]);
  if (!res.ok) throw new Error(`morning-reports.json: ${res.status}`);
  const { meta, days } = await res.json();

  let query = "";
  let shown = BATCH;

  const matches = () => {
    const q = query.trim().toLowerCase();
    if (!q) return days;
    return days.filter(
      (d) =>
        d.date.includes(q) ||
        (d.events ?? "").toLowerCase().includes(q) ||
        (d.station ?? "").toLowerCase().includes(q) ||
        (d.place ?? "").toLowerCase().includes(q) ||
        d.personnel.some((p) =>
          `${p.name} ${p.action} ${p.serial ?? ""}`.toLowerCase().includes(q),
        ),
    );
  };

  const dayNode = (day) => {
    const li = document.createElement("li");
    li.className = "card";
    if (day.notable) li.classList.add("card--notable");

    const head = document.createElement("p");
    head.className = "card__date";
    head.textContent = formatDate(day.date);
    if (day.place) {
      const where = document.createElement("span");
      where.className = "card__place";
      where.textContent = day.place;
      head.append(" ", where);
    }
    li.append(head);

    const body = document.createElement("p");
    body.className = "card__events";
    body.textContent = day.events ?? "No change.";
    if (!day.events) body.classList.add("card__events--empty");
    li.append(body);

    // The daily record carries the "in position firing" days precisely because
    // they are the texture of the war a gun battery fought. The sky is the one
    // thing that changed on those days, so it belongs here more than anywhere.
    // Matched on place name — this file names places, the timeline keys them.
    const sky = day.place ? weatherFor(weather, day.date, { placeName: day.place }) : null;
    const skyNode = sky ? weatherNode(sky, { className: "weather card__weather" }) : null;
    if (skyNode) li.append(skyNode);

    if (day.personnel.length) {
      const ul = document.createElement("ul");
      ul.className = "card__people";
      for (const p of day.personnel) {
        const item = document.createElement("li");
        const name = document.createElement("strong");
        name.textContent = p.name;
        if (/killed|wounded|\bLIA\b|injured in action/i.test(p.action)) {
          item.classList.add("card__person--casualty");
        }
        item.append(name);
        if (p.grade) {
          const g = document.createElement("span");
          g.className = "card__grade";
          g.textContent = p.grade;
          item.append(" ", g);
        }
        item.append(document.createElement("br"), document.createTextNode(p.action));
        ul.append(item);
      }
      li.append(ul);
    }

    const foot = document.createElement("p");
    foot.className = "card__foot";
    const frames = day.frames.join(", ");
    foot.textContent = day.strength
      ? `Frame ${frames} · ${day.strength.presentForDuty} of ${day.strength.assigned} enlisted men present for duty`
      : `Frame ${frames}`;
    li.append(foot);

    return li;
  };

  const draw = () => {
    const hits = matches();
    host.replaceChildren(...hits.slice(0, shown).map(dayNode));
    if (status) {
      status.textContent = `${hits.length} of ${meta.count} cards · frames ${meta.framesTranscribed} of ${meta.framesTotal} transcribed`;
    }
    if (more) {
      const remaining = Math.max(0, hits.length - shown);
      more.hidden = remaining === 0;
      more.textContent = `Show more — ${remaining} remaining`;
    }
  };

  if (search) {
    search.addEventListener("input", () => {
      query = search.value;
      shown = BATCH;
      draw();
    });
  }
  if (more) {
    more.addEventListener("click", () => {
      shown += BATCH * 2;
      draw();
    });
  }

  draw();
  return meta;
}
