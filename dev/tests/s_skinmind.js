/* SKIN-STEALER R11-R12 (dev/trial-3-r9-overhaul/; Trial 3 is not owner-approved): its mind - attention, motive, events, belief,
 * inference (the pack's C01-C15).  Each runs the real server simulation (sim.js + ai.js as built, players moved by the game's own move.js
 * through the harness) over several seeds.  No scenario sets a decision of the creature: they place people, give it a hunger (its spawn
 * option), move people as players would, and read what it did.  Where a scenario reads where a PERSON really is, that is the test's own
 * knowledge (the person's script, the QA sight oracle dev/trial-3-r9-overhaul/tools/qa_sight.js) - the creature never reads it. */
'use strict';
const fs = require('fs'), path = require('path');
const { World, DT, LONG, over, AI, bystander } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const planOf = e => e.plan ? e.plan.k : e.hunt ? 'hunt' : 'roam';
const HUNTING = new Set(['approach', 'chase', 'flank', 'intercept', 'search', 'lure', 'listen', 'hunt']);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : -1; };
const q90 = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * .9))] : -1; };

/* the long lit hall (s_skinpredator.js's): a person at (px, LONG.y) facing pa (or watching it), the creature ex px off, facing west */
function hall(seed, o = {}) {
  const w = World(seed), y = LONG.y; bystander(w, 1300, 3300);
  const p = w.player(o.px ?? 5000, y, { light: o.light !== false, angle: o.pa ?? 0 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', o.ex ?? 5450, y, { hunger: o.hunger }); e.tier = 'near'; e.ang = Math.PI;
  p.look = o.watch ? () => Math.atan2(e.y - p.y, e.x - p.x) : (o.pa ?? 0);
  return { w, p, e };
}
/* seen once (s_skinpredator.js's sw): a lit person walks north past wall C's gap where it sees them, light off past y 5440, on along a way */
const WAYS = { east: [{ x: 1720, y: 4900 }], back: [{ x: 1150, y: 5380 }, { x: 900, y: 5380 }, { x: 700, y: 5330 }],
  north: [{ x: 1250, y: 4870 }, { x: 480, y: 4870 }], northEast: [{ x: 1250, y: 4870 }, { x: 2080, y: 4870 }] };
function glimpse(seed, h, way, mode, T, on) {
  const w = World(seed + 3000); bystander(w, 8400, 900);
  const p = w.player(1300, 5600, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: h }); e.tier = 'near'; e.ang = Math.PI;
  w.run(T, (ww, t) => {
    if (t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5420 }, { x: 1300, y: 5150 }], 'walk'); }
    if (p.going === 1 && p.path && !p.path.length) { p.going = 2; p.route(WAYS[way], mode); }
    if (p.going === 2 && p.path && !p.path.length) { p.going = 3; p.stop('crouch'); }
    if (p.light && p.y < 5440) p.light = false;
    if (on) on(t, p, e, w);
    return true;
  });
  return { w, p, e };
}
const evs = (e, k) => e.mind.ev.filter(v => v.k === k);
/* it acknowledges p: it faces them (its look within .5 rad of them), or its head turns to them - at least .5 rad, its look at least .4 rad
 * nearer them than its body (the head's turn is what the page draws: the snapshot's h) */
const acks = (e, p) => { const b = Math.atan2(p.y - e.y, p.x - e.x), body = Math.abs(angDiff(b, e.ang)), look = Math.abs(angDiff(b, e.ang + (e.head || 0)));
  return look < .5 || (Math.abs(e.head || 0) >= .5 && look < body - .4); };

