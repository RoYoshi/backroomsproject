/* SKIN-STEALER R19 (dev/trial-3-r19-positioning/; Trial 3 is not owner-approved): the owner's October 23 request after a four-person R18
 * session - its chase is good and must not change; its positioning BEFORE a chase should be smarter (the pack's S track).  Each scene runs
 * the real server simulation (sim.js + ai.js as built, players moved by the game's own move.js through the harness), seeded.  No scene sets
 * a decision of the creature: they place people, give it a hunger and move people as players would; what it chose and why is read from its
 * own debug record (e.dbg.pos: the positioning choice, with its reckoning).
 *   SR01 (S01, S26) somebody it sees walking off is not answered with a long way round (R18 began one and dropped it a think later): the way
 *        round is refused with its reckoning (its time, where they would be by then) and it stays on them - never the bait for somebody
 *        going their own way; no way round begun whose own reckoning leaves them beyond its rush of the spot
 *   SR02 (S10, S26; the pack's Scene B) somebody standing in the lit hall, its only covert way round some 10 s: a moderately hungry one
 *        (.7) still goes round (R13-R18's tactic kept), a very hungry one (.85) does not vanish for it - it reckons the time against its
 *        budget, says so, and comes on openly
 *   SR03 (S02, S27) the contest: somebody standing at a junction with a side passage - a very hungry one coming on openly heads for their
 *        side way out (a point on open floor 100-200 px from them, reachable from them, off the straight line beyond them), never for
 *        somebody walking; its footwork takes over at SKF.near as before; and the other way out stays open (a sprint along the hall when it
 *        is 550 px off escapes)
 *   SR04 (S22, S27, the R19 audit) a vault is carried through: begun, the body follows the vault's line until it lands, whatever it
 *        decides meanwhile - R8-R18 let its footwork or a spring move the body on mid-vault (through walls) and set it down later at the
 *        vault's far end (R19's 36 h simulation: an 830 px jump)
 *   SR05 (S30) no churn: a watcher turning to it and away every half second for 20 s - its positioning reckonings come at most once a think,
 *        its plans change at most a few times a second, and no way round is begun and dropped on the next think */
'use strict';
const { World, DT, LONG, AI, bystander } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const SKC_RUSH = 360;                                           // (SKC.rush, ai.skin.cover.js: its spring from cover)

/* the lit hall of s_skinpredator.js (hall()): a lit person 450 px from it, facing it */
function hall(seed, h, walk) {
  const w = World(seed + 3800), y = LONG.y; bystander(w, 1300, 3300);
  const p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
  if (walk) p.go(2000, y, 'walk');
  return { w, p, e };
}
/* what it did about p, and its positioning records, over a run */
function watchRun(w, e, p, secs, each) {
  const R = { plans: [], pos: [], flanks: [], dead: false }; let last = null, lastPos = null;
  w.run(secs, (ww, t) => {
    const P = e.plan;
    if (P !== last) { R.plans.push({ t: +t.toFixed(2), k: P ? P.k : 'roam', mode: P && P.mode, pid: P && P.pid }); last = P; if (P && P.k === 'flank') R.flanks.push({ t: +t.toFixed(2), worth: P.spot && P.spot.worth, v: Math.round(Math.hypot(p.vx || 0, p.vy || 0)) }); }
    if (e.dbg.pos && e.dbg.pos.at !== lastPos) { lastPos = e.dbg.pos.at; R.pos.push(Object.assign({ t: +t.toFixed(2) }, e.dbg.pos)); }
    if (each) each(t);
    return !p.dead;
  });
  R.dead = p.dead; return R;
}

add('SR01 somebody it sees walking off is not answered with a long way round: refused with its reckoning, it stays on them (never the bait), and no way round is begun that its own reckoning says would find them gone', () => {
  const rs = []; for (const h of [.6, .75]) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) { const { w, p, e } = hall(seed, h, true); rs.push(Object.assign({ h, seed }, watchRun(w, e, p, 12))); }
  const refusals = rs.flatMap(r => r.pos.filter(q => q.k === 'flankRefused').map(q => ({ r, q })));
  const reasoned = refusals.filter(({ q }) => /would take [\d.]+ s \(they would be \d+ px from its spot by then\)/.test(q.why) && q.eta && q.eta.length === 2);
  const after = refusals.map(({ r, q }) => { const n = r.plans.find(x => x.t >= q.t - 1e-6 && x.k !== 'roam'); return n ? n.k : 'roam'; });
  const bait = after.filter(k => k === 'retreat' || k === 'lure').length, away = after.filter(k => !['approach', 'chase', 'watch', 'leave'].includes(k)).length;
  const bad = rs.flatMap(r => r.flanks.filter(f => f.worth && f.worth.off !== undefined && f.worth.off > SKC_RUSH));
  const twitch = rs.filter(r => r.plans.some((x, i) => x.k === 'flank' && r.plans[i + 1] && r.plans[i + 1].t - x.t <= .15)).length;
  return { ok: refusals.length >= 4 && reasoned.length === refusals.length && !bait && !away && !bad.length,
    note: `${rs.length} runs (.6 and .75, walking off while looking back): ways round refused ${refusals.length}, each with its reckoning ${reasoned.length} (e.g. "${refusals[0] ? refusals[0].q.why : '-'}"); then ${Object.entries(after.reduce((a, k) => (a[k] = (a[k] || 0) + 1, a), {})).map(([k, n]) => k + ' ' + n).join(', ')}; the bait after one ${bait}; ways round begun against a mover its reckoning had gone ${bad.length}; a way round dropped within a think ${twitch} runs (begun on a think when they still stood); killed ${rs.filter(r => r.dead).length}` };
});

