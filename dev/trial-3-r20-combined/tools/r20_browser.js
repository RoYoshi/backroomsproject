#!/usr/bin/env node
/* dev/trial-3-r20-combined/tools/r20_browser.js - Trial 3 R20: the strategic hunter on a real page, on any tree (R19 combined or R20).
 * Made from dev/trial-3-r19-positioning/tools/r19_browser.js (its helpers, unchanged).  Development tool; evidence, not a gate step.  Trial 3
 * is not owner-approved.
 *
 *   node dev/trial-3-r20-combined/tools/r20_browser.js --dir TREE [--tries 4] [--out FILE.json] [--label C]
 *
 * Scene D (the pack's SH01/SH06 on a real page): the page walks the long hall east in the dark, its torch off, from x 3300 to 7200, with
 * its own keys; a hungry (.75) Skin-Stealer is PLACED 318 px off the hall, round a corner the hall cannot see (4968, 3188), and never
 * steered.  What the page received is judged: was it caught, where, how long the creature was in the page's view before it was within
 * 200 px, and the creature's plans (a post, a wait where it stands, an ambush) from the admin debug.
 * (R19's header follows.)
 *
 * The pages, the server and the recording are R16g's browser campaign's own (dev/trial-3-r9-overhaul/tools/r16g_campaign.js, unchanged:
 * its helpers are compiled here from its source up to its focused scenarios, and its admin-debug reader is taught to keep the R19
 * positioning record `ps` where the tree has one - R18 sends none).  A real page (headless Chromium) is the person, moved and aimed only by
 * its own keys and mouse; a Skin-Stealer is PLACED by the test-only qa_server.js with a hunger, as dev/tests place one, and never steered.
 * What is judged is what the page received: the creature's place each snapshot (50 ms), whether any of the page's three view rays reached
 * its body, and the admin debug (to report why).
 *   B  the pack's Scene B: the page stands lit in the long hall looking at it, 450 px off, the creature very hungry (.85) - did it vanish
 *      (out of the page's view 3 s or more before it came within 200 px), how soon was it within 200 px, its plans, its positioning record
 *   J  the junction: the page stands lit where a side passage leaves the hall (1164, 732), looking at it, the creature 600 px down the
 *      other hall, hungry (.9) - how far east of the straight line (towards the side passage) it went while still 400 px or more off,
 *      when it was within 200 px, its plans, its positioning records
 * Every name and passcode is synthetic; no address, path or secret is written to the output. */
'use strict';
const fs = require('fs'), path = require('path'), Module = require('module');
const CAMP = path.join(__dirname, '..', '..', 'trial-3-r9-overhaul', 'tools', 'r16g_campaign.js');   // (R20: the same campaign helpers)
let src = fs.readFileSync(CAMP, 'utf8');
const cut = src.indexOf('/* ---------------------------------------------------------------- the focused scenarios */');
const A1 = 'q.st, q.ex]; });', A2 = 'ex: d[10] }';
if (cut < 0 || src.split(A1).length !== 2 || src.split(A2).length !== 2) throw new Error('r16g_campaign.js is not as this tool expects');
src = src.slice(0, cut).replace(A1, "q.st, q.ex, q.ps ? q.ps.k + ': ' + String(q.ps.why || '').slice(0, 110) : null]; });").replace(A2, 'ex: d[10], ps: d[11] }')
  + '\nmodule.exports = { B, ARG, sleep, until, alive, keys, stop, H, SS, torch, crouch, look, place, admin, clearK, stretch, track, dbgOf, RUN, LONG, CUR };\n';
const m = new Module(CAMP, module); m.filename = CAMP; m.paths = Module._nodeModulePaths(path.dirname(CAMP)); m._compile(src, CAMP);
const C = m.exports, { B, ARG, sleep, until, alive, keys, stop, H, SS, torch, crouch, look, place, admin, clearK, stretch, track, dbgOf, LONG } = C;
const TRIES = +(ARG.tries || 4);

