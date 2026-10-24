/* THE OPEN-AIR STUCK (Trial 3 R20, the N track; dev/trial-3-r20-nani-head-watchdog/; Trial 3 is not owner-approved).  The owner saw a
 * Skin-Stealer "get STUCK on air in debug and retreat".  Checkpoint A (AUDIT.md) traced two causes, both inherited from before R19:
 *   W1 the shared follower's stuck timer (steerTo) measured a body's progress against half its full speed while its own steering slowed it
 *      to 10-15 % to turn round - every species' turnaround on open floor showed the red STUCK and fired the side-step rung;
 *   W2 the watchdog sampled a Skin-Stealer's stillness at one tick and counted its still time - a wait or a meal ending on the check tick,
 *      or a walk there and back, was "stuck": its route cleared, its roam goal dropped, plan.stuck raised.
 * Every check runs the scene (r20n_scenes.js) on this tree and, through r20n_child.js, on this tree with exactly R20's hunks taken out (R19
 * combined's engine): the R19 side must show the defect (the check's negative proof), this side must not, and real obstruction must still
 * be caught on both.
 *   ST01 a 10-minute corner wait with its head swivelling and a small step now and then: no watchdog reset, no route cleared, no label
 *   ST02 open floor: (a) turning round by the real follower, every species, at its walk and its fastest: no label, no recovery rung, the same
 *        arrival as R19 to 0.1 s; (b) walks there and back past the same spot: no reset; (c) ordinary play: no label in open air, no reset
 *   ST03 real obstruction still caught: the follower's rungs on a waypoint through a wall, every species; the watchdog on a Skin-Stealer
 *        that keeps walking into a wall (where it stands - no teleport, nothing inside the wall); an overlapping body still un-embedded
 *   ST04 vaults (R19's mid-vault fix kept) and the near / mid / far tiers: no false label or reset
 *   ST05 (R20 D3) pinned on a corner: a second side-step at the same spot goes to a new route (the Skin-Stealer's alone) */
'use strict';
const path = require('path'), { execFileSync } = require('child_process');
const S = []; const add = (name, fn) => S.push({ name, fn });
const ROOT = path.join(__dirname, '..', '..'), CACHE = {};
const run = (mode, scene) => { const k = mode + ':' + scene; if (!CACHE[k]) CACHE[k] = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'r20n_child.js'), mode, scene, ROOT], { cwd: ROOT, maxBuffer: 1 << 26 }).toString()); return CACHE[k]; };
const both = scene => { const now = run('now', scene), r19 = run('r19', scene); if (now.took !== 1 || r19.took !== 1) throw new Error('the built ai.js was not compiled exactly once'); return { now, r19 }; };
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

add('ST01 a 10-minute corner wait - still, its head swivelling, a small step aside and back every 6 s: no watchdog reset, no route cleared, no STUCK label (R19: reset, route cleared, label)', () => {
  const { now, r19 } = both('waits'), bad = [];
  for (const r of now.runs) { if (r.resets || r.onStuck || r.maxStuck >= .15 || r.label > 0 || r.recover || r.inside) bad.push(`seed ${r.seed}: ${JSON.stringify(r)}`); if (r.sweeps < 50) bad.push(`seed ${r.seed}: only ${r.sweeps} head sweeps`); }
  const r19r = sum(r19.runs, r => r.resets), r19l = sum(r19.runs, r => r.label);
  if (!(r19r > 0 && r19l > 0)) bad.push(`the negative proof: R19's engine gave ${r19r} resets, ${r19l.toFixed(1)} s of label`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `${now.runs.length} x 600 s, ${sum(now.runs, r => r.sweeps)} head sweeps: 0 resets, 0 routes cleared, stuck timer at most ${Math.max(...now.runs.map(r => r.maxStuck))} s, no label | R19's engine: ${r19r} resets ("stuck: the watchdog cleared its route"), ${r19l.toFixed(0)} s of label` };
});

