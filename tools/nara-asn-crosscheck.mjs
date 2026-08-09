/**
 * Checks every serial number read off the film against the Army Serial Number
 * Electronic File held by the National Archives.
 *
 *   node tools/nara-asn-crosscheck.mjs --fetch    # download the file first
 *   node tools/nara-asn-crosscheck.mjs            # report only
 *   node tools/nara-asn-crosscheck.mjs --write    # report and write data/nara-asn-crosscheck.json
 *
 * The Archives hold a punch card for nearly every man who entered the Army
 * between 1938 and 1946, converted to a fixed-length data file: 9,200,232
 * records of 91 bytes, keyed on serial number. NARA ID 1263923, Record Group 64.
 *
 * That makes it an independent check on the one field this project cannot
 * afford to get wrong. A serial transcribed from the film either lands on a
 * card bearing the same name, or it does not. When it does not, searching the
 * card file by name usually finds the man one digit away — which names the
 * misread digit and gives the reading that should replace it.
 *
 * Two things this cannot do. It cannot confirm a serial the Archives never
 * filmed: about 1.6 million cards were lost before conversion, so silence is
 * not disagreement. And the card file has errors of its own — NARA sampled 377
 * records against the original cards and found 5 serials and 18 names wrong.
 * Agreement between two sources is evidence; a disagreement is a question to
 * put back to the film, not an answer.
 */
