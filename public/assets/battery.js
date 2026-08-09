/**
 * Battery C by its own numbers: the strength line, the status changes, and the
 * men who were wounded or killed.
 *
 * Everything here is read off `public/data/battery.json`, which the timeline
 * build writes out of the morning-report transcriptions. Nothing is computed in
 * the browser except geometry.
 *
 * The charts are drawn at the container's real pixel width and redrawn when it
 * changes, rather than at a fixed viewBox scaled by CSS. A scaled viewBox makes
 * an 11px label render at 5px on a phone, which is how the map labels once came
 * out nine degrees wide.
 */

import { el, formatDate, loadJSON, toTime } from "/assets/lib/format.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

/**
 * Two series, validated against this page's surface for colour-vision
 * separation before they were chosen. The palette is deliberately muted, so
 * both sit under the usual chroma floor; every mark is also directly labelled,
 * which is the secondary channel that makes that safe.
 */
const ASSIGNED = "var(--color-sage-700)";
const PRESENT = "var(--color-accent)";

export async function renderBattery() {
  const data = await loadJSON("/data/battery.json");
  renderStrength(data);
  renderActions(data);
  renderCasualties(data);
  return data;
}

/* --------------------------------------------------------------- the strength */

function renderStrength(data) {
  const host = document.getElementById("strength-chart");
  if (!host || !data.strength?.length) return;

  const draw = () => {
    const w = host.clientWidth;
    if (!w) return;
    const h = w < 560 ? 200 : 260;
    const pad = { top: 16, right: w < 560 ? 44 : 64, bottom: 26, left: 34 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const rows = data.strength;
    const t0 = toTime(rows[0].date);
    const t1 = toTime(rows[rows.length - 1].date);
    // A line chart in a narrow band: the axis is labelled and does not start at
    // zero, which would flatten seventeen months into one straight line.
    const lo = Math.floor(Math.min(...rows.map((r) => r.present)) / 10) * 10 - 10;
    const hi = Math.ceil(Math.max(...rows.map((r) => r.assigned)) / 10) * 10;
    const x = (d) => pad.left + ((toTime(d) - t0) / (t1 - t0)) * plotW;
    const y = (v) => pad.top + plotH - ((v - lo) / (hi - lo)) * plotH;

    const svg = svgEl("svg", {
      width: w,
      height: h,
      viewBox: `0 0 ${w} ${h}`,
      role: "img",
      "aria-label":
        `Line chart of Battery C's enlisted strength from ${formatDate(rows[0].date)} to ` +
        `${formatDate(rows[rows.length - 1].date)}. Assigned runs between ` +
        `${Math.min(...rows.map((r) => r.assigned))} and ${Math.max(...rows.map((r) => r.assigned))} men; ` +
        `present for duty tracks below it.`,
    });

    // Gridlines and their ticks carry the values the direct labels do not.
    for (let v = Math.ceil(lo / 20) * 20; v <= hi; v += 20) {
      svg.append(svgEl("line", { class: "chart__grid", x1: pad.left, x2: w - pad.right, y1: y(v), y2: y(v) }));
      const t = svgEl("text", { class: "chart__tick", x: pad.left - 8, y: y(v) + 4, "text-anchor": "end" });
      t.textContent = v;
      svg.append(t);
    }
    for (const year of [1944, 1945]) {
      for (const m of [0, 3, 6, 9]) {
        const iso = `${year}-${String(m + 1).padStart(2, "0")}-01`;
        if (toTime(iso) < t0 || toTime(iso) > t1) continue;
        const label = svgEl("text", { class: "chart__tick", x: x(iso), y: h - 8, "text-anchor": "middle" });
        label.textContent = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
          month: "short",
          year: m === 0 ? "numeric" : undefined,
          timeZone: "UTC",
        });
        svg.append(label);
      }
    }

    const path = (key) => rows.map((r, i) => `${i ? "L" : "M"}${x(r.date)} ${y(r[key])}`).join(" ");
    // The gap between the two lines is the men who were absent that day.
    const band =
      `${path("assigned")} ` +
      rows
        .slice()
        .reverse()
        .map((r) => `L${x(r.date)} ${y(r.present)}`)
        .join(" ") +
      " Z";
    svg.append(svgEl("path", { class: "chart__band", d: band }));
    svg.append(svgEl("path", { class: "chart__line", d: path("assigned"), stroke: ASSIGNED }));
    svg.append(svgEl("path", { class: "chart__line", d: path("present"), stroke: PRESENT }));

    // Label the ends only. A number on every point is unreadable and unread —
    // and when the two lines finish together, one label, not two stacked.
    const last = rows[rows.length - 1];
    const ends = [
      { v: last.assigned, colour: ASSIGNED },
      { v: last.present, colour: PRESENT },
    ].sort((a, b) => a.v - b.v);
    let lastLabelY = -Infinity;
    for (const e of ends) {
      svg.append(svgEl("circle", { class: "chart__dot", cx: x(last.date), cy: y(e.v), r: 4, fill: e.colour }));
      if (Math.abs(y(e.v) - lastLabelY) < 14) continue;
      lastLabelY = y(e.v);
      const t = svgEl("text", { class: "chart__endlabel", x: x(last.date) + 9, y: y(e.v) + 4 });
      t.textContent = e.v;
      svg.append(t);
    }

    const cross = svgEl("line", { class: "chart__cross", y1: pad.top, y2: pad.top + plotH, x1: 0, x2: 0 });
    cross.style.opacity = "0";
    svg.append(cross);

    host.replaceChildren(svg);
    wireCrosshair(host, svg, cross, rows, x, pad, plotW);
  };

  draw();
  new ResizeObserver(debounce(draw)).observe(host);
}

