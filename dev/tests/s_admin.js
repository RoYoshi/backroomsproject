/* ADMIN scenarios (v17): the DEATHS tab (preview a chosen death), the capture-style override, the AI event log.
 * They run on the real simulation and use only the admin API the server calls (sim.admin.*). */
'use strict';
const { World, DT, dist, LONG, over, rate, TAU } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const X0 = 5000, Y0 = LONG.y;

/* a floor spot with a real wall 70-110 px away in some direction, clean either side of it (for the hound's wall impact) */
function wallSpot(w) {
  const ad = w.ad;
  for (let y = 200; y < 6700; y += 48) for (let x = 200; x < 9000; x += 48) {
    if (!ad.clear(x, y, 24, 'walk')) continue;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU, d = ad.ray(x, y, a, 240);
      if (d > 72 && d < 108 && ad.ray(x, y, a + .5, 240) > 60 && ad.ray(x, y, a - .5, 240) > 60 && ad.ray(x, y, a + Math.PI, 240) > 150) return { x, y, facing: a + Math.PI };
    }
  }
  return null;
}
/* one victim in an open stretch of the long corridor; nobody else about */
function stage(seed, o = {}) {
  const w = World(seed + 4000), at = o.at || { x: X0, y: Y0, facing: Math.PI };
  const v = w.player(at.x, at.y, { light: true }); v.stop('stand'); v.angle = at.facing;
  return { w, v };
}
const killsOf = w => w.kills.filter(k => k.why === 'preview');

add('A01 preview death: every variant of both killers is played exactly as asked, through the real kill path (record, events, entity left in a sane state)', () => {
  const rows = [], bad = [];
  const spot = wallSpot(World(1));
  for (const kind of ['hound', 'smiler']) for (const V of 'ABCD') {
    const at = kind === 'hound' && V === 'C' ? spot : null;
    const { w, v } = stage(V.charCodeAt(0) + (kind === 'hound' ? 0 : 50), at ? { at } : {});
    const before = JSON.stringify(w.eng.recentKills);
    const r = w.sim.admin.previewKill(v, kind, V);
    const ks = killsOf(w), k = ks[0];
    const ent = w.eng.entities.find(e => e.kind === kind);
    const tags = [];
    if (!r.ok) tags.push('refused: ' + r.why);
    if (ks.length !== 1) tags.push('kills=' + ks.length);
    if (k && k.variant !== V) tags.push('variant ' + k.variant);
    if (!v.dead || v.dead !== (kind === 'hound' ? 'Hound' : 'Smiler')) tags.push('victim.dead=' + v.dead);
    if (!v.kill || v.kill.v !== V) tags.push('record ' + (v.kill && v.kill.v));
    if (v.kill && Math.hypot(v.kill.ax - v.x, v.kill.ay - v.y) > 62) tags.push('attacker ' + Math.round(Math.hypot(v.kill.ax - v.x, v.kill.ay - v.y)) + 'px away');
    if (ent && !w.ad.clear(ent.x, ent.y, 10, 'walk')) tags.push('entity inside a wall');
    if (kind === 'hound' && V === 'C') { const wl = v.kill && v.kill.w; if (!wl) tags.push('C without a wall'); else { const d = Math.hypot(wl[0] - v.x, wl[1] - v.y); const ray = w.ad.ray(v.x, v.y, Math.atan2(wl[1] - v.y, wl[0] - v.x), 200); if (d < 50 || d > 135 || Math.abs(ray - d) > 6) tags.push('wall not really there'); } }
    else if (v.kill && v.kill.w) tags.push('wall given for ' + kind + V);
    if (JSON.stringify(w.eng.recentKills) !== before) tags.push('touched the recent-kills memory');
    w.run(6, null);                                                    // afterwards: no second kill, no exception, the entity carries on
    if (w.kills.length !== 1) tags.push('kills after 6 s: ' + w.kills.length);
    if (kind === 'smiler' && V === 'C' && !w.evLog.some(e => e.t === 'lightfail')) tags.push('no lamp failure');
    rows.push(`${kind[0].toUpperCase()}${V}${tags.length ? '!' : ''}`); if (tags.length) bad.push(`${kind} ${V}: ${tags.join(', ')}`);
  }
  return { ok: !bad.length && !!spot, note: bad.length ? bad.join(' | ') : `all 8 played: ${rows.join(' ')}; each exactly one kill (why=preview), victim dead with the right killer and record, attacker within 62 px, the hound's wall really there (${spot ? Math.round(spot.x) + ',' + Math.round(spot.y) : 'n/a'}), lamps fail for the smiler's C, recent-kills memory untouched` };
});