import { createWriteStream, existsSync, mkdirSync, openSync, readSync, closeSync, statSync, writeFileSync, createReadStream, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { createInflateRaw } from "node:zlib";
import { readPages, parseTable, parseCards } from "./lib/pages.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "transcriptions");
const WORK = resolve(ROOT, ".work/nara");
const DAT = resolve(WORK, "ASNEF.FIN.DAT");
const OUT = resolve(ROOT, "data/nara-asn-crosscheck.json");

const ZIP_URL =
  "https://catalog.archives.gov/medialive/23/2639/1263923/content/arcmedia/electronic-records/rg-064/asnf/ASNEF.FIN.zip";

const RECORD = 91; // 89 characters of card, then carriage return and line feed.

/**
 * Columns 1-80 are the punch card, WD AGO Form 372, laid out as War Department
 * TM 12-305 of 1 November 1945 describes it. Columns 81-89 were added by the
 * conversion and say where the card was filmed, which is what lets a reading
 * here be cited: roll and frame.
 */
const CARD = {
  asn: [1, 8],
  name: [9, 32],
  residenceState: [33, 34],
  residenceCounty: [35, 37],
  placeOfEnlistment: [38, 41],
  dateOfEnlistment: [42, 47], // DDMMYY
  gradeAlpha: [48, 50],
  gradeCode: [51, 52],
  branchAlpha: [53, 55],
  branchCode: [56, 57],
  termOfEnlistment: [59, 59],
  source: [63, 63],
  nativity: [64, 65],
  yearOfBirth: [66, 67],
  race: [68, 68],
  education: [69, 69],
  civilianOccupation: [70, 72],
  maritalStatus: [73, 73],
  height: [74, 75],
  weight: [76, 78],
  component: [79, 79],
  roll: [81, 84],
  frame: [85, 89],
};

// ---------------------------------------------------------------- fetching

/** Pull the zip and inflate its single entry, without leaving the zip behind. */
async function fetchData() {
  if (existsSync(DAT)) {
    process.stderr.write(`already have ${DAT}\n`);
    return;
  }
  mkdirSync(WORK, { recursive: true });
  const zip = resolve(WORK, "ASNEF.FIN.zip");
  if (!existsSync(zip)) {
    process.stderr.write(`fetching ${ZIP_URL}\n`);
    const res = await fetch(ZIP_URL);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching the card file`);
    await pipeline(res.body, createWriteStream(zip));
  }

  // One deflated entry. Read the local file header, skip to the data, inflate.
  const fd = openSync(zip, "r");
  const head = Buffer.alloc(30);
  readSync(fd, head, 0, 30, 0);
  if (head.readUInt32LE(0) !== 0x04034b50) throw new Error("not a zip file");
  const method = head.readUInt16LE(8);
  if (method !== 8) throw new Error(`unexpected compression method ${method}`);
  const start = 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
  closeSync(fd);

  process.stderr.write("inflating\n");
  await pipeline(createReadStream(zip, { start }), createInflateRaw(), createWriteStream(DAT));
  unlinkSync(zip);
}

// ---------------------------------------------------------------- the file

/** The card file, read by seeking rather than loading 837 MB into memory. */
class CardFile {
  constructor(path) {
    this.fd = openSync(path, "r");
    this.count = Math.floor(statSync(path).size / RECORD);
    this.buf = Buffer.alloc(RECORD);
  }

  at(i) {
    readSync(this.fd, this.buf, 0, RECORD, i * RECORD);
    return this.buf.toString("latin1", 0, 89);
  }

  /** Every card carrying this serial. The file is sorted on columns 1-8. */
  find(asn) {
    let lo = 0;
    let hi = this.count;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.at(mid).slice(0, 8) < asn) lo = mid + 1;
      else hi = mid;
    }
    const out = [];
    for (let i = lo; i < this.count; i++) {
      const rec = this.at(i);
      if (rec.slice(0, 8) !== asn) break;
      out.push(rec);
    }
    return out;
  }

  /** One pass over all 9.2 million cards, keeping those whose surname is wanted. */
  scanBySurname(surnames, keep) {
    const chunk = Buffer.alloc(RECORD * 4096);
    for (let i = 0; i < this.count; i += 4096) {
      const n = readSync(this.fd, chunk, 0, chunk.length, i * RECORD);
      for (let o = 0; o + RECORD <= n; o += RECORD) {
        const name = chunk.toString("latin1", o + 8, o + 32);
        const sp = name.indexOf(" ");
        if (sp <= 0) continue;
        if (!surnames.has(name.slice(0, sp))) continue;
        keep(chunk.toString("latin1", o, o + 89));
      }
    }
  }
}

const field = (rec, [a, b]) => rec.slice(a - 1, b);
const parseCard = (rec) => {
  const out = { raw: rec };
  for (const [key, span] of Object.entries(CARD)) out[key] = field(rec, span).trim();
  return out;
};

// ---------------------------------------------------------------- names

/** Surname and given names, upper case, no punctuation, no generational suffix. */
function normalise(name) {
  return name
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")
    .replace(/\b(JR|SR|II|III)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * The film writes "Last, First M"; the card writes "LAST FIRST M". Morning
 * report cards often write the surname alone, which still checks the serial —
 * just not as far.
 */
function filmName(name) {
  const parts = name
    .split(",")
    .map((p) => p.trim())
    .filter((p) => !/^(jr|sr|ii|iii)\.?$/i.test(p));
  const full = normalise(parts.join(" "));
  const [surname, ...given] = full.split(" ").filter(Boolean);
  return { full, surname: surname ?? "", given, surnameOnly: given.length === 0 };
}

/**
 * How close two readings of one name are, counting only characters. A clerk's
 * "Barthikowski" against the card's "BARTNIKOWSKI" is the same man; "Lipp,
 * Samuel" against "MUTI ELI W" is not.
 */
function similarity(a, b) {
  const x = a.replace(/ /g, "");
  const y = b.replace(/ /g, "");
  if (!x.length || !y.length) return 0;
  const d = levenshtein(x, y);
  return 1 - d / Math.max(x.length, y.length);
}

function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

const SAME_MAN = 0.72; // below this the card names somebody else

/** Which digits two serials differ in. */
function digitsApart(a, b) {
  if (a.length !== b.length) return null;
  const at = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) at.push(i + 1);
  return at;
}

// ---------------------------------------------------------------- the check

function serialsFromFilm() {
  const found = new Map(); // serial -> [{ page, document, name }]
  const add = (asn, entry) => {
    if (!/^\d{8}$/.test(asn)) return;
    if (!found.has(asn)) found.set(asn, []);
    found.get(asn).push(entry);
  };

  for (const { page, meta, body } of readPages(SRC)) {
    if (meta.duplicate_of) continue;
    if (meta.kind === "morning-report") {
      for (const card of parseCards(body)) {
        for (const p of card.personnel) {
          if (p.serial) add(p.serial.trim(), { page, document: "morning report", name: p.name });
        }
      }
    } else {
      for (const row of parseTable(body)) {
        if (row.asn) add(row.asn.trim(), { page, document: meta.document ?? "order", name: row.name });
      }
    }
  }
  return found;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--fetch")) await fetchData();

  if (!existsSync(DAT)) {
    process.stderr.write(
      `no card file at ${DAT}\n` +
        `run: node tools/nara-asn-crosscheck.mjs --fetch  (185 MB down, 837 MB on disk)\n`,
    );
    process.exit(2);
  }

  const film = serialsFromFilm();
  const cards = new CardFile(DAT);
  process.stderr.write(`${film.size} serials read off the film, ${cards.count} cards to search\n`);

  const agree = [];
  const spelling = [];
  const disagree = [];
  const absent = [];

  for (const [asn, entries] of [...film].sort()) {
    const read = filmName(entries[0].name);
    const matches = cards.find(asn);
    if (!matches.length) {
      absent.push({ asn, entries, read });
      continue;
    }
    const card = parseCard(matches[0]);
    const written = normalise(card.name);
    // A surname-only entry can only be checked against the card's surname.
    const against = read.surnameOnly ? written.split(" ")[0] : written;
    const score = similarity(read.full, against);
    const row = { asn, entries, read, card, score: Math.round(score * 100) / 100 };
    if (read.full === against) agree.push(row);
    else if (score >= SAME_MAN) spelling.push(row);
    else disagree.push(row);
  }

  // Where a serial landed on somebody else, or on nobody, look for the man
  // himself: if his card is one digit away, that names the misread column.
  // The rows where the card agrees are the control: their serials are right, so
  // any near miss found for them is a coincidence, and counting those says how
  // much weight a near miss deserves.
  const searchable = [...disagree, ...absent, ...agree];
  const surnames = new Set(searchable.map((r) => r.read.surname));
  const byName = new Map();
  if (surnames.size) {
    process.stderr.write(`searching the card file for ${surnames.size} surnames\n`);
    cards.scanBySurname(surnames, (rec) => {
      const key = normalise(rec.slice(8, 32));
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(rec);
    });
  }

  for (const row of searchable) {
    const { surname, given } = row.read;
    // A morning-report card often gives the surname alone, which can only be
    // searched on the surname. Those candidates are computed so the control can
    // measure them, and then not reported: the measurement says half the
    // surname-only serials the cards confirm also have a near miss, which makes
    // a surname-only near miss a coin flip.
    const named = [...byName].filter(([k]) => {
      const parts = k.split(" ");
      return parts[0] === surname && (given.length === 0 || parts[1] === given[0]);
    });
    // The fewer men of that name in the whole file, the stronger a near miss is.
    row.sameNameInFile = named.reduce((n, [, recs]) => n + recs.length, 0);
    row.candidates = named
      .flatMap(([, recs]) => recs)
      .map((rec) => ({ ...parseCard(rec), digitsApart: digitsApart(row.asn, rec.slice(0, 8)) }))
      .filter((c) => c.digitsApart?.length >= 1 && c.digitsApart.length <= 2)
      .sort((a, b) => a.digitsApart.length - b.digitsApart.length);
  }

  const rate = (rows) => ({
    serialsKnownRight: rows.length,
    withANearMiss: rows.filter((r) => r.candidates.length).length,
    cardsOfTheSameName: rows.reduce((n, r) => n + r.sameNameInFile, 0),
  });
  const control = {
    fullName: rate(agree.filter((r) => !r.read.surnameOnly)),
    surnameOnly: rate(agree.filter((r) => r.read.surnameOnly)),
  };

  report({ agree, spelling, disagree, absent, control });

  if (args.includes("--write")) {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(serialise({ agree, spelling, disagree, absent, control }), null, 2) + "\n");
    process.stderr.write(`wrote ${OUT}\n`);
  }
}

function report({ agree, spelling, disagree, absent, control }) {
  const checked = agree.length + spelling.length + disagree.length;
  const pad = (s, n) => String(s).padEnd(n);
  const surnameOnly = (rows) => rows.filter((r) => r.read.surnameOnly).length;

  console.log(`\nserials on a card         ${checked}`);
  console.log(`  same name               ${agree.length}  (${surnameOnly(agree)} surname only)`);
  console.log(`  same man, spelt apart   ${spelling.length}`);
  console.log(`  a different man         ${disagree.length}  (${surnameOnly(disagree)} surname only)`);
  console.log(`no card of that serial    ${absent.length}`);
  console.log(
    `\nhow much a near miss is worth, measured on serials the card confirms:\n` +
      `  full name given    ${control.fullName.withANearMiss} of ${control.fullName.serialsKnownRight}` +
      ` also have a card of the same name within two digits\n` +
      `  surname only       ${control.surnameOnly.withANearMiss} of ${control.surnameOnly.serialsKnownRight}`,
  );

  console.log(`\nspelt apart — the card is not the last word, but it is a second reading`);
  for (const r of spelling) {
    console.log(`  ${r.asn}  p${pad(r.entries[0].page, 4)} ${pad(r.entries[0].name, 26)} ${r.card.name}`);
  }

  const near = [...disagree, ...absent].filter((r) => r.candidates?.length && !r.read.surnameOnly);
  console.log(`\nthe film's man is on another card — the column named is the one to re-read`);
  for (const r of near) {
    const c = r.candidates[0];
    const occupant = r.card ? `card reads ${r.card.name}` : "no card of that serial";
    console.log(
      `  ${r.asn}  p${pad(r.entries[0].page, 4)} ${pad(r.entries[0].name, 24)} ${occupant}\n` +
        `                  ${pad("", 24)} ${c.name} is ${c.asn}, column ${c.digitsApart.join(" and ")}` +
        ` (${r.sameNameInFile} of that name in the file)`,
    );
  }

  const unfound = disagree.filter((r) => !r.read.surnameOnly && !r.candidates?.length);
  console.log(`\na different man, and no near serial of that name in the file`);
  for (const r of unfound) {
    console.log(
      `  ${r.asn}  p${pad(r.entries[0].page, 4)} ${pad(r.entries[0].name, 24)} ` +
        `card reads ${pad(r.card.name, 24)} (${r.sameNameInFile} of that name in the file)`,
    );
  }

  const bare = disagree.filter((r) => r.read.surnameOnly);
  console.log(
    `\nthe film gives a surname only, and the card's surname differs.` +
      ` No candidate is offered: on a surname alone a near miss is a coin flip.`,
  );
  for (const r of bare) {
    console.log(
      `  ${r.asn}  p${pad(r.entries[0].page, 4)} ${pad(r.entries[0].name, 24)} ` +
        `card reads ${pad(r.card.name, 24)} (${r.sameNameInFile} of that surname in the file)`,
    );
  }
}

/** Only what a reader would need to check the finding, and in a stable order. */
function serialise({ agree, spelling, disagree, absent, control }) {
  const trim = (r) => ({
    asn: r.asn,
    film: r.entries.map((e) => ({ page: e.page, document: e.document, name: e.name })),
    ...(r.read.surnameOnly ? { surnameOnly: true } : {}),
    ...(r.card ? { card: r.card, nameAgreement: r.score } : {}),
    // Zero men of that name in nine million cards is itself a finding: it puts
    // the name in question as well as the serial.
    ...(r.sameNameInFile === undefined ? {} : { sameNameInFile: r.sameNameInFile }),
    ...(r.candidates?.length && !r.read.surnameOnly
      ? {
          candidates: r.candidates.map((c) => ({
            asn: c.asn,
            name: c.name,
            digitsApart: c.digitsApart,
            roll: c.roll,
            frame: c.frame,
          })),
        }
      : {}),
  });
  return {
    source: {
      title: "Electronic Army Serial Number Merged File, ca. 1938 - 1946",
      naId: 1263923,
      recordGroup: "RG 64, Records of the National Archives and Records Administration",
      url: "https://catalog.archives.gov/id/1263923",
      records: 9200232,
      note:
        "One punch card per man entering the Army, 1938-46, converted from 1,586 rolls of " +
        "16mm film. NARA compared 377 records against the original cards and found errors in " +
        "5 serial numbers and 18 names, so the file is a second reading, not an authority.",
    },
    layout: CARD,
    control,
    counts: {
      agree: agree.length,
      spelling: spelling.length,
      disagree: disagree.length,
      absent: absent.length,
    },
    agree: agree.map(trim),
    spelling: spelling.map(trim),
    disagree: disagree.map(trim),
    absent: absent.map(trim),
  };
}

await main();
