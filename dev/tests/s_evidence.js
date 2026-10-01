/* PART 2 / STAGE 2C - the evidence law.  "The server may know the truth; an entity acts only on evidence it legitimately possesses."
 *   node dev/tests/run.js s_evidence.js
 * E1  a torch does not light, and gives no evidence, through a wall
 * E2  a lit wall / beam seen without the person: an ANONYMOUS lead (no player id, wide uncertainty) - not a target, no record
 * E3  the light source in view: a 'source' lead, then pinned on the person once it sees them (attributed only by perception)
 * E4  turning the light off stops new light evidence but does not erase what it already has
 * E5  hidden-position invariance: moving an unsensed player changes nothing the entity does
 * E6  observation-replay invariance: the carrier somewhere else, the same observations replayed -> the same decisions (no back-projection)
 * E7  the camcorder emits no visible light: no beam, no light evidence, no glare bonus
 * E8  eye contact: the player facing it (and seen) is detected; facing away or behind a wall is not
 * E9  target commitment: no switch to another person within the dwell unless the current one is truly lost
 * E10 bounded, finite, valid: leads, evidence and states over long mixed runs */
'use strict';
const { World, DT, dist, LONG, geo, over, rate, avg, TAU } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const LY = LONG.y;

/* a player facing a wall with the torch on, and a spot from which that lit wall can be seen but the player cannot */
let SETUPS = null;
function litWallSetups() {
  if (SETUPS) return SETUPS;
  const G = geo(), g = G.g, ad = G.ad, out = [];
  for (const c of G.walls) {
    if (out.length >= 24) break;
    if (!ad.clear(c.x, c.y, 22, 'walk')) continue;
    const hx = c.x + Math.cos(c.ang) * (c.d - 4), hy = c.y + Math.sin(c.ang) * (c.d - 4);
    let found = null;
    for (let R = 320; R <= 820 && !found; R += 70) for (let k = 0; k < 24 && !found; k++) {
      const a = k / 24 * TAU, bx = hx + Math.cos(a) * R, by = hy + Math.sin(a) * R;
      if (!ad.clear(bx, by, 28, 'walk') || Math.hypot(bx - c.x, by - c.y) < 300) continue;
      if (!g.los(bx, by, hx, hy)) continue;
      const side = [0, 18, -18].some(o => g.los(bx, by, c.x + Math.cos(c.ang + Math.PI / 2) * o, c.y + Math.sin(c.ang + Math.PI / 2) * o));
      if (side) continue;
      found = { px: c.x, py: c.y, pa: c.ang, hx, hy, bx, by, ba: Math.atan2(hy - by, hx - bx) };
    }
    if (found) out.push(found);
  }
  SETUPS = out; return out;
}
function restingHound(w, x, y, a) { const h = w.hound(x, y); h.state = 'ROAMING'; h.act = 'rest'; h.rest = 1e9; h.ang = a; h.head = 0; h.sp = { ...h.sp, tick() {} }; return h; // sensor-only fixture: 2E now acts on leads; keep observation assertions stationary
}

add('E1 walls stop light: a torch lights nothing and gives no evidence on the far side of a wall', () => {
  const G = geo(), g = G.g; let n = 0, leaks = 0, lightLeaks = 0;
  for (const c of G.walls.filter((q, i) => i % 5 === 0).slice(0, 40)) {
    // the far side: straight through the wall ahead of the player
    let far = null; for (let t = c.d + 20; t < c.d + 400; t += 12) { const x = c.x + Math.cos(c.ang) * t, y = c.y + Math.sin(c.ang) * t; if (G.ad.clear(x, y, 28, 'walk') && !g.los(c.x, c.y, x, y)) { far = { x, y }; break; } }
    if (!far) continue;
    const w = World(4), p = w.player(c.x, c.y, { light: true, angle: c.ang }); p.stop('stand');
    const h = restingHound(w, far.x, far.y, c.ang + Math.PI);
    w.run(2, null);
    n++;
    if (h.mem.leads.length || h.mem.p.has(p.id)) leaks++;
    const lamp = g.lightLevel(far.x, far.y, null), withP = g.lightLevel(far.x, far.y, w.eng.lightPlayers()); if (withP > lamp + 1e-9) lightLeaks++;
  }
  return { ok: n >= 12 && leaks === 0 && lightLeaks === 0, note: `${n} torch-into-wall setups with a hound on the far side: evidence through the wall ${leaks}, light level raised through the wall ${lightLeaks}` };
});