add('SR02 the pack\'s Scene B: somebody standing in the lit hall, its covert way round some 10 s - at .7 it still goes round (R13-R18\'s tactic), at .85 it reckons the time against its budget, says so, and comes on openly instead of vanishing', () => {
  const run = h => [1, 2, 3, 4, 5, 6, 7, 8].map(seed => { const { w, p, e } = hall(seed, h, false); return watchRun(w, e, p, 14); });
  const mid = run(.7), hi = run(.85);
  const midFl = mid.filter(r => r.flanks.length).length;
  const hiRef = hi.filter(r => r.pos.some(q => q.k === 'flankRefused' && /against [\d.]+ s coming on; it may spend [\d.]+ s more/.test(q.why)));
  const hiFl = hi.filter(r => r.flanks.length).length, hiOpen = hiRef.filter(r => r.plans.some(x => x.k === 'approach' && x.mode === 'open')).length;
  return { ok: midFl >= 4 && hiRef.length >= 4 && hiOpen === hiRef.length && hiFl <= 8 - hiRef.length,
    note: `at .7: went round in ${midFl}/8 (ways ${mid.flatMap(r => r.flanks.map(f => f.worth ? f.worth.etaF + ' s' : '?')).join('/')}) | at .85: refused for its time in ${hiRef.length}/8 ("${hiRef[0] ? hiRef[0].pos.find(q => q.k === 'flankRefused').why : '-'}"), came on openly after ${hiOpen}/${hiRef.length}, went round anyway in ${hiFl}/8; killed ${mid.filter(r => r.dead).length}/8 and ${hi.filter(r => r.dead).length}/8` };
});

add('SR03 the contest: at a junction, a very hungry one coming on openly heads for the standing person\'s side way out - a point on open floor 100-200 px from them, reachable from them, off the straight line beyond them - never for somebody walking; its footwork takes over at SKF.near; the other way out stays open', () => {
  const g0 = World(1).eng.geo, near = 400;
  const one = (seed, mode, trig) => {
    const w = World(seed + 9200), g = w.eng.geo, p = w.player(1164, 732, { light: true }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 1164, 1332, { hunger: .9 }); e.tier = 'near'; e.ang = -Math.PI / 2;
    p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
    if (mode === 'walk') p.go(300, 732, 'walk');
    const R = { cps: [], bad: [], afterNear: 0, ran: -1 };
    w.run(10, (ww, t) => {
      const P = e.plan, d = Math.hypot(p.x - e.x, p.y - e.y);
      if (P && P.cp && P.cp.c && !R.cps.some(c => c.x === P.cp.x && c.y === P.cp.y)) {
        const c = P.cp, r = Math.hypot(c.x - c.rx, c.y - c.ry), off = Math.abs(Math.atan2(Math.sin(c.way - Math.atan2(c.ry - e.y, c.rx - e.x)), Math.cos(c.way - Math.atan2(c.ry - e.y, c.rx - e.x))));
        R.cps.push({ x: c.x, y: c.y, r: Math.round(r), v: Math.round(Math.hypot(p.vx || 0, p.vy || 0)) });
        if (!(r >= 59 && r <= 201 && g.clear(c.x, c.y, e.rc + 1, 'walk') && g.lineClear(c.x, c.y, c.rx, c.ry, e.rc - 1, 'walk') && off >= AI.SK.contestOff - .02)) R.bad.push([Math.round(c.x), Math.round(c.y), Math.round(r)]);
      }
      if (P && P.cp && P.cp.c && d <= near - 30) R.afterNear++;
      if (trig && R.ran < 0 && d < trig) { R.ran = t; p.look = null; p.go(mode, 732, 'run'); }
      return !p.dead;
    });
    R.dead = p.dead; return R;
  };
  const stand = [1, 2, 3, 4, 5, 6].map(s => one(s, 'stand')), walk = [1, 2, 3, 4, 5, 6].map(s => one(s, 'walk')), west = [1, 2, 3, 4, 5, 6, 7, 8].map(s => one(s, 264, 550));
  const got = stand.filter(r => r.cps.length).length, bad = stand.concat(walk).flatMap(r => r.bad), walkCp = walk.filter(r => r.cps.some(c => c.v > 60)).length, after = stand.concat(walk).reduce((a, r) => a + r.afterNear, 0);
  const esc = west.filter(r => !r.dead).length;
  return { ok: got >= 4 && !bad.length && !walkCp && !after && esc >= 4 && !!g0,
    note: `standing: headed for their way out in ${got}/6 (${stand.flatMap(r => r.cps.map(c => `${Math.round(c.x)},${Math.round(c.y)} ${c.r} px`)).slice(0, 3).join('; ')}), points off floor / out of reach / not to their side ${bad.length} | walking: a contest point while they walked ${walkCp}/6 | a contest point held inside its footwork's range ${after} ticks | standing, then a sprint west along the hall when it is 550 px off: escaped ${esc}/8` };
});

