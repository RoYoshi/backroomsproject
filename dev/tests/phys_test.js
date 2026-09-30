/* numeric checks of dphys.js: continuity, rest, wall respect, determinism.  node phys_test.js [verbose] */
const fs = require('fs'), vm = require('vm'), path = require('path');
const win = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../g/dphys.js'), 'utf8'), { window: win, Math });
const P = win.__dphys, verbose = process.argv[2] === 'v';
const hyp = Math.hypot;
// a room: floor everywhere, walls as blocks at given rects
function mkWalls(rects) { return (x, y) => rects.filter(q => true); }
const OPEN = [], WALL_E = [{ x: 92, y: -2000, w: 1000, h: 4000 }];            // wall face at x=92 (the victim stands about 90 px in front of it)
const PLAN = {
  Hound: { A: { hits: [.2, .62, 1.05, 1.55], kn: 46, dr: 40 }, B: { hits: [.3, .85, 1.5, 2.1], kn: 12, dr: 140 }, C: { hits: [.2, .21, .8, 1.4], kn: 34, dr: 0 }, D: { hits: [.45, .95, 1.55], kn: 24, dr: 26 } },
  Smiler: { A: { hits: [.38, .98, 1.48], kn: 34, dr: 86 }, B: { hits: [.7, 1.2, 1.7], kn: 0, dr: 0 }, C: { hits: [.55, 1.1, 1.6], kn: 18, dr: 36 }, D: { hits: [.6, 1.2, 1.8], kn: 26, dr: 70 } },
};
function run(kind, v, o = {}) {
  const pl = PLAN[kind][v], vic = { x: 0, y: 0, angle: 0, vx: o.vx || 0, vy: 0 }, src = { x: -46, y: 0 };
  const dir = Math.atan2(vic.y - src.y, vic.x - src.x);
  const S = P.create({ kind, v, victim: vic, src, dir, hits: pl.hits, kn: (o.wallD != null ? o.wallD : pl.kn), drag: pl.dr, seed: 12345 + (o.seed || 0), exhausted: o.exh, eqKind: 'flashlight', hat: 'cap', walls: mkWalls(o.walls || OPEN), dur: 4.6 });
  const fr = []; let prev = null, maxJump = 0, maxHandJump = 0, maxEqJump = 0, maxAng = 0, pen = 0;
  for (let i = 0; i <= 60 * 4.6; i++) {
    P.advance(S, i / 60);
    const b = S.b, snap = { t: i / 60, x: b.x, y: b.y, th: b.th, h: S.h.map(h => [h.x, h.y]), eq: [S.eq.x, S.eq.y], held: S.eq.held, at: [S.at.x, S.at.y], st: S.state };
    if (prev) { maxJump = Math.max(maxJump, hyp(snap.x - prev.x, snap.y - prev.y)); maxAng = Math.max(maxAng, Math.abs(snap.th - prev.th)); for (let k = 0; k < 2; k++) maxHandJump = Math.max(maxHandJump, hyp(snap.h[k][0] - prev.h[k][0], snap.h[k][1] - prev.h[k][1])); if (!snap.held && !prev.held) maxEqJump = Math.max(maxEqJump, hyp(snap.eq[0] - prev.eq[0], snap.eq[1] - prev.eq[1])); }
    // wall penetration (wall at x=400)
    if (o.walls && b.x + 18 > 92 + 1.5) pen = Math.max(pen, b.x + 18 - 92);
    fr.push(snap); prev = snap;
  }
  const last = fr[fr.length - 1], rest = fr.find(f => f.st === 'SLEEPING');
  return { S, fr, maxJump, maxHandJump, maxEqJump, maxAng, pen, last, restT: rest ? rest.t : null };
}
let bad = 0;
const chk = (name, ok, note) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + note : '')); if (!ok) bad++; };
for (const kind of ['Hound', 'Smiler']) for (const v of 'ABCD') {
  const wall = kind === 'Hound' && v === 'C';
  const r = run(kind, v, wall ? { walls: WALL_E, wallD: 73 } : {});
  const b = r.S.b, dist = hyp(r.last.x, r.last.y), at = r.S.at;
  const ev = r.S.ev.filter(e => e.k === 'contact' || e.k === 'wall' || e.k === 'eq' || e.k === 'hat' || e.k === 'slip').map(e => e.k + '@' + e.t.toFixed(2)).join(' ');
  chk(`${kind} ${v}: body never jumps (max ${r.maxJump.toFixed(1)} px / frame)`, r.maxJump < 14);
  chk(`${kind} ${v}: hands never jump (max ${r.maxHandJump.toFixed(1)} px / frame)`, r.maxHandJump < 20);
  chk(`${kind} ${v}: the light never teleports (max ${r.maxEqJump.toFixed(1)} px / frame)`, r.maxEqJump < 16);
  chk(`${kind} ${v}: never turns more than ${(r.maxAng * 57.3).toFixed(1)}°/frame`, r.maxAng < .32);
  chk(`${kind} ${v}: is at rest by the end`, r.S.state !== 'ACTIVE' && Math.hypot(b.vx, b.vy) < 8, `state ${r.S.state}, v ${hyp(b.vx, b.vy).toFixed(1)}, sleeps at ${r.restT}`);
  chk(`${kind} ${v}: travelled a plausible distance`, dist > (v === 'B' && kind === 'Smiler' ? -1 : 8) && dist < 260, `${dist.toFixed(0)} px, angle ${(b.th * 57.3).toFixed(0)}°`);
  if (wall) chk(`${kind} ${v}: the wall stops it (no penetration)`, r.pen < 2, `pen ${r.pen.toFixed(2)}, wall hit ${JSON.stringify(r.S.wallHit && { t: +r.S.wallHit.t.toFixed(2), sp: Math.round(r.S.wallHit.sp) })}`);
  if (verbose) console.log('   events:', ev, ' attacker end', at.x.toFixed(0), at.y.toFixed(0));
}
// determinism: same parameters, two runs, identical
{ const a = run('Hound', 'B'), c = run('Hound', 'B'); chk('deterministic: two runs are identical', a.last.x === c.last.x && a.last.th === c.last.th && a.S.eq.x === c.S.eq.x); }
// sampling-independent: stepping at 30 Hz or 120 Hz gives the same result
{ const mk = () => P.create({ kind: 'Hound', v: 'A', victim: { x: 0, y: 0, angle: 0, vx: 0, vy: 0 }, src: { x: -46, y: 0 }, dir: 0, hits: PLAN.Hound.A.hits, kn: 46, drag: 40, seed: 7, eqKind: 'flashlight', hat: 'cap', walls: () => [], dur: 4 });
  const a = mk(), c = mk(); for (let i = 1; i <= 120; i++) P.advance(a, i / 30); for (let i = 1; i <= 480; i++) P.advance(c, i / 120); chk('sampling-independent: 30 Hz and 120 Hz agree', Math.abs(a.b.x - c.b.x) < 1e-6 && Math.abs(a.h[0].x - c.h[0].x) < 1e-6); }