add('E2 a lit wall seen without the person: an anonymous lead (no player, wide uncertainty), not a target and not a record', () => {
  const rs = [];
  for (const s of litWallSetups().slice(0, 14)) {
    const w = World(5), p = w.player(s.px, s.py, { light: true, angle: s.pa }); p.stop('stand');
    const h = restingHound(w, s.bx, s.by, s.ba);
    w.run(1.5, null);
    const L = h.mem.leads.filter(q => q.k !== 'source');
    rs.push({ lead: L.length > 0, anon: h.mem.leads.every(q => q.pid === null), wide: L.every(q => q.u >= 120), minU: L.length ? Math.round(Math.min(...L.map(q => q.u))) : -1, noRec: !h.mem.p.has(p.id), notTarget: h.target !== p.id, off: L.length ? Math.round(Math.min(...L.map(q => Math.hypot(q.x - p.x, q.y - p.y)))) : -1, inv: !!h.inv && !h.inv.pid });
  }
  const got = rs.filter(r => r.lead);
  return { ok: rs.length >= 8 && got.length >= rs.length * .7 && rs.every(r => r.anon && r.wide && r.noRec && r.notTarget), note: `${rs.length} setups: lead formed ${got.length}; all anonymous ${rs.every(r => r.anon)}; uncertainty >= 120 px ${rs.every(r => r.wide)} (smallest ${Math.min(...got.map(r => r.minU))} px); no record of the player ${rs.filter(r => r.noRec).length}/${rs.length}; not its target ${rs.filter(r => r.notTarget).length}/${rs.length}; lead-to-player distance ${got.map(r => r.off).join(', ')} px (it guesses a region, it does not know the spot)` };
});

add('E3 the light source in view gives an anonymous source lead; only sight of the person then names it', () => {
  const rs = over([1, 2, 3, 4, 5, 6], s => {
    const w = World(s), h = restingHound(w, 5000, LY, 0), p = w.player(5000 + 900 + s * 20, LY, { light: true, angle: Math.PI }); p.stop('stand');
    w.run(1.5, null);
    const src = h.mem.leads.find(q => q.k === 'source'), rec0 = h.mem.p.has(p.id);                     // a light pointed at it from beyond where it can make out a body
    p.go(5240, LY, 'walk'); w.run(4, null);                                                          // the person walks into plain view
    const r = h.mem.p.get(p.id), named = !!(r && r.ev.some(q => q.k === 'light')), srcLeft = src ? h.mem.leads.some(q => q.id === src.id) : true;
    return { ok: !!src && src.pid === null && !rec0 && !!r && named && !srcLeft, src: !!src, rec0, named, srcLeft };
  });
  return { ok: rate(rs) >= .8, note: `${rs.filter(r => r.ok).length}/${rs.length}: at range - anonymous source lead ${rs.filter(r => r.src).length}, no record of the person ${rs.filter(r => !r.rec0).length}; once it saw them - lead pinned on them as light evidence ${rs.filter(r => r.named).length} (and gone from the anonymous list ${rs.filter(r => !r.srcLeft).length})` };
});

add('E4 light off: no new light evidence, but what it already has stays (and fades like any memory)', () => {
  const rs = [];
  for (const s of litWallSetups().slice(0, 12)) {
    const w = World(6), p = w.player(s.px, s.py, { light: true, angle: s.pa }); p.stop('stand');
    const h = restingHound(w, s.bx, s.by, s.ba);
    w.run(1.5, null); const L0 = h.mem.leads.find(q => q.k !== 'source'); if (!L0) continue;
    p.light = false; const tOff = w.eng.now; w.run(4, null);
    const L1 = h.mem.leads.find(q => q.id === L0.id);
    const kept = !!L1, noNew = !L1 || L1.t <= tOff + .35, c1 = L1 ? L1.c : 0;
    w.run(60, null); const gone = !h.mem.leads.some(q => q.id === L0.id);
    rs.push({ kept, noNew, gone, c0: +L0.c.toFixed(2), c1: +c1.toFixed(2) });
  }
  return { ok: rs.length >= 6 && rs.every(r => r.kept && r.noNew && r.gone), note: `${rs.length} leads: still held 4 s after the light went off ${rs.filter(r => r.kept).length}, none refreshed after it ${rs.filter(r => r.noNew).length}, faded away within a minute ${rs.filter(r => r.gone).length}; confidence ${rs.map(r => r.c0 + '->' + r.c1).join(' ')}` };
});

