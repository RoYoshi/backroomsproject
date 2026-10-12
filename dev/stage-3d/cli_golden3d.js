/* Stage 3D - 3H0's client golden traces (mp.js and its helpers in a fake-clock Chromium page), the accepted parent against the working
 * tree, with every difference sorted into death or not (development only).
 *
 *   node dev/stage-3d/cli_golden3d.js [--old-ref 06949a8] [--scenes a,b] [--out FILE.json] [--keep DIR]   (--keep: write both sides' traces)
 *
 * Runs dev/stage-3h0/golden/cli_lib.js's nine scenes on both sides.  3D's one new global, window.__dvic (mp.js: the victim's death starts
 * from the server's kill record), is declared like 3H0's own __mpLib: kept out of the strict trace and listed.  Then:
 *   - a scene whose traces are byte-identical passes;
 *   - otherwise both traces are put in their non-death view, and that must be identical.  Taken out, on both sides:
 *       the client's own death claims, which 3D no longer sends: a 'ws.send' of a death replay (t 'fx', k 'death') or of a corpse (t 'b',
 *       c not 'Vanish'), with the light-part lookup ('api.gear.parts') made for it just before at the same time;
 *       in the 'hb' field of the scene's state records, only the player's own corpse ('r' + the scene's own id; 3D hides the server's copy of
 *       your own corpse while you are still dying), and the size of window.__hideBodies in the page's global listings; every other
 *       hidden corpse must match (a state record left equal to the one before it by this is dropped, as the scene itself does);
 *       a corpse record's 'born' (its age, 3D) in 'api.bodies'.
 * Exit status 0 only if every scene passes. */