add('C01 a hungry one acts on its first real sighting at once: watched or not, hungry (.6) or very hungry (.75), the first step of a hunt follows the think it first saw them (within 0.25 s), and the sighting is an event it answered', () => {
  const rs = [];
  for (const [h, watch] of [[.6, true], [.75, true], [.6, false], [.75, false]]) rs.push(...over([1, 2, 3, 4], seed => {
    const { w, p, e } = hall(seed + 7100, { hunger: h, watch, pa: watch ? 0 : Math.PI }); let seenAt = -1, huntAt = -1;
    w.run(4, (ww, t) => { if (seenAt < 0 && e.seenNow.has(p.id)) seenAt = t; if (huntAt < 0 && seenAt >= 0 && (e.hunt || (HUNTING.has(planOf(e)) && e.plan.pid === p.id) || planOf(e) === 'retreat')) huntAt = t; return true; });
    const s = evs(e, 'sight').find(v => v.pid === p.id);
    return { h, watch, seenAt: +seenAt.toFixed(2), lag: huntAt >= 0 ? +(huntAt - seenAt).toFixed(2) : -1, resp: s ? s.resp : -2 };
  }));
  const ok = rs.every(r => r.lag >= 0 && r.lag <= .25 && r.resp >= 0 && r.resp <= .25);
  return { ok, note: `first hunt step after first sight: ${rs.map(r => r.lag).join('/')} s; the sighting event answered in ${rs.map(r => r.resp).join('/')} s (h .6 / .75, watched / unaware x 4 seeds)` };
});
add('C02 a satiated one (.1) still acknowledges: turned 57 deg away from a person watching it from 450 px (at the edge of its sight), within 2 s it faces them or turns its head to them (at least .5 rad, its look at least .4 rad nearer them than its body), whatever it then decides - it does not hunt them; the same for a person who walks toward it from 520 px and stops at 300', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const { w, p, e } = hall(seed + 7200, { hunger: .1, watch: true }); e.ang = Math.PI - 1; let lookAt = -1, seenAt = -1;
    w.run(6, (ww, t) => { if (seenAt < 0 && e.seenNow.has(p.id)) seenAt = t;
      if (seenAt >= 0 && lookAt < 0 && acks(e, p)) lookAt = t; return true; });
    const hunted = e.tally.hunt > 0 || e.tally.pounce > 0 || w.kills.length > 0;
    return { lag: lookAt >= 0 ? +(lookAt - seenAt).toFixed(2) : -1, hunted };
  });
  const walk = over([1, 2, 3, 4], seed => {
    const { w, p, e } = hall(seed + 7250, { hunger: .1, px: 4930 }); e.ang = Math.PI - 1; let lookAt = -1, seenAt = -1;
    p.look = null; p.route([{ x: 5150, y: LONG.y }], 'walk');
    w.run(7, (ww, t) => { if (seenAt < 0 && e.seenNow.has(p.id)) seenAt = t;
      if (seenAt >= 0 && lookAt < 0 && acks(e, p)) lookAt = t; return true; });
    return { lag: lookAt >= 0 ? +(lookAt - seenAt).toFixed(2) : -1, hunted: e.tally.hunt > 0 || e.tally.pounce > 0 };
  });
  const ok = rs.every(r => r.lag >= 0 && r.lag <= 2 && !r.hunted) && walk.every(r => r.lag >= 0 && r.lag <= 2 && !r.hunted);
  return { ok, note: `watched from 450 px: turned to them after ${rs.map(r => r.lag).join('/')} s, hunted ${rs.filter(r => r.hunted).length} | walked up to 300 px: ${walk.map(r => r.lag).join('/')} s, hunted ${walk.filter(r => r.hunted).length}` };
});

