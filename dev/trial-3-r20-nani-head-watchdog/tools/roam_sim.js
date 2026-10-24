#!/usr/bin/env node
/* R20 A: one creature of --kind and --people (2) people who just explore (walk, sometimes run; no reaction to it); a person it kills is put back
 * far from it 5 s later.  For the stuck trace of every species in ordinary play.  node roam_sim.js --dir TREE --kind hound --mins 10 --seeds 8 */
'use strict';
const path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve(arg('dir')), KIND = arg('kind', 'hound'), MINS = +arg('mins', 10), SEEDS = +arg('seeds', 8), FROM = +arg('from', 1), NP = +arg('people', 2);
const L = require(path.join(DIR, 'dev', 'tests', 'lib.js')), { World, geo } = L;
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const out = [];
for (let seed = FROM; seed <= SEEDS; seed++) {
  const G = geo(), w = World(seed * 7907 + 18000), R0 = rng(seed + 11), g = w.eng.geo;
  const floor = (near, lo, hi) => { for (let k = 0; k < 400; k++) { const c = G.cells[Math.floor(R0() * G.cells.length)], x = g.cx(c), y = g.cy(c), d = near ? Math.hypot(x - near.x, y - near.y) : 0;
    if (w.ad.clear(x, y, 24, 'walk') && (!near || (d >= lo && d <= hi))) return { x, y }; } return null; };
  const s0 = floor(null), e = w.eng.spawn(KIND, s0.x, s0.y, KIND === 'skinstealer' ? { hunger: .55 } : {});
  const ppl = Array.from({ length: NP }, (_, i) => i).map(i => { const at = floor(e, 1400, 3500) || floor(null), p = w.player(at.x, at.y, { light: true }); p.stop('stand'); return { p, until: 0, dead: 0, r: rng(seed * 31 + i + 1) }; });
  let kills = 0;
  w.run(MINS * 60, (ww, t) => {
    for (const B of ppl) { const p = B.p;
      if (p.dead) { if (!B.dead) { B.dead = t; kills++; } if (t - B.dead > 5) { const at = floor(e, 1800, 4200) || floor(null); p.dead = false; p.alive = true; p.caught = false; p.x = at.x; p.y = at.y; p.stamina = 100; p.stop('stand'); B.dead = 0; } continue; }
      if ((!p.path || !p.path.length) && t > B.until) { const q = floor(p, 500, 1800); if (q) p.pathTo(q.x, q.y, B.r() < .2 ? 'run' : 'walk'); B.until = t + (B.r() < .3 ? 1 + B.r() * 4 : 0); }
    }
    return true;
  });
  out.push({ seed, kills });
}
console.log(JSON.stringify({ kind: KIND, tree: path.basename(DIR), runs: out }));
