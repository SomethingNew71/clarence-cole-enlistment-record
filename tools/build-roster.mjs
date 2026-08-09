/**
 * Builds public/data/roster.json from transcriptions/*.md.
 *
 * Every row transcribed from the film lives in transcriptions/, one file per
 * PDF page. This script parses them, cross-checks pages that carry the same
 * man, and emits the roster the site reads.
 *
 *   node tools/build-roster.mjs
 *
 * Fails on: a filename that disagrees with its `page`, a row with no serial
 * number, or two pages that record the same serial number differently.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { readPages, parseTable, parseCards } from "./lib/pages.mjs";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "transcriptions");
const OUT = resolve(ROOT, "public/data/roster.json");

/** The documents the transcriptions draw from, in the order they happened. */
const DOCUMENTS = {
  "SO 66": {
    id: "special-orders-66",
    title: "Special Orders 66",
    headquarters: "Headquarters, 153rd Field Artillery Battalion",
    date: "1945-08-24",
    effective: "1945-08-26",
    direction: "out",
    label: "Sent home",
    summary:
      "153rd FA Bn men transferred to the 70th Infantry Division for return to the " +
      "United States. Authority: XXIII Corps and the 32nd Field Artillery Brigade.",
  },
  "SO 226": {
    id: "special-orders-226",
    title: "Special Orders 226",
    headquarters: "Headquarters, 29th Infantry Division",
    date: "1945-09-11",
    effective: "1945-09-13",
    direction: "in",
    label: "Sent in",
    summary:
      "29th Infantry Division men released from their units and assigned to the 153rd " +
      "FA Bn. Authority: Seventh US Army. Where SO 66 sent the high-point men home, " +
      "this order replaced them with low-point men who had to stay.",
  },
};

const errors = [];
const warnings = [];

// Only the orders build the roster. Morning-report pages live in the same
// directory and the same format, but a card is not a roster row.
const allPages = readPages(SRC);
const files = allPages.filter((p) => p.meta.kind !== "morning-report");

const byAsn = new Map();
const pages = [];

for (const { file, page: expected, meta, body } of files) {
  if (meta.page !== expected) {
    errors.push(`${file}: front matter says page ${meta.page}, filename says ${expected}`);
  }

  const rows = parseTable(body);
  pages.push({
    page: expected,
    document: meta.document ?? null,
    unit: meta.unit ?? null,
    verified: meta.verified === true,
    complete: meta.complete !== false,
    duplicateOf: meta.duplicate_of ?? null,
    rows: rows.length,
  });

  for (const row of rows) {
    if (!row.asn) {
      errors.push(`${file}: row for "${row.name || "(no name)"}" has no serial number`);
      continue;
    }

    const person = {
      asn: row.asn,
      name: row.name,
      grade: row.grade,
      mos: row.mos || null,
      profile: row.profile || null,
      document: meta.document ?? null,
      page: expected,
      officer: /^O/i.test(row.asn),
    };
    if (row.mco) person.mco = row.mco;
    if (row.asr) {
      const n = Number(row.asr);
      if (Number.isFinite(n)) person.asr = n;
      else person.asrRaw = row.asr;
    }
    if (meta.unit) person.sourceUnit = meta.unit;
    if (meta.verified !== true) person.unverified = true;
    if (row.flags) {
      const flags = row.flags.split(",").map((s) => s.trim()).filter(Boolean);
      if (flags.length) person.uncertain = flags;
    }

    // Army serial numbers have a shape: seven or eight digits for enlisted men,
    // an O prefix and six or seven for officers. A reading outside that is wrong
    // whatever its digits say, and a partial one hides it — p269 carried
    // "3?07?0968" for nine characters until the second read measured the field.
    // Cheap to check, and it catches the class of error rather than the instance.
    const bare = person.asn.replace(/^O-?/i, "");
    const width = person.officer ? [6, 7, 8] : [7, 8];
    if (!width.includes(bare.length)) {
      errors.push(
        `${file}: ${person.name} — serial "${person.asn}" is ${bare.length} characters; ` +
          `${person.officer ? "officer" : "enlisted"} numbers are ${width.join(" or ")}`,
      );
      continue;
    }
    if (!/^[0-9?]+$/.test(bare)) {
      errors.push(`${file}: ${person.name} — serial "${person.asn}" has a non-digit`);
      continue;
    }

    // A serial number that cannot be fully read is not an identity key, so it
    // is kept out of the cross-check rather than colliding with other rows.
    if (person.asn.includes("?")) {
      person.asnPartial = true;
      warnings.push(`p${expected}: ${person.name} — serial not fully legible (${person.asn})`);
      byAsn.set(`${person.asn}#${person.name}`, person);
      continue;
    }

    const existing = byAsn.get(person.asn);
    if (!existing) {
      byAsn.set(person.asn, person);
      continue;
    }

    // The same man on two pages is the cross-check the page split exists for.
    for (const key of ["name", "grade", "mos", "asr"]) {
      if (existing[key] !== person[key]) {
        errors.push(
          `serial ${person.asn}: page ${existing.page} has ${key}="${existing[key]}", ` +
            `page ${person.page} has "${person[key]}"`,
        );
      }
    }
  }
}

