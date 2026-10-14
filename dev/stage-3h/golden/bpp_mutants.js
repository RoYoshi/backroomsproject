/* Stage 3H - are the B++ golden traces sensitive?  One-line changes ("mutants") of the server code, each run through the scenario that should
 * notice it (development only; never served; changes no file in the repository).
 *
 *   node dev/stage-3h/golden/bpp_mutants.js [--ref REF] [--only id,id] [--out FILE.json]
 *
 * The server's files (server.js, server/*.js, sim.js, ai.js, world.js, death_srv.js, dphys.js) are copied into a scratch folder - from the
 * working tree, or from Git at --ref.  For every mutant, the one file among them that contains its text exactly once is changed there (the
 * tool refuses a mutant whose text is found in no file, twice in a file, or in two files: that mutant is MISSED), the scenarios are run in
 * Stage 3H0's closed-world harness with srv_scenarios_bpp.js, and each trace is compared with the unchanged copy's trace of the same
 * scenario.  "caught" means a trace differs.  Because the text is looked up wherever it now lives, a mutant follows code that a 3H step
 * moved into a module (e.g. NEW RUN's into server/newrun.js).  Exit 0 only when every mutant is caught.
 * (Stage 3H1 ran this with server.js from Git and the working tree's other files; Stage 3H2 copies the whole server side, so that code
 * moved out of server.js is mutated too.) */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const HERE = __dirname, REPO = path.resolve(HERE, '..', '..', '..'), HARNESS = path.join(REPO, 'dev', 'stage-3h0', 'golden', 'srv_harness.js'), SCEN_FILE = path.join(HERE, 'srv_scenarios_bpp.js');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const MUTANTS = [
  { id: 'guard_off', scenarios: ['bpp_place_guard', 'bpp_world_guard'], find: 'if (pl && now < v.grace && now - pl[2] < MV.GRACE', repl: 'if (false && pl && now < v.grace && now - pl[2] < MV.GRACE', why: "B++-0's placement guard removed (B+'s behaviour)" },
  { id: 'grace_1000', scenarios: ['bpp_known_limits'], find: 'SNAP: 220, GRACE: 900 }', repl: 'SNAP: 220, GRACE: 1000 }', why: 'the grace after a placement 100 ms longer' },
  { id: 'admin_checked', scenarios: ['bpp_known_limits'], find: 'if (me.admin) { if (!me.mv) mvReset(me, false); adminMove(', repl: 'if (me.admin && false) { if (!me.mv) mvReset(me, false); adminMove(', why: "an admin's own poses checked like anyone's" },
  { id: 'fast_gap_30', scenarios: ['bpp_caps_q'], find: 'const FAST_GAP = 16;', repl: 'const FAST_GAP = 30;', why: "B+'s faster pose intake off" },
  { id: 'q_self', scenarios: ['bpp_caps_q'], find: 'const p = ch.filter(q => q[0] !== c.id);', repl: 'const p = ch;', why: "'q' also carries the receiver's own pose" },
  { id: 'nr_gap_200', scenarios: ['bpp_new_run'], find: 'const NR_GAP = 250;', repl: 'const NR_GAP = 200;', why: "NEW RUN's flood gap 50 ms shorter" },
  { id: 'nr_wait_round', scenarios: ['bpp_new_run'], find: 'ans.wait = Math.ceil(sim.nrWait(p, t) * 10) / 10;', repl: 'ans.wait = Math.round(sim.nrWait(p, t) * 10) / 10;', why: 'the cooldown wait rounded instead of rounded up' },
  { id: 'nr_no_memory', scenarios: ['bpp_new_run'], find: 'me.nr = { q, ans }; send(me, ans);', repl: 'send(me, ans);', why: 'a repeated press decided again instead of answered again' },
  { id: 'nr_free_off', scenarios: ['bpp_new_run'], find: 'free = !!(me.admin && me.nrFree);', repl: 'free = false;', why: "an admin's UNLIMITED NEW RUN ignored" },
  { id: 'nr_held_free', scenarios: ['bpp_new_run_held'], find: "if(L===`held`)return`held`;", repl: "if(L===`held`)return``;", why: "a NEW RUN pressed while held is no longer refused (sim.nrWhy)" },
  /* Stage 3H2, before C-2: the death aftermath (bpp_aftermath).  (Not here: putBody's Math.min(Date.now(), at) - a corpse's age from its
   * death's end rather than from when the tick placed it.  The two differ by under 50 ms, and in the closed world a death's end falls on
   * the very snapshot tick that places its corpse, so the golden cannot see the difference: the mutant was tried and missed.) */
  { id: 'aft_el_half', scenarios: ['bpp_aftermath'], find: 'send(c, el > .25 ?', repl: 'send(c, el > .5 ?', why: "a late joiner's replay says how far it has run only after 0.5 s instead of 0.25 s" },
  { id: 'aft_every_tick', scenarios: ['bpp_aftermath'], find: 'if (!a.sent.has(c.id)) { a.sent.add(c.id); send(c, el', repl: 'if (!a.sent.has(c.id)) { send(c, el', why: 'the replay sent on every snapshot tick instead of once to each client' },
  { id: 'aft_victim_replay', scenarios: ['bpp_aftermath'], find: 'sent: new Set([c.id]), body: false, info, run });', repl: 'sent: new Set(), body: false, info, run });', why: 'the victim is sent its own death replay too' },
  { id: 'aft_one_per_player', scenarios: ['bpp_aftermath'], find: 'room.afts = (room.afts || []).filter(a => a.id !== c.id);', repl: 'room.afts = (room.afts || []);', why: "a player's second death no longer drops its first" },
  { id: 'aft_world_tick', scenarios: ['bpp_aftermath'], find: "if (room.sim.worldSeq !== a.world) { a.body = true; a.dropped = 'world reset'; continue; }", repl: "if (false) { a.body = true; a.dropped = 'world reset'; continue; }", why: 'a death from a world that is gone plays on and leaves a corpse' },
  { id: 'aft_killer_end', scenarios: ['bpp_aftermath'], find: "if (a.kill.k === 'Hound' && room.sim.killerEnd)", repl: "if (false && a.kill.k === 'Hound' && room.sim.killerEnd)", why: "the Hound is not placed where the death left it" },
  { id: 'aft_boom_revive', scenarios: ['bpp_aftermath'], find: '(room.afts || []).find(a => a.id === id && !a.body && !a.boom)', repl: '(room.afts || []).find(a => a.id === id && !a.body)', why: 'an admin revive also cancels a NEW RUN blast' },
  { id: 'aft_revive_end', scenarios: ['bpp_aftermath'], find: "if (c !== target) send(c, { t: 'fx', k: 'end', id: target.id, de: a.de });", repl: "if (false) send(c, { t: 'fx', k: 'end', id: target.id, de: a.de });", why: 'a revived death is not ended on the other screens' },
];
const SERVER_SIDE = ['server.js', 'sim.js', 'ai.js', 'world.js', 'death_srv.js', 'dphys.js'];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const ref = ARG.ref ? execFileSync('git', ['-C', REPO, 'rev-parse', ARG.ref]).toString().trim() : null;
const list = () => ref ? execFileSync('git', ['-C', REPO, 'ls-tree', '--name-only', ref, 'server/']).toString().split('\n').filter(f => /\.js$/.test(f))
  : fs.readdirSync(path.join(REPO, 'server')).filter(f => /\.js$/.test(f)).map(f => 'server/' + f);