/* one hound chasing a decoy it can see; a third player stands silent, lightless and out of sight at one of two places */
function traceRun(seed, hidden, secs, hook) {
  const w = World(seed), h = w.hound(4300, LY); h.ang = 0;
  const d = w.player(4700, LY, { light: true, angle: 0 }); d.go(8200, LY, 'run');
  const q = w.player(hidden.x, hidden.y, { light: false }); q.stop('stand');
  if (hook) w.eng.obsHook = hook;
  const tr = []; let sensed = false;
  w.run(secs, () => {
    const r = h.mem.p.get(q.id); if (r) sensed = true;
    tr.push(`${h.x.toFixed(4)},${h.y.toFixed(4)},${h.state},${h.act},${h.target},${h.inv ? h.inv.lead : 0},${h.mem.leads.map(L => L.k + L.x.toFixed(2) + ',' + L.y.toFixed(2)).join(';')}`);
  }, 1);
  return { tr, sensed };
}
add('E5 hidden-position invariance: an unsensed player moved elsewhere changes nothing the hound does', () => {
  const G = geo(), g = G.g, spots = G.dark.filter(c => G.ad.clear(c.x, c.y, 24, 'walk') && Math.abs(c.y - LY) > 700 && c.x > 3500 && c.x < 8000);
  const pairs = []; for (let i = 0; i + 7 < spots.length && pairs.length < 6; i += 11) pairs.push([spots[i], spots[i + 7]]);
  let valid = 0, same = 0; const diffAt = [];
  pairs.forEach(([a, b], k) => {
    const A = traceRun(10 + k, a, 12), B = traceRun(10 + k, b, 12);
    if (A.sensed || B.sensed) return;
    valid++; const i = A.tr.findIndex((x, j) => x !== B.tr[j]); if (i < 0 && A.tr.length === B.tr.length) same++; else diffAt.push(i);
  });
  return { ok: valid >= 4 && same === valid, note: `${valid} valid pairs (the hidden player never sensed in either world): identical tick-by-tick decisions ${same}/${valid}${diffAt.length ? ' - first difference at ticks ' + diffAt.join(',') : ''}` };
});