// exhausted victim resists less
{ const f = run('Hound', 'A', { exh: true }), n = run('Hound', 'A', {}); chk('exhausted victim resists less', f.S.exh < 1 && n.S.exh === 1); }
// the whole matrix: every variant in an open room, with a wall behind, a wall beside, in a corner, moving fast, exhausted, with 5 seeds each
const rd = (x, y, q) => { const cx = Math.max(q.x, Math.min(x, q.x + q.w)), cy = Math.max(q.y, Math.min(y, q.y + q.h)); return hyp(x - cx, y - cy); };
const SC = { open: {}, wallBehind: { walls: [{ x: 96, y: -2000, w: 900, h: 4000 }] }, wallSide: { walls: [{ x: -2000, y: 34, w: 4000, h: 900 }] }, corner: { walls: [{ x: 84, y: -2000, w: 900, h: 4000 }, { x: -2000, y: 50, w: 4000, h: 900 }] }, moving: { vx: 230 }, tired: { exh: true } };
let cells = 0, worst = { jump: 0, hand: 0, pen: 99, eq: 0 }, fails = [];
for (const kind of ['Hound', 'Smiler']) for (const v of 'ABCD') for (const [sn, sc] of Object.entries(SC)) for (let seed = 0; seed < 5; seed++) {
  const r = run(kind, v, Object.assign({ seed }, sc)); cells++;
  let pen = 99; if (sc.walls) for (const f of r.fr) for (const q of sc.walls) pen = Math.min(pen, rd(f.x, f.y, q));
  worst.jump = Math.max(worst.jump, r.maxJump); worst.hand = Math.max(worst.hand, r.maxHandJump); worst.eq = Math.max(worst.eq, r.maxEqJump); worst.pen = Math.min(worst.pen, pen);
  const restOk = r.S.state !== 'ACTIVE' || hyp(r.S.b.vx, r.S.b.vy) < 12;
  if (r.maxJump > 16 || r.maxHandJump > 22 || r.maxEqJump > 18 || pen < 15 || !restOk || !isFinite(r.last.x)) fails.push(`${kind} ${v} ${sn} #${seed}: jump ${r.maxJump.toFixed(1)} hand ${r.maxHandJump.toFixed(1)} eq ${r.maxEqJump.toFixed(1)} pen ${pen.toFixed(1)} rest ${restOk}`);
}
chk(`matrix: ${cells} runs (8 variants x 6 situations x 5 seeds): no jumps, no wall clipping, everything comes to rest`, !fails.length, `worst body ${worst.jump.toFixed(1)} px/frame, hand ${worst.hand.toFixed(1)}, light ${worst.eq.toFixed(1)}, closest to a wall ${worst.pen.toFixed(1)} px (radius 18)` + (fails.length ? '\n     ' + fails.slice(0, 10).join('\n     ') : ''));
console.log(bad ? `\n${bad} FAILED` : '\nall physics checks passed'); process.exit(bad ? 1 : 0);
