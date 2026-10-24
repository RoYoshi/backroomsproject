/* (Trial 3 R19, the N track; Trial 3 is not owner-approved) the N track's change to the shared engine, as text: its hunk of ai.entity.js
 * (DESIGN_DECISIONS N1 in dev/trial-3-nani-corners/) - follow() drops a waypoint the body has passed on the inside of a bend when its aim
 * would swing back for it.  The checks that hold the shared engine to its starting commits - PR25 (4518f93), WL05 (R8 f378049) - compare
 * this tree's ai.entity.js with the base with exactly these hunks applied;
 * C15 (no Skin-Stealer: every snapshot R8's) and s_nanicorner.js run this tree with exactly these hunks taken back out.  Any other change
 * to ai.entity.js, or to a hunk, still fails them.  Not a suite: run.js does not list it.
 * (Trial 3 R20, the N track: the same registry also holds R20's shared-engine hunks for the open-air STUCK - two in ai.entity.js's steerTo,
 * two in ai.engine.js's watchdog, dev/trial-3-r20-nani-head-watchdog/DESIGN_DECISIONS.md W1/W2.  Each hunk names its file; the checks
 * apply each file's own hunks to that file's base and take every hunk out of the built ai.js.) */
'use strict';
const HUNKS = [
 [
  "    e.unst = null; const c = carrotOf(eng, e, clamp(e.speed * .42, 64, 150)); tx = c.x; ty = c.y;\n",
  "    e.unst = null; const c = carrotOf(eng, e, clamp(e.speed * .42, 64, 150)); tx = c.x; ty = c.y;\n    // (Trial 3 R19, the N track) the aim swinging back - over 57 deg off the body's heading - for a waypoint the body has passed on the inside\n    // of a bend: it cut the corner and is beside the waypoint - over the line square to the next leg through it, on the side its heading\n    // turns toward to take the next leg (the inside of the bend while it turns into it; a test of its heading, not of the bend's geometry:\n    // the review's fresh seeds found every drop on the inside), the waypoint 80 deg or more off its heading,\n    // within 26 px and .12 s of its travel - and can get onto the next leg from here: the line to a point its own look-ahead along it (64-150\n    // px by its speed, or the whole leg) is clear by its collider and 2 px, and neither the next waypoint nor the one after is a vault link\n    // or a crawl cell.  The waypoint is dropped and this tick followed again without it.  R8-R18 kept it until the body was 26 px from it or the\n    // whole next leg was clear: the aim fell back to the waypoint beside or behind it, the heading error passed 90 deg and the body stopped,\n    // pivoted and went (the stop-pivot-go of a Hound at a bend).  Only then: an aim that does not swing back is R18's, unchanged\n    const n1 = e.path[1], n2 = e.path[2];\n    if (!o.passed && n1 && !n1.link && (n1.c | 0) <= 1 && (wp.c | 0) <= 1 && !(n2 && (n2.link || (n2.c | 0) > 1)) && Math.abs(angDiff(Math.atan2(ty - e.y, tx - e.x), e.ang)) > 1) {\n      const d = Math.hypot(wp.x - e.x, wp.y - e.y), ll = Math.hypot(n1.x - wp.x, n1.y - wp.y) || 1, ux = (n1.x - wp.x) / ll, uy = (n1.y - wp.y) / ll, k = Math.min(ll, clamp(e.speed * .42, 64, 150));\n      const hx = Math.cos(e.ang), hy = Math.sin(e.ang), inner = (ux * (e.y - wp.y) - uy * (e.x - wp.x)) * (hx * uy - hy * ux) > 0;\n      if (d < 26 + e.speed * .12 && inner && (e.x - wp.x) * ux + (e.y - wp.y) * uy > 0 && Math.abs(angDiff(Math.atan2(wp.y - e.y, wp.x - e.x), e.ang)) > 1.4 && geo.lineClear(e.x, e.y, wp.x + ux * k, wp.y + uy * k, e.rc + 2, e.mode)) {\n        e.path.shift(); navOf(e).passed = (navOf(e).passed || 0) + 1; return follow(eng, e, dt, vmax, Object.assign({}, o, { passed: 1 }));\n      }\n    }\n"
 ],
  // (Trial 3 R20: the N track - the open-air STUCK, dev/trial-3-r20-nani-head-watchdog/DESIGN_DECISIONS.md W1, W2 - and the S track - a
  // species with its own ear, opt-in, in hearEvent: dev/trial-3-r20-strategic-ambush/DESIGN_DECISIONS.md - and the head swivel, opt-in,
  // tagged head: dev/trial-3-r20-nani-head-watchdog/DESIGN_DECISIONS.md W3)
 [
  " * provides: approach, coarseMove, directOk, directTo, faceToward, follow, goTo, mkEntity, moodTick, moveCollide, navOf, plan,\n",
  " * provides: approach, coarseMove, directOk, directTo, faceToward, follow, goTo, headAhead, mkEntity, moodTick, moveCollide, navOf, plan,\n",
  "src/frameworks/nani/server/ai.entity.js",
  "head"
 ],
 [
  "  let target = o.hold ? 0 : vmax * (o.noSlow ? 1 : clamp(align, .1, 1));\n",
  "  const turnV = o.hold ? 0 : vmax * (o.noSlow ? 1 : clamp(align, .1, 1));       // (R20) the speed its own turn allows: what its progress is measured against\n  let target = turnV;\n",
  "src/frameworks/nani/server/ai.entity.js"
 ],
 [
  "  const intent = Math.max(step, (o.hold ? 0 : vmax) * dt * .5);                 // stuck = it wants to move and does not (measured against intent, not the speed it was braked to)\n",
  "  // stuck = it wants to move and does not.  (R20) A species that opts in (caps.TURN_AWARE_STUCK: the Skin-Stealer) measures it against\n  // the speed its own turn allows, not the speed a wall or a corner braked it to: against its full speed, a body slowed to 10-15 % to turn\n  // round on open floor counted as stuck - the open-air STUCK.  Every other species keeps R8-R19's yardstick, its full speed: the Hound's and\n  // the Smiler's movement and recovery are B++'s byte for byte (the gate's server golden traces hold them)\n  const intent = Math.max(step, (e.caps.TURN_AWARE_STUCK ? turnV : o.hold ? 0 : vmax) * dt * .5);\n",
  "src/frameworks/nani/server/ai.entity.js"
 ],
 [
  "function moodTick(e, dt) {\n",
  "/* (Trial 3 R20, the N track) the head swivel, for a species that opts in with caps.HEAD_SWIVEL = { max, run, rate, ahead }: the head angle\n * (from the body's heading) its gaze leads with while it walks its route - toward the next bend of its own path as it comes within\n * `ahead` px of it, more as it nears it, to `max` rad (`run` rad at a run).  It is only where its head points: the sight is the engine's\n * (centred on e.ang + e.head, range, light and walls as for every species), so the turn shows it the corner's mouth as it opens and nothing\n * behind the wall; its body's speed, turn and collision are untouched.  A species without the capability gets 0 and never calls it. */\nfunction headAhead(eng, e) {\n  const H = e.caps && e.caps.HEAD_SWIVEL, P = e.path;\n  if (!H || !P || P.length < 2 || e.trav || e.speed < 30 || P[0].link || P[1].link) return 0;\n  const d0 = Math.hypot(P[0].x - e.x, P[0].y - e.y); if (d0 > H.ahead) return 0;\n  const w = 1 - d0 / H.ahead, lim = e.speed > (H.runFrom || 230) ? H.run : H.max;\n  return clamp(angDiff(Math.atan2(P[1].y - e.y, P[1].x - e.x), e.ang) * w, -lim, lim);\n}\nfunction moodTick(e, dt) {\n",
  "src/frameworks/nani/server/ai.entity.js",
  "head"
 ],
 [
  "    if (e.kind === 'hound') { if (!idle) w.t += dt; } else w.t += dt;\n",
  "    // (R20) a species that says itself when it stands still on purpose (sp.still: the Skin-Stealer) has the hound's rule too, its stillness\n    // asked every tick rather than at the one tick of the check; a second of standing still on purpose begins its time afresh (a wait, a\n    // stare, a meal: whatever it does next is a new attempt); and it is stuck only if in its 6 s of trying it never got 60 px from where it\n    // began (a walk there and back past the same spot is not being stuck)\n    const own = !!e.sp.still;\n    if (own) { if (idle) { w.rest = (w.rest || 0) + dt; if (w.rest >= 1) { w.t = 0; w.x = e.x; w.y = e.y; w.far = 0; } } else w.rest = 0; }\n    if (e.kind === 'hound' || own) { if (!idle) w.t += dt; } else w.t += dt;\n    if (own) w.far = Math.max(w.far || 0, Math.hypot(e.x - w.x, e.y - w.y));\n",
  "src/frameworks/nani/server/ai.engine.js"
 ],
 [
  "    let stuck = false; if (w.t >= 6) { stuck = Math.hypot(e.x - w.x, e.y - w.y) < 26 && (e.kind === 'hound' || !idle); w.x = e.x; w.y = e.y; w.t = 0; }\n",
  "    let stuck = false; if (w.t >= 6) { stuck = Math.hypot(e.x - w.x, e.y - w.y) < 26 && (own ? (w.far || 0) < 60 : e.kind === 'hound' || !idle); w.x = e.x; w.y = e.y; w.t = 0; w.far = 0; }\n",
  "src/frameworks/nani/server/ai.engine.js"
 ],
 [
  "  if (d > eff * 1.05) return;\n",
  "  if (e.sp.hearScale) eff *= e.sp.hearScale(ev);                              // (Trial 3 R20) a species with its own ear (opt-in: the Skin-Stealer's, by kind of sound)\n  if (d > eff * 1.05) return;\n",
  "src/frameworks/nani/server/ai.senses.js"
 ],
 [
  "  if (!clear) eff *= .6;\n",
  "  if (!clear) eff *= e.sp.hearWall || .6;                                       // (R20: its own share through a wall, if it has one)\n",
  "src/frameworks/nani/server/ai.senses.js"
 ]
];   // [base text, this tree's text, file (R19's hunk: ai.entity.js), tag ('head': the head swivel)]
const FILE = 'src/frameworks/nani/server/ai.entity.js', fileOf = h => h[2] || FILE, FILES = [...new Set(HUNKS.map(fileOf))];
const once = (s, x) => s.split(x).length === 2;
/* the base of one file with every hunk of that file applied (null: a hunk's base text is not there exactly once, or its new text is already
 * there); file: the part's path (R19's callers name none: ai.entity.js) */