add('A02 preview works through god mode, spawn protection and a frozen world; refuses honestly (no wall near, already dead, already caught, everything busy)', () => {
  const bad = [];
  {
    const { w, v } = stage(1); v.god = true; v.safe = 3; w.sim.admin.freeze(true);
    const r = w.sim.admin.previewKill(v, 'hound', 'A');
    if (!r.ok || !v.dead || killsOf(w).length !== 1) bad.push('god+safe+frozen: ' + JSON.stringify(r) + ' dead=' + v.dead);
  }
  {
    const { w, v } = stage(2);                                         // hound C in the middle of a corridor: no wall at 55-128 px behind or in front
    const r = w.sim.admin.previewKill(v, 'hound', 'C');
    if (r.ok || v.dead || killsOf(w).length || w.eng.entities.length) bad.push('C with no wall: ' + JSON.stringify(r) + ' dead=' + v.dead + ' ents=' + w.eng.entities.length);
    if (!/wall/.test(r.why || '')) bad.push('refusal does not say why: ' + r.why);
  }
  {
    const { w, v } = stage(3); w.sim.admin.previewKill(v, 'smiler', 'A');
    const r = w.sim.admin.previewKill(v, 'hound', 'A');
    if (r.ok || w.kills.length !== 1) bad.push('second preview on a dead player: ' + JSON.stringify(r) + ' kills=' + w.kills.length);
  }
  {
    const { w, v } = stage(4); const e = w.hound(X0 - 400, Y0); v.caught = { phase: 'down', eid: e.id };
    const r = w.sim.admin.previewKill(v, 'hound', 'A');
    if (r.ok) bad.push('preview on a player who is already caught');
  }
  {
    const { w, v } = stage(5); const cap=w.sim.admin.info().mh; for (let i = 0; i < cap; i++) { const e = w.hound(X0 - 500 - (i % 8) * 60, Y0 + 300 + Math.floor(i / 8) * 60); e.cap = { phase: 'down' }; }
    const r = w.sim.admin.previewKill(v, 'hound', 'A');
    if (r.ok || !/busy/.test(r.why || '')) bad.push('all hounds busy: ' + JSON.stringify(r));
  }
  return { ok: !bad.length, note: bad.length ? bad.join(' | ') : 'god mode, spawn protection and a frozen world do not get in the way; when it cannot be done (no wall near for C, player already dead / caught, every hound busy) it says why and changes nothing' };
});

add('A03 preview uses the nearest free entity (population unchanged) and only spawns one when none exists (and removes it again if the preview is refused)', () => {
  const bad = [];
  {
    const { w, v } = stage(6); const far = w.hound(X0 - 1500, Y0), near = w.hound(X0 + 900, Y0); const n0 = w.eng.entities.length;
    const r = w.sim.admin.previewKill(v, 'hound', 'A');
    if (!r.ok || w.eng.entities.length !== n0 || r.eid !== near.id) bad.push('reuse: ' + JSON.stringify(r) + ' n ' + w.eng.entities.length + '/' + n0 + ' nearest ' + near.id + ' far ' + far.id);
  }
  {
    const { w, v } = stage(7); const r = w.sim.admin.previewKill(v, 'smiler', 'B');
    if (!r.ok || w.eng.count('smiler') !== 1) bad.push('spawn when none exists: ' + JSON.stringify(r) + ' smilers ' + w.eng.count('smiler'));
  }
  {
    const { w, v } = stage(8); const r = w.sim.admin.previewKill(v, 'hound', 'C');
    if (r.ok || w.eng.count('hound') !== 0) bad.push('refused preview left a spawned hound behind: ' + w.eng.count('hound'));
  }
  return { ok: !bad.length, note: bad.length ? bad.join(' | ') : 'the nearest free hound is used; a smiler is spawned only when there is none; a refused preview leaves nothing behind' };
});

