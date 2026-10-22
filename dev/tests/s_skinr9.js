/* SKIN-STEALER R9-R17 (dev/trial-3-r9-overhaul/; Trial 3 is not owner-approved).  The owner's October 22 report on R8 (f378049), as
 * executable scenarios on the real server simulation (sim.js + ai.js as built, players moved by the game's own move.js through the harness).
 * No scenario sets a decision of the creature: they place people, give it a hunger (its spawn option), move people as players would, and
 * read what it did.  What a PERSON can see is the TEST-ONLY oracle dev/trial-3-r9-overhaul/tools/qa_sight.js (the client's own sight mask
 * and darkness, on the server's level): it reads where both really are - the creature never does.
 * R9: R9-01, the minimal reproducer of the owner's complaint (it FAILS on R8 by design; it passes from R13 and is in run.js's default list). */
'use strict';
const { World, LONG, over, bystander } = require('./lib.js');
const { sees } = require('../trial-3-r9-overhaul/tools/qa_sight.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/* the mode a plan runs in: from R13 the plan says so (P.mode: 'covert' | 'open' | 'feint'); on R8 (no such field) by its kind - a flank on
 * its way, the approach from a flank, and an approach begun because 'P.. is not watching' (it creeps under cover believing itself unseen)
 * are covert transits; the bait's back-off is a feint; a chase or an approach that knows it is seen is open */
function modeOf(e) {
  const P = e.plan; if (!P) return '';
  if (P.mode) return P.mode;
  if (P.k === 'flank' && !P.arrived) return 'covert';
  if (P.k === 'approach' && (P.side || /is not watching/.test(P.why || ''))) return 'covert';
  if (P.k === 'intercept' && !P.arrived) return 'covert';
  if (P.k === 'retreat' && P.bait && !P.arrived) return 'feint';
  if (P.k === 'chase' || P.k === 'approach') return 'open';
  return '';
}
/* the watched hall (repro_r9.js W): a lit person at (5000, LONG.y) keeps facing the creature, placed 450 px east */
function watchedHall(seed, h) {
  const w = World(seed + 9100); bystander(w, 1300, 3300);
  const p = w.player(5000, LONG.y, { light: true, angle: 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5450, LONG.y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
  return { w, p, e };
}
/* ten times a second, while the plan is covert: how far it moved in the person's sight - but not on a withdrawal out of it (P.phase 'exit':
 * moving away from them, not across their front) */
function covertExposure(w, p, e, secs) {
  const R = { covert: 0, exposed: 0, exitSeen: 0, badExit: 0, plans: [], worst: null }; let lx = e.x, ly = e.y, ld = Math.hypot(e.x - p.x, e.y - p.y), lastP = null, run = 0, b0 = null;
  w.run(secs, (ww, t) => {
    if (Math.round(t * 60) % 6) return true;
    const P = e.plan, m = modeOf(e), V = sees(w, p, e.x, e.y), step = Math.hypot(e.x - lx, e.y - ly), d = Math.hypot(e.x - p.x, e.y - p.y);
    if (P !== lastP) { if (P) R.plans.push([+t.toFixed(1), P.k, m]); lastP = P; run = 0; b0 = null; }
    if (P && P.phase === 'exit') { if (R.exitAt === undefined) { R.exitAt = t; R.braked = 0; } } else R.exitAt = undefined;   // (R16: when the withdrawal began, seen or not)
    if (m === 'covert') {
      R.covert += step;
      if (V.vis) {
        const bear = Math.atan2(e.y - p.y, e.x - p.x); if (b0 === null) b0 = bear;
        // a withdrawal: not closer, not swinging across their front - (R16) but for its braking: seen while it was moving their way (a search,
        // an approach), it needs a moment to stop (ACCELERATION 760 px/s2 from its 90 px/s pace: about 5 px); within the first .3 s of the
        // withdrawal up to 10 px closer in all is that, not a sneak (the sample that holds the switch also holds the last of the move before)
        const brake = P.phase === 'exit' && t - R.exitAt < .3 && R.braked + Math.max(0, ld - d) <= 10; if (brake) R.braked += Math.max(0, ld - d);
        const away = (d >= ld - 1 || brake) && Math.abs(angDiff(bear, b0)) < .45;
        if (P.phase === 'exit' && away) R.exitSeen += step;
        else { R.exposed += step; run += step; if (!R.worst || run > R.worst.px) R.worst = { px: Math.round(run), t: +t.toFixed(1), k: P.k, why: (e.dbg.why || '').slice(0, 90) }; }
        if (P.phase === 'exit' && !away) R.badExit++;
      } else run = 0;
    }
    lx = e.x; ly = e.y; ld = d; return true;
  });
  return R;
}

add('R9-01 the owner\'s exposed ambush: watched by a lit person in the long hall (hunger .6 / .75 / .85), the creature never moves in their sight while it is on a covert way (a flank to its spot, an approach from cover, an approach it believes unseen) - only a withdrawal straight out of their sight may be seen (R8: fails)', () => {
  const rs = [];
  for (const h of [.6, .75, .85]) rs.push(...over([1, 2, 3, 4], seed => { const { w, p, e } = watchedHall(seed, h); const R = covertExposure(w, p, e, 20); R.h = h; R.seed = seed; return R; }));
  const bad = rs.filter(r => r.exposed >= 48 || r.badExit), covert = rs.filter(r => r.covert > 0);
  return { ok: bad.length === 0 && rs.every(r => !r.err),
    note: `${rs.length} runs, ${covert.length} with a covert way; in the person's sight on a covert way: ${rs.map(r => Math.round(r.exposed)).join('/')} px (withdrawals seen ${rs.map(r => Math.round(r.exitSeen)).join('/')} px; a 'withdrawal' that came closer or crossed their front ${rs.reduce((a, r) => a + r.badExit, 0)}) | worst: ${JSON.stringify((bad.sort((a, b) => b.exposed - a.exposed)[0] || {}).worst || null)}` + (rs.some(r => r.err) ? ' | ERR ' + rs.find(r => r.err).err : ''),
    data: rs.map(r => ({ h: r.h, seed: r.seed, exposed: Math.round(r.exposed), plans: r.plans.slice(0, 8) })) };
});

module.exports = S;