function add(src, file = FILE) { let t = src; for (const h of HUNKS) { if (fileOf(h) !== file) continue; const [o, n] = h; if (!once(t, o) || t.includes(n)) return null; t = t.replace(o, () => n); } return t; }
/* this tree's source (the part - file - or the built ai.js, which holds every part: no file) with every hunk taken back out (null: a hunk's
 * new text is not there exactly once) */
const hdr = h => /^ \* (provides|uses):/.test(h[1]);   // (R20 D) a hunk of a part's header comment: the build leaves headers out of ai.js
function remove(src, file = null) { let t = src; for (const h of HUNKS) { if (file && fileOf(h) !== file) continue; if (!file && hdr(h)) continue; const [o, n] = h; if (!once(t, n)) return null; t = t.replace(n, () => o); } return t; }
const lines = f => HUNKS.filter(h => !f || fileOf(h) === f).reduce((a, [o, n]) => a + n.split('\n').length - o.split('\n').length, 0);
/* (R20) the built ai.js with only the given hunks taken back out (R20's alone: R19 combined's engine) - null as remove() */
const R20 = HUNKS.filter(h => h[2] && !h[3]), R19 = HUNKS.filter(h => !h[2]);   // (R20: R19's cornering hunk alone - NC01-NC04's subject)
const HEAD = HUNKS.filter(h => h[3] === 'head');   // (R20 checkpoint D: the opt-in head swivel's helper, W3 - kept by the STUCK checks' R19 runs, which the Skin-Stealer's code calls)
function without(src, hs) { let t = src; for (const h of hs) { if (hdr(h)) continue; const [o, n] = h; if (!once(t, n)) return null; t = t.replace(n, () => o); } return t; }
module.exports = { HUNKS, FILE, FILES, fileOf, add, remove, lines: lines(), linesOf: lines, R20, R19, HEAD, without };
