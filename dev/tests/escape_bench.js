/* Chase / escape benchmark (Part 1C).  A scripted player flees a hunting hound with a strategy; the real AI and the real stamina rules decide the rest.
 *   node tests/escape_bench.js [strategy|all] [runs]
 * Strategies (each starts with the hound hunting, 320-420 px behind, the player seen and fresh):
 *   straight   hold sprint along a long route across rooms (walks when exhausted, keeps going)
 *   break-walk sprint, and once out of the hound's sight walk quietly on
 *   break-hide sprint, and once out of sight crouch still in the first spot out of its view
 *   break-run  sprint, break sight, keep sprinting (loud)
 *   crawl      sprint to the nearest wall hole / table and crawl in, then stay still
 * Outcome per run: caught (and when), escaped (the hound has not been HUNTING/STALKING for 20 s and is > 700 px away), or still engaged at 90 s.
 * The player bot reads nothing from the hound except what a player sees on screen (is it in view?). */
'use strict';
const { World, DT, geo, avg } = require('./lib.js');
const TAU = Math.PI * 2;
function floorPts() { const G = geo(); return G.cells.filter((_, i) => i % 7 === 0).map(c => ({ x: G.g.cx(c), y: G.g.cy(c) })).filter(p => G.ad.clear(p.x, p.y, 26, 'walk')); }
let PTS = null;
const ENG = new Set(['HUNTING', 'STALKING']);
function farTarget(w, p, from, i) { const P = PTS || (PTS = floorPts()); let best = null, bs = -1; for (let k = 0; k < 60; k++) { const q = P[(i * 131 + k * 977) % P.length], d = Math.hypot(q.x - p.x, q.y - p.y), away = Math.hypot(q.x - from.x, q.y - from.y) - d; if (d > 1800 && d < 3600 && away > bs) { const r = w.eng.geo.path(p.x, p.y, q.x, q.y, { CAN_VAULT: false }); if (r) { bs = away; best = q; } } } return best; }
function seenBy(w, h, p) { return w.eng.geo.los(h.x, h.y, p.x, p.y) && Math.hypot(h.x - p.x, h.y - p.y) < 900; }       // the player can see the hound on screen: in line of sight, close
function crawlTarget(w, p) { const W0 = require(require('../paths.js') + '/world.js'); let best = null, bd = 1e9; for (const z of W0.PROPS.filter(q => q.type === 'gap' || q.type === 'under')) { const d = Math.hypot(z.cx - p.x, z.cy - p.y); if (d < bd) { bd = d; best = z; } } return best; }