/* what the page had of creature k: per sample [t, x, y, inView]; plans and positioning records from the admin debug */
function sumUp(rec, id, aid) {
  const tr = track(rec, id), D = dbgOf(rec, id), plans = [], ps = [];
  for (const d of D) { if (plans[plans.length - 1] !== d.pl) plans.push(d.pl); if (d.ps && ps[ps.length - 1] !== d.ps) ps.push(d.ps); }
  const inView = s => { const i = s[2].findIndex(q => q[0] === id); return i >= 0 && !!(s[4] && s[4][i]); };
  const S = rec.map(s => { const k = s[2].find(q => q[0] === id); return { t: s[0], k, me: s[1], seen: inView(s) }; });
  const dead = rec.find(s => s[1][5]);
  return { tr, S, plans, ps, deadAt: dead ? dead[0] : null };
}
(async () => {
  const { p: srv, port, qa } = await B.serve();
  const b = await B.pw.chromium.launch({ args: B.LAUNCH });
  const R = { tool: 'dev/trial-3-r20-combined/tools/r20_browser.js', chromium: b.version(), tree: ARG.label || path.basename(B.DIR), runs: [] };
  try {
    const room = 'r20b' + (Date.now() % 1e6), VP = { width: 1024, height: 640 };
    const A = await B.runPage(b, port, room, VP, 'K3Ra', B.VIDEO);
    await admin(A); const aid = await A.P.evaluate(() => __api.H.id); await A.P.keyboard.press('KeyW');
    const spawn = async (x, y, hunger, ang) => { const k = await qa({ op: 'spawn', kind: 'skinstealer', x, y, hunger, ang }); await until(A.P, () => (window.__k3.ss || []).length > 0, null, 5000); return k; };
    const scene = async (name, fn) => { const F = { name }; try { await clearK(A); await alive(A, A, aid); await crouch(A, false); await fn(F); } catch (e) { F.error = String(e && e.message || e).slice(0, 200); } R.runs.push(F); console.log(`${name}: ${F.note || F.error || ''}`); };
    // the walk: east along the hall with its own keys, looking where it goes, until x 7200, its death, or 34 s
    const walk = async t0 => { while (Date.now() - t0 < 34000) { const h = await H(A); if (!h || h.dead || h.x >= 7200) break; await keys(A, 1, (LONG - h.y) / 60, false); await look(A, h.x + 300, LONG); await sleep(150); } await stop(A); };
    for (let tr = 1; tr <= TRIES; tr++) await scene(`D.${tr} a dark walk past a hidden one (.75)`, async F => {
      await place(A, 3300, LONG); await torch(A, false); await look(A, 3700, LONG);
      const k = await spawn(4968, 3188, .75, Math.PI / 2);
      const [rec] = await stretch(A, [A], walk);
      const U = sumUp(rec, k.id, aid), near = U.S.find(s => s.k && Math.hypot(s.k[1] - s.me[0], s.k[2] - s.me[1]) < 200);
      let seen = 0; for (const s of U.S) { if (near && s.t >= near.t) break; if (s.seen) seen += .05; }
      const last = U.S[U.S.length - 1];
      Object.assign(F, { caught: U.deadAt !== null, deadAt: U.deadAt, at: U.deadAt !== null && last ? Math.round(last.me[0]) : null, nearAt: near ? near.t : null, seenBefore: +seen.toFixed(2), plans: U.plans, staged: U.plans.some(p => p === 'post' || p === 'ambush'), samples: U.S.length });
      F.note = `${F.caught ? 'CAUGHT at ' + F.deadAt + ' s' : 'got through'}; within 200 px at ${F.nearAt} s; in the page's view ${F.seenBefore} s before that; plans ${U.plans.join('>')}`;
    });
  } catch (e) { R.error = e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ').replace(/\/[^\s|:]*\//g, '') : String(e); }
  finally { await b.close().catch(() => { }); try { process.kill(srv.pid); } catch (e) { } }
  const Ds = R.runs.filter(F => !F.error);
  console.log(`SUMMARY ${R.tree}: caught ${Ds.filter(F => F.caught).length}/${Ds.length}; staged (a post or an ambush in its plans) ${Ds.filter(F => F.staged).length}/${Ds.length}; seen before it was within 200 px ${Ds.map(F => F.seenBefore).join('/')} s${R.error ? '; ERROR ' + R.error : ''}`);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
})();