add('E6 observation replay: the carrier somewhere else, the same observations replayed -> the same leads and decisions (no back-projection)', () => {
  const rs = [];
  const G = geo(), far = G.dark.filter(c => G.ad.clear(c.x, c.y, 24, 'walk'));
  for (const [k, s] of litWallSetups().slice(0, 10).entries()) {
    const rec = [];
    const run = (replay, where) => {
      const w = World(20 + k), p = w.player(where.x, where.y, { light: !replay, angle: s.pa }); p.stop('stand');
      const dq = w.player(decoy.x, decoy.y, { light: false }); dq.stop('stand');                         // the same unseen bystander in both worlds keeps the level of detail the same
      const h = w.hound(s.bx, s.by); h.ang = s.ba;
      let i = 0; w.eng.obsHook = (e, obs) => { if (e !== h) return obs; if (!replay) { rec.push(JSON.parse(JSON.stringify(obs))); return obs; } return JSON.parse(JSON.stringify(rec[i++] || [])); };
      const tr = []; let sensed = false;
      w.run(8, () => { if (h.mem.p.has(p.id) || h.mem.p.has(dq.id)) { sensed = true; return false; } tr.push(`${h.x.toFixed(4)},${h.y.toFixed(4)},${h.state},${h.act},${h.target},${h.inv ? h.inv.k + h.inv.x.toFixed(2) : '-'},${h.mem.leads.map(L => L.k + L.x.toFixed(2) + ',' + L.y.toFixed(2) + ',' + L.u.toFixed(1)).join(';')}`); }, 1);
      return { tr, sensed, leads: rec.length };
    };
    const decoy = far.find(c => { const d = Math.hypot(c.x - s.bx, c.y - s.by); return d > 500 && d < 1300 && !G.g.los(c.x, c.y, s.bx, s.by); }); if (!decoy) continue;
    const A = run(false, { x: s.px, y: s.py });
    const elsewhere = far.find(c => Math.hypot(c.x - s.px, c.y - s.py) > 2500 && Math.hypot(c.x - s.bx, c.y - s.by) > 2500);
    const B = run(true, elsewhere);
    // Compare the common observation-only prefix: moving to investigate may legitimately reveal the carrier in 2E.
    const n = Math.min(A.tr.length, B.tr.length); if (n < 12) continue;
    const hadLight = A.tr.some(x => /lit|beam/.test(x));
    rs.push({ same: A.tr.slice(0,n).join('|') === B.tr.slice(0,n).join('|'), hadLight, moved: Math.round(Math.hypot(elsewhere.x - s.px, elsewhere.y - s.py)) });
  }
  const used = rs.filter(r => r.hadLight);
  return { ok: used.length >= 5 && used.every(r => r.same), note: `${used.length} runs where the hound formed light leads: identical decisions with the carrier moved ${used.filter(r => r.same).length}/${used.length} (moved ${used.map(r => r.moved).join(', ')} px, light off, only the recorded observations replayed)` };
});

add('E7 the camcorder emits no visible light: no beam, no light evidence, no glare bonus - its raised state is presentation only', () => {
  const rs = over([1, 2, 3, 4], s => {
    const w = World(s), h = restingHound(w, 5000, LY, 0), p = w.player(5000 + 900, LY, { light: true, kind: 'camcorder', angle: Math.PI }); p.stop('stand');
    w.run(3, null);
    return { ok: !p.light && w.eng.lightPlayers().length === 0 && !h.mem.leads.length, light: p.light, lp: w.eng.lightPlayers().length, leads: h.mem.leads.length };
  });
  return { ok: rate(rs) === 1, note: `${rs.filter(r => r.ok).length}/${rs.length}: raised camcorder -> visible light ${rs.map(r => r.light).join(',')}, lit players ${rs.map(r => r.lp).join(',')}, light leads ${rs.map(r => r.leads).join(',')}` };
});

add('E8 eye contact: seen and facing it -> detected; facing away, or a wall between -> not', () => {
  const ec = (w, h, pid) => { const d = w.eng.debugInfo().find(q => q.i === h.id); return !!(d && d.ec && d.ec.some(c => c[0] === pid)); };
  const rs = over([1, 2, 3], s => {
    const w = World(s), h = restingHound(w, 5000, LY, 0), p = w.player(5260, LY, { light: true, angle: Math.PI }); p.stop('stand');
    w.run(.6, null); const facing = ec(w, h, p.id);
    p.angle = 0; w.run(.3, null); const away = ec(w, h, p.id);
    return { ok: facing && !away, facing, away };
  });
  // a wall between: the E1 geometry, player facing the hound's side of the wall
  const G = geo(), g = G.g; let walled = 0, wallN = 0;
  for (const c of G.walls.filter((q, i) => i % 3 === 0).slice(0, 30)) {
    let far = null; for (let t = c.d + 20; t < c.d + 300; t += 12) { const x = c.x + Math.cos(c.ang) * t, y = c.y + Math.sin(c.ang) * t; if (G.ad.clear(x, y, 28, 'walk') && !g.los(c.x, c.y, x, y)) { far = { x, y }; break; } }
    if (!far) continue; wallN++;
    const w = World(7), p = w.player(c.x, c.y, { light: true, angle: c.ang }); p.stop('stand'); const h = restingHound(w, far.x, far.y, c.ang + Math.PI);
    w.run(.6, null); if (ec(w, h, p.id)) walled++;
  }
  return { ok: rate(rs) === 1 && wallN >= 5 && walled === 0, note: `open corridor: facing detected ${rs.filter(r => r.facing).length}/${rs.length}, facing away detected ${rs.filter(r => r.away).length}/${rs.length}; through a wall detected ${walled}/${wallN}` };
});