const FILES = SERVER_SIDE.concat(list()).sort();
const readSrc = f => ref ? execFileSync('git', ['-C', REPO, 'show', `${ref}:${f}`], { maxBuffer: 1 << 28 }) : fs.readFileSync(path.join(REPO, f));
const SRC = Object.fromEntries(FILES.map(f => [f, readSrc(f).toString('utf8')]));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'h2mut-'));
const tree = (name, edit) => { const d = path.join(tmp, name); fs.mkdirSync(path.join(d, 'server'), { recursive: true }); for (const f of FILES) fs.writeFileSync(path.join(d, f), edit && edit.file === f ? edit.text : SRC[f]); return d; };
const run = (dir, scen) => {
  const out = path.join(dir, scen + '.jsonl');
  const r = spawnSync(process.execPath, [HARNESS, '--src', path.join(dir, 'server.js'), '--dir', dir, '--scenario', scen, '--out', out, '--scenarios', SCEN_FILE], { encoding: 'utf8', timeout: 900000 });
  const buf = fs.existsSync(out) ? fs.readFileSync(out) : Buffer.alloc(0);
  return { ok: r.status === 0, sha256: sha(buf), lines: buf.length ? buf.toString('utf8').split('\n').length - 1 : 0, stderr: (r.stderr || r.stdout || '').trim().slice(-300) };
};
const only = ARG.only ? ARG.only.split(',') : null;
const muts = MUTANTS.filter(m => !only || only.includes(m.id));
const refDir = tree('reference'), base = {};
for (const s of new Set(muts.flatMap(m => m.scenarios))) base[s] = run(refDir, s);
const R = { tool: 'dev/stage-3h/golden/bpp_mutants.js', source: ref ? 'git ' + ref : 'working tree', files: FILES, node: process.version, reference: base, mutants: [], ok: Object.values(base).every(b => b.ok) };
for (const m of muts) {
  const where = FILES.filter(f => SRC[f].split(m.find).length - 1 > 0), counts = where.map(f => SRC[f].split(m.find).length - 1);
  const rec = { id: m.id, why: m.why, find: m.find, repl: m.repl, foundIn: where, scenarios: {} };
  if (where.length !== 1 || counts[0] !== 1) { rec.applicable = false; rec.caught = false; }
  else {
    const d = tree(m.id, { file: where[0], text: SRC[where[0]].replace(m.find, m.repl) }); rec.applicable = true; rec.file = where[0];
    for (const s of m.scenarios) { const r = run(d, s); rec.scenarios[s] = { ok: r.ok, sha256: r.sha256, lines: r.lines, differs: r.sha256 !== base[s].sha256, stderr: r.ok ? '' : r.stderr }; }
    rec.caught = Object.values(rec.scenarios).some(x => x.differs);
  }
  R.mutants.push(rec); R.ok = R.ok && rec.caught;
  console.log(`${rec.caught ? 'CAUGHT ' : 'MISSED '} ${m.id}${rec.file ? ' (' + rec.file + ')' : ''}: ${m.why}${rec.applicable ? '' : ` (text found in ${where.length ? where.join(', ') + ' ' + counts.join('/') + ' times' : 'no file'}: not applied)`} | ${Object.entries(rec.scenarios).map(([s, x]) => s + (x.differs ? ' differs' : ' same')).join(', ')}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`B++ golden mutants: ${R.mutants.filter(m => m.caught).length}/${R.mutants.length} caught${Object.values(base).every(b => b.ok) ? '' : ' (a reference run FAILED)'}`);
process.exitCode = R.ok ? 0 : 1;
