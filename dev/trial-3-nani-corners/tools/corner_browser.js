#!/usr/bin/env node
/* dev/trial-3-nani-corners/tools/corner_browser.js - Trial 3 R19, N track: a Hound taking corners at its chase speed, in the real game,
 * as the page receives it.  Development tool; evidence, not a gate step.  Not owner-approved.
 *
 *   node dev/trial-3-nani-corners/tools/corner_browser.js --dir TREE [--routes 23,26,16,28] [--tries 2] [--out FILE.json] [--shots DIR] [--video DIR]
 *
 * TREE's own server.js (through the test-only qa_server.js, as r9_browser.js; a synthetic passcode), headless Chromium (SwiftShader).  One
 * page, the admin: for each route of corner_audit.js's seed-7 set (evidence/N0/corner_r18_summary.json: start and goal) the world is frozen,
 * every other creature removed, the page stands at the route's goal, a Hound is PLACED at its start (as dev/tests place one), the world
 * unfrozen, and the admin's own DEBUG navigation command "come" (ai.engine.js navCmd -> navGo: the real route, follower, steering,
 * locomotion and collision at the Hound's chase speed, 292 px/s, and no species decision) sends it to the page.  Every snapshot the page
 * receives (20 a second) is recorded: the Hound's place, heading and speed as the server sends them.  From those samples: the time to reach
 * the page, the slowest it went between start and arrival (time read in the order of the server's snapshots, 50 ms apart - not the page's
 * own clock, which bunches them under SwiftShader), the time it spent pivoting (under a third of its pace while its heading turned
 * faster than 1.2 rad/s - corner_audit.js's rule, on the page's samples), its fastest turn; and the page's own view (frames drawn).
 * Nothing steers the Hound but the game's own command; the page does not move. */
'use strict';
const fs = require('fs'), path = require('path');
const B = require(path.join(__dirname, '..', '..', 'trial-3-r9-overhaul', 'tools', 'r9_browser.js'));
const ARG = { routes: '23,26,16,28', tries: '2' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const { sleep, until, SHOTS, VIDEO } = B;
const ROUTES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'evidence', 'N0', 'corner_r18_summary.json'), 'utf8')).routes;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const REC = `(() => { const K = window.__k3; K.hrec = []; const t0 = performance.now(); K.frames = 0; const fr = () => { K.frames++; K.raf = requestAnimationFrame(fr); }; fr();
  K.onH = ev => { let m; try { m = JSON.parse(ev.data); } catch (x) { return; } if (m.t !== 's' || !m.e) return; const h = (m.e.h || []).find(q => q.i === K.hid); if (!h) return;
    K.hrec.push([+((performance.now() - t0) / 1000).toFixed(3), h.x, h.y, h.a, h.v, h.ac, m.tk || 0]); };
  K.game.addEventListener('message', K.onH); })()`;