add('ST02 open floor: (a) turning round by the real follower, walk and fastest pace - the Skin-Stealer: no STUCK label or recovery rung and the same arrival as R19; the Hound and the Smiler: exactly R19 (W1 is the Skin-Stealer\'s alone); (b) walks there and back: no watchdog reset; (c) ordinary play: no label in open air, no reset (R19: all three)', () => {
  const T = both('turns'), B = both('thereback'), O = both('ordinary'), bad = [], notes = [];
  for (const k of ['skinstealer', 'hound', 'smiler']) {
    const a = T.now[k], b = T.r19[k]; if (a.length < 100 || a.length !== b.length) { bad.push(`${k}: ${a.length} / ${b.length} turns`); continue; }
    // (R20 D2) W1 is the Skin-Stealer's alone (caps.TURN_AWARE_STUCK): the Hound's and the Smiler's turns are R19's, run for run
    if (k !== 'skinstealer') { const same = JSON.stringify(a) === JSON.stringify(b); if (!same) bad.push(`${k}: its turns differ from R19's`); notes.push(`${k} ${a.length} turns: exactly R19's (label ${sum(a, r => r.label).toFixed(0)} s, side-steps ${sum(a, r => r.side)}: its own, unchanged)`); continue; }
    const lab = sum(a, r => r.label), side = sum(a, r => r.side + r.replan), un = a.filter(r => r.t === null).length;
    let worst = 0; a.forEach((r, i) => { if (r.t !== null && b[i].t !== null) worst = Math.max(worst, r.t - b[i].t); });
    if (lab > 0 || side || un) bad.push(`${k}: label ${lab.toFixed(2)} s, rungs ${side}, not arrived ${un}`);
    if (worst > .1) bad.push(`${k}: a turn ${worst.toFixed(3)} s slower than R19`);
    const lab19 = sum(b, r => r.label), side19 = sum(b, r => r.side);
    if (!(lab19 > 0 && side19 > 0)) bad.push(`${k}: the negative proof: R19 label ${lab19}, side-steps ${side19}`);
    notes.push(`${k} ${a.length} turns: label 0, rungs 0, at most ${Math.max(0, worst).toFixed(3)} s slower (R19 ${lab19.toFixed(0)} s label, ${side19} side-steps)`);
  }
  const br = sum(B.now.runs, r => r.resets), br19 = sum(B.r19.runs, r => r.resets);
  if (br || B.now.runs.some(r => r.onStuck)) bad.push(`there and back: ${br} resets`); if (!(br19 > 0)) bad.push(`there and back: the negative proof: R19 ${br19} resets`);
  notes.push(`there and back ${sum(B.now.runs, r => r.legs)} legs: 0 resets (R19 ${br19})`);
  const ol = sum(O.now.runs, r => r.openLabel), orr = sum(O.now.runs, r => r.resets), os = sum(O.now.runs, r => r.side), ol19 = sum(O.r19.runs, r => r.openLabel);
  if (ol > 0 || orr || os) bad.push(`ordinary play: ${ol} s label in open air, ${orr} resets, ${os} side-steps`); if (!(ol19 > 0)) bad.push(`ordinary play: the negative proof: R19 ${ol19} s`);
  notes.push(`ordinary play ${sum(O.now.runs, r => r.nearS).toFixed(0)} s near/mid: label ${sum(O.now.runs, r => r.label)} s, 0 side-steps, 0 resets (R19 ${ol19.toFixed(1)} s in open air, ${sum(O.r19.runs, r => r.side)} side-steps)`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : notes.join(' | '), data: { thereback: B.now.runs, ordinary: O.now.runs, ordinaryR19: O.r19.runs } };
});

add('ST03 real obstruction is still caught: a waypoint through a wall still raises the stuck timer and fires the follower\'s rungs (every species); a Skin-Stealer walking into a wall is still reset by the watchdog where it stands; an overlapping body is still un-embedded onto clear floor', () => {
  const { now, r19 } = both('block'), bad = [], notes = [];
  for (const k of ['skinstealer', 'hound', 'smiler']) {
    const a = now.follow.filter(r => r.kind === k), hit = a.filter(r => r.maxStuck > .35 && r.side >= 1).length, b = r19.follow.filter(r => r.kind === k), hit19 = b.filter(r => r.maxStuck > .35 && r.side >= 1).length;
    if (hit < a.length - 1 || hit < hit19 - 1 || a.some(r => r.inside)) bad.push(`${k}: blocked ${hit}/${a.length} (R19 ${hit19}), inside ${sum(a, r => r.inside)}`);
    notes.push(`${k}: the rungs fired on ${hit} of ${a.length} walls (R19 ${hit19})`);
  }
  const pin = now.wall.filter(r => r.pinned), pin19 = r19.wall.filter(r => r.pinned);
  if (pin.length < 3) bad.push(`walking into a wall: only ${pin.length} pinned`);
  for (const r of pin) if (!(r.resets >= 1 && r.onStuck)) bad.push(`walking into a wall, pinned: ${JSON.stringify(r)}`);
  for (const r of now.wall) if (r.inside || r.maxJump >= 10) bad.push(`walking into a wall: ${JSON.stringify(r)}`);
  notes.push(`walking into a wall: ${pin.length} of ${now.wall.length} pinned, each reset (${pin.map(r => r.resets).join('/')} times; R19 ${pin19.map(r => r.resets).join('/')}), at most ${Math.max(...now.wall.map(r => r.maxJump))} px a tick, never inside`);
  const E = now.embed; if (!(E && !E.startedClear && E.emergency >= 1 && E.nowClear && E.moved < 100 && E.toPerson > 100)) bad.push(`embedded: ${JSON.stringify(E)}`);
  notes.push(`overlapping a wall: un-embedded ${E.emergency} time(s), ${E.moved} px onto clear floor, ${E.toPerson} px from the person`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : notes.join(' | ') };
});

