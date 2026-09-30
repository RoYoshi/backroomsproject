/* CAPTURE / KILL scenarios */
'use strict';
const { World, DT, dist, LONG, geo, over, rate, avg, stateNames, WORLD, TAU, pick, tracker } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const X0 = 5000, Y0 = LONG.y;
const SPECIES = require(require('../paths.js') + '/ai.js').SPECIES;

/* a victim standing in the long corridor and an entity right at its heels, about to make contact */
function capWorld(kind, seed, o = {}) {
  const w = World(seed + 2000); w.sim.admin.blackout('on'); w.sim.debug.V.blackout = true;              // (dark everywhere: a smiler is not put off by the lamps; captures are what is under test)
  const v = w.player(X0, Y0, { light: o.light !== false }); v.stop(o.mode || 'stand'); v.angle = o.face === undefined ? Math.PI : o.face;
  const e = kind === 'hound' ? w.hound(X0 - 34, Y0) : w.smiler(X0 - 34, Y0); e.ang = 0;
  const others = [];
  for (const oo of o.others || []) { const q = w.player(oo.x, oo.y, { light: oo.light !== false }); q.stop('stand'); if (oo.go) q.go(oo.go.x, oo.go.y, oo.go.mode || 'run'); others.push(q); }
  if (kind === 'hound') { e.state = 'HUNTING'; e.target = v.id; }
  else { w.run(.3, null); e.state = 'PROVOKED'; e.act = 'rush'; e.provoked = { rid: v.id, style: o.style || 'rush' }; e.rushT = 0; e.target = v.id; }
  return { w, v, e, others };
}
/* force the play (rather than the quick) branch of an entity species for the duration of fn */
function withQuick(kind, val, fn) { const sp = SPECIES[kind], old = sp.capture.quick; sp.capture.quick = () => val; try { return fn(); } finally { sp.capture.quick = old; } }
const evs = (w, t) => w.evLog.filter(e => e.t === t);

