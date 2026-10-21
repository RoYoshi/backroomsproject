/* SKIN-STEALER cognitive refinement scenarios (dev/trial-3-cognitive-predator/; Trial 3 and its refinements are not owner-approved).
 * Each runs the real server simulation (sim.js + ai.js as built; players moved by the game's own move.js through the harness) over
 * several seeds.  As in s_skinpredator.js no scenario sets a decision of the creature: they place people, give it a hunger (its spawn
 * option), move people as players would, and read what it did.  The people's scripts may read where the creature really is (a player's
 * own sight of it); the creature never reads them.  Timings are measured from the first tick at which it really has the evidence.
 * C1: C01 (a new sighting is faced at once; an unseen person changes nothing), C04 (interrupts: a hungry bait is not a blind wait; a
 * listen ends when the sound it waits for comes; a twitch of the eyes is not an interrupt).  Every scenario here fails on R8
 * (dev/trial-3-cognitive-predator/evidence/c1_before_r8.txt). */
'use strict';
const { World, LONG, over, floorNear, bystander } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const planOf = e => e.plan ? e.plan.k : e.hunt ? 'hunt' : 'roam';
const ang = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return d; };
// the requirement, stated here and not read from the creature's constants: hungry, no blind wait round a corner longer than this (s)
const LURE_MAX = 4.5;
const q = (a, p) => { const v = a.filter(x => x !== null && x !== undefined).sort((x, y) => x - y); return v.length ? +v[Math.min(v.length - 1, Math.floor(p * v.length))].toFixed(2) : null; };

add('C01 a person who walks into its view is faced at once (the first near thinks), hunger .55 - and where an unsensed person is (in the dark behind it, crouched, still, unlit: two different places) changes nothing it does, tick for tick', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    const w = World(seed + 11000), y = LONG.y; bystander(w, 1300, 3300);
    const e = w.eng.spawn('skinstealer', 5450, y, { hunger: .55 }); e.tier = 'near'; e.ang = Math.PI;
    // the person starts behind it and to its side, in the big lit room above the hall (2.5 rad from its facing: outside its 2.5 rad
    // field), and walks by a real route down into the hall in front of it
    const p = w.player(5700, 3250, { light: true, angle: Math.PI }); p.stop('stand'); p.look = null;
    let seenAt = -1, orientAt = -1, choiceAt = -1, plan0 = null, off0 = 0;
    w.run(6, (ww, t) => {
      if (t > .2 && !p.leg) { p.leg = 1; p.pathTo(4700, y, 'walk'); }
      const b = Math.atan2(p.y - e.y, p.x - e.x), off = Math.abs(ang(e.ang + (e.head || 0), b));
      if (seenAt < 0 && e.seenNow.has(p.id)) { seenAt = t; off0 = off; plan0 = e.plan; }
      if (seenAt >= 0 && orientAt < 0 && (off < .5 || off < off0 - .3)) orientAt = t;
      if (seenAt >= 0 && choiceAt < 0 && (e.plan !== plan0 || e.hunt)) choiceAt = t;
      return true; });
    return { seenAt: +seenAt.toFixed(2), orient: orientAt >= 0 ? +(orientAt - seenAt).toFixed(2) : null, choice: choiceAt >= 0 ? +(choiceAt - seenAt).toFixed(2) : null, plan: planOf(e) };
  });
  // the negative: a person crouched still and unlit in the dark behind it, in two different places 800-1000 px off (near enough to keep
  // it in the engine's near tier - the level of detail is the engine's, not a sense) - the same creature either way, and neither sensed
  const same = over([1, 2, 3, 4], seed => {
    const one = where => { const w = World(seed + 11100), y = LONG.y; bystander(w, 1300, 3300);
      const e = w.eng.spawn('skinstealer', 5450, y, { hunger: .55 }); e.tier = 'near'; e.ang = Math.PI;
      const f = floorNear(w, where.x, where.y), h = w.player(f.x, f.y, { light: false, angle: 0 }); h.stop('crouch');
      const tr = []; w.run(8, () => { tr.push([Math.round(e.x * 10), Math.round(e.y * 10), Math.round(e.ang * 1000), Math.round((e.head || 0) * 1000), planOf(e)].join(',')); return true; });
      return { tr, sensed: e.mem.p.has(h.id) }; };
    const a = one({ x: 5928, y: 2712 }), b = one({ x: 6360, y: 3096 }); let k = 0; while (k < a.tr.length && a.tr[k] === b.tr[k]) k++;
    return { same: k === a.tr.length && !a.sensed && !b.sensed, ticks: a.tr.length, firstDiff: k, sensed: a.sensed || b.sensed };
  });
  // (one seed of eight roams off the other way and never has the walker in view: a scene that gives no evidence measures nothing; at
  // least six of eight must, and every one that does is held to the limits)
  const saw = rs.filter(r => r.seenAt >= 0);
  const ok = saw.length >= 6 && saw.every(r => r.orient !== null && r.orient <= .5 && r.choice !== null && r.choice <= .25) && same.every(r => r.same);
  return { ok, note: `seen at ${rs.map(r => r.seenAt).join('/')} s (${saw.length}/8 had it in view); faced it ${saw.map(r => r.orient).join('/')} s later (p50 ${q(saw.map(r => r.orient), .5)}, worst ${q(saw.map(r => r.orient), 1)}); a new plan ${saw.map(r => r.choice).join('/')} s after the sighting (${[...new Set(rs.map(r => r.plan))].join(', ')}) | an unsensed person in the dark behind it in one place or another: the same creature tick for tick, never sensed ${same.filter(r => r.same).length}/4 (${same.map(r => r.ticks).join('/')} ticks)`, data: { rs, same } };
});

