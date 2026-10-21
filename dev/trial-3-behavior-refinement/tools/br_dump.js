#!/usr/bin/env node
/* dev/trial-3-behavior-refinement/tools/br_dump.js - the behaviour scenarios' full records (development only; the reports' evidence,
 * not a gate step).  Trial 3 is not owner-approved.
 *
 *   node dev/trial-3-behavior-refinement/tools/br_dump.js [--out FILE.json] [--only BR08,BR15]     every run's record of each scenario
 *   node dev/trial-3-behavior-refinement/tools/br_dump.js --wide N [--out FILE.json]                BR08's pressing over seeds 1..N
 *
 * The first form runs dev/tests/s_skinbehave.js's scenarios as the test runner does and keeps what the runner prints only on failure:
 * each run's record (`data`), whole.  The second takes BR08's own drivers (a satiated one at hunger exactly 0; a person who keeps within
 * 60 px of it, facing it, for 60 s) over more seeds than the test's eight, so that its seeded choice (withdraw or strike) is seen at its
 * real rate: per seed, its first defence (when, which, the odds), every spring (hit or miss), the kill if any (when, which death). */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const S = require(path.join(__dirname, '..', '..', '..', 'dev', 'tests', 's_skinbehave.js'));
const out = { tool: 'dev/trial-3-behavior-refinement/tools/br_dump.js', node: process.version };
if (ARG.wide) {
  const { stage, persist, springs, contactOk } = S.helpers, N = +ARG.wide, rows = [];
  for (let seed = 1; seed <= N; seed++) {
    const { w, e, p } = stage(seed, { hunger: 0 }), go = persist(w, e, p), SP = springs(w, e, p); let first = null;
    w.run(60, (ww, t) => { if (!p.dead && !p.caught) go(); SP.take(t); if (!first && e.dbg.def) first = { t: +t.toFixed(1), k: e.dbg.def.k, odds: e.dbg.def.odds, cornered: e.dbg.def.cornered }; return true; });
    const K = w.kills.filter(k => k.pid === p.id);
    rows.push({ seed, first, springs: SP.out.length, hits: e.tally.defendHit, misses: e.tally.defendMiss, withdrawals: e.tally.withdraw, warnings: e.tally.warn,
      kill: K.length ? { at: +K[0].at.toFixed(1), v: K[0].variant, contact: contactOk(w, K[0], e) } : null, others: w.kills.length - K.length, hungerEnd: +e.hunger.toFixed(3) });
  }
  const killed = rows.filter(r => r.kill), firstStrike = rows.filter(r => r.first && r.first.k === 'strike'), t = killed.map(r => r.kill.at).sort((a, b) => a - b);
  out.wide = { seeds: N, secs: 60, rows, summary: { defended: rows.filter(r => r.first).length, firstDecisionStrike: firstStrike.length, killed: killed.length, killedAtContact: killed.filter(r => r.kill.contact).length,
    killTimes: { min: t[0], median: t[Math.floor(t.length / 2)], max: t[t.length - 1] }, springs: rows.reduce((a, r) => a + r.springs, 0), hits: rows.reduce((a, r) => a + r.hits, 0), misses: rows.reduce((a, r) => a + r.misses, 0),
    withdrawals: rows.reduce((a, r) => a + r.withdrawals, 0), otherKills: rows.reduce((a, r) => a + r.others, 0) } };
  const m = out.wide.summary;
  console.log(`BR08's pressing over ${N} seeds (60 s each, hunger 0 at the start): a defence in ${m.defended}; first decision a strike in ${m.firstDecisionStrike}; killed ${m.killed} (all at contact: ${m.killedAtContact === m.killed}), at ${m.killTimes.min}-${m.killTimes.max} s (median ${m.killTimes.median}); springs ${m.springs} (hits ${m.hits}, misses ${m.misses}); withdrawals ${m.withdrawals}; other kills ${m.otherKills}`);
} else {
  const only = ARG.only ? ARG.only.split(',') : null; out.scenarios = [];
  for (const sc of S) {
    const id = sc.name.split(' ')[0]; if (only && !only.includes(id)) continue;
    const t0 = Date.now(); let r; try { r = sc.fn(); } catch (err) { r = { ok: false, note: String(err && err.stack || err).slice(0, 400) }; }
    out.scenarios.push({ id, name: sc.name, ok: !!r.ok, note: r.note, data: r.data, ms: Date.now() - t0 });
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${id} (${Date.now() - t0} ms)`);
  }
  console.log(`${out.scenarios.filter(s => s.ok).length}/${out.scenarios.length} passed`);
}
if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(out, null, 1) + '\n');