function run(strategy, i, opt = {}) {
  const P = PTS || (PTS = floorPts()), a = P[(i * 7919 + 13) % P.length];
  const w = World(3000 + i), p = w.player(a.x, a.y, { light: true }); p.stamina = opt.stamina ?? 100; if (p.stamina < 24) p.ex = 1;
  // the hound: behind the player, on the floor, hunting it, having seen it
  let h = null; for (let k = 0; k < 24 && !h; k++) { const ang = k / 24 * TAU, d = (opt.startD || 320) + (k % 3) * 50, x = a.x + Math.cos(ang) * d, y = a.y + Math.sin(ang) * d; if (w.ad.clear(x, y, 26, 'walk') && (opt.startD ? w.eng.geo.path(x, y, a.x, a.y, { CAN_VAULT: false }) : w.eng.geo.lineClear(x, y, a.x, a.y, 22, 'walk'))) h = w.hound(x, y); }
  if (!h) return null;
  if (opt.traits) Object.assign(h.tr, opt.traits);
  h.ang = Math.atan2(a.y - h.y, a.x - h.x); w.run(.4, null); let r = h.mem.p.get(p.id); if (opt.startD && (!r || !r.seen)) { w.eng.sound({ type: 'run', x: p.x, y: p.y, r: 900, I: 1, src: p.id }); r = h.mem.p.get(p.id); } if (!r || (!r.seen && !opt.startD)) return null;
  h.state = 'HUNTING'; h.target = p.id; h.chaseBlind = 0; h.huntStart = w.eng.now; p.lastH = { x: h.x, y: h.y }; if (opt.light === false) p.light = false;   // spotted with the torch on; it goes off as the chase starts
  const tgt = strategy === 'crawl' ? crawlTarget(w, p) : farTarget(w, p, h, i); if (!tgt) return null;
  if (strategy === 'crawl') { const W0 = require(require('../paths.js') + '/world.js'), cz = W0.CRAWL.find(c => c.id === tgt.id); let ex = null, bd = 1e9; for (const x of cz.exits) { const d = Math.hypot(x.x - p.x, x.y - p.y); if (d < bd && w.ad.clear(x.x, x.y, 16, 'walk')) { bd = d; ex = x; } } if (!ex || !p.pathTo(ex.x, ex.y, 'run')) return null; p.crawlTo = { x: cz.cx, y: cz.cy }; }
  else p.pathTo(tgt.x, tgt.y, 'run');
  let t = 0, caught = false, lost = -1, out = 0, broke = -1, hid = false, notEng = 0, maxGap = 0;
  const lim = opt.lim || 90;
  while (t < lim) {
    const vis = seenBy(w, h, p); if (vis) p.lastH = { x: h.x, y: h.y };
    if (!vis && broke < 0 && t > .5) broke = t;
    if (strategy === 'break-walk' && broke >= 0 && p.mode === 'run' && !p.panic) p.mode = 'walk';
    // smart: break its sight, keep running a little to make distance, then go quiet and take a different turn from the one it saw you heading for
    if (strategy === 'smart' && broke >= 0 && !p.quiet && t - broke > 2.2) { p.quiet = true; const hd = Math.atan2(p.vy, p.vx); let q = null; for (let k = 0; k < 40 && !q; k++) { const c = P[(i * 37 + k * 211) % P.length], d = Math.hypot(c.x - p.x, c.y - p.y); if (d > 600 && d < 1600 && Math.cos(Math.atan2(c.y - p.y, c.x - p.x) - hd) < .2 && Math.hypot(c.x - p.lastH.x, c.y - p.lastH.y) > Math.hypot(p.x - p.lastH.x, p.y - p.lastH.y) + 400 && w.eng.geo.path(p.x, p.y, c.x, c.y, { CAN_VAULT: false })) q = c; } if (q) p.pathTo(q.x, q.y, 'walk'); else p.mode = 'walk'; }
    if (strategy === 'smart' && p.quiet && !p.path?.length && !p.tx && !hid) { hid = true; p.stop('crouch'); }
    if (strategy === 'break-hide' && broke >= 0 && !hid) { hid = true; p.stop('crouch'); }
    if (strategy === 'crawl' && !p.path?.length && !p.tx && !hid) { if (p.crawlTo) { p.go(p.crawlTo.x, p.crawlTo.y, 'crawl'); p.crawlTo = null; } else { hid = true; p.stop('crawl'); } }
    if (!p.path?.length && !p.tx && !hid && strategy !== 'crawl' && !p.quiet) { const q = farTarget(w, p, h, i + Math.floor(t)); if (q) p.pathTo(q.x, q.y, p.ex ? 'walk' : strategy === 'break-walk' && broke >= 0 ? 'walk' : 'run'); }
    if (p.mode === 'walk' && !p.ex && p.stamina > 60 && (strategy === 'straight' || strategy === 'break-run')) p.mode = 'run';          // a sprinter sprints again as soon as it can
    // a skilled player dodges a lunge it can see coming (the wind-up crouch and the growl): a hard sidestep, then back on its way
    if (opt.juke && vis && h.act === 'wind' && !p.juke && Math.hypot(h.x - p.x, h.y - p.y) < 360) { const a0 = Math.atan2(p.y - h.y, p.x - h.x) + (i % 2 ? 1.35 : -1.35), jx = p.x + Math.cos(a0) * 140, jy = p.y + Math.sin(a0) * 140; if (w.ad.clear(jx, jy, 18, 'walk')) { p.juke = { t: .45, path: p.path, tx: p.tx }; p.go(jx, jy, p.stamina > 5 ? 'run' : 'walk'); } }
    if (p.juke) { p.juke.t -= DT; if (p.juke.t <= 0) { const j = p.juke; p.juke = null; if (j.path) p.route(j.path, p.stamina > 5 && !p.ex ? 'run' : 'walk'); else p.stop(); } }
    w.step(); t += DT;
    if (opt.hook) { const hr = opt.hook(w, h, p, t, P); if (hr) return hr; }                          // a test can take over the player mid-run
    if (opt.hook) { const hr = opt.hook(w, h, p, t, P); if (hr) return hr; }                          // a test can take over the player mid-run
    if (process.env.TRACE && Math.round(t * 60) % 30 === 0) { const rr = h.mem.p.get(p.id); console.log(t.toFixed(1), h.state, h.act, 'd', Math.round(Math.hypot(h.x - p.x, h.y - p.y)), 'blind', (h.chaseBlind || 0).toFixed(1), 'ear', h.dbg.pursuit && h.dbg.pursuit.ear, 'hLoudAge', rr ? (w.eng.now - rr.hLoud).toFixed(1) : '-', 'heardAge', rr ? (w.eng.now - rr.heardAt).toFixed(1) : '-', 'conf', rr ? rr.conf.toFixed(2) : '-', 'st', p.st, 'sp', Math.round(p.sp), 'tier', h.tier, h.dbg.disengage || ''); }
    if (p.caught || p.dead) { caught = true; break; }
    if (ENG.has(h.state)) notEng = 0; else notEng += DT;
    maxGap = Math.max(maxGap, Math.hypot(h.x - p.x, h.y - p.y));
    if (notEng > 20 && Math.hypot(h.x - p.x, h.y - p.y) > 700 && (!opt.untilGiveUp || !['SEARCHING', 'FRUSTRATED', 'ALERT', 'CURIOUS'].includes(h.state))) { lost = t; break; }   // untilGiveUp: count it only once the hound has actually stopped looking
  }
  const nv = h.nav || {};
  const rr = h.mem.p.get(p.id);
  return { caught, t: +t.toFixed(1), lost: lost >= 0, broke: +broke.toFixed(1), stamina: Math.round(p.stamina), searchWhy: h.dbg.searchWhy || '', state: h.state, maxGap: Math.round(maxGap), plans: nv.plans | 0, dis: h.dbg.disengage || '', conf: rr ? +rr.conf.toFixed(2) : 0 };
}
function summary(name, rs) {
  rs = rs.filter(Boolean); const c = rs.filter(r => r.caught), l = rs.filter(r => r.lost), e = rs.filter(r => !r.caught && !r.lost);
  return { strategy: name, n: rs.length, caught: +(c.length / rs.length).toFixed(2), escaped: +(l.length / rs.length).toFixed(2), stillEngaged: +(e.length / rs.length).toFixed(2), catchTime: c.length ? +avg(c.map(r => r.t)).toFixed(1) : null, escapeTime: l.length ? +avg(l.map(r => r.t)).toFixed(1) : null };
}
if (require.main === module) {
  const which = process.argv[2] || 'all', n = +(process.argv[3] || 16);
  const S = which === 'all' ? ['straight', 'break-walk', 'break-hide', 'break-run', 'crawl'] : [which];
  for (const s of S) { const rs = []; for (let i = 0; i < n; i++) rs.push(run(s, i)); console.log(JSON.stringify(summary(s, rs))); }
  { const rs = []; for (let i = 0; i < n; i++) rs.push(run('straight', i, { stamina: 12 })); console.log(JSON.stringify(summary('straight, exhausted at start', rs))); }
  for (const s2 of ['straight', 'break-walk', 'break-hide', 'crawl']) { const rs = []; for (let i = 0; i < n; i++) rs.push(run(s2, i, { juke: true })); console.log(JSON.stringify(summary(s2 + ' + dodges lunges', rs))); }
  if (process.env.MID) for (const s2 of ['straight', 'break-walk', 'break-hide', 'crawl', 'smart']) { const rs = []; for (let i = 0; i < n; i++) rs.push(run(s2, i, { light: false, startD: 520 })); console.log(JSON.stringify(summary(s2 + ', light off, hound 520 px away', rs))); }
  if (process.env.FAR) for (const s2 of ['straight', 'break-walk', 'break-hide']) { const rs = []; for (let i = 0; i < n; i++) rs.push(run(s2, i, { light: false, startD: 800 })); console.log(JSON.stringify(summary(s2 + ', light off, hound 800 px away', rs))); }
  if (process.env.DARK) for (const s2 of ['straight', 'break-walk', 'break-hide', 'break-run', 'crawl']) { const rs = []; for (let i = 0; i < n; i++) rs.push(run(s2, i, { light: false })); console.log(JSON.stringify(summary(s2 + ', flashlight OFF', rs))); }
}
module.exports = { run, summary };
