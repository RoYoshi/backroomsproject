/* RETIRED in Part 2D (v23.1): these scenarios encode the pre-canon, light-averse Smiler (fades in light, lamp avoidance, light-failure attacks, play captures, quirks).  Superseded by s_smiler.js (canon). Kept for reference only; not run. */
/* SMILER scenarios */
'use strict';
const { World, DT, dist, LONG, geo, over, rate, avg, stateNames, WORLD, TAU, pick, tracker } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });

/* a dark cell for the player and another dark cell with a clear line to it, `lo`..`hi` px away */
function darkPair(i, lo = 450, hi = 800, need = {}) {
  const G = geo(), g = G.g, seenP = new Set();
  for (let k = 0; k < 400; k++) {
    const p = G.dark[(i * 131 + k * 17) % G.dark.length]; if (!p || !G.ad.clear(p.x, p.y, 24, 'walk')) continue;
    const cand = G.dark.filter(c => { const d = Math.hypot(c.x - p.x, c.y - p.y); return d >= lo && d <= hi && g.los(c.x, c.y, p.x, p.y) && G.ad.clear(c.x, c.y, 24, 'walk'); });
    if (!cand.length) continue;
    const s = cand[(i * 7) % cand.length];
    if (need.deadEnd) { const arcs = G.arcs(p.x, p.y); if (!(arcs.arcs <= 1 && arcs.frac < .34)) continue; }
    return { p, s };
  }
  return null;
}
/* a player standing still in the dark, a smiler in another dark spot with a view of them */
function setup(seed, o = {}) {
  const pr = darkPair(seed, o.lo || 450, o.hi || 800, o); if (!pr) return null;
  const w = World(seed + 1000), p = w.player(pr.p.x, pr.p.y, { light: !!o.light }); p.stop(o.mode || 'stand'); p.angle = Math.atan2(pr.s.y - pr.p.y, pr.s.x - pr.p.x);
  const s = w.smiler(pr.s.x, pr.s.y); s.ang = Math.atan2(pr.p.y - pr.s.y, pr.p.x - pr.s.x); s.cool.special = o.special ?? s.cool.special;
  return { w, p, s, pr };
}
/* the smiler has seen the player: now put it on the trail (the engine's own STALKING state, entered through its own transition data) */
function forceStalk(w, s, p, style) {
  w.until(6, () => { const r = s.mem.p.get(p.id); return r && r.seen; });
  const r = s.mem.p.get(p.id); if (!r) return false;
  s.state = 'STALKING'; s.act = 'creep'; s.stateT = 0; s.actT = 0; s.target = p.id; s.style = style || 'rush'; s.stalk = { since: w.eng.now, hold: 0, rid: p.id, decided: false }; s.face = .85; s.faceT = .85; s.exposed = 0; s.path = []; s.goalKey = '';
  return true;
}

