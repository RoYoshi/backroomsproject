#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/c15_hashes.js - C15: with no Skin-Stealer, a world runs exactly as on R8 (development tool and the
 * fixture's maker; Trial 3 is not owner-approved).
 *
 *   node dev/trial-3-r9-overhaul/tools/c15_hashes.js [--repo DIR] [--out FILE.json]      (the fixture: --repo an R8 f378049 tree)
 *   require(...).hashes(DIR)                                                              (s_skinmind.js C15: this tree)
 *
 * DIR's own harness and sim (dev/harness.js: sim.js + ai.js as built), the director on (its own Hounds and Smilers), four scripted
 * players walking seeded routes, 30 s; once a second the SHA-256 of the engine's snapshot (every Hound's and Smiler's place, facing,
 * state, act) and of the players' places.  Seeds 11, 12, 13. */
'use strict';
const path = require('path'), crypto = require('crypto'), fs = require('fs');
const mkRng = s => () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function hashes(repo) {
  const H = require(path.join(path.resolve(repo), 'dev', 'harness.js')), out = {};
  for (const seed of [11, 12, 13]) {
    const w = H.World(seed, { director: true }); w.sim.resetWorld();
    const R = mkRng(seed * 7 + 1), floors = [];
    for (let k = 0; k < 4000 && floors.length < 200; k++) { const x = 300 + R() * 9000, y = 300 + R() * 6000; if (w.ad.clear(x, y, 20, 'walk')) floors.push({ x: Math.round(x), y: Math.round(y) }); }
    const ps = []; for (let i = 0; i < 4; i++) { const f = floors[(i * 37) % floors.length]; const p = w.player(f.x, f.y, { light: i !== 3 }); p.stop('stand'); ps.push(p); }
    const hs = [];
    w.run(30, (ww, t) => {
      const n = Math.round(t * 60);
      if (n % 240 === 0) for (const [i, p] of ps.entries()) { const g = floors[Math.floor(R() * floors.length)]; p.pathTo(g.x, g.y, ['walk', 'run', 'crouch', 'walk'][i]); }
      if (n % 60 === 0) hs.push(crypto.createHash('sha256').update(JSON.stringify(w.eng.snapshot()) + '|' + ps.map(p => [Math.round(p.x * 100), Math.round(p.y * 100), p.alive ? 1 : 0].join(',')).join(';')).digest('hex').slice(0, 16));
      return true;
    });
    out['seed' + seed] = hs;
  }
  return out;
}
if (require.main === module) {
  const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  const repo = path.resolve(ARG.repo || path.join(__dirname, '..', '..', '..')), r = { from: ARG.from || 'f378049 (R8)', runs: hashes(repo) };
  const txt = JSON.stringify(r, null, 1) + '\n'; if (ARG.out) fs.writeFileSync(ARG.out, txt); else process.stdout.write(txt);
}
module.exports = { hashes };