add('E9 target commitment: it does not switch to somebody else inside the dwell unless it has truly lost its prey', () => {
  const rs = over([1, 2, 3, 4, 5, 6], s => {
    const w = World(s), h = w.hound(5000, LY); h.ang = 0;
    const a = w.player(5260, LY, { light: true, angle: 0 }); a.go(5600, LY, 'run');
    const b = w.player(5560, LY + (s % 2 ? 60 : -60), { light: true, angle: Math.PI }); b.stop('stand');
    let hunting = -1, switches = [], last = 0, tgtAt = 0, sw = 0;
    w.run(8, (ww, t) => {
      if ((h.target || 0) !== last) { const nt = h.target || 0; if (last && nt) { const r = h.mem.p.get(last); const dwell = t - tgtAt; if (dwell < 1.45 && r && r.conf >= .2) switches.push(+dwell.toFixed(2)); } if (nt) { last = nt; tgtAt = t; } }
      if (hunting < 0 && h.state === 'HUNTING' && h.target === a.id) { hunting = t; a.x = 5600; a.y = LY + 900; if (!w.ad.clear(a.x, a.y, 22, 'walk')) { a.x = 3000; a.y = LY + 600; } a.stop('stand'); a.light = false; }
    }, 1);
    return { ok: switches.length === 0, switches, hunting };
  });
  const tried = rs.filter(r => r.hunting >= 0);
  return { ok: tried.length >= 3 && tried.every(r => r.ok), note: `${tried.length} runs where it hunted A and A vanished while B stood in view: early switches (inside 1.5 s, prey not lost) ${tried.filter(r => !r.ok).length} ${tried.map(r => r.switches.join('/')).join(' ')}` };
});

add('E10 bounded and valid: leads <= 6, evidence <= 4 per record, all numbers finite, confidences in [0,1], over long mixed runs', () => {
  let bad = [], maxL = 0, maxE = 0, ticks = 0, leadsSeen = 0;
  for (const s of [1, 2, 3]) {
    const w = World(s); const hs = [w.hound(4300, LY), w.hound(6200, LY)], sm = w.smiler(7200, LY);
    const ps = [w.player(5000, LY, { light: true }), w.player(5600, LY, { light: true, kind: 'headlamp' }), w.player(6600, LY, { light: true, kind: 'lantern' }), w.player(3600, LY, { light: true, kind: 'camcorder' })];
    ps[0].go(8000, LY, 'walk'); ps[1].go(3200, LY, 'run'); ps[2].stop('stand'); ps[3].go(7000, LY, 'walk');
    w.run(80, (ww, t) => {
      ticks++;
      if (Math.floor(t * 3) % 7 === 0) ps[2].light = !ps[2].light;
      for (const p of ps) p.angle += .02;
      for (const e of [...hs, sm]) {
        if (!isFinite(e.x) || !isFinite(e.y)) bad.push('pos'); maxL = Math.max(maxL, e.mem.leads.length); if (e.mem.leads.length) leadsSeen++;
        for (const L of e.mem.leads) if (!isFinite(L.x) || !isFinite(L.y) || !(L.u > 0) || L.c < 0 || L.c > 1 || L.pid !== null) bad.push('lead');
        for (const r of e.mem.p.values()) { maxE = Math.max(maxE, (r.ev || []).length); for (const q of r.ev || []) if (!isFinite(q.x) || !isFinite(q.y) || !(q.u > 0) || q.c < 0 || q.c > 1) bad.push('ev'); }
        if (!e.state || typeof e.state !== 'string') bad.push('state');
      }
    }, 3);
  }
  return { ok: bad.length === 0 && maxL <= 6 && maxE <= 4 && leadsSeen > 50, note: `${ticks} samples: problems ${bad.length}${bad.length ? ' (' + [...new Set(bad)].join(',') + ')' : ''}; most leads held ${maxL}; most evidence entries on a record ${maxE}; samples with leads ${leadsSeen}` };
});

module.exports = S;