const people = [...byAsn.values()];

/* ------------------------------------------------ Battery C cross-reference */
// Neither order carries a battery column, so on its own neither can place a man
// in Battery C. The morning reports can: they are Battery C's own cards. Matching
// on serial number resolves the battery for part of these lists.
//
// Exact serial match counts as confirmation. A surname match where the serials
// differ by one or two characters is recorded as probable — microfilm digits are
// genuinely ambiguous — and names both readings so a human can adjudicate.
// A partially-legible serial is never matched; "330?????" is not an identity.
const mrBySerial = new Map();
const mrBySurname = new Map();
for (const page of allPages.filter((p) => p.meta.kind === "morning-report")) {
  for (const card of parseCards(page.body)) {
    for (const p of card.personnel) {
      if (!p.name || /^\d+ (EM|Officers)/i.test(p.name) || /^Above/i.test(p.name)) continue;
      const serial = (p.serial ?? "").replace(/^O-?/i, "");
      const surname = p.name.toLowerCase().split(",")[0].replace(/[^a-z]/g, "");
      const entry = { name: p.name, serial, date: card.date, page: page.page };
      if (serial && !serial.includes("?")) {
        if (!mrBySerial.has(serial)) mrBySerial.set(serial, []);
        mrBySerial.get(serial).push(entry);
      }
      if (!mrBySurname.has(surname)) mrBySurname.set(surname, []);
      mrBySurname.get(surname).push(entry);
    }
  }
}

const charDistance = (a, b) => {
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) if (a[i] !== b[i]) d += 1;
  return d;
};

let confirmed = 0;
let probable = 0;
for (const p of people) {
  if (p.asnPartial) continue;
  const asn = p.asn.replace(/^O-?/i, "");
  const exact = mrBySerial.get(asn);
  if (exact?.length) {
    const dates = exact.map((e) => e.date).sort();
    p.batteryC = {
      status: "confirmed",
      basis: "serial number appears in the Battery C morning reports",
      firstSeen: dates[0],
      lastSeen: dates[dates.length - 1],
      source: { id: "morning-reports" },
    };
    confirmed += 1;
    continue;
  }
  const surname = p.name.toLowerCase().split(",")[0].replace(/[^a-z]/g, "");
  const near = (mrBySurname.get(surname) ?? []).find(
    (e) => e.serial && charDistance(asn, e.serial) <= 2,
  );
  if (near) {
    p.batteryC = {
      status: "probable",
      basis: "same surname in the Battery C morning reports, serial differing by one or two digits",
      morningReportSerial: near.serial,
      note: "One of the two transcriptions misreads a digit; which one is not established.",
      firstSeen: near.date,
      source: { id: "morning-reports" },
    };
    probable += 1;
  }
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);

const payload = {
  documents: Object.fromEntries(
    Object.entries(DOCUMENTS).map(([key, doc]) => [
      key,
      {
        ...doc,
        count: people.filter((p) => p.document === key).length,
        verified: pages
          .filter((p) => p.document === key && !p.duplicateOf)
          .every((p) => p.verified),
      },
    ]),
  ),
  pages,
  columns: {
    asn: "Army serial number",
    mos: "Military occupational specialty",
    mco: "Second code as printed on SO 66; its meaning has not been established",
    asr: "Adjusted Service Rating — the points score that decided who went home first",
    profile: "Physical profile",
  },
  people,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload));

const byDoc = Object.entries(payload.documents)
  .map(([k, d]) => `${k} ${d.count}${d.verified ? "" : " unverified"}`)
  .join(", ");
console.log(
  `roster.json: ${people.length} men (${byDoc}) from ${files.length} pages, ` +
    `${new Set(people.map((p) => p.mos)).size} distinct MOS, ` +
    `${errors.length} errors, ${warnings.length} warnings\n` +
    `Battery C cross-reference: ${confirmed} confirmed, ${probable} probable`,
);

if (errors.length) process.exit(1);