add('ST04 vaults and tiers: a Skin-Stealer sent over vault links (R19\'s mid-vault fix: no vault left open far from its body) and the real Skin-Stealer among four people walking off and back (near, mid, far): no false label, no reset', () => {
  const { now, r19 } = both('vaulttier'), bad = [];
  if (now.vault.length < 3) bad.push(`only ${now.vault.length} vault routes`);
  for (const r of now.vault) if (r.label > 0 || r.resets || r.stale || !r.arrived || !(r.trav > 0)) bad.push(`vault: ${JSON.stringify(r)}`);
  for (const r of now.tiers) { if (r.label > 0 || r.resets) bad.push(`tiers seed ${r.seed}: ${JSON.stringify(r)}`); if (!(r.tiers.near > 0 && r.tiers.mid > 0)) bad.push(`tiers seed ${r.seed}: tiers ${JSON.stringify(r.tiers)}`); }
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `${now.vault.length} vault routes: ${sum(now.vault, r => r.trav).toFixed(2)} s vaulting, no label, no reset, no vault left open (R19 ${sum(r19.vault, r => r.label).toFixed(2)} s label) | ${now.tiers.length} x 240 s with four people: tiers ${now.tiers.map(r => JSON.stringify(r.tiers)).join(' ')}, ${sum(now.tiers, r => r.changes)} tier changes, no label, no reset (R19 ${sum(r19.tiers, r => r.openLabel).toFixed(1)} s label in open air)` };
});

add('ST05 pinned on a corner (a route\'s last waypoint against a wall, its line clipping the corner): the Skin-Stealer goes to a new route at its second side-step (within 5 s of setting off; the corner is 2 s away) instead of side-stepping until the watchdog clears its route (R19: side-steps all 15 s, no new route); the Hound exactly as R19; on floor it fits, both arrive', () => {
  const { now, r19 } = both('pin'), bad = [], f = (R, k, g) => R.runs.find(r => r.kind === k && r.goal === g);
  const s = f(now, 'skinstealer', 'raw'), s19 = f(r19, 'skinstealer', 'raw');
  if (!(s.firstNew !== null && s.firstNew < 5 && s.side <= s19.side / 2)) bad.push(`the Skin-Stealer: first new route at ${s.firstNew} s (${JSON.stringify(s)})`);
  if (!(s19.replans === 0 && s19.side >= 8)) bad.push(`the negative proof: R19 ${JSON.stringify(s19)}`);
  for (const g of ['raw', 'fit']) if (JSON.stringify(f(now, 'hound', g)) !== JSON.stringify(f(r19, 'hound', g))) bad.push(`the Hound (${g}) differs from R19`);
  for (const k of ['skinstealer', 'hound']) if (f(now, k, 'fit').at === null) bad.push(`${k} never reached the goal on floor it fits`);
  return { ok: !bad.length, note: bad.length ? bad.join('; ') : `the Skin-Stealer: a new route at ${s.firstNew} s, ${s.replans} in 15 s and ${s.side} side-steps (R19: ${s19.side} side-steps, no new route) | the Hound: R19's exactly (${f(now, 'hound', 'raw').side} side-steps, ${f(now, 'hound', 'raw').replans} new routes) | on floor it fits: arrived ${f(now, 'skinstealer', 'fit').at} / ${f(now, 'hound', 'fit').at} s`, data: { now: now.runs, r19: r19.runs } };
});

module.exports = S;