add('C03 starving (.95), watched in the narrow north corridor where there is no way round: it watches at most briefly and then takes a physically possible open action - it comes on (or gives chase), never stands there for good and never leaves', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const w = World(seed + 7300); bystander(w, 1200, 4500);
    const p = w.player(1170, 4400, { light: true, angle: Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 1170, 4780, { hunger: .95 }); e.tier = 'near'; e.ang = -Math.PI / 2; p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
    let openAt = -1, watchRun = 0, watchMax = 0, left = 0;
    w.run(15, (ww, t) => { const k = planOf(e); if (k === 'watch') { watchRun += DT; watchMax = Math.max(watchMax, watchRun); } else watchRun = 0;
      if (openAt < 0 && (k === 'approach' || k === 'chase') && e.seenNow.has(p.id)) openAt = t; if (k === 'leave') left++; return true; });
    return { openAt: +openAt.toFixed(1), watchMax: +watchMax.toFixed(1), left, kills: w.kills.length, flank: e.tally.flank };
  });
  return { ok: rs.every(r => r.openAt >= 0 && r.openAt < 6 && r.watchMax < 3 && r.left === 0), note: `open approach at ${rs.map(r => r.openAt).join('/')} s; longest watch ${rs.map(r => r.watchMax).join('/')} s; left ${rs.map(r => r.left).join('/')}; flanks tried ${rs.map(r => r.flank).join('/')}; kills ${rs.map(r => r.kills).join('/')}` };
});
add('C04 one glimpse can be enough: a lit person seen walking north past the gap, then gone (torch off, walking on east / north-east), hungry (.75): from that one glimpse it moves to cut them off or to look for them out of their sight (an interception, a flank, a lure or a search) in most runs', () => {
  const rs = [];
  for (const way of ['east', 'northEast']) rs.push(...over([1, 2, 3, 4], seed => {
    let seen = 0, first = '';
    const { e, w } = glimpse(seed + 100, .75, way, 'walk', 14, (t, p, e) => { if (e.seenNow.has(p.id)) seen++; const k = planOf(e); if (!first && ['intercept', 'flank', 'lure', 'search'].includes(k)) first = k; });
    return { way, seen: +(seen * DT).toFixed(1), first: first || '-', kills: w.kills.length, hunt: e.tally.hunt };
  }));
  const moved = rs.filter(r => r.first !== '-');
  return { ok: moved.length >= Math.ceil(rs.length * .6), note: `${moved.length}/${rs.length} moved on the glimpse (${rs.map(r => r.way[0] + ':' + r.first).join(' ')}); in its sight ${rs.map(r => r.seen).join('/')} s; kills ${rs.map(r => r.kills).join('/')}` };
});
add('C05 nothing names a person it has not seen: footsteps behind a wall (it never sees them) - every sound event it logs is anonymous, it keeps no record, no observation, no plan or hunt about them', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const w = World(seed + 7500);
    const p = w.player(780, 4950, { light: false, angle: Math.PI / 2 }); p.stop('stand');
    const e = w.eng.spawn('skinstealer', 1300, 5180, { hunger: .7 }); e.tier = 'near'; e.ang = 0;
    let named = 0, seenAt = -1;
    w.run(12, (ww, t) => { if (t > 1 && !p.going) { p.going = 1; p.route([{ x: 780, y: 5300 }, { x: 600, y: 5900 }], 'run'); }
      if (e.seenNow.has(p.id)) { if (seenAt < 0) seenAt = t; return true; }
      if (seenAt < 0 && (e.mem.p.has(p.id) || e.mind.obs.has(p.id) || (e.plan && e.plan.pid === p.id) || (e.hunt && e.hunt.pid === p.id) || e.mind.ev.some(v => v.pid === p.id))) named++;
      return true; });
    const sounds = e.mind.ev.filter(v => v.k === 'sound');
    return { named, seenAt: +seenAt.toFixed(1), sounds: sounds.length, anon: sounds.filter(v => !v.pid).length };
  });
  return { ok: rs.every(r => r.named === 0) && rs.some(r => r.sounds > 0) && rs.every(r => r.sounds === r.anon || r.seenAt >= 0), note: `named before a sighting: ${rs.map(r => r.named).join('/')}; sound events ${rs.map(r => r.sounds).join('/')} (anonymous ${rs.map(r => r.anon).join('/')}); first seen at ${rs.map(r => r.seenAt).join('/')} s (-1: never)` };
});
add('C06 another player\'s footsteps can mislead it: A is seen, then crouches torchless out of its sight; B, never seen, runs up and down a lane nearby - it takes B\'s running for A in some runs (its belief and guesses move toward B), and never names B', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    let nearB = 0, namedB = 0, B = null;
    const { e } = glimpse(seed + 200, .8, 'north', 'crouch', 24, (t, p, e, w) => {
      if (!B && t > 4) { B = w.player(1700, 4880, { light: false, angle: 0 }); B.lane = [{ x: 2150, y: 4880 }, { x: 1700, y: 4880 }]; }
      if (B) { if (!B.path || !B.path.length) B.route(B.lane.slice(), 'run'), B.lane.reverse(); if (e.mem.p.has(B.id) && !e.seenNow.has(B.id) && !(e.mem.p.get(B.id).seenAt > 0)) namedB++;
        const H = e.hunt; if (H && H.pid === p.id && !e.seenNow.has(p.id) && Math.hypot(H.x - B.x, H.y - B.y) < Math.hypot(H.x - p.x, H.y - p.y)) nearB++; }
    });
    return { nearB: +(nearB * DT).toFixed(1), namedB, heardQ: e.tally.heardQ };
  });
  return { ok: rs.filter(r => r.nearB > 1).length >= 2 && rs.every(r => r.namedB === 0), note: `its belief nearer B than A for ${rs.map(r => r.nearB).join('/')} s; sounds taken for A ${rs.map(r => r.heardQ).join('/')}; B named without a sighting ${rs.map(r => r.namedB).join('/')}` };
});
add('C07 no sound, no sight: a person seen once who then crouches out of its sight and stays silent is given up - the hunt ends for a stated reason within its forgetting time, and does not come back without new evidence', () => {
  // (a run where it never saw the person at all - the glimpse missed it - has no hunt to give up: it is reported, not counted; at least
  // five of the eight seeds must have the glimpse)
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], seed => {
    let endAt = -1, why = '', again = 0, saw = false;
    const { e } = glimpse(seed + 300, .8, 'north', 'crouch', 60, (t, p, e) => { if (e.seenNow.has(p.id)) saw = true; if (endAt < 0 && e.dbg.huntEnd && e.dbg.huntEnd.pid === p.id && !e.hunt) { endAt = t; why = e.dbg.huntEnd.why; } if (endAt >= 0 && e.hunt && e.hunt.pid === p.id && !e.seenNow.has(p.id)) again++; });
    return { saw, hunted: e.tally.hunt > 0, endAt: +endAt.toFixed(1), why: why.slice(0, 50), again };
  });
  const tried = rs.filter(r => r.saw && r.hunted);
  return { ok: tried.length >= 5 && tried.every(r => r.endAt > 0 && r.endAt < 55 && r.again === 0), note: rs.map(r => !r.saw ? 'never saw them' : !r.hunted ? 'saw them, did not hunt' : `ended at ${r.endAt} s ("${r.why}")${r.again ? ' CAME BACK ' + r.again : ''}`).join(' | ') };
});
add('C08 two worlds the same to its senses give the same creature: a person seen once who then walks silently (crouched) one way or the other - its every decision, place and belief are identical until it next senses them', () => {
  const rs = over([1, 2, 3, 4], seed => {
    const run = way => { const tr = []; let sensed = -1;
      glimpse(seed + 400, .8, way, 'crouch', 16, (t, p, e) => { if (sensed < 0 && t > 3 && (e.seenNow.has(p.id) || e.mind.ev.some(v => v.k === 'sound' && v.t > 63))) sensed = tr.length;
        const H = e.hunt; tr.push([Math.round(e.x * 10), Math.round(e.y * 10), planOf(e), e.act, H ? [Math.round(H.x), Math.round(H.y), +H.conf.toFixed(3)].join(',') : '-'].join('|')); });
      return { tr, sensed }; };
    const A = run('north'), B = run('northEast'), until = Math.min(A.sensed < 0 ? 1e9 : A.sensed, B.sensed < 0 ? 1e9 : B.sensed, A.tr.length);
    let diff = -1; for (let i = 0; i < until; i++) if (A.tr[i] !== B.tr[i]) { diff = i; break; }
    return { diff, until, len: A.tr.length };
  });
  return { ok: rs.every(r => r.diff < 0 && r.until > 300), note: rs.map(r => `identical for ${r.until} ticks (first difference ${r.diff})`).join(' | ') };
});
add('C09 no hidden truth leaks: while it cannot sense a person, nothing it keeps (belief, observation, events, debug) holds where they really are; the snapshot carries only its public fields', () => {
  const rs = over([1, 2, 3, 4], seed => {
    let leak = 0, n = 0, keys = new Set();
    glimpse(seed + 500, .8, 'north', 'crouch', 20, (t, p, e, w) => {
      for (const k of Object.keys(AI.SKIN.snap(e))) keys.add(k);
      if (e.seenNow.has(p.id) || w.eng.now - (e.mem.p.get(p.id) || { heardAt: -99 }).heardAt < 1) return; n++;
      const H = e.hunt, near = (x, y) => Math.abs(x - p.x) < .5 && Math.abs(y - p.y) < .5;
      if (H && near(H.x, H.y)) leak++;
      const d = AI.SKIN.debug(w.eng, e); if (JSON.stringify(d).includes(`${Math.round(p.x)},${Math.round(p.y)}`)) leak++;
    });
    return { leak, n, keys: [...keys].sort().join(',') };
  });
  const PUB = 'a,ac,h,i,s,v,x,y';
  return { ok: rs.every(r => r.leak === 0 && r.n > 100 && r.keys === PUB), note: `unsensed ticks ${rs.map(r => r.n).join('/')}, holding their true place ${rs.map(r => r.leak).join('/')}; snapshot fields ${rs[0].keys}` };
});
add('C10 confidence fades without evidence and a failed place is forgotten in time: after it loses a silent person its hunt confidence only falls (no evidence lifts it) and a place it found empty is no longer held after its memory time', () => {
  const rs = over([1, 2, 3, 4], seed => {
    let rise = 0, last = 2, failedMax = 0, failedLate = -1;
    const { e } = glimpse(seed + 600, .8, 'north', 'crouch', 75, (t, p, e) => { const H = e.hunt; if (H && H.pid === p.id && !e.seenNow.has(p.id) && H.ev !== 'heard') { if (H.conf > last + 1e-6 && H.ev !== 'seen') rise++; last = H.conf; failedMax = Math.max(failedMax, H.failed.length); } else last = 2; });
    return { rise, failedMax, hunts: e.tally.hunt };
  });
  // (the forgetting of failed places: a hunt object's failures older than SK.failedTtl are dropped - checked directly on its own record)
  const { e, w } = glimpse(7, .8, 'north', 'crouch', 4); const H = e.hunt || { failed: [] }; H.failed = [{ x: 0, y: 0, t: w.eng.now - AI.SK.failedTtl - 1, k: 'x' }]; if (e.hunt) { w.run(.3); }
  const forgot = !e.hunt || e.hunt.failed.every(f => w.eng.now - f.t <= AI.SK.failedTtl);
  return { ok: rs.every(r => r.rise === 0) && forgot, note: `confidence rises without evidence ${rs.map(r => r.rise).join('/')}; most failed places held ${rs.map(r => r.failedMax).join('/')}; an expired failure forgotten ${forgot}` };
});
add('C11 seeing them again where it did not expect corrects it at once: while it waits at a wrong guess, the person shows up elsewhere in its sight - within 0.25 s it answers that sighting (a new plan about where they really are now)', () => {
  const rs = over([1, 2, 3, 4], seed => {
    let guessAt = -1, showAt = -1, resp = -1, shown = false;
    const { e } = glimpse(seed + 700, .8, 'back', 'crouch', 26, (t, p, e, w) => {
      const k = planOf(e); if (guessAt < 0 && ['intercept', 'search', 'listen'].includes(k) && !e.seenNow.has(p.id)) guessAt = t;
      if (guessAt >= 0 && !shown && t > guessAt + 2) { shown = true; showAt = t; p.light = true; p.stop('stand'); const a = Math.atan2(e.y - p.y, e.x - p.x); const q = w.ad.clear(e.x - Math.cos(a) * 300, e.y - Math.sin(a) * 300, 24, 'walk') ? { x: e.x - Math.cos(a) * 300, y: e.y - Math.sin(a) * 300 } : null; void q; p.look = () => Math.atan2(e.y - p.y, e.x - p.x); p.route([{ x: e.x + 250 * Math.cos(e.ang), y: e.y + 250 * Math.sin(e.ang) }], 'run'); }
      if (shown && resp < 0) { const s = e.mind.ev.find(v => v.k === 'sight' && v.pid === p.id && v.t > showAt + 60 - .01); if (s && s.resp >= 0) resp = s.resp; }
    });
    return { guessAt: +guessAt.toFixed(1), resp, hunt: e.tally.hunt };
  });
  const tried = rs.filter(r => r.resp >= 0);
  return { ok: tried.length >= 3 && tried.every(r => r.resp <= .25), note: `answered the new sighting in ${rs.map(r => r.resp).join('/')} s (guess at ${rs.map(r => r.guessAt).join('/')} s)` };
});
add('C12 effort is never refilled by a change of plan: the seconds it has spent on one person only grow while its attention stays on them, through every plan it switches between', () => {
  const rs = over([1, 2, 3, 4, 5, 6], seed => {
    const { w, p, e } = hall(seed + 7800, { hunger: .75, watch: true }); let drop = 0, last = -1, plans = new Set();
    w.run(20, () => { if (e.enc && e.enc.pid === p.id) { if (e.enc.spent < last - 1e-6) drop++; last = e.enc.spent; } plans.add(planOf(e)); return true; });
    return { drop, plans: plans.size };
  });
  return { ok: rs.every(r => r.drop === 0), note: `effort fell ${rs.map(r => r.drop).join('/')} times across ${rs.map(r => r.plans).join('/')} plans` };
});
add('C13 plans hold without flicker: watched by a person who strolls (X), no plan lasts under 0.3 s except where an event answered it (a sighting, a loss, being seen) - no stale plan kept after a contradicting event', () => {
  const rs = over([1, 2, 3, 4], seed => {
    const { w, p, e } = hall(seed + 7900, { hunger: .75, watch: true }); let lastP = null, t0 = 0, short = 0, n = 0;
    w.run(20, (ww, t) => { if (t > 2 && !p.going) { p.going = 1; p.route([{ x: 4700, y: LONG.y }, { x: 5050, y: LONG.y }, { x: 4650, y: LONG.y }], 'walk'); }
      if (e.plan !== lastP) { if (lastP && t - t0 < .3 && !e.mind.ev.some(v => Math.abs(v.t - (w.eng.now - (t - t0))) < .35)) short++; n++; lastP = e.plan; t0 = t; } return true; });
    return { short, n };
  });
  return { ok: rs.every(r => r.short <= 1), note: `plans under 0.3 s with no event behind them ${rs.map(r => r.short).join('/')} (of ${rs.map(r => r.n).join('/')} plan changes)` };
});
add('C14 it answers events fast and never idles while a hungry hunt is possible: across these scenes the median answer to a sighting or a loss is under 0.25 s (90 % under 0.7 s) - and so is the median of the answers that changed its plan (R16), at least a third of them; hungry (.75) with a lone person in view it never stands watching for more than 3 s at a stretch', () => {
  const lat = [], idle = [], how = {}, latC = [];
  for (const seed of [1, 2, 3, 4]) {
    const { w, p, e } = hall(seed + 8000, { hunger: .75, watch: seed % 2 === 0, pa: seed % 2 ? Math.PI : 0 }); let run = 0, mx = 0;
    w.run(15, () => { if (planOf(e) === 'watch') { run += DT; mx = Math.max(mx, run); } else run = 0; return true; });
    idle.push(+mx.toFixed(1)); for (const v of e.mind.ev) if ((v.k === 'sight' || v.k === 'lost') && v.resp >= 0) { lat.push(v.resp), how[v.how] = (how[v.how] || 0) + 1; if (v.how === 'changed') latC.push(v.resp); }
    const g = glimpse(seed + 800, .75, 'east', 'walk', 14); for (const v of g.e.mind.ev) if ((v.k === 'sight' || v.k === 'lost') && v.resp >= 0) { lat.push(v.resp), how[v.how] = (how[v.how] || 0) + 1; if (v.how === 'changed') latC.push(v.resp); }
  }
  // (an answer is a decision that weighed the event: a change of plan, or the plan kept because it goes on without a sighting / is still clearly
  // the best - ai.skin.mind.js skMindKept; how many of each is reported)
  // (R16, the independent review: a 'kept' answer comes on its next think by construction - so the answers that CHANGED its plan are held to the
  // same bars on their own, and must be at least a third of all)
  return { ok: lat.length >= 8 && med(lat) <= .25 && q90(lat) <= .7 && latC.length >= Math.max(4, lat.length / 3) && med(latC) <= .25 && q90(latC) <= .7 && idle.every(x => x <= 3), note: `answers to sight/loss events: ${lat.length} (${Object.entries(how).map(([k, n]) => k + ' ' + n).join(', ')}), median ${med(lat)} s, 90 % ${q90(lat)} s; the ${latC.length} that changed its plan: median ${latC.length ? med(latC) : '-'} s, 90 % ${latC.length ? q90(latC) : '-'} s; longest watch while hungry with a lone person in view ${idle.join('/')} s` };
});
/* C15: with no Skin-Stealer in the world, the Hounds, the Smilers and everything else run exactly as on R8: the per-second snapshot hashes
 * of this tree against R8's own (fixtures/c15_r8.json, made by dev/trial-3-r9-overhaul/tools/c15_hashes.js on R8 f378049) */