/** Crosshair and a readout, so any one of 399 days can be looked up. */
function wireCrosshair(host, svg, cross, rows, x, pad, plotW) {
  const tip = document.getElementById("strength-readout");
  const clear = () => {
    cross.style.opacity = "0";
    if (tip) tip.textContent = "";
  };
  svg.addEventListener("pointerleave", clear);
  svg.addEventListener("pointermove", (event) => {
    const box = svg.getBoundingClientRect();
    const px = event.clientX - box.left;
    if (px < pad.left || px > pad.left + plotW) return clear();
    let best = rows[0];
    let bestD = Infinity;
    for (const r of rows) {
      const d = Math.abs(x(r.date) - px);
      if (d < bestD) [best, bestD] = [r, d];
    }
    cross.setAttribute("x1", x(best.date));
    cross.setAttribute("x2", x(best.date));
    cross.style.opacity = "1";
    if (tip) {
      tip.textContent =
        `${formatDate(best.date)} — ${best.assigned} assigned, ${best.present} present for duty, ` +
        `${best.assigned - best.present} absent`;
    }
  });
}

/* ------------------------------------------------------- what happened to them */

function renderActions(data) {
  const host = document.getElementById("actions-chart");
  const kinds = data.actions?.kinds;
  if (!host || !kinds?.length) return;

  const max = Math.max(...kinds.map((k) => k.count));
  const frag = document.createDocumentFragment();
  for (const k of kinds) {
    const row = el("div", "hbar");
    row.append(el("span", "hbar__label", k.label));
    const track = el("span", "hbar__track");
    const fill = el("span", "hbar__fill");
    fill.style.width = `${(k.count / max) * 100}%`;
    track.append(fill);
    row.append(track);
    row.append(el("span", "hbar__value", String(k.count)));
    if (k.example) {
      row.title = `${formatDate(k.example.date)}, frame ${k.example.page}: ${k.example.action}`;
    }
    frag.append(row);
  }
  host.replaceChildren(frag);
}

/* ------------------------------------------------------------------ casualties */
/* Nine entries is not a chart. A list, with the clerk's own words. */

function renderCasualties(data) {
  const host = document.getElementById("casualties");
  const rows = data.actions?.casualties;
  if (!host || !rows?.length) return;

  const list = el("ol", "casualties");
  for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
    const li = el("li", r.kind === "killed" ? "casualty casualty--killed" : "casualty");
    li.append(el("p", "casualty__head", `${r.name} — ${formatDate(r.date)}`));
    li.append(el("p", "casualty__body", r.action));
    li.append(el("p", "casualty__source", `Frame ${r.page}`));
    list.append(li);
  }
  host.replaceChildren(list);
}

function debounce(fn, ms = 150) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}