add('A04 capture style override: AUTO leaves the decision to the entity, QUICK makes every catch a kill, PLAY makes every catch a held victim (then the normal decision)', () => {
  const count = mode => {
    let quick = 0, play = 0, n = 0;
    for (const kind of ['hound', 'smiler']) for (let s = 1; s <= 12; s++) {
      const w = World(s + 6000); w.sim.admin.blackout('on'); w.sim.debug.V.blackout = true;
      const v = w.player(X0, Y0, { light: true }); v.stop('stand'); v.angle = Math.PI;
      const e = kind === 'hound' ? w.hound(X0 - 34, Y0) : w.smiler(X0 - 34, Y0); e.ang = 0;
      w.sim.admin.captureMode(mode);
      if (kind === 'hound') { e.state = 'HUNTING'; e.target = v.id; } else { w.run(.3, null); e.state = 'PROVOKED'; e.act = 'rush'; e.provoked = { rid: v.id, style: 'rush' }; e.rushT = 0; e.target = v.id; }
      let seen = null; w.run(3, () => { if (v.caught) { seen = 'play'; return false; } if (w.kills.length) { seen = 'quick'; return false; } }, 1);
      if (seen) { n++; if (seen === 'quick') quick++; else play++; }
    }
    return { quick, play, n };
  };
  const q = count('quick'), p = count('play'), a = count('auto');
  const ok = q.n >= 20 && q.play === 0 && p.n >= 20 && p.quick === 0 && a.n >= 20;
  return { ok, note: `QUICK: ${q.quick}/${q.n} kills, ${q.play} held;  PLAY: ${p.play}/${p.n} held, ${p.quick} instant kills;  AUTO: ${a.quick} kills / ${a.play} held (the entity's own choice)`, data: { q, p, a } };
});

add('A05 the AI event log: state changes, catches, kills and lamp failures are written down with a running number; readers get only what is new; the log stays short', () => {
  const { w, v } = stage(9); const e = w.hound(X0 - 34, Y0); e.ang = 0; e.state = 'HUNTING'; e.target = v.id; w.sim.admin.captureMode('quick'); w.sim.admin.blackout('on'); w.sim.debug.V.blackout = true;
  const seq0 = w.sim.logSeq; let mid = 0;
  w.run(30, () => { if (!mid && w.kills.length) { mid = w.sim.logSeq; return false; } }, 1);
  w.run(4, null);
  const all = w.sim.logSince(seq0), tail = w.sim.logSince(mid - 1);
  const kinds = { state: all.filter(l => /->/.test(l.x)).length, kill: all.filter(l => /KILLED/.test(l.x)).length };
  const ordered = all.every((l, i) => i === 0 || l.s === all[i - 1].s + 1);
  for (let i = 0; i < 300; i++) w.eng.note('spam ' + i);
  const capped = w.eng.log.length <= 60;
  const ok = kinds.kill === 1 && kinds.state >= 1 && ordered && tail.length >= 1 && tail.length <= all.length && capped && w.sim.logSince(w.sim.logSeq).length === 0;
  return { ok, note: `${all.length} entries in 30 s (${kinds.state} state changes, ${kinds.kill} kill), numbered ${ordered ? 'in order' : 'OUT OF ORDER'}; "since N" returns only newer ones; ring buffer capped at ${w.eng.log.length}` };
});

module.exports = S;