add('SR04 a vault is carried through: begun, the body keeps to the vault\'s line until it lands - its decisions meanwhile (a hungry one close to a person it sees, its footwork and its spring) move nothing - and no jump faster than its run', () => {
  const rs = [];
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const w = World(seed + 9300), g = w.eng.geo; let L = null;
    for (const [, ls] of g.links) { for (const l of ls) { const len = Math.hypot(l.bx - l.ax, l.by - l.ay); if (len > 100 && len < 220 && w.ad.clear(l.ax, l.ay, 30, 'walk') && w.ad.clear(l.bx, l.by, 30, 'walk')) { L = l; break; } } if (L) break; }
    if (!L) { rs.push({ none: 1 }); continue; }
    const a = Math.atan2(L.by - L.ay, L.bx - L.ax), px = L.ax - Math.sin(a) * 160, py = L.ay + Math.cos(a) * 160;   // a person 160 px to the side of the vault's start
    const p = w.player(w.ad.clear(px, py, 24, 'walk') ? px : L.ax - Math.cos(a) * 160, w.ad.clear(px, py, 24, 'walk') ? py : L.ay - Math.sin(a) * 160, { light: true }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', L.ax, L.ay, { hunger: .9 }); e.tier = 'near'; e.ang = a;
    p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
    e.trav = { ax: L.ax, ay: L.ay, bx: L.bx, by: L.by, t: 0, dur: .5 / .9, prop: L.prop, dir: a };   // (beginTrav's own record: a vault begun)
    const R = { off: 0, ticks: 0, landed: -1, jump: 0 }; let lx = e.x, ly = e.y;
    w.run(2, (ww, t) => {
      if (e.trav) { R.ticks++; const lx2 = L.bx - L.ax, ly2 = L.by - L.ay, L2 = lx2 * lx2 + ly2 * ly2, k = Math.max(0, Math.min(1, ((e.x - L.ax) * lx2 + (e.y - L.ay) * ly2) / L2)); R.off = Math.max(R.off, Math.hypot(e.x - L.ax - lx2 * k, e.y - L.ay - ly2 * k)); }
      else if (R.landed < 0) R.landed = +t.toFixed(3);
      if (!e.pounce && Math.hypot(e.x - lx, e.y - ly) > AI.SKIN.speeds.run * DT * 1.5 + 2 && !e.trav) R.jump++;
      lx = e.x; ly = e.y; return true;
    });
    rs.push(R);
  }
  const ok = rs.filter(r => !r.none);
  return { ok: ok.length >= 4 && ok.every(r => r.off < 1 && r.landed > 0 && r.landed <= .5 / .9 + 2 * DT && r.jump === 0),
    note: `${ok.length} vaults with a person 160 px off and a hungry one (.9) in it: off the vault's line ${ok.map(r => r.off.toFixed(1)).join('/')} px, landed at ${ok.map(r => r.landed).join('/')} s (its vault ${(.5 / .9).toFixed(2)} s), jumps ${ok.reduce((a, r) => a + r.jump, 0)}` };
});

add('SR05 no churn: a watcher turning to it and away every half second for 20 s, at .6 and .8 - its positioning reckonings at most once a think, its plans changed at most a few times a second, no way round begun and dropped on the next think', () => {
  const rs = [];
  for (const h of [.6, .8]) for (const seed of [1, 2, 3, 4]) {
    const { w, p, e } = hall(seed + 40, h, false);
    p.look = () => (Math.floor(w.t / .5) % 2 ? 0 : Math.atan2(e.y - p.y, e.x - p.x));
    const R = watchRun(w, e, p, 20); R.h = h;
    const perSec = []; for (let s = 0; s < 20; s++) perSec.push(R.plans.filter(x => x.t >= s && x.t < s + 1).length);
    R.maxPlans = Math.max(...perSec); R.posMax = Math.max(0, ...Array.from({ length: 200 }, (_, i) => R.pos.filter(q => q.t >= i * .1 && q.t < i * .1 + .1).length));
    R.twitch = R.plans.filter((x, i) => x.k === 'flank' && R.plans[i + 1] && R.plans[i + 1].t - x.t <= .15).length; rs.push(R);
  }
  return { ok: rs.every(r => r.posMax <= 1 && r.maxPlans <= 4 && r.twitch === 0),
    note: `${rs.length} runs: positioning records in any 0.1 s at most ${Math.max(...rs.map(r => r.posMax))}; plans begun in any second at most ${Math.max(...rs.map(r => r.maxPlans))} (${rs.map(r => r.plans.length).join('/')} in 20 s); ways round dropped within a think ${rs.reduce((a, r) => a + r.twitch, 0)}; killed ${rs.filter(r => r.dead).length}` };
});

module.exports = S;