add('C15 no Skin-Stealer, no difference: 30 s of the director\'s Hounds and Smilers with four players moving, three seeds - every snapshot of this tree is R8\'s, byte for byte (the per-second hashes stored from f378049); R19 N: with the shared cornering hunks (r19n_patch.js) taken back out - the one difference from R8 the N track makes, which moves Hounds and Smilers differently at some bends', () => {
  const F = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'trial-3-r9-overhaul', 'fixtures', 'c15_r8.json'), 'utf8'));
  // (Trial 3 R19, the N track, dev/trial-3-nani-corners/DESIGN_DECISIONS.md N1) a child process runs this tree with exactly the N hunks taken
  // out of the built ai.js (r19n_c15.js): every snapshot must be R8's.  This tree as built is run too, and how many seconds differ reported
  const out = require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'r19n_c15.js'), path.join(__dirname, '..', '..')], { maxBuffer: 1 << 26 }).toString();
  const R = JSON.parse(out), now = R.runs, asBuilt = require('../trial-3-r9-overhaul/tools/c15_hashes.js').hashes(path.join(__dirname, '..', '..'));
  const diff = Object.keys(F.runs).filter(k => JSON.stringify(F.runs[k]) !== JSON.stringify(now[k]));
  const moved = Object.keys(F.runs).map(k => (asBuilt[k] || []).filter((h, i) => h !== F.runs[k][i]).length);
  return { ok: R.took === 1 && !diff.length && Object.keys(F.runs).length === 3, note: `without the N hunks: runs ${Object.keys(F.runs).join(', ')}: ${diff.length ? 'DIFFERENT ' + diff.join(',') : 'identical'} (${Object.values(now).reduce((a, r) => a + r.length, 0)} snapshot hashes; R8 fixture from ${F.from}) | as built, seconds whose snapshot differs from R8 (the N hunks' cornering): ${moved.join('/')}` };
});

S.helpers = { hall, glimpse, planOf };                         // (for development tools; run.js reads only the list)
module.exports = S;
