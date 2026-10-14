/* Stage 3H1 - are the B++ golden traces sensitive?  One-line changes ("mutants") of a reference server.js, each run through the scenario
 * that should notice it (development only; never served; changes no file in the repository).
 *
 *   node dev/stage-3h/golden/bpp_mutants.js [--ref 143b63f] [--out FILE.json]
 *
 * For every mutant: the reference server.js (read from Git at REF) with exactly one text replaced - the tool refuses a mutant whose text
 * is not found exactly once - is run in Stage 3H0's closed-world harness with srv_scenarios_bpp.js, and its trace compared with the
 * reference's own trace of the same scenario.  "caught" means the trace differs.  Both sides use the working tree's other files
 * (sim.js, ai.js, world.js, death_srv.js, server/*), as bpp_golden.js does.  Exit 0 only when every mutant is caught. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const HERE = __dirname, REPO = path.resolve(HERE, '..', '..', '..'), HARNESS = path.join(REPO, 'dev', 'stage-3h0', 'golden', 'srv_harness.js'), SCEN_FILE = path.join(HERE, 'srv_scenarios_bpp.js');
const ARG = { ref: '143b63ff42b88c6780c5043e0f61d64100f81f40' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
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
];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'h1mut-'));
const ref = execFileSync('git', ['-C', REPO, 'rev-parse', ARG.ref]).toString().trim();
const src = execFileSync('git', ['-C', REPO, 'show', ref + ':server.js']).toString();
const run = (file, scen) => {
  const out = path.join(tmp, path.basename(file) + '.' + scen + '.jsonl');
  const r = spawnSync(process.execPath, [HARNESS, '--src', file, '--dir', REPO, '--scenario', scen, '--out', out, '--scenarios', SCEN_FILE], { encoding: 'utf8', timeout: 900000 });
  const buf = fs.existsSync(out) ? fs.readFileSync(out) : Buffer.alloc(0);
  return { ok: r.status === 0, sha256: sha(buf), lines: buf.length ? buf.toString('utf8').split('\n').length - 1 : 0, stderr: (r.stderr || '').trim().slice(-300) };
};
const refFile = path.join(tmp, 'ref_server.js'); fs.writeFileSync(refFile, src);
const base = {}; for (const s of new Set(MUTANTS.flatMap(m => m.scenarios))) base[s] = run(refFile, s);
const R = { tool: 'dev/stage-3h/golden/bpp_mutants.js', ref, node: process.version, reference: base, mutants: [], ok: true };
for (const m of MUTANTS) {
  const n = src.split(m.find).length - 1, rec = { id: m.id, why: m.why, find: m.find, repl: m.repl, matches: n, scenarios: {} };
  if (n !== 1) { rec.applicable = false; rec.caught = false; }
  else {
    const f = path.join(tmp, m.id + '_server.js'); fs.writeFileSync(f, src.replace(m.find, m.repl)); rec.applicable = true;
    for (const s of m.scenarios) { const r = run(f, s); rec.scenarios[s] = { ok: r.ok, sha256: r.sha256, lines: r.lines, differs: r.sha256 !== base[s].sha256, stderr: r.stderr }; }
    rec.caught = Object.values(rec.scenarios).some(x => x.differs);
  }
  R.mutants.push(rec); R.ok = R.ok && rec.caught;
  console.log(`${rec.caught ? 'CAUGHT ' : 'MISSED '} ${m.id}: ${m.why}${rec.applicable ? '' : ` (text found ${n} times: not applied)`} | ${Object.entries(rec.scenarios).map(([s, x]) => s + (x.differs ? ' differs' : ' same')).join(', ')}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`B++ golden mutants: ${R.mutants.filter(m => m.caught).length}/${R.mutants.length} caught`);
process.exit(R.ok ? 0 : 1);
