/* Stage 3H continuation (C3a) - B++'s sim and this tree's, side by side: the same calls must give the same results (development only; the
 * gate's sim step).
 *
 *   node dev/tools/gate/golden/sim_diff.js [--seeds 1,7,42,99,1234] [--ops 4000] [--out FILE.json] [--old-ref 143b63f]
 *   node dev/tools/gate/golden/sim_diff.js --mutants dev/tools/gate/golden/sim_mutants.js [--seeds 1,7] [--ops 1500] [--out FILE.json]
 *        each mutant applied to a copy of the sim's files (the composition, its modules, the built ai.js and world.js), in turn: the run
 *        must find a difference (the mutant is caught), which proves this run sees that seam
 *
 * The old side is the accepted B++ head's sim.js, with its ai.js and world.js, read from Git into a scratch folder (they load each other
 * there as they did in that game).  Until C3a the game ran exactly these bytes (M8's generated/server/sim.js, ai.js and world.js are
 * B++'s).  The new side is this tree's sim where the layout puts it (dev/tools/layout.js: src/core/server/sim.js, the composition of the
 * owners' modules), with the built ai.js and world.js it requires.  Both get the same options (a fixed seed, a body
 * lifetime, a death callback) and then the same calls, chosen by a seeded random stream: steps of four lengths, moves checked and made,
 * movement reports, pick-ups, bodies, NEW RUN / leave / join / respawn / forfeit, and every admin tool (freeze, speed, blackout, god,
 * debug, monster and world resets, new walls and cartograph, adding, removing, placing and summoning monsters, capture modes, the DEATHS
 * tab's preview kill and its end, spots, the nav command, where a kill ended).  After every call, what it returned and the world's
 * visible state (the snapshot's entities, the players' records, the admin's info, the getters) are serialised on both sides and must
 * be equal.  The goldens prove the same through the server's own traffic; this reaches every function of the sim's interface directly,
 * with many more seeds.  The counts of what happened (kills, pick-ups, resets ...) show what was reached. */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..', '..'), LAYOUT = require(path.join(REPO, 'dev', 'tools', 'layout.js'));