add('S01 a smiler dropped in the light does not stay there: it fades within a moment and is back in the dark', () => {
  const G = geo(); const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], i => {
    const c = G.lit[(i * 37 + 5) % G.lit.length], D = pick(G.dark, c.x, c.y, 900, 1500, i); if (!D) return { ok: false, why: 'no dark pair' };
    const w = World(300 + i), p = w.player(D.x, D.y, { light: false }); p.stop('crouch'); const s = w.smiler(c.x, c.y); const T = tracker(w, s);
    let fadeAt = -1, darkAt = -1;
    w.run(14, (ww, t) => { T.tick(); if (fadeAt < 0 && s.state === 'DISAPPEARING') fadeAt = t; if (fadeAt >= 0 && darkAt < 0 && (s.lit || 0) < .45 && s.state !== 'DISAPPEARING') darkAt = t; }, 1);
    const startedLit = true;
    return { ok: fadeAt >= 0 && fadeAt < .6 && T.litStillMax < .5 && T.litTime < 3.2, fadeAt: +fadeAt.toFixed(2), litMax: +T.litStillMax.toFixed(2), litTime: +T.litTime.toFixed(2), darkAt: +darkAt.toFixed(2), jump: +T.jump.toFixed(1) };
  });
  return { ok: rate(rs) >= .9, note: `${(rate(rs) * 100) | 0}% faded within .6 s (avg ${avg(rs.filter(r => r.fadeAt >= 0).map(r => r.fadeAt)).toFixed(2)}s); most it ever stood still in strong light ${Math.max(...rs.map(r => r.litMax || 0)).toFixed(2)}s, most total time lit while escaping ${Math.max(...rs.map(r => r.litTime || 0)).toFixed(2)}s` };
});
add('S02 a flashlight beam on a smiler makes it fade (its own reason: "lit"); it never keeps standing in the beam', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], i => {
    const A = setup(i, { light: true, lo: 185, hi: 212 }); if (!A) return { ok: false, why: 'no pair' };
    const { w, p, s } = A; p.light = false; w.run(.6, null); const still = s.state === 'HIDDEN' || s.state === 'WATCHING'; p.light = true;           // the torch comes on and swings onto it
    const T = tracker(w, s); let fade = -1, lit0 = -1, why = '';
    w.run(6, (ww, t) => { p.angle = Math.atan2(s.y - p.y, s.x - p.x); T.tick(); if (lit0 < 0 && T.lit > .6) lit0 = t; if (fade < 0 && s.state === 'DISAPPEARING') { fade = t; why = s.disap && s.disap.why; } }, 1);
    return { ok: still && fade >= 0 && fade < .8 && T.litStillMax < .5, fade: +fade.toFixed(2), lit0: +lit0.toFixed(2), why, still };
  });
  const v = rs.filter(r => r.still && r.fade >= 0);
  return { ok: rate(rs) >= .75, note: `${(rate(rs) * 100) | 0}% faded within .8 s of being lit (${v.length} valid runs; first lit at ${avg(v.filter(r => r.lit0 >= 0).map(r => r.lit0)).toFixed(2)}s, faded at ${avg(v.map(r => r.fade)).toFixed(2)}s; reasons ${[...new Set(v.map(r => r.why))].join('/')})` };
});
add('S03 no teleporting: smilers and hounds move a bounded distance every tick, whatever they are doing', () => {
  let worstS = 0, worstH = 0, at = null, n = 0;
  for (let i = 1; i <= 16; i++) {
    const A = setup(i, { lo: 500, hi: 900 }); if (!A) continue; const { w, p, s } = A;
    const G = geo(), hd = pick(G.dark, p.x, p.y, 1100, 1600, i), h = hd && w.hound(hd.x, hd.y);
    p.route([{ x: p.x + 180, y: p.y }, { x: p.x - 200, y: p.y + 60 }, { x: p.x, y: p.y - 150 }], i % 2 ? 'walk' : 'run'); n++;
    const Ts = tracker(w, s), Th = h && tracker(w, h);
    w.run(150, () => { Ts.tick(); Th && Th.tick(); if (p.dead) return false; }, 1);
    if (Ts.jump > worstS) { worstS = Ts.jump; at = Ts.jumpAt; } if (Th && Th.jump > worstH) worstH = Th.jump;
  }
  return { ok: n >= 10 && worstS < 9 && worstH < 12, note: `${n} runs of 150s; biggest single-tick step: smiler ${worstS.toFixed(1)}px (${(worstS * 60) | 0}px/s), hound ${worstH.toFixed(1)}px (${(worstH * 60) | 0}px/s)${at ? ' @' + JSON.stringify(at) : ''}` };
});
add('S04 smiler state coverage: HIDDEN, WATCHING, FOLLOWING, STALKING, PROVOKED/ATTACKING, PLAYING, DISAPPEARING arise on their own', () => {
  const seen = new Set(); let kills = 0;
  for (let i = 1; i <= 24; i++) {
    const A = setup(i, { lo: 500, hi: 900 }); if (!A) continue; const { w, p, s } = A;
    p.route([{ x: p.x + 120, y: p.y }, { x: p.x - 120, y: p.y + 40 }, { x: p.x, y: p.y - 100 }, { x: p.x + 60, y: p.y + 60 }], 'walk'); let loops = 0;
    w.run(240, (ww, t) => { seen.add(s.state); if (!p.path || !p.path.length) { p.route([{ x: p.x + 120, y: p.y }, { x: p.x - 120, y: p.y + 40 }, { x: p.x, y: p.y - 100 }], 'walk'); } if (p.caught && s.cap && s.cap.phase === 'crawl') p.go(p.x + 40, p.y, 'crawl'); if (p.dead) { kills++; return false; } }, 3);
  }
  const need = ['HIDDEN', 'WATCHING', 'FOLLOWING', 'STALKING', 'DISAPPEARING'], any = ['PROVOKED', 'ATTACKING'];
  const miss = need.filter(n => !seen.has(n)); if (!any.some(n => seen.has(n))) miss.push('PROVOKED|ATTACKING');
  return { ok: miss.length === 0, note: `visited ${[...seen].join(', ')} (${kills} kills)${miss.length ? '   MISSING ' + miss.join(', ') : ''}` };
});
add('S05 running provokes it: a runner within its reach is rushed out of the darkness at once (variant A); a person standing still much less so', () => {
  const run = (i, mode) => {
    const A = setup(i, { lo: 240, hi: 320, mode }); if (!A) return null; const { w, p, s } = A; if (!forceStalk(w, s, p)) return null;
    let prov = -1, kill = null; const t0 = w.t;
    if (mode === 'run') { const perp = Math.atan2(p.y - s.y, p.x - s.x) + Math.PI / 2 * (i % 2 ? 1 : -1); p.go(p.x + Math.cos(perp) * 90, p.y + Math.sin(perp) * 90, 'run'); }
    w.run(20, () => { if (prov < 0 && s.state === 'PROVOKED') prov = w.t - t0; if (w.kills.length) { kill = w.kills[0]; return false; } }, 1);
    return { prov, kill: kill && kill.variant };
  };
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const rr = seeds.map(i => run(i, 'run')).filter(Boolean), st = seeds.map(i => run(i, 'stand')).filter(Boolean);
  const rp = rate(rr, r => r.prov >= 0 && r.prov < 2), sp = rate(st, r => r.prov >= 0 && r.prov < 2), kills = rr.filter(r => r.kill), A = kills.length ? rate(kills, r => r.kill === 'A') : 0;
  return { ok: rr.length >= 6 && rp >= .7 && sp < rp, note: `provoked within 2 s: runners ${(rp * 100) | 0}% (${rr.length} runs) vs standing ${(sp * 100) | 0}% (${st.length} runs); runner kills that were variant A: ${(A * 100) | 0}% of ${kills.length}` };
});
add('S06 cornered in a dead end: the smiler closes slowly and the kill is the "cornered" one (variant B)', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], i => {
    const A = setup(i, { lo: 380, hi: 560, deadEnd: true }); if (!A) return null; const { w, p, s } = A; if (!forceStalk(w, s, p)) return null;
    let kill = null, att = false; w.run(40, () => { if (s.state === 'ATTACKING') att = true; if (w.kills.length) { kill = w.kills[0]; return false; } }, 1);
    return { att, v: kill && kill.variant };
  }).filter(Boolean);
  const done = rs.filter(r => r.v);
  return { ok: rs.length >= 5 && done.length >= 4 && rate(done, r => r.v === 'B') >= .8, note: `${rs.length} dead-end setups, ${done.length} kills, ${(rate(done, r => r.v === 'B') * 100) | 0}% variant B (${done.map(r => r.v).join('')})` };
});
add('S07 light failure: rare, only for someone standing in the light, three stages each one closer, then a kill (variant C)', () => {
  const G = geo(); const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], i => {
    const L = G.lit.filter(c => G.ad.clear(c.x, c.y, 24, 'walk'));
    for (let k = 0; k < 200; k++) {
      const c = L[(i * 41 + k * 13) % L.length], d = pick(G.dark, c.x, c.y, 330, 480, k); if (!d || !G.g.los(d.x, d.y, c.x, c.y)) continue;
      const w = World(500 + i), p = w.player(c.x, c.y, { light: true }); p.stop('stand'); const s = w.smiler(d.x, d.y); s.cool.special = 0; s.ang = Math.atan2(c.y - d.y, c.x - d.x);
      if (!forceStalk(w, s, p)) continue;
      const dists = [], evs = []; let kill = null;
      const lf0 = w.evLog.length; w.run(60, () => { const l = w.evLog.filter((e, j) => j >= lf0 && e.t === 'lightfail'); if (l.length > evs.length) { evs.push(l[l.length - 1]); dists.push(Math.round(dist(s, p))); } if (w.kills.length) { kill = w.kills[0]; return false; } }, 1);
      return { ok: true, stages: evs.length, dists, v: kill && kill.variant, cool: +s.cool.special.toFixed(0), attacked: dists.length > 0 };
    }
    return null;
  }).filter(Boolean);
  const att = rs.filter(r => r.attacked), closer = att.filter(r => r.dists.length >= 3 && r.dists[0] > r.dists[1] && r.dists[1] > r.dists[2]);
  return { ok: rs.length >= 6 && att.length >= 3 && closer.length >= Math.ceil(att.length * .6) && att.every(r => r.v === 'C' || !r.v) && att.every(r => r.cool > 150), note: `${att.length}/${rs.length} runs triggered it; ${closer.length} showed three stages each closer (distances ${att.slice(0, 3).map(r => r.dists.join('>')).join(' | ')}); kills ${att.map(r => r.v || '-').join('')}; cooldown after use ${att.map(r => r.cool).join(',')}s` };
});
add('S08 groups are followed, not engaged: people together are never stalked or killed by a smiler; a lone player is', () => {
  const run = (i, group) => {
    const pr = darkPair(i, 500, 900); if (!pr) return null; const w = World(700 + i + (group ? 50 : 0)), a = w.player(pr.p.x, pr.p.y, { light: false }); a.stop('stand'); let b = null;
    if (group) { b = w.player(pr.p.x + 70, pr.p.y + 40, { light: false }); if (!w.ad.clear(b.x, b.y, 20, 'walk')) { b.x = pr.p.x - 60; b.y = pr.p.y; } b.stop('stand'); }
    const s = w.smiler(pr.s.x, pr.s.y); s.ang = Math.atan2(pr.p.y - pr.s.y, pr.p.x - pr.s.x); const seen = new Set(); let killed = false;
    w.run(400, () => { seen.add(s.state); if (a.dead || (b && b.dead)) { killed = true; return false; } }, 4);
    return { killed, stalked: seen.has('STALKING'), followed: seen.has('FOLLOWING') };
  };
  const lone = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => run(i, false)).filter(Boolean), grp = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => run(i, true)).filter(Boolean);
  const ls = rate(lone, r => r.stalked), gs = rate(grp, r => r.stalked), lk = rate(lone, r => r.killed), gk = rate(grp, r => r.killed);
  return { ok: lone.length >= 8 && ls > 0 && gs <= ls * .35 && gk <= lk, note: `stalked: lone ${(ls * 100) | 0}% vs groups ${(gs * 100) | 0}%; killed: lone ${(lk * 100) | 0}% vs groups ${(gk * 100) | 0}% (${lone.length}/${grp.length} runs of 400s)` };
});
add('S09 blackout makes them bolder: with the lights out a smiler crosses lamp-lit floor it normally avoids', () => {
  const G = geo(); const measure = black => {
    let lampT = 0, tot = 0;
    for (let i = 1; i <= 8; i++) {
      const A = setup(i, { lo: 600, hi: 1000 }); if (!A) continue; const { w, p, s } = A; w.sim.admin.blackout(black ? 'on' : 'off'); w.sim.debug.V.blackout = black;
      s.state = 'FOLLOWING'; s.act = 'follow'; s.target = p.id; s.follow = { since: w.eng.now, until: w.eng.now + 200, rid: p.id, goalT: 0 }; p.route([{ x: p.x + 150, y: p.y }, { x: p.x - 100, y: p.y + 80 }], 'walk');
      w.run(120, () => { const c = w.eng.geo.cellAt(s.x, s.y); if (c >= 0 && w.eng.geo.lamp[c] >= .2) lampT += DT; tot += DT; if (!p.path || !p.path.length) p.route([{ x: p.x + 150, y: p.y }, { x: p.x - 100, y: p.y + 80 }], 'walk'); }, 1);
    }
    return lampT / Math.max(1, tot);
  };
  const off = measure(false), on = measure(true);
  return { ok: on >= off && off < .06, note: `fraction of time standing on lamp-lit floor: lights on ${(off * 100).toFixed(1)}% vs blackout ${(on * 100).toFixed(1)}%` };
});
add('S10 "play" style: a smiler that plays keeps its victim down and watched for seconds, then kills (D) or lets go', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], i => {
    const A = setup(i, { lo: 300, hi: 450 }); if (!A) return null; const { w, p, s } = A; if (!forceStalk(w, s, p, 'play')) return null; s.stalk.decided = true;
    let capT = -1, deadT = -1, rel = false, v = null, phases = new Set(), plays = 0;
    w.run(80, (ww, t) => { if (p.caught && capT < 0) capT = t; if (p.caught) phases.add(p.caught.phase); if (s.cap) plays = Math.max(plays, s.cap.plays); if (w.kills.length) { deadT = t; v = w.kills[0].variant; return false; } if (w.evLog.some(e => e.t === 'release')) rel = true; if (capT > 0 && t - capT > 40) return false; }, 2);
    return { capT, deadT, held: deadT > 0 && capT > 0 ? deadT - capT : -1, v, rel, phases: [...phases].join('/'), plays };
  }).filter(Boolean);
  const k = rs.filter(r => r.v);
  return { ok: rs.length >= 8 && k.length >= 5 && rate(k, r => r.v === 'D') >= .6 && avg(k.filter(r => r.held >= 0).map(r => r.held)) >= 2.5, note: `${rs.length} runs; ${k.length} deaths, ${(rate(k, r => r.v === 'D') * 100) | 0}% variant D; victim held down avg ${avg(k.filter(r => r.held >= 0).map(r => r.held)).toFixed(1)}s before the kill; false hope shown in ${rs.filter(r => r.rel).length}` };
});
S.helpers = { darkPair, setup, forceStalk };
module.exports = S;
