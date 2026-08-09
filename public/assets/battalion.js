/**
 * The battalion room.
 *
 * Battery C's strength and status changes come first, from battery.js; the
 * network of the two 1945 orders follows. The network itself is graph.js,
 * unchanged; this module wires its controls and writes the two notes underneath
 * — whether Cole is on either order, and which pages of the film have been read
 * twice.
 */

import { loadJSON } from "/assets/lib/format.js";
import { renderBattery } from "/assets/battery.js";

async function main() {
  // Battery C's own figures first — they are the unit the rest of the page is
  // about, and they do not depend on the network finishing its layout.
  await renderBattery();

  const host = document.getElementById("roster-graph");
  const mod = await import("/assets/graph.js");
  const { svg, count, pages } = await mod.renderRosterGraph(host);

  mod.wireGraphSearch(
    document.getElementById("graph-search"),
    svg,
    document.getElementById("graph-status"),
  );
  mod.wireGraphDocFilter([...document.querySelectorAll("[data-doc]")], svg);

  renderProvenance(pages);
  await renderColeNote(svg, count);
}

/** Say plainly which pages have been checked and which have not. */
function renderProvenance(pages) {
  const host = document.getElementById("graph-provenance");
  if (!host) return;

  const real = pages.filter((p) => !p.duplicateOf);
  const checked = real.filter((p) => p.verified).map((p) => p.page);
  const unchecked = real.filter((p) => !p.verified).map((p) => p.page);

  host.textContent =
    "Every name here comes from a numbered page of the film, one file per page. " +
    (checked.length ? `Pages ${checked.join(", ")} have been read twice and agree. ` : "") +
    (unchecked.length
      ? `Pages ${unchecked.join(", ")} — the whole September order — are a first pass. ` +
        "Several of those frames are damaged at the edge. Characters that cannot be read " +
        "are left as question marks, and twenty-four men here have an incomplete serial " +
        "number."
      : "");
}

/**
 * Whether Cole is on the transfer list is the first thing to check, and the
 * answer is worth stating explicitly either way.
 */
async function renderColeNote(svg, count) {
  const note = document.getElementById("graph-note");
  if (!note) return;

  const { subject } = await loadJSON("/data/timeline.json");
  const cole = subject.serial;
  const onList = svg.querySelector(`.net-man[data-asn="${cole}"]`);

  note.textContent = onList
    ? `Sergeant Cole, ${cole}, is on this list.`
    : `Sergeant Cole is on neither order. His ${cole} does not appear in the ${count} ` +
      "names. He had 80 points, which was within the range of men sent home in August. " +
      "He left Battery C on 5 September 1945, transferred to the 3rd Reinforcement " +
      "Depot, and sailed a month after that. Neither order lists a battery, so these " +
      "men cannot be assigned to Battery C from these documents alone.";
}

main().catch((err) => {
  console.error(err);
  const host = document.getElementById("roster-graph");
  if (host) host.innerHTML = `<p class="map-empty">The roster network could not be loaded.</p>`;
});
