/* (Trial 3 R19, the N track; Trial 3 is not owner-approved) the N track's change to the shared engine, as text: its hunk of ai.entity.js
 * (DESIGN_DECISIONS N1 in dev/trial-3-nani-corners/) - follow() drops a waypoint the body has passed on the inside of a bend when its aim
 * would swing back for it.  The checks that hold the shared engine to its starting commits - PR25 (4518f93), WL05 (R8 f378049) - compare
 * this tree's ai.entity.js with the base with exactly these hunks applied;
 * C15 (no Skin-Stealer: every snapshot R8's) and s_nanicorner.js run this tree with exactly these hunks taken back out.  Any other change
 * to ai.entity.js, or to a hunk, still fails them.  Not a suite: run.js does not list it. */
'use strict';
const HUNKS = [
 [
  "    e.unst = null; const c = carrotOf(eng, e, clamp(e.speed * .42, 64, 150)); tx = c.x; ty = c.y;\n",
  "    e.unst = null; const c = carrotOf(eng, e, clamp(e.speed * .42, 64, 150)); tx = c.x; ty = c.y;\n    // (Trial 3 R19, the N track) the aim swinging back - over 57 deg off the body's heading - for a waypoint the body has passed on the inside\n    // of a bend: it cut the corner and is beside the waypoint - over the line square to the next leg through it, on the inner side of the\n    // turn (the side its heading turns toward: a body that ran wide and is curving back is not), the waypoint 80 deg or more off its heading,\n    // within 26 px and .12 s of its travel - and can get onto the next leg from here: the line to a point its own look-ahead along it (64-150\n    // px by its speed, or the whole leg) is clear by its collider and 2 px, and neither the next waypoint nor the one after is a vault link\n    // or a crawl cell.  The waypoint is dropped and this tick followed again without it.  R8-R18 kept it until the body was 26 px from it or the\n    // whole next leg was clear: the aim fell back to the waypoint beside or behind it, the heading error passed 90 deg and the body stopped,\n    // pivoted and went (the stop-pivot-go of a Hound at a bend).  Only then: an aim that does not swing back is R18's, unchanged\n    const n1 = e.path[1], n2 = e.path[2];\n    if (!o.passed && n1 && !n1.link && (n1.c | 0) <= 1 && (wp.c | 0) <= 1 && !(n2 && (n2.link || (n2.c | 0) > 1)) && Math.abs(angDiff(Math.atan2(ty - e.y, tx - e.x), e.ang)) > 1) {\n      const d = Math.hypot(wp.x - e.x, wp.y - e.y), ll = Math.hypot(n1.x - wp.x, n1.y - wp.y) || 1, ux = (n1.x - wp.x) / ll, uy = (n1.y - wp.y) / ll, k = Math.min(ll, clamp(e.speed * .42, 64, 150));\n      const hx = Math.cos(e.ang), hy = Math.sin(e.ang), inner = (ux * (e.y - wp.y) - uy * (e.x - wp.x)) * (hx * uy - hy * ux) > 0;\n      if (d < 26 + e.speed * .12 && inner && (e.x - wp.x) * ux + (e.y - wp.y) * uy > 0 && Math.abs(angDiff(Math.atan2(wp.y - e.y, wp.x - e.x), e.ang)) > 1.4 && geo.lineClear(e.x, e.y, wp.x + ux * k, wp.y + uy * k, e.rc + 2, e.mode)) {\n        e.path.shift(); navOf(e).passed = (navOf(e).passed || 0) + 1; return follow(eng, e, dt, vmax, Object.assign({}, o, { passed: 1 }));\n      }\n    }\n"
 ]
];   // [base text, this tree's text]
const FILE = 'src/frameworks/nani/server/ai.entity.js';
const once = (s, x) => s.split(x).length === 2;
/* the base with every hunk applied (null: a hunk's base text is not there exactly once, or its new text is already there) */
function add(src) { let t = src; for (const [o, n] of HUNKS) { if (!once(t, o) || t.includes(n)) return null; t = t.replace(o, () => n); } return t; }
/* this tree's source (the part, or the built ai.js) with every hunk taken back out (null: a hunk's new text is not there exactly once) */
function remove(src) { let t = src; for (const [o, n] of HUNKS) { if (!once(t, n)) return null; t = t.replace(n, () => o); } return t; }
module.exports = { HUNKS, FILE, add, remove, lines: HUNKS.reduce((a, [o, n]) => a + n.split('\n').length - o.split('\n').length, 0) };
