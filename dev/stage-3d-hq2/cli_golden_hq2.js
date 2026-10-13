/* Stage 3D HQ2 - 3H0's client golden traces (mp.js and its helpers in a fake-clock Chromium page), the accepted HQ1 parent against the
 * working tree, with every difference sorted into "death", "HQ2's NEW RUN" or "not" (development only).
 *
 *   node dev/stage-3d-hq2/cli_golden_hq2.js [--old-ref ebb3bd6...] [--scenes a,b] [--out FILE.json] [--keep DIR]   (--keep: both traces)
 *
 * dev/stage-3d/cli_golden3d.js's method and normalisation, unchanged (that tool is left as it was: it declares 3D's globals only, and so
 * reports HQ2's three as undeclared).  Here:
 *   declared, like 3H0's own __mpLib (kept out of the strict trace and listed): 3D's __dvic, HQ1's __deathLight, and HQ2's
 *     __nrDebug (H2-1: the NEW RUN button's last request and answer, for the tests), __epochDebug (H2-4: the world number and what the
 *     page dropped for it, for the tests), __peerBodies (H2-4: the solid other players, for move.js);
 *   the non-death view (cli_golden3d.js's, word for word) and then HQ2's documented client deltas, on both sides:
 *     the client's own vanish claims, which HQ2 no longer sends (the server makes the blast from the 'nr' intent): a 'ws.send' of
 *       {t:'fx', k:'vanish'} or of a corpse {t:'b', c:'Vanish'}, with the light-part lookup ('api.gear.parts') made for it just before at
 *       the same time;
 *     'nr' (H2-1: the intent's sender) in window.__net's listing.
 *   A scene passes if its traces are identical, or its normalised views are identical, with nothing undeclared, no page error, and not
 *   one vanish claim sent by the working tree.
 * Exit status 0 only if every scene passes. */
