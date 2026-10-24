#!/usr/bin/env node
/* R20 checkpoint A: what the debug's red "STUCK n s" (navDebug st = e.stuck > .15) and the engine watchdog's resets are, in ordinary seeded play.
 *   node stuck_trace.js --dir TREE --sim PRECHASE_SIM.js [prechase args...] --trout FILE.json
 * Read-only hooks (trhook.js).  Classifies every tick the stuck timer grows: real (it moved at its own speed into something: moved < half its step),
 * braked (its own steering slowed it: turn-in-place alignment, corner cap, wall feeler, accelerating from a stop), and every tick the label shows
 * while nothing steers it (the timer frozen: only steerTo decays it). */
'use strict';
const path = require('path'), fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve(arg('dir')), OUT = arg('trout');
const R = {}; const per = new Map();
const K = k => R[k] || (R[k] = { ticks: 0, steerTicks: 0, label: 0, labelFrozen: 0, labelFrozenStill: 0, labelOpen: 0, labelOpenFrozen: 0, grow: { real: 0, turn: 0, vcap: 0, feel: 0, accel: 0, hold: 0, other: 0 }, growOpen: { real: 0, turn: 0, vcap: 0, feel: 0, accel: 0, hold: 0, other: 0 },
  side: 0, replan: 0, wdChecks: 0, wdStuck: 0, wdEmb: 0, wdStuckIdleOK: 0, wdEvents: [], episodes: [], frozenEp: [] });