const ARG = { seeds: '1,7,42,99,1234', ops: '4000', 'old-ref': '143b63ff42b88c6780c5043e0f61d64100f81f40' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const R = { tool: 'dev/tools/gate/golden/sim_diff.js', old: `${ARG['old-ref'].slice(0, 7)}: sim.js, ai.js, world.js`, new: ARG.tree ? `a copy: ${ARG.tree}` : `this tree: ${LAYOUT.rel('sim.js')} and its modules`, seeds: ARG.seeds.split(',').map(Number), ops: +ARG.ops, comparisons: 0, differences: 0, first: [], reached: {}, ok: true };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c3sim-'));
const MODERN = (() => { try { execFileSync('git', ['-C', REPO, 'cat-file', '-e', `${ARG['old-ref']}:public/index.html`], { stdio: 'ignore' }); return true; } catch (e) { return false; } })();   // (C5) an old side on the modern layout (M8): generated/server/
for (const f of ['sim', 'ai', 'world']) fs.writeFileSync(path.join(tmp, f + '.js'), execFileSync('git', ['-C', REPO, 'show', `${ARG['old-ref']}:${MODERN ? 'generated/server/' : ''}${f}.js`]));
/* --mutants: this file runs itself once per mutant, on a copy of the sim's files with that mutant applied (--tree), and reports */
if (ARG.mutants) {
  const files = LAYOUT.simFiles().concat([LAYOUT.rel('ai.js'), LAYOUT.rel('world.js')]);
  const M = require(path.resolve(ARG.mutants)), out = { tool: R.tool, mutants: [], ok: true };
  for (const m of M) {
    const dir = path.join(tmp, 'm_' + m.id), hits = [];
    for (const f of files) { const s = fs.readFileSync(path.join(REPO, f), 'utf8'); fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); const n = s.split(m.find).length - 1; if (n) hits.push([f, n]); fs.writeFileSync(path.join(dir, f), n === 1 ? s.replace(m.find, m.repl) : s); }
    if (hits.length !== 1 || hits[0][1] !== 1) { out.mutants.push({ id: m.id, caught: false, why: 'its text is not found exactly once' }); out.ok = false; console.log(`MISSED  ${m.id}: its text is not found exactly once`); continue; }
    const r = require('child_process').spawnSync(process.execPath, [__filename, '--tree', dir, '--old-ref', ARG['old-ref'], '--seeds', ARG.seeds === '1,7,42,99,1234' ? '1,7' : ARG.seeds, '--ops', ARG.ops === '4000' ? '1500' : ARG.ops], { encoding: 'utf8' });
    const caught = r.status === 1 && /SIM DIFF: DIFFERENT/.test(r.stdout), first = (/DIFFERENT \(seed \d+\) ([^\n]*)/.exec(r.stdout) || [])[1] || '';
    out.mutants.push({ id: m.id, file: hits[0][0], caught, first }); if (!caught) out.ok = false;
    console.log(`${caught ? 'CAUGHT ' : 'MISSED '} ${m.id} (${hits[0][0]}): ${m.why}${caught ? ' | first difference: ' + first.slice(0, 90) : ''}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
  console.log(`SIM DIFF MUTANTS: ${out.mutants.filter(x => x.caught).length} of ${M.length} caught`);
  process.exit(out.ok ? 0 : 1);
}
const NEW_TREE = ARG.tree ? path.resolve(ARG.tree) : REPO;
const oldCreate = require(path.join(tmp, 'sim.js')), newCreate = require(path.join(NEW_TREE, LAYOUT.rel('sim.js')));
const J = v => JSON.stringify(v, (k, x) => (x instanceof Map ? ['Map', [...x]] : x instanceof Set ? ['Set', [...x]] : typeof x === 'function' ? 'fn' : x));
const mkR = s => { let a = s >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hit = k => { R.reached[k] = (R.reached[k] || 0) + 1; };
for (const seed of R.seeds) {
  const deaths = [[], []];
  const S = [oldCreate({ seed, bodyTtl: 30, onDeath: p => deaths[0].push(p.id + ':' + p.dead) }), newCreate({ seed, bodyTtl: 30, onDeath: p => deaths[1].push(p.id + ':' + p.dead) })];
  const rand = mkR(seed * 31 + 5);
  const same = (what, f) => {
    R.comparisons++; const a = J(f(S[0], 0)), b = J(f(S[1], 1));
    if (a !== b) { R.differences++; R.ok = false; if (R.first.length < 10) R.first.push({ seed, what, old: a.slice(0, 600), new: b.slice(0, 600) }); }
    return a;
  };
  same('the object returned (keys, in order)', s => Object.keys(s));
  same('the first world', s => [s.entities(), s.glitches, s.runT, s.worldSeq, s.bodyVer, s.debugOn, s.admin.info(), s.debug.V, s.debug.Ic]);
  const ids = [1, 2, 3, 4];
  for (const id of ids) same('addPlayer ' + id, s => [s.addPlayer(id), s.players.length]);
  same('join', s => ids.map(id => s.join(s.players.find(p => p.id === id))));
  for (let t = 0; t < R.ops; t++) {
    const r = rand(), pid = ids[(rand() * ids.length) | 0], x = 300 + rand() * 8400, y = 300 + rand() * 6200, v = rand();
    const kind = r < .5 ? 'step' : r < .58 ? 'move' : r < .64 ? 'hear' : r < .69 ? 'take' : r < .73 ? 'body' : r < .8 ? 'life' : 'admin';
    const P = s => s.players.find(q => q.id === pid);
    if (kind === 'step') { const dt = [1 / 60, 1 / 30, .05, .25][(v * 4) | 0]; same(`${t} step ${dt}`, s => { s.step(dt); return [s.entities(), s.runT, s.bodyVer, s.players.map(p => [p.dead, p.caught, p.exited, p.safe, p.st, p.prof])]; }); hit('step'); }
    else if (kind === 'move') {
      same(`${t} move`, s => { const p = P(s); const ok = s.moveOk(p.x, p.y, x, y, 400), rt = s.moveRoute(p.x, p.y, x, y, 900);
        if (ok && v < .7) { p.x = x; p.y = y; p.obsV = v * 300; s.gaitFloor(p, v < .4); } return [ok, rt, s.spawnOk(x, y), s.clearAt(x, y, 20), s.blockersAt(x, y).length, p]; });
      hit('move');
    } else if (kind === 'hear') { same(`${t} hearMove`, s => [s.hearMove(P(s), { s: (v * 8) | 0, sp: v * 400, st: v * 100, ex: v < .2, ev: [[1, 50], [2, 20]] }), P(s)]); hit('hearMove'); }
    else if (kind === 'take') {
      const got = same(`${t} takeItem`, s => { const p = P(s), it = s.admin.nearestItem(p.x, p.y); if (it && v < .6) { p.x = it.x + 20; p.y = it.y; } return [s.takeItem(p), s.entities().it]; });
      if (/^\["cartograph"/.test(got)) hit('cartograph taken'); hit('takeItem');
    } else if (kind === 'body') { same(`${t} setBody`, s => { s.setBody(pid, { x: Math.round(x), y: Math.round(y), k: 'hound' }); return [s.bodyVer, [...s.bodies.keys()]]; }); hit('setBody'); }
    else if (kind === 'life') {
      const op = ['newRun', 'leave', 'join', 'respawn', 'forfeit'][(v * 5) | 0];
      const res = same(`${t} ${op}`, s => { const p = P(s), w = s.nrWhy(p, t / 10, v < .3); const out = op === 'newRun' ? s.newRun(p, t / 10, v < .3) : s[op](p); return [w, out, s.lifeOf(p), s.nrWait(p, t / 10), s.canRespawn(p), p]; });
      hit(op + (/^\["[a-z]*",(true|"")/.test(res) ? ' (done)' : ''));
    } else {
      const which = (v * 22) | 0;
      const res = same(`${t} admin ${which}`, s => {
        const A = s.admin, p = P(s);
        switch (which) {
          case 0: return [A.freeze(v < .5), A.info()];
          case 1: return [A.speed(v * 4), A.info()];
          case 2: return [A.blackout(['on', 'off', 'auto', 'x'][(v * 16) % 4 | 0]), A.info(), s.debug.V];
          case 3: return [A.god(p), A.debug(v < .5), s.debugOn, A.info()];
          case 4: return [A.resetMonsters(), s.runT, A.info()];
          case 5: return [A.resetWorld(), s.worldSeq, s.glitches, s.players, A.info()];
          case 6: return [A.newGlitches(), s.glitches, s.debug.glitches, A.info()];
          case 7: return [A.newItem(), A.nearestItem(x, y), A.info()];
          case 8: return [A.addHound(), A.addSmiler(), A.info()];
          case 9: return [A.removeHound(), A.removeSmiler(), A.info()];
          case 10: return [A.addNear(v < .5 ? 'hound' : 'smiler', p.x, p.y), A.info()];
          case 11: return [A.captureMode(['quick', 'play', 'auto'][(v * 9) % 3 | 0]), A.info()];
          case 12: return [A.previewKill(p, v < .5 ? 'hound' : 'smiler', (v * 5) | 0), p, A.info()];
          case 13: return [A.endPreview(p), A.info()];
          case 14: return [A.spotNear(p.x, p.y), A.entityAt(1), A.entityAt(2)];
          case 15: return [A.nearestGlitch(x, y)];
          case 16: return [A.summon(p.x, p.y, p.id), A.info()];
          case 17: return [A.removeEntity((v * 6) | 0), A.info()];
          case 18: return [s.navCmd(1, 'goto', { x, y }), s.killerEnd(1, x, y, v)];
          case 19: return [s.capInfo(p), s.debugInfo(), s.logSince(0).length, s.logSeq, s.engStats];
          case 20: return [s.resetWorld(), s.entities(), s.worldSeq];
          default: return [A.freeze(false), A.speed(1), A.blackout('auto'), A.info()];
        }
      });
      hit('admin ' + ['freeze', 'speed', 'blackout', 'god+debug', 'resetMonsters', 'resetWorld', 'newGlitches', 'newItem', 'add', 'remove', 'addNear', 'captureMode', 'previewKill', 'endPreview', 'spots', 'nearestGlitch', 'summon', 'removeEntity', 'nav+killerEnd', 'capInfo+debugInfo+log', 'sim.resetWorld', 'unfreeze'][which]);
      if (which === 12 && /^\[\{"ok":true/.test(res)) hit('previewKill ok');
    }
  }
  const d = same('the deaths the sim reported (onDeath)', (s, i) => deaths[i]); R.reached.deaths = (R.reached.deaths || 0) + JSON.parse(d).length;
  same('the final world', s => [s.entities(), s.players, s.admin.info(), s.runT, s.worldSeq, s.bodyVer, [...s.bodies], s.glitches, s.debugOn, s.logSeq]);
  same('removePlayer', s => { s.removePlayer(s.players[0]); return [s.players.length, s.entities()]; });
}
fs.rmSync(tmp, { recursive: true, force: true });
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`reached: ${Object.entries(R.reached).sort().map(([k, n]) => `${k} ${n}`).join(', ')}`);
for (const f of R.first) console.log(`DIFFERENT (seed ${f.seed}) ${f.what}\n  old ${f.old}\n  new ${f.new}`);
console.log(`SIM DIFF: ${R.ok ? 'SAME' : 'DIFFERENT'} - ${R.comparisons} comparisons over ${R.seeds.length} seeds, ${R.differences} differences`);
process.exitCode = R.ok ? 0 : 1;