add('C04 interrupts: hungry, a bait round a corner is a short wait, then it looks again (no 9 s blind wait, no departure while its hunt is alive); a listen ends when the sound it waits for comes (footsteps behind a wall), not when its time is up; a watcher\'s twitch of the eyes is not an interrupt (no flicker)', () => {
  // (a) the bait: watched in the lit hall at .65-.75 (R8's own bait scene), every lure it begins
  const lures = [];
  over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    for (const h of [.65, .75]) {
      const w = World(seed + 11200 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
      const p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
      const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI; p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
      let L = null;
      w.run(35, (ww, t) => {
        const P = e.plan;
        if (P && P.k === 'lure' && (!L || L.P !== P)) { if (L && L.end < 0) L.end = t; L = { P, t0: t, end: -1, next: '', h: e.hunger, hunt: !!e.hunt }; lures.push(L); }
        else if (L && L.end < 0 && P !== L.P) { L.end = t; L.next = planOf(e); }
        return true; });
      if (L && L.end < 0) { L.end = 35; L.next = 'running'; }
    }
    return {};
  });
  const done = lures.filter(L => L.next !== 'running'), long = done.filter(L => L.end - L.t0 > LURE_MAX * 1.01 + .15), left = done.filter(L => L.next === 'leave' && L.hunt);
  // (b) the listen: footsteps behind a wall, nobody seen (PR12's scene): every listen begun on a sound, and when it ended
  const listens = over([1, 2, 3, 4, 5, 6], seed => {
    const w = World(seed + 11300); bystander(w, 8400, 900);
    const e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: .6 }); e.tier = 'near'; e.ang = 0;      // facing east, away from the wall
    const p = w.player(1300, 5900, { light: false, angle: 0 }); p.stop('stand');
    const out = []; let cur = null;
    w.run(12, (ww, t) => {
      if (t > .3 && !p.leg) { p.leg = 1; p.route([{ x: 1300, y: 5300 }, { x: 1300, y: 5900 }, { x: 1300, y: 5300 }], 'run'); }
      const P = e.plan;
      if (P && P.k === 'listen' && P.curious && (!cur || cur.P !== P)) { cur = { P, t0: t, end: -1, until: P.until - P.t0, follow: -1 }; out.push(cur); }
      if (cur && cur.end < 0 && cur.follow < 0 && e.mem.sounds.some(s => s.id > cur.P.curious.id)) cur.follow = t;
      if (cur && cur.end < 0 && e.plan !== cur.P) { cur.end = t; cur.next = planOf(e); }
      return true; });
    return { listens: out.map(L => ({ dur: +((L.end < 0 ? 12 : L.end) - L.t0).toFixed(2), planned: +L.until.toFixed(2), follow: L.follow < 0 ? null : +(L.follow - L.t0).toFixed(2), next: L.next })), seen: e.tally.hunt };
  });
  const all = listens.flatMap(r => r.listens), withFollow = all.filter(L => L.follow !== null && L.follow < L.planned - .25);
  const early = withFollow.filter(L => L.dur <= Math.max(.35, L.follow + .25));
  // (c) the negative: minor, noisy evidence is not an interrupt.  A watcher whose eyes twitch off it for a tenth of a second every 1.2 s
  // (shorter than its beat) at .55 and .75: no choice it records as taken on an opening, and no flicker (a plan dropped and the same kind
  // taken up again within 0.8 s)
  const twitch = over([1, 2, 3, 4, 5, 6], seed => [.55, .75].map(h => {
    const w = World(seed + 11400 + Math.round(h * 100)), y = LONG.y; bystander(w, 1300, 3300);
    const p = w.player(5000, y, { light: true, angle: 0 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 5450, y, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
    p.look = () => Math.atan2(e.y - p.y, e.x - p.x) + ((w.t % 1.2) < .1 ? 1.4 : 0);
    let n0 = 0, onOpening = 0, flick = 0; const seq = [];
    w.run(25, (ww, t) => {
      const C = e.cog; if (C && C.n > n0) { for (const L of C.log.slice(-(C.n - n0))) if (L.stim === 'opening' && / -> /.test(L.what)) onOpening++; n0 = C.n; }
      const k = planOf(e); if (!seq.length || seq[seq.length - 1].k !== k) seq.push({ k, t });
      return !w.kills.length; });
    for (let i = 2; i < seq.length; i++) if (seq[i].k === seq[i - 2].k && seq[i].t - seq[i - 1].t < .8 && !['roam', 'feed', 'hunt'].includes(seq[i - 1].k)) flick++;
    return { h, onOpening, flick, plans: seq.map(s => s.k).join('>').slice(0, 120) };
  })).flat();
  const twOpen = twitch.filter(r => r.onOpening > 0), twFlick = twitch.filter(r => r.flick > 0);
  const ok = done.length >= 3 && long.length === 0 && left.length === 0 && withFollow.length >= 3 && early.length === withFollow.length && twOpen.length === 0 && twFlick.length === 0;
  return { ok, note: `(a) ${lures.length} lures at .65/.75 (${done.length} ended): longest ${q(done.map(L => L.end - L.t0), 1)} s (limit ${LURE_MAX} s), over it ${long.length}; then ${[...new Set(done.map(L => L.next))].join('/')}; left while its hunt was alive ${left.length} | (b) ${all.length} listens on a sound; ${withFollow.length} had the next footstep before their time was up - all ended within 0.25 s of it: ${early.length}/${withFollow.length} (durations ${withFollow.map(L => L.dur).join('/')} s against ${withFollow.map(L => L.planned).join('/')} s planned) | (c) a watcher's 0.1 s twitches (12 runs): a choice taken on one ${twOpen.length}, a flicker ${twFlick.length}`, data: { lures: lures.slice(0, 20), listens, twitch } };
});

module.exports = S;