add('C01 quick or play depends on the situation: others approaching -> almost always a quick kill; an isolated victim -> the playful kinds toy with it', () => {
  const trial = (kind, seed, crowd) => {
    const o = crowd ? { others: [{ x: X0 + 560, y: Y0, go: { x: X0 + 100, y: Y0 }, mode: 'run' }] } : {};
    const { w, v, e } = capWorld(kind, seed, o); let mode = null;
    w.run(2, () => { if (v.caught || w.kills.length) { mode = w.kills.length ? 'quick' : 'play'; return false; } }, 1);
    return mode;
  };
  const N = 60, res = {};
  for (const kind of ['hound', 'smiler']) for (const crowd of [false, true]) { const m = []; for (let s = 1; s <= N; s++) m.push(trial(kind, s, crowd)); res[kind + (crowd ? '+crowd' : '')] = m.filter(x => x === 'play').length / m.filter(Boolean).length; }
  return { ok: res['hound+crowd'] <= .08 && res['smiler+crowd'] <= .08 && res.smiler > res['smiler+crowd'] + .3 && res.hound < .4 && res.smiler >= .35, note: `share of captures that became play: hound alone ${(res.hound * 100) | 0}% / with someone running up ${(res['hound+crowd'] * 100) | 0}%;  smiler alone ${(res.smiler * 100) | 0}% / with someone running up ${(res['smiler+crowd'] * 100) | 0}%` };
});
add('C02 CAUGHT is not DEAD: a played-with victim stays alive and held; the next major decision comes after a tense 4-21 s and never in a rush', () => {
  const first = [], gaps = [], held = [], alive = [];
  for (const kind of ['hound', 'smiler']) withQuick(kind, 0, () => { for (let s = 1; s <= 30; s++) {
    const { w, v, e } = capWorld(kind, s + 10); let t0 = -1, t1 = -1, aliveThrough = true, phase = new Set(), lastDec = -1, cap = null, decisions = [];
    w.run(70, (ww, t) => {
      if (v.caught && t0 < 0) { t0 = t; cap = v.caught; first.push(cap.decideAt); }
      if (cap && cap.decideAt !== lastDec) { if (lastDec >= 0) decisions.push(cap.decideAt - lastDec); lastDec = cap.decideAt; }
      if (v.caught) { phase.add(v.caught.phase); if (v.dead) aliveThrough = false; }
      if ((w.kills.length || evs(w, 'release').length) && t1 < 0 && t0 >= 0) { t1 = t; return false; }
    }, 1);
    for (const g of decisions) gaps.push(g);
    if (t0 >= 0 && t1 >= 0) { held.push(t1 - t0); alive.push(aliveThrough && phase.has('down')); }
  } });
  const md = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
  return { ok: held.length >= 40 && Math.min(...first) >= 4 && Math.max(...first) <= 21 && (gaps.length === 0 || Math.min(...gaps) >= 3) && alive.every(Boolean), note: `${held.length} played captures: first decision due ${Math.min(...first).toFixed(1)}-${Math.max(...first).toFixed(1)}s after the grab, later ones ${gaps.length ? Math.min(...gaps).toFixed(1) + '-' + Math.max(...gaps).toFixed(1) + 's' : 'n/a'} apart; total time held ${Math.min(...held).toFixed(1)}-${Math.max(...held).toFixed(1)}s (median ${md(held).toFixed(1)}s); victim alive and CAUGHT throughout in ${alive.filter(Boolean).length}/${alive.length}` };
});
add('C03 false hope: a released victim may be hunted again if it runs, and is left alone if it does not', () => {
  let rel = 0, resumed = 0, letgo = 0, killedAfterRun = 0, runs = 0;
  for (const kind of ['smiler', 'hound']) withQuick(kind, 0, () => { for (let s = 1; s <= 60; s++) {
    const { w, v, e } = capWorld(kind, s + 30); let released = -1, runner = s % 2 === 0, second = false, dead = false;
    w.run(90, (ww, t) => {
      if (released < 0 && evs(w, 'release').length) { released = t; rel++; if (runner) v.go(v.x + 700 * (s % 4 < 2 ? 1 : -1), v.y, 'run'); else v.stop('crouch'); }
      if (released >= 0 && v.caught) second = true;
      if (w.kills.length) { dead = true; return false; }
      if (released >= 0 && t - released > 25) return false;
    }, 2);
    if (released >= 0) { runs++; if (runner && (second || dead)) { resumed++; if (dead) killedAfterRun++; } if (!runner && !second && !dead) letgo++; }
  } });
  return { ok: rel >= 8 && resumed >= 2 && letgo >= 2, note: `${rel} releases in 120 played captures; those who ran were caught again in ${resumed} (${killedAfterRun} died), those who stayed put were let go in ${letgo}` };
});
add('C04 interruption: someone running up with a light changes its mind within a moment - it kills (or lets go), depending on who it is', () => {
  const outc = { kill: 0, release: 0, none: 0 }, delays = [];
  for (const kind of ['hound', 'smiler']) withQuick(kind, 0, () => { for (let s = 1; s <= 30; s++) {
    const { w, v, e, others } = capWorld(kind, s + 60, { others: [{ x: X0 + 900, y: Y0, light: true }] }); const rescuer = others[0]; let tRun = -1, tDecide = -1, outcome = 'none';
    w.run(50, (ww, t) => {
      if (tRun < 0 && v.caught && t > 2.5) { tRun = t; rescuer.go(X0 + 60, Y0, 'run'); }
      if (tRun >= 0 && tDecide < 0) { if (w.kills.length) { tDecide = t; outcome = 'kill'; return false; } if (evs(w, 'release').length) { tDecide = t; outcome = 'release'; return false; } }
    }, 1);
    outc[outcome]++; if (tDecide >= 0) delays.push(tDecide - tRun);
  } });
  const md = delays.sort((a, b) => a - b)[delays.length >> 1] || 99;
  return { ok: outc.kill + outc.release >= 45 && outc.kill > 0 && outc.release > 0 && md < 3.2, note: `60 played captures interrupted by a runner with a light: kill ${outc.kill}, let go ${outc.release}, no reaction ${outc.none}; median time to react ${md.toFixed(1)}s after they set off` };
});
add('C05 after a quick kill it reads the room: with others coming it defends, attacks the next or leaves; alone it settles', () => {
  const st = { hound: {}, smiler: {}, houndAlone: {}, smilerAlone: {} };
  for (const kind of ['hound', 'smiler']) withQuick(kind, 1, () => { for (let s = 1; s <= 30; s++) for (const alone of [false, true]) {
    const o = alone ? {} : { others: [{ x: X0 + 500, y: Y0 - 30, go: { x: X0 + 100, y: Y0 }, mode: 'run' }, { x: X0 + 560, y: Y0 + 40, go: { x: X0 + 120, y: Y0 + 20 }, mode: 'run' }] };
    const { w, v, e } = capWorld(kind, s + 90, o); let after = null; if (alone && kind === 'hound') require('./lib.js').bystander(w);   // (a far, hidden bystander keeps the world running after the kill: the server pauses a room with nobody alive)
    w.run(12, (ww, t) => { if (w.kills.length && after === null && !e.commit) { after = t; } if (after !== null && typeof after === 'number' && t - after > (kind === 'hound' ? .1 : .6)) { after = stateNames(e); return false; } }, 1);   // (v20: a hound reads the room once its kill commitment is over)
    const key = kind + (alone ? 'Alone' : ''); st[key][after] = (st[key][after] || 0) + 1;
  } });
  const ok1 = Object.keys(st.hound).every(k => /^(HUNTING|RETREATING|FEEDING)/.test(k)), ok2 = Object.keys(st.smiler).every(k => /^(DISAPPEARING|WATCHING|HIDDEN)/.test(k)) && (st.smiler['DISAPPEARING/fade'] || 0) >= 20;
  const ok3 = Object.keys(st.houndAlone).every(k => /^(EXCITED|FEEDING|STALKING|ROAMING|DORMANT)/.test(k)) && Object.keys(st.smilerAlone).every(k => /^(WATCHING|DISAPPEARING|HIDDEN)/.test(k)) && (st.smilerAlone['WATCHING/watch'] || 0) >= 15;
  return { ok: ok1 && ok2 && ok3, note: `with company: hound ${JSON.stringify(st.hound)}, smiler ${JSON.stringify(st.smiler)}; alone: hound ${JSON.stringify(st.houndAlone)}, smiler ${JSON.stringify(st.smilerAlone)}` };
});
add('C06 the death itself: one kill per life, the record carries variant / geometry, the body is where the victim fell, no repeat kills', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], s => {
    const kind = s % 2 ? 'hound' : 'smiler'; const { w, v, e } = withQuick(kind, 1, () => capWorld(kind, s + 120)); withQuick(kind, 1, () => { w.run(12, () => { if (v.dead) return false; }, 1); }); w.run(8, null);
    const ks = w.kills.filter(k => k.pid === v.id), pk = v.kill;
    return { ok: v.dead === (kind === 'hound' ? 'Hound' : 'Smiler') && ks.length === 1 && v.dseq === 1 && !!pk && /^[ABCD]$/.test(pk.v) && Math.hypot(pk.x - X0, pk.y - Y0) < 90 && !v.caught, kills: ks.length, dseq: v.dseq, dead: v.dead, at: pk && [pk.x, pk.y] };
  });
  return { ok: rate(rs) === 1, note: `${(rate(rs) * 100) | 0}% of 12 deaths were clean: exactly one kill event, dseq 1, victim record with variant and position, no lingering capture` };
});
add('C07 spawn protection and admin god mode: nothing captures a protected player; unprotected, the very same attack lands', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8], s => {
    const kind = s % 2 ? 'hound' : 'smiler', { w, v, e } = capWorld(kind, s + 150); v.safe = 3; let capDuring = false, capAfter = false;
    w.run(2.9, () => { if (v.caught || v.dead) { capDuring = true; return false; } }, 1);
    const g = capWorld(kind, s + 160); g.v.god = true; let capGod = false; g.w.run(6, () => { if (g.v.caught || g.v.dead) { capGod = true; return false; } }, 1);
    const w3 = capWorld(kind, s + 170); let capNorm = false; w3.w.run(6, () => { if (w3.v.caught || w3.v.dead) { capNorm = true; return false; } }, 1);
    return { ok: !capDuring && !capGod && capNorm, capDuring, capGod, capNorm };
  });
  return { ok: rate(rs) === 1, note: `${(rate(rs) * 100) | 0}% of 8 runs: never captured while spawn-protected (3 s) or in god mode; the same attack on an unprotected player lands` };
});
add('C08 two hunters, one victim: exactly one capture; the other reacts to the kill (it does not double-kill)', () => {
  const rs = over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], s => {
    const { w, v, e } = capWorld('hound', s + 180); const h2 = w.hound(X0 + 34, Y0); h2.ang = Math.PI; h2.state = 'HUNTING'; h2.target = v.id;
    w.run(20, () => { }, 1); const ks = w.kills.filter(k => k.pid === v.id), caughtEvents = evs(w, 'caught').length;
    return { ok: ks.length === 1 && v.dseq === 1 && caughtEvents <= 1, kills: ks.length, dseq: v.dseq };
  });
  return { ok: rate(rs) === 1, note: `${(rate(rs) * 100) | 0}% of 10 double-hunter runs produced exactly one kill and one death` };
});
module.exports = S;
