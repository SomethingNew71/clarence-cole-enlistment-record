/**
 * Writes straightened, banded images for one PDF page so it can be transcribed.
 *
 *   node tools/deskew-page.mjs 248
 *
 * Output goes to .work/p<page>/ (gitignored). Deskewing is not optional: the
 * sheets sit up to ~1.6 degrees off square on the film, which over the width of
 * a page shifts the serial-number column by a full row against the names.
 *
 * Needs Python with pypdfium2, numpy and Pillow, and the source PDF path in
 * COLE_PDF (default ./cole.pdf). Set PYTHON to point at a specific interpreter;
 * a local .venv is picked up automatically, since macOS system Python is
 * externally managed and these packages will not install into it.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const page = Number(process.argv[2]);
// Auto-detection reads the row-ink profile, but the frames are nearly square
// (594x613pt) so it has little to go on and does get it wrong. When the bands
// come out sideways, say which way to turn the page: --rotate 0 or --rotate -90.
const rotArg = process.argv.indexOf("--rotate");
const forcedRotation = rotArg === -1 ? null : Number(process.argv[rotArg + 1]);
if (!Number.isInteger(page) || page < 1) {
  console.error("usage: node tools/deskew-page.mjs <pdf-page-number> [--rotate 0|-90]");
  process.exit(1);
}

const script = `
import numpy as np, pypdfium2 as pdfium, os, sys
from PIL import Image, ImageOps

src = os.environ.get('COLE_PDF', 'cole.pdf')
page = ${page}
out = os.path.join('.work', 'p%d' % page)
os.makedirs(out, exist_ok=True)

def best_angle(img):
    """Text lines are sharpest when horizontal: maximise row-ink variance."""
    a = np.asarray(img.convert('L'))
    best, ba = -1, 0.0
    for ang in np.arange(-2.5, 2.51, 0.1):
        r = np.asarray(Image.fromarray(a).rotate(ang, resample=Image.BILINEAR,
                                                 fillcolor=255, expand=False))
        v = (r < 128).mean(axis=1).var()
        if v > best: best, ba = v, ang
    return ba

d = pdfium.PdfDocument(src)
raw = d[page - 1].render(scale=4.2).to_pil().convert('L')

def upright(img):
    """Frames differ in orientation: the wide orders sit on their side, the
    morning-report cards sit upright. Text lines are horizontal in the correct
    one, so pick whichever rotation gives the stronger row-ink profile."""
    best, out = -1, img
    for ang in (0, -90):
        cand = img.rotate(ang, expand=True) if ang else img
        a = np.asarray(cand)
        v = (a < 128).mean(axis=1).var()
        if v > best:
            best, out = v, cand
    return out

forced = ${forcedRotation === null ? "None" : forcedRotation}
pil = upright(raw) if forced is None else (raw if forced == 0 else raw.rotate(forced, expand=True))
a = np.asarray(pil); b = a > 110
on = np.convolve(b.mean(axis=1), np.ones(25) / 25, mode='same') > 0.35
runs, i, H = [], 0, len(on)
while i < H:
    if on[i]:
        j = i
        while j < H and on[j]: j += 1
        if j - i > 250: runs.append((i, j))
        i = j
    else: i += 1

for si, (y0, y1) in enumerate(runs):
    cols = np.where(np.convolve(b[y0:y1].mean(axis=0), np.ones(25) / 25, mode='same') > 0.35)[0]
    if not len(cols): continue
    sh = pil.crop((cols[0], y0, cols[-1], y1))
    ang = best_angle(sh)
    sh = ImageOps.autocontrast(sh.rotate(ang, resample=Image.BICUBIC,
                                         fillcolor=255, expand=False), cutoff=1)
    w, h = sh.size
    n = max(1, round(h / 430))
    for bi in range(n):
        top, bot = int(h * bi / n), int(h * (bi + 1) / n)
        c = sh.crop((0, max(0, top - 10), w, min(h, bot + 10)))
        tw = 1500
        c = c.resize((tw, max(40, int(c.height * tw / c.width))), Image.LANCZOS)
        c.save(os.path.join(out, 'sheet%d_band%d.png' % (si, bi)))
    print('sheet %d: deskewed %+.1f deg, %d bands' % (si, ang, n))
print('written to', out)
`;

const venv = resolve(ROOT, ".venv/bin/python");
const python = process.env.PYTHON ?? (existsSync(venv) ? venv : "python3");
const res = spawnSync(python, ["-c", script], { cwd: ROOT, stdio: "inherit" });
process.exit(res.status ?? 1);
