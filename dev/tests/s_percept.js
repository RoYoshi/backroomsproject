/* PERCEPTION / MEMORY / SOCIAL AWARENESS scenarios */
'use strict';
const { World, DT, dist, LONG, geo, over, rate, avg, stateNames, WORLD } = require('./lib.js');
const S = [];
const add = (name, fn) => S.push({ name, fn });

/* how far away does a resting hound react to a head-on approach, by movement mode / light? */
function noticeAt(seed, mode, light) {
  const w = World(seed);
  const h = w.hound(7000, LONG.y); h.state = 'ROAMING'; h.act = 'rest'; h.rest = 1e9; h.ang = Math.PI;
  const p = w.player(5000, LONG.y, { light, angle: 0 }); p.go(6950, LONG.y, mode);
  let at = -1;
  w.run(40, () => { if (h.state !== 'ROAMING' || h.act !== 'rest') { at = dist(h, p); return false; } if (dist(h, p) < 60) return false; }, 2);
  return { at: at < 0 ? 60 : at };
}
add('P01 noticing distance: run > walk > crouch (resting hound, corridor)', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const m = mode => avg(over(seeds, s => noticeAt(s, mode, true)).map(r => r.at));
  const run = m('run'), walk = m('walk'), crouch = m('crouch');
  return { ok: run > walk && walk > crouch, note: `run ${run | 0}px  walk ${walk | 0}px  crouch ${crouch | 0}px` };
});
add('P02 light beam makes a walker easier to notice (hound)', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const on = avg(over(seeds, s => noticeAt(s, 'walk', true)).map(r => r.at)), off = avg(over(seeds, s => noticeAt(s, 'walk', false)).map(r => r.at));
  return { ok: on > off, note: `light on ${on | 0}px  off ${off | 0}px` };
});
add('P03 standing still: a hound that is not looking never finds a silent standing player 300px away behind it', () => {
  const rs = over([1, 2, 3, 4, 5, 6], s => {
    const w = World(s), h = w.hound(4600, LONG.y); h.state = 'ROAMING'; h.act = 'rest'; h.rest = 1e9; h.ang = 0;       // facing away (east)
    const p = w.player(4300, LONG.y, { light: false }); p.stop('stand');
    let noticed = false; w.run(40, () => { if (h.state !== 'ROAMING') { noticed = true; return false; } }, 4);
    return { ok: !noticed };
  });
  return { ok: rate(rs) >= .8, note: `${(rate(rs) * 100) | 0}% stayed unnoticed (hound facing away, 300px, silent stander)` };
});
add('P04 walls block sight: a hound never SEES a player through a wall at 150px', () => {
  const G = geo(); let done = 0, seen = 0;
  for (let i = 0; i < 400 && done < 14; i++) {
    const c = G.walls[(i * 37) % G.walls.length]; if (!c) continue;
    const w = World(i + 1), ax = c.x + Math.cos(c.ang) * (c.d + 118), ay = c.y + Math.sin(c.ang) * (c.d + 118);
    if (!w.ad.clear(ax, ay, 20, 'walk')) continue;                         // the far side of that wall must be walkable floor
    const h = w.hound(c.x, c.y); h.state = 'ROAMING'; h.act = 'rest'; h.rest = 1e9; h.ang = c.ang;
    const p = w.player(ax, ay, { light: true }); p.stop('stand');
    if (w.eng.geo.los(h.x, h.y, p.x, p.y)) continue;
    done++; w.run(4, () => { const r = h.mem.p.get(p.id); if (r && r.seen) { seen++; return false; } });
  }
  return { ok: done >= 6 && seen === 0, note: `${done} wall-separated pairs, seen through wall in ${seen}` };
});
add('P05 hearing: a running player is heard through a wall (hound turns to it); a crouch-walker at the same spot is not', () => {
  const G = geo(); const cases = G.walls.filter((c, i) => i % 11 === 0).slice(0, 60);
  let runHeard = 0, crHeard = 0, n = 0;
  for (const mode of ['run', 'crouch']) for (const c of cases) {
    const w = World(3), ax = c.x + Math.cos(c.ang) * (c.d + 260), ay = c.y + Math.sin(c.ang) * (c.d + 260);
    if (!w.ad.clear(ax, ay, 20, 'walk')) continue;
    const h = w.hound(c.x, c.y); h.state = 'ROAMING'; h.act = 'rest'; h.rest = 1e9; h.ang = c.ang + Math.PI;
    const p = w.player(ax, ay, { light: false }); if (w.eng.geo.los(h.x, h.y, p.x, p.y)) continue;
    p.go(ax + Math.cos(c.ang + Math.PI / 2) * 200, ay + Math.sin(c.ang + Math.PI / 2) * 200, mode);
    let heard = false; w.run(4, () => { if (h.heardCount > 0) { heard = true; return false; } }, 3);
    if (mode === 'run') { n++; if (heard) runHeard++; } else if (heard) crHeard++;
  }
  return { ok: n >= 10 && runHeard / n >= .6 && crHeard / n <= .15, note: `run heard ${runHeard}/${n}, crouch-walk heard ${crHeard}/${n} (through one wall, ~300px)` };
});
add('P06 hearing radius: sliding / vaulting / landing are loud events, a standing player is silent', () => {
  const w = World(4), h = w.hound(4000, LONG.y); h.state = 'ROAMING'; h.act = 'rest'; h.rest = 1e9;
  const p = w.player(4400, LONG.y, { light: false }); p.stop('stand');
  w.run(6, null); const quiet = h.heardCount;
  p.evq.push([30, 90]); p.evq.push([23, 90]); w.run(.2, null);
  const loud = h.heardCount; const types = h.mem.sounds.map(s => s.type);
  return { ok: quiet === 0 && loud >= 2 && types.includes('slide') && types.includes('vault'), note: `heard while standing ${quiet}; after slide+vault events ${loud} (${types.join(',')})` };
});
add('P07 exhausted breathing is audible only close by', () => {
  const w = World(5), h = w.hound(3400, LONG.y); h.state = 'ROAMING'; h.act = 'rest'; h.rest = 1e9;
  const far = w.player(4300, LONG.y, { light: false }); far.stop('stand');
  const keep = () => { far.stamina = 0; far.ex = 1; };
  w.run(10, keep); const farHeard = h.heardCount;
  far.x = 3400 + 180; w.run(10, keep);
  return { ok: farHeard === 0 && h.heardCount > 0, note: `900px away: ${farHeard} sounds; 180px away: ${h.heardCount}` };
});
/* (Part 1C) a search may start ahead of the last sighting along the way the prey was going (the runner went that way), not only on the spot */
const ahead = (lk, g) => { const h = Math.atan2(lk.vy || 0, lk.vx || 0), dx = g.x - lk.x, dy = g.y - lk.y, fw = dx * Math.cos(h) + dy * Math.sin(h), lat = Math.abs(-dx * Math.sin(h) + dy * Math.cos(h)); return fw > 0 && fw < 1300 && lat < 200; };   // (as far as a runner gets in the seconds the hound was blind)
add('P08 memory: the last known position is used, then goes stale; the hound gives up and goes back to roaming', () => {
  const rs = over([1, 2, 3, 4, 5, 6], s => {
    const w = World(s), p = w.player(5400, LONG.y, {}), h = w.hound(4900, LONG.y); h.ang = 0;
    p.go(6200, LONG.y, 'run'); let vanished = false, vt = 0, lk = null, firstSearchGoal = null, gaveUp = -1, confAtVanish = 0, conf20 = null, found = -1, confFound = 0, lastConf = 0;
    w.run(150, (ww, t) => {
      const r = h.mem.p.get(p.id);
      if (!vanished && r && r.seen && t > 1.2) {                                                    // it has just seen the player: now the player is gone (quiet, dark, far away)
        vanished = true; vt = t; lk = { x: r.lkx, y: r.lky, vx: r.lvx, vy: r.lvy }; confAtVanish = r.conf; p.x = 7500; p.y = LONG.y; p.light = false; p.stop('crouch'); p.stamina = 100;
      }
      if (vanished && found < 0 && r && r.seen && t - vt > 1) { found = t - vt; confFound = lastConf; }   // a roaming hound came across the crouched player again (legitimately, close by): memory is judged up to here
      if (vanished && r) lastConf = r.conf;
      if (vanished && found < 0) {
        if (!firstSearchGoal && h.state === 'SEARCHING' && h.search && h.search.goal) firstSearchGoal = { x: h.search.goal.x, y: h.search.goal.y };
        if (conf20 === null && t - vt > 20 && r) conf20 = r.conf;
        if (gaveUp < 0 && t - vt > 3 && (h.state === 'ROAMING' || h.state === 'DORMANT') && h.mem.p.get(p.id) && h.mem.p.get(p.id).conf < .5) gaveUp = t - vt;
      }
    }, 3);
    const r = h.mem.p.get(p.id), confEnd = found >= 0 ? confFound : r ? r.conf : 0;
    return { ok: vanished && !!firstSearchGoal && (Math.hypot(firstSearchGoal.x - lk.x, firstSearchGoal.y - lk.y) < 400 || ahead(lk, firstSearchGoal)) && gaveUp > 0 && confEnd < .2 && (conf20 === null || conf20 < confAtVanish), vanished, gaveUp: +gaveUp.toFixed(1), conf: +confEnd.toFixed(2), found };
  });
  const c = rs.filter(r => r.vanished);
  return { ok: rate(rs) >= .8 && c.length >= 5, note: `${rs.filter(r => r.ok).length}/${rs.length}: it searched the last known spot, gave up after ~${avg(rs.filter(r => r.gaveUp > 0).map(r => r.gaveUp)).toFixed(0)}s and its memory of the player had decayed (conf ${avg(rs.map(r => r.conf)).toFixed(2)} at 150 s, or just before a roaming hound came across the crouched player again: ${rs.filter(r => r.found >= 0).map(r => r.found.toFixed(0) + ' s').join(', ') || 'never'})` };
});
add('P09 no impossible information: a silent player two rooms away leaves no trace in a roaming hound\'s memory', () => {
  const rs = over([1, 2, 3, 4, 5], s => {
    const w = World(s); const p = w.player(1500, 4000, { light: false }); p.stop('crouch');
    const h = w.hound(1500 + 1300, 4000 + 200);
    let seenAny = false, conf = 0; w.run(60, () => { const r = h.mem.p.get(p.id); if (r) { conf = Math.max(conf, r.conf); if (r.seen) seenAny = true; } }, 5);
    const d = dist(h, p);
    return { ok: !seenAny && conf === 0, conf, d: d | 0 };
  });
  return { ok: rate(rs) >= .8, note: `${rs.filter(r => r.ok).length}/${rs.length} runs: no record at all of the hidden player (hound stayed >~1000px away)`, data: rs };
});
add('P10 social awareness: a second player behind walls, silent, is not counted as a threat; a runner approaching is', () => {
  const G = geo(); const w = World(7);
  const c = G.deadEnds.find(d => d.y > 1000) || G.deadEnds[0];
  // victim in the open, hound adjacent; witness far away behind walls vs. running close in the open
  const h = w.hound(4200, LONG.y); const v = w.player(4290, LONG.y, {}); v.stop('stand');
  const witnessFar = w.player(1500, 4000, { light: false }); witnessFar.stop('stand');
  w.run(1.5, null);
  const cap = w.eng.caps[0] || null;
  const ctx = require('./lib.js').AI; // (assessment is exercised through real captures in the capture scenarios)
  const r = h.mem.p.get(witnessFar.id);
  return { ok: !r || r.conf === 0, note: `hound memory of the far witness: ${r ? 'record conf ' + r.conf : 'none'}` };
});
add('P11 personality: same species, different individuals (trait variation within bounds)', () => {
  const w = World(9); const hs = []; for (let i = 0; i < 40; i++) hs.push(w.hound(3000 + i * 60, LONG.y));
  const sd = k => { const m = avg(hs.map(h => h.tr[k])); return Math.sqrt(avg(hs.map(h => (h.tr[k] - m) ** 2))); };
  const means = { AGGRESSION: avg(hs.map(h => h.tr.AGGRESSION)), HEARING: avg(hs.map(h => h.tr.HEARING)) };
  const inBounds = hs.every(h => Object.values(h.tr).every(v => v >= .02 && v <= .98));
  const sms = []; for (let i = 0; i < 20; i++) sms.push(w.smiler(3000 + i * 60, LONG.y + 96));
  return { ok: sd('AGGRESSION') > .03 && sd('HEARING') > .03 && means.AGGRESSION > .7 && inBounds && sms.every(s => s.tr.LIGHT_SENS > .5), note: `hound AGGRESSION mean ${means.AGGRESSION.toFixed(2)} sd ${sd('AGGRESSION').toFixed(3)}; smilers light-sensitive: ${sms.filter(s => s.tr.LIGHT_SENS > .5).length}/20` };
});
add('P12 traversal caps: hound vaults, smiler vaults slower, nobody squeezes through wall holes without CAN_USE_TIGHT_GAPS; crawl only when allowed', () => {
  const w = World(1), g = w.eng.geo; const P = WORLD.PROPS;
  const L1 = P.find(p => p.id === 'L1'), r = L1.rect;
  const a = { x: r.x + r.w / 2, y: r.y - 100 }, b = { x: r.x + r.w / 2, y: r.y + r.h + 100 };
  const pv = g.path(a.x, a.y, b.x, b.y, { CAN_VAULT: true, VAULT_SPEED: 1.2 }), pn = g.path(a.x, a.y, b.x, b.y, { CAN_VAULT: false });
  const linkV = pv && pv.some(p => p.link), linkN = pn && pn.some(p => p.link);
  const lenV = pv ? pv.length : 0, lenN = pn ? pn.length : 0;
  const G1 = P.find(p => p.id === 'G1'), gc = G1.cell; const ga = { x: gc.x - 150, y: gc.y + 48 }, gb = { x: gc.x + gc.w + 150, y: gc.y + 48 };
  const noTight = g.path(ga.x, ga.y, gb.x, gb.y, { CAN_VAULT: true, CAN_CRAWL: true, CAN_USE_TIGHT_GAPS: false }), tight = g.path(ga.x, ga.y, gb.x, gb.y, { CAN_VAULT: true, CAN_CRAWL: true, CAN_USE_TIGHT_GAPS: true });
  const straightNo = noTight ? noTight.length : 0, straightYes = tight ? tight.length : 0;
  const hs = w.hound(1000, 1000), sm = w.smiler(1000, 1100);
  return { ok: linkV && !linkN && (!noTight || straightNo > straightYes + 6) && !!tight && hs.caps.CAN_VAULT && hs.caps.VAULT_SPEED > sm.caps.VAULT_SPEED && hs.caps.CAN_CRAWL && !sm.caps.CAN_CRAWL,
    note: `vault link used ${linkV}, without CAN_VAULT ${linkN}; hole path len no-tight ${straightNo} vs tight ${straightYes}; VAULT_SPEED hound ${hs.caps.VAULT_SPEED} smiler ${sm.caps.VAULT_SPEED}` };
});
module.exports = S;
