/**
 * Searches the National Archives catalogue export for a pattern, including the
 * OCR of every digitised page.
 *
 *   node tools/nara-catalog-grep.mjs 407 'FABN.?153|FAGP.?79'
 *   node tools/nara-catalog-grep.mjs 407 '153(d|rd) Field Artillery' --context 300
 *
 * The Archives publish their whole catalogue as a public S3 bucket,
 * `s3://nara-national-archives-catalog` in us-east-2 — JSONL, one prefix per
 * record group, no credentials. Each record carries an `extractedText` field
 * holding the OCR of its digitised images. The Catalog API does not search that
 * field, and its own search ranks loosely enough to return a hit for almost any
 * query, so a phrase that matters has to be looked for here instead.
 *
 * This streams and discards rather than downloading: RG 407, the Adjutant
 * General's Office and so the home of the WWII operations reports, is 12 GB
 * across 400 shards and sweeps in under a minute. RG 64 is 180 GB and will not
 * sweep in reasonable time — but the morning-report and general-order file units
 * in it are titled only by roll and month, with no unit named anywhere in the
 * record, so there is nothing in them for a pattern to find.
 *
 * It is how `FABN-153-0.1` and Box 15969 were found. See README.
 */
import { createInterface } from "node:readline";
import { Readable } from "node:stream";

const BUCKET = "https://nara-national-archives-catalog.s3.us-east-2.amazonaws.com";
const SHARDS = 400; // every record group is sharded into the same number of files
const PARALLEL = 8;

const [group, pattern, ...rest] = process.argv.slice(2);
if (!group || !pattern) {
  process.stderr.write(
    "usage: node tools/nara-catalog-grep.mjs <record-group> <regex> [--context N]\n",
  );
  process.exit(2);
}
const contextArg = rest.indexOf("--context");
const CONTEXT = contextArg === -1 ? 200 : Number(rest[contextArg + 1]);
const re = new RegExp(pattern, "i");

/** One shard, line by line, held only as long as it takes to test it. */
async function sweep(n) {
  const res = await fetch(`${BUCKET}/descriptions/record-groups/rg_${group}/rg_${group}-${n}.jsonl`);
  if (!res.ok) return [];
  const hits = [];
  const lines = createInterface({ input: Readable.fromWeb(res.body), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!re.test(line)) continue;
    try {
      hits.push(JSON.parse(line).record);
    } catch {
      // A truncated line is a shard boundary artefact, not a record.
    }
  }
  return hits;
}

const found = [];
let done = 0;
const queue = Array.from({ length: SHARDS }, (_, i) => i + 1);
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
      found.push(...(await sweep(n)));
      if (++done % 50 === 0) process.stderr.write(`${done}/${SHARDS} shards, ${found.length} hits\n`);
    }
  }),
);

for (const r of found.sort((a, b) => (a.naId ?? 0) - (b.naId ?? 0))) {
  const series = r.ancestors?.find((a) => a.levelOfDescription === "series")?.title ?? "";
  console.log(`\n${r.naId}  ${r.levelOfDescription}  ${series}`);
  console.log(`  ${r.title ?? ""}`);
  console.log(`  https://catalog.archives.gov/id/${r.naId}`);
  const blob = JSON.stringify(r);
  const m = re.exec(blob);
  if (m) {
    const from = Math.max(0, m.index - CONTEXT);
    console.log(`  …${blob.slice(from, m.index + m[0].length + CONTEXT).replace(/\\n/g, " ")}…`);
  }
}
process.stderr.write(`\n${found.length} records matched in RG ${group}\n`);
