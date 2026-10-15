/* Stage 3H continuation (C3a) - is an early death more likely with the sim's modules?  (development only; reads B++'s sim from Git)
 *
 *   node dev/stage-3h-modernization/tools/c3a_early_death_check.js [--seeds 150] [--secs 60] [--out FILE.json]
 *
 * C3a's first full gate failed one browser check because a Smiler killed a player before the check's admin had removed the monsters
 * (dev/stage-3d-hq4/gameplay_smoke.py: the real server picks a random world seed, so the monsters start somewhere new each run).  The
 * question is whether the sim's modules make that more likely.  For every world seed, B++'s sim.js and this tree's sim each get two
 * players who join as the server joins them, put themselves on open floor near the start (spawnOk, as a client's choice is checked),
 * then turn slowly and take a short step every 2 s (moveOk, gaitFloor) for --secs of sim time at 60 Hz.  Every death is recorded with
 * its time.  The two sims must give the same deaths, at the same moments, for every seed; how many worlds have a death is the base rate
 * of such a death, the same for both. */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..'), BPP = '143b63ff42b88c6780c5043e0f61d64100f81f40';
const ARG = { seeds: '150', secs: '60' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const N = +ARG.seeds, SECS = +ARG.secs, LAYOUT = require(path.join(REPO, 'dev', 'tools', 'layout.js'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c3a-deaths-'));
for (const f of ['sim', 'ai', 'world']) fs.writeFileSync(path.join(tmp, f + '.js'), execFileSync('git', ['-C', REPO, 'show', `${BPP}:${f}.js`]));
const OLD = require(path.join(tmp, 'sim.js')), NEW = require(LAYOUT.at('sim.js'));
const R = { tool: 'dev/stage-3h-modernization/tools/c3a_early_death_check.js', old: `${BPP.slice(0, 7)}: sim.js`, new: path.relative(REPO, LAYOUT.at('sim.js')), seeds: N, secs: SECS, different: [], worldsWithDeath: 0, deaths: [], ok: true };
for (let seed = 1; seed <= N; seed++) {
  const out = [OLD, NEW].map(create => {
    const deaths = []; let t = 0;
    const s = create({ seed, onDeath: p => deaths.push([p.id, p.dead, +t.toFixed(3)]) });
    const a = s.addPlayer(1), b = s.addPlayer(3);
    s.join(a); s.join(b);
    for (const [p, dx] of [[a, 0], [b, 60]]) for (let k = 0; k < 60; k++) { const x = 960 + dx + (k % 8) * 48, y = 3264 + Math.floor(k / 8) * 48; if (s.spawnOk(x, y)) { p.x = x; p.y = y; break; } }
    let r = seed * 7 + 1; const rand = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
    for (let i = 0; i < SECS * 60; i++) {
      t += 1 / 60;
      for (const p of [a, b]) {
        if (p.dead || !p.active) continue;
        p.angle += .04;
        if (i % 120 === 60) { const ang = rand() * Math.PI * 2, nx = p.x + Math.cos(ang) * 40, ny = p.y + Math.sin(ang) * 40; if (s.moveOk(p.x, p.y, nx, ny, 60)) { p.x = nx; p.y = ny; p.obsV = 80; s.gaitFloor(p, false); } }
      }
      s.step(1 / 60);
    }
    return JSON.stringify([deaths, s.entities().h.length, s.entities().m.length]);
  });
  if (out[0] !== out[1]) { R.different.push(seed); R.ok = false; }
  const d = JSON.parse(out[0])[0]; if (d.length) { R.worldsWithDeath++; R.deaths.push({ seed, first: d[0] }); }
}
fs.rmSync(tmp, { recursive: true, force: true });
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`${N} world seeds, ${SECS} s each: worlds where B++'s sim and this one differ: ${R.different.length}; worlds with a death: ${R.worldsWithDeath} (the same on both)`);
console.log('first deaths (seed: player, killer, time): ' + R.deaths.map(x => `${x.seed}: ${x.first.join(' ')}`).join('; '));
console.log(`EARLY DEATH CHECK: ${R.ok ? 'SAME' : 'DIFFERENT'}`);
process.exitCode = R.ok ? 0 : 1;
