/* Stage 3C QA2 - the start, frame by frame, as evidence (development only; never served).
 *
 *   node dev/stage-3c-qa2/capture_boot.js [--game DIR] [--out DIR] [--port 9851]
 *
 * Three starts recorded with boot_capture.js and laid out by boot_sheet.py (contact sheets of the frames where the picture changed):
 *  - gate_desktop: 1280 x 720, Chromium as installed (it wants a gesture before sound), cold then warm (the music from Cache
 *    Storage); the gate's line is left up for 1.2 s, then a key press enters;
 *  - gate_phone: 390 x 844 touch, cold; the gate's line for 1.2 s, then a tap;
 *  - direct_desktop: 1280 x 720, Chromium told sound may start: no gate, cold then warm.
 * Writes OUT/boot_<tag>_<cold|warm>_sheet.jpg and OUT/boot_starts.json (per start: the boot timeline, the gate, the theme's
 * prepared / began times, the first paint, and the frame summary). */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), { spawnSync } = require('child_process');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const GAME = path.resolve(opt('game', path.join(__dirname, '..', '..'))), OUT = path.resolve(opt('out', path.join(__dirname, 'evidence', 'q3', 'boot'))), PORT = +opt('port', 9851);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'qa2boot-'));
const RUNS = [
  ['gate_desktop', ['--size', '1280x720', '--secs', '16', '--warm', '1', '--gesture', '1', '--gesture-after', '1200']],
  ['gate_phone', ['--size', '390x844m', '--secs', '16', '--gesture', '1', '--gesture-how', 'tap', '--gesture-after', '1200']],
  ['direct_desktop', ['--size', '1280x720', '--secs', '13', '--warm', '1', '--autoplay', '1']]];
fs.mkdirSync(OUT, { recursive: true });
const all = {}; let bad = 0;
for (const [tag, args] of RUNS) {
  const r = spawnSync('node', [path.join(__dirname, 'boot_capture.js'), '--game', GAME, '--out', TMP, '--tag', tag, '--port', String(PORT)].concat(args), { encoding: 'utf8', timeout: 300000 });
  if (r.status !== 0) { bad++; console.log(tag, 'capture failed', (r.stderr || r.stdout).slice(0, 400)); }
  const s = spawnSync('python3', ['-I', path.join(__dirname, 'boot_sheet.py'), TMP, tag], { encoding: 'utf8', timeout: 300000 });
  if (s.status !== 0) { bad++; console.log(tag, 'sheet failed', s.stderr.slice(0, 400)); continue; }
  const J = JSON.parse(fs.readFileSync(path.join(TMP, tag + '.json'), 'utf8'));
  all[tag] = { size: J.size, autoplayFlag: J.autoplayFlag, errors: J.errors, runs: J.runs.map(x => ({ kind: x.kind, gestureAt: x.gestureAt, summary: x.summary, paints: x.page.paints, boot: x.page.boot, gate: x.page.gate, theme: x.page.theme, uiState: x.page.uiState })) };
  for (const k of ['cold', 'warm']) { const f = path.join(TMP, `${tag}_${k}_sheet.jpg`); if (fs.existsSync(f)) fs.copyFileSync(f, path.join(OUT, `boot_${tag}_${k}_sheet.jpg`)); }
  for (const x of all[tag].runs) console.log(tag, x.kind, JSON.stringify({ timeline: x.boot && x.boot.timeline, gate: x.gate && [x.gate.gate, x.gate.passedBy], theme: x.theme && [x.theme.state, x.theme.preparedAt, x.theme.beganAt, x.theme.fetched, x.theme.cacheHits], firstPaint: (x.paints.find(p => p[0] === 'first-paint') || [])[1] }));
}
fs.writeFileSync(path.join(OUT, 'boot_starts.json'), JSON.stringify(all, null, 1) + '\n');
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { }
console.log(bad ? 'ERRORS ' + bad : 'done');
process.exit(bad ? 1 : 0);