let G = null, ENG = null, RUN = 0;
const clearance = (e) => { let m = 1e9; for (let k = 0; k < 16; k++) m = Math.min(m, G.ray(e.x, e.y, k / 16 * Math.PI * 2, 200)); return m; };
const LG = (process.env.TRLOG || '').split(':').map(Number); let lgT = -1;
const TR = {
  steer(e, i) { if (i.eng !== ENG) { ENG = i.eng; G = i.eng.geo; RUN++; } const s = per.get(e) || {}; per.set(e, s); s.steerAt = i.eng.now; s.lastErr = +i.err.toFixed(2); const kr = K(e.kind);
    if (e.stuck > i.s0) { // grew
      let c; const dt = 1 / 60;
      if (i.step > .5 && i.moved < i.step * .5) c = 'real';
      else if (i.hold) c = 'hold';
      else if (Math.abs(i.err) > 1.0) c = 'turn';
      else if (i.vcap !== undefined && i.vcap < i.vmax * .3) c = 'vcap';
      else if (i.target < i.vmax * .3) c = 'feel';
      else if (e.speed < i.target - 1) c = 'accel'; else c = 'other';
      kr.grow[c] += dt; const open = clearance(e) > e.rc + 24; if (open) kr.growOpen[c] += dt; s.lastCause = c; s.causes = s.causes || {}; s.causes[c] = (s.causes[c] || 0) + 1;
    } },
  lad(e, k) { const kr = K(e.kind); if (k === 'sidestep') kr.side++; else kr.replan++; const s = per.get(e) || {}; per.set(e, s); s.lad = s.lad || []; s.lad.push(k); if (e.unst === null || !e.unst) { s.pendSide = { ang: e.ang, want: e.want }; } },
  tick(e, dt, eng) { if (eng !== ENG) { ENG = eng; G = eng.geo; RUN++; } const kr = K(e.kind), s = per.get(e) || {}; per.set(e, s); kr.ticks++;
    const steered = s.steerAt === eng.now;
    if (LG.length === 3 && RUN === LG[0] && eng.now >= LG[1] && eng.now <= LG[2] && e.kind === 'skinstealer' && eng.now - lgT >= .099) { lgT = eng.now; const P = e.plan;
      console.error([eng.now.toFixed(2), Math.round(e.x), Math.round(e.y), 'v' + Math.round(e.speed || 0), 'ang' + e.ang.toFixed(2), 'want' + (e.want !== undefined ? e.want.toFixed(2) : '-'), 'st' + e.stuck.toFixed(2), e.unst ? 'UNST' : '', steered ? 'S' : '-', e.still ? 'STILL' : '', 'tier:' + e.tier, (P ? P.k : 'roam') + '/' + (e.act || '') + '/' + e.state,
        'path' + e.path.length + (e.path[0] ? '@' + Math.round(e.path[0].x) + ',' + Math.round(e.path[0].y) : ''), 'goal' + (e.goal ? Math.round(e.goal.x) + ',' + Math.round(e.goal.y) : '-'), 'rg' + (e.roam && e.roam.goal ? Math.round(e.roam.goal.x) + ',' + Math.round(e.roam.goal.y) : '-'), 'wd' + (e.wd.t || 0).toFixed(1), String(e.dbg.why || '').slice(0, 70)].join(' ')); } if (steered) kr.steerTicks++;
    s.win = s.win || { n: 0, still: 0, slow: 0, steer: 0, idleish: 0 }; s.win.n++; if (e.still) s.win.still++; if ((e.speed || 0) < 8) s.win.slow++; if (steered) s.win.steer++;
    const lab = e.stuck > .15;
    if (lab) { kr.label += dt; const open = clearance(e) > e.rc + 24; if (open) kr.labelOpen += dt; if (!steered) { kr.labelFrozen += dt; if (open) kr.labelOpenFrozen += dt; if ((e.speed || 0) < 8) kr.labelFrozenStill += dt; }
      if (!s.ep) s.ep = { run: RUN, x: Math.round(e.x), y: Math.round(e.y), err0: s.lastErr, sp0: Math.round(e.speed || 0), t0: +eng.now.toFixed(2), max: 0, frozen: 0, n: 0, act: e.act, plan: e.plan ? e.plan.k : (e.state || ''), open: 0, causes: {} };
      s.ep.max = Math.max(s.ep.max, e.stuck); s.ep.n++; if (!steered) s.ep.frozen++; if (open) s.ep.open++; }
    else if (s.ep) { s.ep.dur = +(eng.now - s.ep.t0).toFixed(2); s.ep.causes = s.causes || {}; s.ep.lad = s.lad || []; s.ep.max = +s.ep.max.toFixed(2); s.ep.frozenFrac = +(s.ep.frozen / s.ep.n).toFixed(2); s.ep.openFrac = +(s.ep.open / s.ep.n).toFixed(2); delete s.ep.frozen; delete s.ep.open;
      if (kr.episodes.length < 400) kr.episodes.push(s.ep); s.ep = null; s.causes = {}; s.lad = []; }
    // after a watchdog reset: what it did next (plan / why) for 5 s
    if (s.after && eng.now - s.after.t < 5) { const pk = (e.plan ? e.plan.k : '-') + '/' + (e.act || ''); if (s.after.seq[s.after.seq.length - 1] !== pk) s.after.seq.push(pk); if (e.dbg && e.dbg.why && s.after.whys[s.after.whys.length - 1] !== e.dbg.why) s.after.whys.push(String(e.dbg.why).slice(0, 90)); }
    else if (s.after) { s.after = null; } },
  wd(e, i) { const kr = K(e.kind), s = per.get(e) || {}; per.set(e, s); kr.wdChecks++; const eng = i.eng;
    const d = s.wdx !== undefined ? Math.hypot(e.x - s.wdx, e.y - s.wdy) : null; s.wdx = e.x; s.wdy = e.y; const W = s.win || { n: 1 }; s.win = null;
    if (i.stuck || i.embedded) { if (i.stuck) kr.wdStuck++; if (i.embedded) kr.wdEmb++;
      const ev = { run: RUN, x: Math.round(e.x), y: Math.round(e.y), t: +eng.now.toFixed(2), stuck: i.stuck, emb: i.embedded, disp: d === null ? null : Math.round(d), idle: i.idle, stillNow: !!e.still, act: e.act, state: e.state, plan: e.plan ? e.plan.k : null, planStuck: e.plan ? e.plan.stuck || 0 : null, tier: e.tier,
        sp: Math.round(e.speed || 0), path: e.path.length, clear: Math.round(clearance(e)), trav: !!e.trav, why: e.dbg && e.dbg.why ? String(e.dbg.why).slice(0, 90) : '', stuckT: +e.stuck.toFixed(2),
        win: { stillFrac: +((W.still || 0) / W.n).toFixed(2), slowFrac: +((W.slow || 0) / W.n).toFixed(2), steerFrac: +((W.steer || 0) / W.n).toFixed(2) } };
      if (kr.wdEvents.length < 300) kr.wdEvents.push(ev); s.after = { t: eng.now, seq: [], whys: [], ev }; ev.next = s.after.seq; ev.nextWhy = s.after.whys; } }
};
require('./trhook.js')(TR);
process.on('exit', () => { const o = { tree: path.basename(DIR), patched: TR.patched, kinds: R }; fs.writeFileSync(OUT, JSON.stringify(o, null, 1) + '\n'); });
const sim = path.resolve(arg('sim')); require(sim);
