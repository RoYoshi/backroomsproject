#!/usr/bin/env node
/* dev/trial-3-r19-positioning/tools/r19_browser.js - Trial 3 R19, S track: the S track's own scenes in the real game, on any tree (R18 or
 * R19).  Development tool; evidence, not a gate step.  Trial 3 is not owner-approved.
 *
 *   node dev/trial-3-r19-positioning/tools/r19_browser.js --dir TREE [--tries 3] [--out FILE.json] [--label S]
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
const CAMP = path.join(__dirname, '..', '..', 'trial-3-r9-overhaul', 'tools', 'r16g_campaign.js');
let src = fs.readFileSync(CAMP, 'utf8');
const cut = src.indexOf('/* ---------------------------------------------------------------- the focused scenarios */');
const A1 = 'q.st, q.ex]; });', A2 = 'ex: d[10] }';
if (cut < 0 || src.split(A1).length !== 2 || src.split(A2).length !== 2) throw new Error('r16g_campaign.js is not as this tool expects');
src = src.slice(0, cut).replace(A1, "q.st, q.ex, q.ps ? q.ps.k + ': ' + String(q.ps.why || '').slice(0, 110) : null]; });").replace(A2, 'ex: d[10], ps: d[11] }')
  + '\nmodule.exports = { B, ARG, sleep, until, alive, keys, stop, H, SS, torch, crouch, look, place, admin, clearK, stretch, track, dbgOf, RUN, LONG, CUR };\n';
const m = new Module(CAMP, module); m.filename = CAMP; m.paths = Module._nodeModulePaths(path.dirname(CAMP)); m._compile(src, CAMP);
const C = m.exports, { B, ARG, sleep, until, alive, H, SS, torch, crouch, look, place, admin, clearK, stretch, track, dbgOf, LONG } = C;
const TRIES = +(ARG.tries || 3);

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
  const R = { tool: 'dev/trial-3-r19-positioning/tools/r19_browser.js', chromium: b.version(), tree: ARG.label || path.basename(B.DIR), runs: [] };
  try {
    const room = 'r19b' + (Date.now() % 1e6), VP = { width: 1024, height: 640 };
    const A = await B.runPage(b, port, room, VP, 'K3Ra', B.VIDEO);
    await admin(A); const aid = await A.P.evaluate(() => __api.H.id); await A.P.keyboard.press('KeyW');
    const spawn = async (x, y, hunger, ang) => { const k = await qa({ op: 'spawn', kind: 'skinstealer', x, y, hunger, ang }); await until(A.P, () => (window.__k3.ss || []).length > 0, null, 5000); return k; };
    // the page keeps its eyes on it: its mouse aimed at the creature's last place it was sent
    const watch = async (t0, secs, kx, ky) => { let lx = kx, ly = ky; while (Date.now() - t0 < secs * 1000) { const h = await H(A); if (!h || h.dead) break; const ss = await SS(A); if (ss.length) { lx = ss[0].x; ly = ss[0].y; } await look(A, lx, ly); await sleep(200); } };
    const scene = async (name, fn) => { const F = { name }; try { await clearK(A); await alive(A, A, aid); await crouch(A, false); await fn(F); } catch (e) { F.error = String(e && e.message || e).slice(0, 200); } R.runs.push(F); console.log(`${name}: ${F.note || F.error || ''}`); };
    for (let tr = 1; tr <= TRIES; tr++) await scene(`B.${tr} Scene B (standing, lit, .85)`, async F => {
      await place(A, 5000, LONG); await torch(A, true); await look(A, 5450, LONG);
      const k = await spawn(5450, LONG, .85, Math.PI);
      const [rec] = await stretch(A, [A], t0 => watch(t0, 14, 5450, LONG));
      const U = sumUp(rec, k.id, aid), near = U.S.find(s => s.k && Math.hypot(s.k[1] - s.me[0], s.k[2] - s.me[1]) < 200);
      let gone = 0, run = 0; for (const s of U.S) { if (near && s.t >= near.t) break; if (!s.seen) { run += .05; gone = Math.max(gone, run); } else run = 0; }
      Object.assign(F, { nearAt: near ? near.t : null, outOfView: +gone.toFixed(2), vanished: gone >= 3, plans: U.plans, ps: U.ps, deadAt: U.deadAt, samples: U.S.length });
      F.note = `${F.vanished ? 'VANISHED' : 'stayed in view'} (longest out of the page's view before it was within 200 px: ${F.outOfView} s); within 200 px at ${F.nearAt} s; plans ${U.plans.join('>')}; positioning ${U.ps.join(' | ') || '-'}${U.deadAt !== null ? `; the page killed at ${U.deadAt} s` : ''}`;
    });
    for (let tr = 1; tr <= TRIES; tr++) await scene(`J.${tr} the junction (standing, lit, .9)`, async F => {
      await place(A, 1164, 732); await torch(A, true); await look(A, 1164, 1332);
      const k = await spawn(1164, 1332, .9, -Math.PI / 2);
      const [rec] = await stretch(A, [A], t0 => watch(t0, 8, 1164, 1332));
      const U = sumUp(rec, k.id, aid), far = U.S.filter(s => s.k && Math.hypot(s.k[1] - s.me[0], s.k[2] - s.me[1]) >= 400);
      const near = U.S.find(s => s.k && Math.hypot(s.k[1] - s.me[0], s.k[2] - s.me[1]) < 200);
      const first = U.S.find(s => s.k);
      Object.assign(F, { placed: { ok: !!(k && k.ok), id: k && k.id }, firstSeenAt: first ? [first.k[1], first.k[2]] : null, eastMax: far.length ? Math.round(Math.max(...far.map(s => s.k[1] - 1164))) : null, nearAt: near ? near.t : null, plans: U.plans, ps: U.ps, deadAt: U.deadAt, samples: U.S.length });
      if (!U.plans.some(p => p && p !== 'roam')) F.notJudged = 'it never had the page in a plan (roam only)';
      F.note = `${F.notJudged ? 'NOT JUDGED (' + F.notJudged + `; its first place on the page ${F.firstSeenAt}) ` : ''}the most east of the straight line while 400 px or more off: ${F.eastMax} px; within 200 px at ${F.nearAt} s; plans ${U.plans.join('>')}; positioning ${U.ps.join(' | ') || '-'}${U.deadAt !== null ? `; the page killed at ${U.deadAt} s` : ''}`;
    });
  } catch (e) { R.error = e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ').replace(/\/[^\s|:]*\//g, '') : String(e); }
  finally { await b.close().catch(() => { }); try { process.kill(srv.pid); } catch (e) { } }
  const Bs = R.runs.filter(F => F.name.startsWith('B') && !F.error), Js = R.runs.filter(F => F.name.startsWith('J') && !F.error);
  console.log(`SUMMARY ${R.tree}: Scene B vanished ${Bs.filter(F => F.vanished).length}/${Bs.length}; junction east of the line ${Js.map(F => F.notJudged ? 'not judged' : F.eastMax).join('/')} px${R.error ? '; ERROR ' + R.error : ''}`);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
})();