'use strict';
const fs = require('fs'), path = require('path');
const L = require(path.join(__dirname, '..', 'stage-3h0', 'golden', 'cli_lib.js'));
const ARG = { 'old-ref': 'ebb3bd603e8a2bb4ef00cc40aa6b415bccab9763' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const DECLARED = ['__dvic', '__deathLight', '__nrDebug', '__epochDebug', '__peerBodies'];
for (const g of DECLARED) if (!L.NEWG.includes(g)) L.NEWG.push(g);
const SCENES = ARG.scenes ? ARG.scenes.split(',') : L.SCENES;
const OWN = {}; { const src = fs.readFileSync(path.join(__dirname, '..', 'stage-3h0', 'golden', 'cli_scenes.js'), 'utf8'), parts = src.split(/\n  S\.(\w+) = async/);
  for (let i = 1; i < parts.length; i += 2) OWN[parts[i]] = [...new Set([...parts[i + 1].matchAll(/t: 'hi', id: (\d+)/g)].map(m => 'r' + m[1]))]; }

const sent = e => { if (!Array.isArray(e) || e[1] !== 'ws.send' || typeof e[3] !== 'string') return null; try { return JSON.parse(e[3]); } catch (x) { return null; } };
const claim = e => { const m = sent(e); return !!m && ((m.t === 'fx' && m.k === 'death') || (m.t === 'b' && m.c !== 'Vanish')); };   // cli_golden3d.js's
const vanishClaim = e => { const m = sent(e); return !!m && ((m.t === 'fx' && m.k === 'vanish') || (m.t === 'b' && m.c === 'Vanish')); };   // HQ2
function view(T, own) {                                    // cli_golden3d.js's nonDeath, with HQ2's two deltas
  const out = []; let lastState = null;
  for (let i = 0; i < T.length; i++) {
    const e = T[i];
    if (claim(e) || vanishClaim(e)) { if (out.length && Array.isArray(out[out.length - 1]) && out[out.length - 1][1] === 'api.gear.parts' && out[out.length - 1][0] === e[0]) out.pop(); continue; }
    if (Array.isArray(e) && e[1] === 'api.bodies' && Array.isArray(e[2])) { out.push([e[0], e[1], e[2].map(r => { const o = Object.assign({}, r); delete o.born; return o; })].concat(e.slice(3))); continue; }
    if (Array.isArray(e) && e[1] === 'state' && e[2] && typeof e[2] === 'object') {
      const o = Object.assign({}, e[2]); if (Array.isArray(o.hb)) o.hb = o.hb.filter(k => !own.includes(k));
      if (Array.isArray(o.pl)) o.pl = o.pl.filter(q => q && 'ir' in q);
      const d = JSON.stringify(o); if (d === lastState) continue; lastState = d;
      out.push([e[0], e[1], o].concat(e.slice(3))); continue; }
    if (Array.isArray(e) && e[2] && typeof e[2] === 'object' && Array.isArray(e[2].globals)) {
      const o = Object.assign({}, e[2], { globals: e[2].globals.map(g => g[0] === '__hideBodies' ? [g[0], '~'] : g) });
      if (Array.isArray(o.net)) o.net = o.net.filter(g => !(Array.isArray(g) && g[0] === 'nr' && g[1] === 'function'));   // HQ2 (H2-1)
      out.push([e[0], e[1], o].concat(e.slice(3))); continue; }
    out.push(e);
  }
  return out;
}
(async () => {
  const OLD = L.fromRef(ARG['old-ref']), NEW = L.fromTree(), browser = await L.launch();
  const report = { tool: 'dev/stage-3d-hq2/cli_golden_hq2.js', oldRef: ARG['old-ref'], declared: DECLARED, scenes: [], ok: true };
  for (const sc of SCENES) {
    const o = await L.runScene(browser, OLD, sc), n = await L.runScene(browser, NEW, sc);
    const A = JSON.parse(o.trace), B = JSON.parse(n.trace);
    if (ARG.keep) { fs.mkdirSync(ARG.keep, { recursive: true }); fs.writeFileSync(path.join(ARG.keep, sc + '.old.json'), o.trace); fs.writeFileSync(path.join(ARG.keep, sc + '.new.json'), n.trace); }
    const R = { scene: sc, oldEntries: A.length, newEntries: B.length, identical: o.trace === n.trace, errors: o.errs.concat(n.errs),
      globalsOnlyInNew: n.globals.filter(g => !o.globals.includes(g)), globalsOnlyInOld: o.globals.filter(g => !n.globals.includes(g)),
      vanishClaims: { old: A.filter(vanishClaim).length, new: B.filter(vanishClaim).length }, deathClaims: { old: A.filter(claim).length, new: B.filter(claim).length } };
    R.undeclared = R.globalsOnlyInNew.filter(g => !L.NEWG.includes(g)).concat(R.globalsOnlyInOld);
    if (!R.identical) {
      const a = view(A, OWN[sc] || []), b = view(B, OWN[sc] || []); let fd = -1;
      for (let i = 0; i < Math.max(a.length, b.length); i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) { fd = i; break; }
      R.removed = { old: A.length - a.length, new: B.length - b.length };
      R.viewIdentical = fd < 0;
      if (fd >= 0) R.firstDiff = { index: fd, old: JSON.stringify(a[fd] || null).slice(0, 400), new: JSON.stringify(b[fd] || null).slice(0, 400) };
    }
    R.ok = (R.identical || R.viewIdentical) && !R.undeclared.length && !R.errors.length && R.vanishClaims.new === 0;
    report.ok = report.ok && R.ok; report.scenes.push(R);
    console.log(`${R.ok ? 'PASS' : 'FAIL'} ${sc}: ${R.identical ? 'IDENTICAL' : 'differs; normalised view ' + (R.viewIdentical ? 'identical' : 'DIFFERS at ' + R.firstDiff.index) + ` (removed: old ${R.removed.old}, new ${R.removed.new})`}` +
      ` | vanish claims sent: HQ1 ${R.vanishClaims.old}, HQ2 ${R.vanishClaims.new} | death claims: HQ1 ${R.deathClaims.old}, HQ2 ${R.deathClaims.new}` +
      (R.globalsOnlyInNew.length ? ' | new globals: ' + R.globalsOnlyInNew.join(',') : '') + (R.undeclared.length ? ' | UNDECLARED: ' + R.undeclared.join(',') : '') + (R.errors.length ? ' | errors ' + R.errors.length : ''));
    if (R.firstDiff) console.log('   old: ' + R.firstDiff.old + '\n   new: ' + R.firstDiff.new);
  }
  await browser.close();
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(report, null, 1) + '\n');
  console.log(report.ok ? 'CLIENT GOLDEN HQ2: every output identical apart from the declared globals, the death claims (3D) and the vanish claims (HQ2)' : 'CLIENT GOLDEN HQ2: FAIL');
  process.exitCode = report.ok ? 0 : 1;
})();