(async () => {
  const S = await B.serve(), b = await B.pw.chromium.launch({ args: B.LAUNCH }), out = { tool: 'dev/trial-3-nani-corners/tools/corner_browser.js', tree: ARG.label || path.basename(B.DIR), runs: [] };
  try {
    const room = 'r19c' + (Date.now() % 1e6), VP = { width: 1024, height: 640 };
    const W = await B.runPage(b, S.port, room, VP, 'K3Corner', VIDEO);
    W.cmd({ c: 'freeze', on: true }); for (const k of ['hounds', 'smilers', 'skinstealers']) W.cmd({ c: k, mode: 'remove', n: 10 }); await sleep(500);
    for (const k of ['hounds', 'smilers']) W.cmd({ c: k, mode: 'remove', n: 10 });
    for (const id of ARG.routes.split(',').map(Number)) for (let tr = 1; tr <= +ARG.tries; tr++) {
      const R = ROUTES.find(r => r.id === id); if (!R) continue;
      W.cmd({ c: 'freeze', on: true }); W.cmd({ c: 'hounds', mode: 'remove', n: 10 }); await sleep(400);
      // (a Hound that reached the page is a Hound again once its navigation ends - the page may have been caught: revive it first)
      await B.alive(W, W, await W.P.evaluate(() => __api.H.id));
      await W.P.evaluate(q => { __api.tp(q.x, q.y); }, { x: R.bx, y: R.by }); await sleep(500);
      const placed = await S.qa({ op: 'spawn', kind: 'hound', x: R.ax, y: R.ay, ang: Math.atan2(R.by - R.ay, R.bx - R.ax) });
      if (!placed || !placed.ok) { out.runs.push({ route: id, tr, skipped: 'not placed' }); continue; }
      await W.P.evaluate(hid => { window.__k3.hid = hid; }, placed.id); await W.P.evaluate(REC);
      W.cmd({ c: 'freeze', on: false }); await sleep(150);
      W.cmd({ c: 'nav', eid: placed.id, cmd: 'come' });
      const t0 = Date.now(); let shot = 0;
      while (Date.now() - t0 < 16000) {
        await sleep(200);
        const last = await W.P.evaluate(() => { const r = window.__k3.hrec; return r.length ? r[r.length - 1] : null; }).catch(() => null);
        if (last && Math.hypot(last[1] - R.bx, last[2] - R.by) < 50 && last[4] < 5) { W.cmd({ c: 'freeze', on: true }); break; }
        if (SHOTS && last && shot < 3 && Date.now() - t0 > 1500 + shot * 1500) { shot++; await W.P.screenshot({ path: path.join(SHOTS, `corner_${out.tree}_r${id}_try${tr}_${shot}.png`) }).catch(() => { }); }
      }
      const rec = await W.P.evaluate(() => { const K = window.__k3; K.game.removeEventListener('message', K.onH); cancelAnimationFrame(K.raf); const r = K.hrec.slice(); K.hrec = []; return { r, frames: K.frames }; });
      // the measures, on the samples the page received (each sample: [t page, x, y, heading, speed as sent, act])
      const s = rec.r, M = { route: id, tr, samples: s.length, arrivedS: null, slowest: 1e9, pivotS: 0, maxTurn: 0, minMidV: 1e9, fps: +(rec.frames / Math.max(1, (Date.now() - t0) / 1000)).toFixed(1) };
      for (let i = 1; i < s.length && M.arrivedS === null; i++) {                     // (measured up to its arrival: after it, the Hound is a Hound again)
        const dt = .05, turn = Math.abs(angDiff(s[i][3], s[i - 1][3])) / dt, toEnd = Math.hypot(s[i][1] - R.bx, s[i][2] - R.by), fromStart = Math.hypot(s[i][1] - R.ax, s[i][2] - R.ay);
        if (fromStart > 120 && toEnd > 120) { M.minMidV = Math.min(M.minMidV, s[i][4]); if (s[i][4] < 292 / 3 && turn > 1.2) M.pivotS += dt; M.maxTurn = Math.max(M.maxTurn, turn); }
        if (M.arrivedS === null && toEnd < 60) M.arrivedS = +(i * .05).toFixed(2);
      }
      M.minMidV = M.minMidV === 1e9 ? null : M.minMidV; M.pivotS = +M.pivotS.toFixed(2); M.maxTurn = +M.maxTurn.toFixed(2); delete M.slowest;
      M.trace = s.map((q, i) => [+(i * .05).toFixed(2), Math.round(q[1]), Math.round(q[2]), q[3], q[4]]);
      out.runs.push(M); console.log(`${out.tree} route ${id} try ${tr}: ${M.samples} samples, reached the page ${M.arrivedS} s, slowest mid-route ${M.minMidV} px/s, pivoting ${M.pivotS} s, fastest turn ${M.maxTurn} rad/s, ${M.fps} frames a second`);
    }
    out.errors = W.errs; await W.ctx.close();
    if (VIDEO) { const v = W.P.video && W.P.video(); if (v) out.videoFile = path.basename(await v.path()); }
  } finally { await b.close().catch(() => { }); try { process.kill(S.p.pid); } catch (e) { } }
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(out) + '\n');
})().catch(e => { console.error(e); process.exit(1); });