'use strict';
const fs = require('fs'), path = require('path');
const L = require(path.join(__dirname, '..', 'stage-3h0', 'golden', 'cli_lib.js'));
const ARG = { 'old-ref': '06949a8a4204a1ce8144b87b2192251b259b21ec' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const DECLARED_3D = ['__dvic'];
for (const g of DECLARED_3D) if (!L.NEWG.includes(g)) L.NEWG.push(g);
const SCENES = ARG.scenes ? ARG.scenes.split(',') : L.SCENES;
// Each scene's own player ids (its 'hi' messages): only the own corpse ('r' + id) may be hidden in 3D and not in the parent
const OWN = {}; { const src = fs.readFileSync(path.join(__dirname, '..', 'stage-3h0', 'golden', 'cli_scenes.js'), 'utf8'), parts = src.split(/\n  S\.(\w+) = async/);
  for (let i = 1; i < parts.length; i += 2) OWN[parts[i]] = [...new Set([...parts[i + 1].matchAll(/t: 'hi', id: (\d+)/g)].map(m => 'r' + m[1]))]; }

function claim(e) {
  if (!Array.isArray(e) || e[1] !== 'ws.send' || typeof e[3] !== 'string') return false;
  let m; try { m = JSON.parse(e[3]); } catch (x) { return false; }
  return (m.t === 'fx' && m.k === 'death') || (m.t === 'b' && m.c !== 'Vanish');
}
function nonDeath(T, own) {
  const out = []; let lastState = null;
  for (let i = 0; i < T.length; i++) {
    const e = T[i];
    if (claim(e)) { if (out.length && Array.isArray(out[out.length - 1]) && out[out.length - 1][1] === 'api.gear.parts' && out[out.length - 1][0] === e[0]) out.pop(); continue; }
    if (Array.isArray(e) && e[1] === 'api.bodies' && Array.isArray(e[2])) { out.push([e[0], e[1], e[2].map(r => { const o = Object.assign({}, r); delete o.born; return o; })].concat(e.slice(3))); continue; }
    if (Array.isArray(e) && e[1] === 'state' && e[2] && typeof e[2] === 'object') {
      const o = Object.assign({}, e[2]); if (Array.isArray(o.hb)) o.hb = o.hb.filter(k => !own.includes(k));
      const d = JSON.stringify(o); if (d === lastState) continue; lastState = d;   // the scene records state only when it changes
      out.push([e[0], e[1], o].concat(e.slice(3))); continue; }
    if (Array.isArray(e) && e[2] && typeof e[2] === 'object' && Array.isArray(e[2].globals)) { const o = Object.assign({}, e[2], { globals: e[2].globals.map(g => g[0] === '__hideBodies' ? [g[0], '~'] : g) }); out.push([e[0], e[1], o].concat(e.slice(3))); continue; }
    out.push(e);
  }
  return out;
}
(async () => {
  const OLD = L.fromRef(ARG['old-ref']), NEW = L.fromTree(), browser = await L.launch();
  const report = { tool: 'dev/stage-3d/cli_golden3d.js', oldRef: ARG['old-ref'], declared3d: DECLARED_3D, scenes: [], ok: true };
  for (const sc of SCENES) {
    const o = await L.runScene(browser, OLD, sc), n = await L.runScene(browser, NEW, sc);
    const A = JSON.parse(o.trace), B = JSON.parse(n.trace);
    if (ARG.keep) { fs.mkdirSync(ARG.keep, { recursive: true }); fs.writeFileSync(path.join(ARG.keep, sc + '.old.json'), o.trace); fs.writeFileSync(path.join(ARG.keep, sc + '.new.json'), n.trace); }
    const R = { scene: sc, oldEntries: A.length, newEntries: B.length, identical: o.trace === n.trace, errors: o.errs.concat(n.errs),
      globalsOnlyInNew: n.globals.filter(g => !o.globals.includes(g)), globalsOnlyInOld: o.globals.filter(g => !n.globals.includes(g)) };
    R.undeclared = R.globalsOnlyInNew.filter(g => !L.NEWG.includes(g)).concat(R.globalsOnlyInOld);
    if (!R.identical) {
      const a = nonDeath(A, OWN[sc] || []), b = nonDeath(B, OWN[sc] || []); let fd = -1;
      for (let i = 0; i < Math.max(a.length, b.length); i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) { fd = i; break; }
      R.removed = { old: A.length - a.length, new: B.length - b.length, claimsOld: A.filter(claim).length, claimsNew: B.filter(claim).length };
      R.nonDeathIdentical = fd < 0;
      if (fd >= 0) R.firstNonDeathDiff = { index: fd, old: JSON.stringify(a[fd] || null).slice(0, 400), new: JSON.stringify(b[fd] || null).slice(0, 400) };
    }
    R.ok = (R.identical || R.nonDeathIdentical) && !R.undeclared.length && !R.errors.length;
    report.ok = report.ok && R.ok; report.scenes.push(R);
    console.log(`${R.ok ? 'PASS' : 'FAIL'} ${sc}: ${R.identical ? 'IDENTICAL' : 'differs; non-death view ' + (R.nonDeathIdentical ? 'identical' : 'DIFFERS at ' + R.firstNonDeathDiff.index) + ` (removed: old ${R.removed.old}, new ${R.removed.new}; client death claims: old ${R.removed.claimsOld}, new ${R.removed.claimsNew})`}` +
      (R.globalsOnlyInNew.length ? ' | new globals: ' + R.globalsOnlyInNew.join(',') : '') + (R.undeclared.length ? ' | UNDECLARED: ' + R.undeclared.join(',') : '') + (R.errors.length ? ' | errors ' + R.errors.length : ''));
    if (R.firstNonDeathDiff) console.log('   old: ' + R.firstNonDeathDiff.old + '\n   new: ' + R.firstNonDeathDiff.new);
  }
  await browser.close();
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(report, null, 1) + '\n');
  console.log(report.ok ? 'CLIENT GOLDEN 3D: every non-death output identical' : 'CLIENT GOLDEN 3D: FAIL');
  process.exitCode = report.ok ? 0 : 1;
})();
