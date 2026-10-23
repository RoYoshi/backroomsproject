#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/r16g_campaign.js - Trial 3 R16g: the owner's extended browser campaign (October 22, the additional
 * refinement, section 7).  Development tool; checkpoint evidence, not a gate step.  Trial 3 is not owner-approved.
 *
 *   node dev/trial-3-r9-overhaul/tools/r16g_campaign.js --part focused|continuous|threat|judge [--dir DIR] [--mins 12] [--only S3] [--run 270] [--out FILE.json]
 *        [--shots DIR] [--video DIR]
 *
 * Real pages (headless Chromium, SwiftShader) on one real server (DIR's server.js through the test-only qa_server.js, as r9_browser.js):
 * every person is a page moved by its own keys (W A S D, Shift to run, C to crouch, F for the torch) and its own mouse; a creature is
 * PLACED by qa_server.js where a scene says (its hunger set, as dev/tests set one) and never steered.  What is judged is what the pages
 * received and drew: the creature's pose as the page has it (the snapshot's ss list: place, facing, head, act, speed) and the page's
 * own view of it; WHY it did something comes from the admin debug the server sends the admin page (read only to report and to tie an
 * action to its reason - never to move anybody).
 *   focused     the section's focused scenarios, each passed only on what the pages observed:
 *               F1 a sound behind it (its head, then its body, turn on the page), F2 movement at the edge of its view (a side corridor),
 *               F3 seen while roaming (its route given up), F4 hunger (the same sighting, fed and starving), F5 circled (its facing,
 *               its sidesteps, its speed), F6 a feint (the reversal answered late, then answered), F7 two people (a sound from one while
 *               it deals with the other).
 *   continuous  10-15 minutes of two people moving through the level as players do - exploring, hiding in the dark, fleeing,
 *               circling, feinting, peeking - against one Skin-Stealer, then two (the second at mid-way, hungrier); every second what
 *               it perceived, what plan it cut or kept and why, what it visibly did; and the hard failures checked throughout (it walks on
 *               after newly seeing somebody it may hunt; its head never turns; it sees through a wall; faster than its run; stuck;
 *               plans flipping back and forth; page errors).
 *   threat      (R18, the owner's overtuned experiment, section 11) thirteen adversarial scenes, S1-S13 (see threat() below), each recording
 *               its speeds, acts, plans and stamina, judged on threat and fairness alike; run on R18 and on R16i (--dir) to compare.
 * Every name and passcode is synthetic; no address, path or secret is written to the output. */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./r9_browser.js');
const ARG = { part: 'focused', mins: '12' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const { sleep, until, alive } = B, SHOTS = B.SHOTS, VIDEO = B.VIDEO;
// (R18) its run is the tree's own (R8-R16i 255, R18's overtuned 270): --run N to judge a record of another tree
const RUN = ARG.run ? +ARG.run : (() => { try { return require(path.join(B.DIR, 'dev', 'tests', 'lib.js')).AI.SKIN.speeds.run; } catch (e) { return 255; } })();
const LONG = 3504, angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
/* (R18) its fastest pace in a track (samples [t, x, y, ang, head, act, speed, ...]): its strike (acts 12-14) and its kill (15) excepted, and
 * the engine's crossings of a low obstacle or a window by check d's own rule (R17: a run of samples over its run, all within 70 px of one such
 * prop, ending on its other side - every species is carried over in a fixed time, up to about 450 px/s); the crossings are returned, listed */
function paceOf(tr) {
  const CROSS = require(path.join(B.DIR, 'dev', 'tests', 'lib.js')).WORLD.PROPS.filter(p => p.type === 'low' || p.type === 'window'), mv = s => !(s[5] >= 12 && s[5] <= 15);
  const out = []; let cur = null; tr.forEach((s, i) => { if (s[6] > RUN + 1 && mv(s)) { if (!cur) cur = { a: i, b: i }; else cur.b = i; } else if (cur) { out.push(cur); cur = null; } }); if (cur) out.push(cur);
  const skip = new Set(), crossings = [];
  for (const g of out) { const a = tr[Math.max(0, g.a - 1)], b = tr[Math.min(tr.length - 1, g.b + 1)];
    const P = CROSS.find(P => { const r = P.rect, near = s => s[1] > r.x - 70 && s[1] < r.x + r.w + 70 && s[2] > r.y - 70 && s[2] < r.y + r.h + 70;
      const side = s => r.w < r.h ? Math.sign(s[1] - (r.x + r.w / 2)) : Math.sign(s[2] - (r.y + r.h / 2));
      return tr.slice(g.a, g.b + 1).every(near) && side(a) !== 0 && side(a) === -side(b); });
    if (P) { for (let i = g.a; i <= g.b; i++) skip.add(i); crossings.push({ t: tr[g.a][0], n: g.b - g.a + 1, vmax: Math.max(...tr.slice(g.a, g.b + 1).map(s => s[6])), prop: P.id + ' (' + P.type + ')' }); } }
  return { vmax: Math.max(0, ...tr.filter((s, i) => mv(s) && !skip.has(i)).map(s => s[6])), crossings };
}
/* in the page: at every snapshot it receives (20 a second), what it has - its own wanderer, every creature as the snapshot has it, the
 * admin debug last received (the admin page only; 6-7 a second), how much of each creature's body the page's own rays reach */
const REC = `(() => { const K = window.__k3; K.rec = []; const t0 = performance.now(); K.frames = 0; const fr = () => { K.frames++; K.raf = requestAnimationFrame(fr); }; fr();
  K.dbgRec = null;
  // (the admin's debug rides in the same snapshot message as the server tick it describes, every third: it is read from that message, so
  // the debug and the creatures' places are of one tick - s[5] says whether this sample's debug is its own tick's)
  const pd = list => (list || []).filter(d => d.sk).map(d => { const q = d.sk; return [d.i, q.pl, (q.why || '').slice(0, 80), q.pe ? [q.pe.ago, q.pe.from, q.pe.kept, q.pe.why.slice(0, 70)] : null, q.lk ? [q.lk.k, q.lk.body] : null, q.ft ? [q.ft.pid, q.ft.side, q.ft.back] : null, q.sw || [], q.hu, q.pid || 0, q.st, q.ex]; });   // (R18: its stamina and exhaustion too)
  K.onMsg = ev => { let m; try { m = JSON.parse(ev.data); } catch (x) { return; } if (m.t !== 's' || !m.e) return; const H = __api.H; if (!H) return;
    if (m.dbg) K.dbgRec = pd(m.dbg);
    const list = m.e.ss || [], ss = list.map(k => [k.i, Math.round(k.x), Math.round(k.y), +(+k.a).toFixed(3), +(+(k.h || 0)).toFixed(2), k.ac, k.v, k.s]);
    const vis = list.map(k => K.view(k.x, k.y).mask);                                    // (how many of the page's three rays reach its body: 0 - a wall between)
    K.rec.push([+((performance.now() - t0) / 1000).toFixed(2), [Math.round(H.x), Math.round(H.y), +(+H.angle).toFixed(2), H.mv ? H.mv.s : '', __api.lightOn() ? 1 : 0, (__api.death() && __api.death().active) || H.dead ? 1 : 0, H.id], ss, K.dbgRec || [], vis, m.dbg ? 1 : 0, (m.p || []).map(q => [q.id, Math.round(q.x), Math.round(q.y)])]);   // (s[6]: the other people where the server has them)
    // (a person running round it, steered here at every snapshot - the page's own keys and mouse - rather than from outside the page)
    const C = K.circ, c = C && list.find(q => q.i === C.id);
    if (c) { const a = Math.atan2(H.y - c.y, H.x - c.x), tx = c.x + Math.cos(a + C.dir * .5) * C.R, ty = c.y + Math.sin(a + C.dir * .5) * C.R, dx = tx - H.x, dy = ty - H.y, L = Math.hypot(dx, dy) || 1, held = K.held || (K.held = new Set());
      const want = new Set(['ShiftLeft']); if (dx / L > .38) want.add('KeyD'); if (dx / L < -.38) want.add('KeyA'); if (dy / L > .38) want.add('KeyS'); if (dy / L < -.38) want.add('KeyW');
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) { const on = want.has(k); if (on && !held.has(k)) { K.key(k, true); held.add(k); } else if (!on && held.has(k)) { K.key(k, false); held.delete(k); } }
      const sc = K.screen(c.x, c.y); if (sc) window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: sc.x, clientY: sc.y, bubbles: true })); } };
  K.game.addEventListener('message', K.onMsg); })()`;
const STOPREC = `(() => { const K = window.__k3; K.game.removeEventListener('message', K.onMsg); cancelAnimationFrame(K.raf); const r = K.rec.slice(); K.rec = []; return r; })()`;
/* a page's own keys: hold the ones for a direction (and Shift, to run), release the others */
async function keys(pg, dx, dy, run) {
  const want = new Set(); const L = Math.hypot(dx, dy);
  if (L > .01) { const ux = dx / L, uy = dy / L; if (ux > .38) want.add('KeyD'); if (ux < -.38) want.add('KeyA'); if (uy > .38) want.add('KeyS'); if (uy < -.38) want.add('KeyW'); if (run) want.add('ShiftLeft'); }
  await pg.P.evaluate(w => { const K = window.__k3, held = K.held || (K.held = new Set()); for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) { const on = w.includes(c); if (on && !held.has(c)) { K.key(c, true); held.add(c); } else if (!on && held.has(c)) { K.key(c, false); held.delete(c); } } }, [...want]).catch(() => { });
}
const stop = pg => keys(pg, 0, 0, false);
const H = pg => pg.P.evaluate(() => { const h = __api.H; return h ? { x: h.x, y: h.y, a: h.angle, st: h.mv ? h.mv.s : '', light: __api.lightOn(), dead: !!((__api.death() && __api.death().active) || h.dead), id: h.id } : null; }).catch(() => null);
const SS = pg => pg.P.evaluate(() => (window.__k3.ss || []).map(k => ({ i: k.i, x: k.x, y: k.y, a: +k.a, h: +(k.h || 0), ac: k.ac, v: k.v }))).catch(() => []);
async function torch(pg, on) { if ((await pg.P.evaluate(() => __api.lightOn()).catch(() => on)) !== on) await pg.P.keyboard.press('KeyF'); }
// (R18: the key is held until the page's own movement state has changed, at most 3 s - a tap of 60 ms can fall between two frames of a page
// drawing one or two a second, and the page stayed crouched: the threat scenes' run of October 23 from S7 on)
async function crouch(pg, on) { const st = () => pg.P.evaluate(() => __api.H.mv ? __api.H.mv.s : '').catch(() => ''), is = s => s === 'crouch' || s === 'crawl';
  if (is(await st()) === on) return;
  await pg.P.evaluate(() => window.__k3.key('KeyC', true)); await sleep(60);
  const t0 = Date.now(); while (Date.now() - t0 < 3000 && is(await st()) !== on) await sleep(50);
  await pg.P.evaluate(() => window.__k3.key('KeyC', false)); }
async function look(pg, x, y) { await B.aimAt(pg.P, x, y); }
const place = async (pg, x, y) => { await stop(pg); await pg.P.evaluate(q => __api.tp(q.x, q.y), { x, y }); await sleep(250); };
async function shot(pg, name, R) { if (!SHOTS) return; const f = `${name}.png`; await pg.P.screenshot({ path: path.join(SHOTS, f) }).catch(() => { }); (R.shots || (R.shots = [])).push(f); }
/* the scene's admin: the world held while it is set, the Hounds and Smilers taken off, the debug data on (the overlay itself off) */
async function admin(A) {
  A.cmd({ c: 'freeze', on: true }); A.cmd({ c: 'hounds', mode: 'remove', n: 10 }); A.cmd({ c: 'smilers', mode: 'remove', n: 10 }); await sleep(400);
  A.cmd({ c: 'hounds', mode: 'remove', n: 10 }); A.cmd({ c: 'smilers', mode: 'remove', n: 10 }); A.cmd({ c: 'debug', on: true });
  await A.P.evaluate(() => { Object.assign(window.__ents.dbgCfg, { on: false, ai: true }); });
}
const clearK = async A => { A.cmd({ c: 'skinstealers', mode: 'remove', n: 4 }); A.cmd({ c: 'hounds', mode: 'remove', n: 10 }); A.cmd({ c: 'smilers', mode: 'remove', n: 10 }); await sleep(700); };
/* a recorded stretch: the pages' samples while fn runs (the world unfrozen) */
const RAWS = [], CUR = { scene: '', fps: null };   // (R18) the threat part's records, scene by scene, for --raw; the page's frame rate in the last stretch
async function stretch(A, pages, fn) {
  for (const pg of pages) await pg.P.evaluate(REC);
  A.cmd({ c: 'freeze', on: false });
  const t0 = Date.now(); await fn(t0);
  A.cmd({ c: 'freeze', on: true });
  CUR.fps = +((await pages[0].P.evaluate(() => window.__k3.frames).catch(() => 0)) / Math.max(.1, (Date.now() - t0) / 1000)).toFixed(1);
  const recs = []; for (const pg of pages) recs.push(await pg.P.evaluate(STOPREC).catch(() => [])); for (const pg of pages) await stop(pg);
  if (ARG.part === 'threat' && ARG.raw) RAWS.push({ scene: CUR.scene, recs });
  return recs;
}
/* what the page had of creature id: [t, x, y, a, h, ac, v] */
const track = (rec, id) => rec.map(s => { const k = s[1] && s[2].find(q => q[0] === id); return k ? [s[0], k[1], k[2], k[3], k[4], k[5], k[6], s[1], s] : null; }).filter(Boolean);
/* its debug, where anything changed: [t, plan, its eyes' stimulus, its last interruption (why)] */
const dTrace = D => { const out = []; let l = ''; for (const d of D) { const k = `${d.pl}|${d.lk ? d.lk[0] : ''}|${d.pe ? d.pe[3] : ''}`; if (k !== l) out.push([d.t, d.pl, d.lk ? d.lk[0] + (d.lk[1] ? '+body' : '') : '', d.pe ? (d.pe[2] ? 'kept: ' : '') + d.pe[3] : '', d.sn.join(',')]); l = k; } return out.slice(0, 40); };
const dbgOf = (rec, id) => rec.map(s => { const d = s[3].find(q => q[0] === id); return d ? { t: s[0], pl: d[1], why: d[2], pe: d[3], lk: d[4], ft: d[5], sn: d[6], hu: d[7], pid: d[8], st: d[9], ex: d[10] } : null; }).filter(Boolean);
/* ---------------------------------------------------------------- the focused scenarios */
async function focused(b, port, R, qa) {
  const room = 'r16gf' + (Date.now() % 1e6), VP = { width: 1024, height: 640 };
  const b2 = await B.pw.chromium.launch({ args: B.LAUNCH }); R.closers = [() => b2.close()];
  const A = await B.runPage(b, port, room, VP, 'K3Fa', VIDEO), Bp = await B.runPage(b2, port, room, VP, 'K3Fb');
  await admin(A); const aid = await A.P.evaluate(() => __api.H.id), bid = await Bp.P.evaluate(() => __api.H.id); R.ids = { A: aid, B: bid };
  for (const pg of [A, Bp]) await pg.P.keyboard.press('KeyW');
  const park = async pg => { await place(pg, 8400, 900); await torch(pg, false); await crouch(pg, true); };   // (out of the way: the far north-east, dark, crouched)
  R.F = [];
  // (a scene whose premise did not hold - the creature already had the person in sight before the stimulus - is set again, up to three times)
  const scene = async (name, fn) => { if (ARG.only && !name.startsWith(ARG.only)) return; let F;
    for (let tr = 1; tr <= 3; tr++) { F = { name, try: tr }; try { await clearK(A); await alive(A, A, aid); if (!Bp.closed) await alive(Bp, A, bid); await fn(F); } catch (e) { F.error = String(e && e.message || e).slice(0, 200); } if (!F.void) break; }
    R.F.push(F); console.log(`${F.ok ? 'PASS' : 'FAIL'} ${name}: ${F.void ? '(premise not met in 3 tries: ' + F.void + ') ' : ''}${F.note || F.error || ''}${F.try > 1 ? ' (try ' + F.try + ')' : ''}`); };
  // F1 a sound behind it: the page, dark, runs a moment 350 px behind a roaming creature, then stands
  await scene('F1 a sound behind it: its head turns first, then its body, on the page', async F => {
    await park(Bp); await place(A, 5650, LONG); await torch(A, false); await crouch(A, false);
    // (R18: placed 300 px from the page, and the page runs at once - R16g-R16i placed it 350 px off and ran after 1 s: at R18's walk, 160 px/s
    // (R16i 105), and with a page at 1-2 frames a second starting its run 1-2 s late, the creature was 850 px off by then, beyond its ears)
    const k = await qa({ op: 'spawn', kind: 'skinstealer', x: 5950, y: LONG, hunger: .55, ang: 0, goal: { x: 8400, y: LONG } }); await until(A.P, () => (window.__k3.ss || []).length > 0, null, 5000);   // (roaming away east, its back to the page)
    const [rec] = await stretch(A, [A], async () => { await sleep(200); await keys(A, 0, -1, true); await sleep(700); await stop(A); await sleep(3600); });
    const tr = track(rec, k.id), runAt = (rec.find(s => s[0] > .9 && s[1][3] === 'run') || [null])[0];
    const err = s => Math.abs(angDiff(s[3] + s[4], Math.atan2(s[7][1] - s[2], s[7][0] - s[1]))), body = s => Math.abs(angDiff(s[3], Math.atan2(s[7][1] - s[2], s[7][0] - s[1])));
    const before = tr.filter(s => runAt !== null && s[0] < runAt), e0 = before.length ? err(before[before.length - 1]) : null, b0 = before.length ? body(before[before.length - 1]) : null;
    const headT = tr.find(s => runAt !== null && s[0] >= runAt && Math.abs(s[4]) > .3), bodyT = tr.find(s => runAt !== null && s[0] >= runAt && b0 !== null && body(s) < b0 - .4);
    const D = dbgOf(rec, k.id), snd = D.find(d => d.lk && d.lk[0] === 'sound'); F.trace = dTrace(D);
    F.poses = tr.filter(s => s[0] > 1.2 && s[0] < 3.2).map(s => [s[0], s[3], s[4], s[5], s[6]]);
    // (the page's own frames come seldom under SwiftShader and its messages in bursts: the snapshots' ORDER is the server's, 50 ms apart)
    const i0 = runAt === null ? -1 : tr.findIndex(s => s[0] >= runAt), ih = i0 < 0 ? -1 : tr.findIndex((s, i) => i >= i0 && Math.abs(s[4]) > .1);
    const ion = ih < 0 ? -1 : tr.findIndex((s, i) => i >= ih && Math.abs(s[4]) >= 1.15), ib = ih < 1 ? -1 : tr.findIndex((s, i) => i >= ih && Math.abs(angDiff(s[3], tr[ih - 1][3])) > .05);
    F.snaps = { headOnMs: ion < 0 ? null : (ion - ih) * 50, bodyAfterHeadMs: ib < 0 ? null : (ib - ih) * 50 };
    Object.assign(F, { runAt, err0: e0 && +e0.toFixed(2), headAfter: headT && runAt !== null ? +(headT[0] - runAt).toFixed(2) : null, bodyAfter: bodyT && runAt !== null ? +(bodyT[0] - runAt).toFixed(2) : null, sound: !!snd, plans: [...new Set(D.map(d => d.pl))] });
    if (runAt !== null && D.some(d => d.t < runAt && d.sn.includes(aid))) F.void = 'it saw the page before it ran';
    F.ok = !F.void && runAt !== null && F.headAfter !== null && F.headAfter <= 1.5 && F.sound && (F.bodyAfter === null || F.bodyAfter >= F.headAfter);   // (the page's clock: its frames come in bursts; the snapshots' order is judged below)
    F.ok = F.ok && F.snaps.bodyAfterHeadMs !== null && F.snaps.bodyAfterHeadMs > 0 && F.snaps.headOnMs !== null && F.snaps.headOnMs <= 250;
    F.note = `the page ran at ${runAt} s; in the snapshots it received (50 ms apart): its head on the sound ${F.snaps.headOnMs} ms after the head began, its body began ${F.snaps.bodyAfterHeadMs} ms after the head; on the page's own clock (its frames come seldom) the head ${F.headAfter} s after the run; its eyes: a sound ${F.sound}; plans ${F.plans.join('>')}`;
    await shot(A, 'F1_after', F);
  });
  // F2 movement at the edge of its view: a roaming creature walks east down the hall past the room north of it; the page waits there,
  // crouched in the dark 420 px north of the hall (seen from 285 px so - repro V), and once the creature is past it - the page off its
  // left side, outside its field of view - stands and walks to and fro, unlit (footsteps carry 240 px: not to it).  Nothing is moved by
  // hand: a teleport is itself a jump the creature could notice
  let F2trig = 5330;                                                           // (R18: where the creature is when the page stands - see below)
  await scene('F2 movement at the edge of its view: noticed, its head (and, beyond what the head reaches, its body) turns to it, then it sees them', async F => {
    await park(Bp); await place(A, 5420, 3084); await torch(A, false); await crouch(A, true);
    const k = await qa({ op: 'spawn', kind: 'skinstealer', x: 5250, y: LONG, hunger: .3, ang: 0, goal: { x: 8400, y: LONG } }); await until(A.P, () => (window.__k3.ss || []).length > 0, null, 5000);   // (roaming east down the hall, past the room)
    let walkAt = null;
    const [rec] = await stretch(A, [A], async t0 => {
      // (R18: the page stands once the creature is 1.36 rad past it - x 5330, its view's edge 1.25 - R16g-R16i waited for x 5520 (1.8 rad).  A page
      // at 1-3 frames a second begins to walk a second or two after it decides to, and at R18's roam (160 px/s; R8-R16i 105) the creature was
      // 2.39 rad past it by then, beyond the edge of its eye (1.25 + 0.9): R16i's run 2.03)
      while (Date.now() - t0 < 8000) { const c = (await SS(A)).find(q => q.i === k.id); if (c && c.x >= F2trig) break; await sleep(60); }
      await crouch(A, false); let dir = 1; while (Date.now() - t0 < 11000) { await keys(A, dir, 0, false); await sleep(1100); dir = -dir; } await stop(A); await sleep(800); });
    { const w = rec.find(s => s[1][3] === 'walk'); walkAt = w ? w[0] : null; }               // (when the page began to walk: its own samples)
    const tr = track(rec, k.id), D = dbgOf(rec, k.id); F.trace = dTrace(D); const mot = D.find(d => d.lk && (d.lk[0] === 'motion' || d.lk[0] === 'sight' || d.lk[0] === 'sound')), saw = D.find(d => d.sn.includes(aid));
    const err = s => Math.abs(angDiff(s[3] + s[4], Math.atan2(s[7][1] - s[2], s[7][0] - s[1])));
    const firstM = D.find(d => d.lk && d.lk[0] === 'motion'), turned = tr.find(s => walkAt !== null && s[0] > walkAt && err(s) < 1.2);   // (within its field of view about where its drawn head points)
    F.path = tr.filter((s, i) => i % 5 === 0).map(s => [s[0], Math.round(s[1]), Math.round(s[2]), +(s[3]).toFixed(2), +(s[4]).toFixed(2), s[5], Math.round(s[7][0]), Math.round(s[7][1]), s[7][3], s[7][4]]);
    Object.assign(F, { noticed: mot ? mot.t : null, by: mot ? mot.lk[0] : '', motionAt: firstM ? firstM.t : null, saw: saw ? saw.t : null, turned: turned ? turned[0] : null });
    if (walkAt !== null && D.some(d => d.t < walkAt && d.sn.includes(aid))) F.void = 'it saw the page before it walked';
    if (walkAt === null) F.void = F.void || 'the page did not walk';
    const off = tr.find(s => walkAt !== null && s[0] >= walkAt); F.offAtEntry = off ? +err(off).toFixed(2) : null;
    // (R18: a premise, set again - and the next try's start moved by what this one showed: the page's own lag)
    if (F.offAtEntry !== null && F.offAtEntry > 2.15) { F.void = F.void || `the page began to walk ${F.offAtEntry} rad off its head, beyond the edge of its eye (2.15)`; F2trig -= 150; }
    else if (F.offAtEntry !== null && F.offAtEntry <= 1.25) { F.void = F.void || `the page began to walk ${F.offAtEntry} rad off its head, inside its view`; F2trig += 100; }
    F.nextTrig = F2trig;
    // (the movement's snap and the sight it brings can be a tenth of a second apart, under the debug's own pace of 6-7 a second: the first
    // stimulus must be the movement, logged no later than the sight, within that pace; and the page must have begun outside its view)
    F.ok = !F.void && !!firstM && !!saw && !!turned && F.by === 'motion' && firstM.t <= saw.t + .2 && F.offAtEntry > 1.25;
    F.note = `the page, crouched in the dark in the room off the hall, stood and walked at ${walkAt} s, ${F.offAtEntry} rad off where the creature's drawn head pointed (its view: 1.25 either side): its eyes took movement at ${F.motionAt} s, it saw the page at ${F.saw} s, the page inside the view its drawn head gives by ${F.turned} s (the first stimulus: ${F.by} at ${F.noticed} s)`;
    await shot(A, 'F2_turned', F);
  });
  // F3 seen while roaming: a hungry roaming creature; the page appears lit 500 px ahead of it
  await scene('F3 seen while roaming: it gives up its route on that think', async F => {
    await park(Bp); await place(A, 5200, LONG); await torch(A, false); await crouch(A, true);   // (ahead of it, unseen: crouched in the dark 800 px off)
    const k = await qa({ op: 'spawn', kind: 'skinstealer', x: 4400, y: LONG, hunger: .65, ang: 0, goal: { x: 8400, y: LONG } }); await until(A.P, () => (window.__k3.ss || []).length > 0, null, 5000); await look(A, 4400, LONG);
    const [rec] = await stretch(A, [A], async () => { await sleep(1500); await crouch(A, false); await torch(A, true); await sleep(3500); });   // (it stands up, torch on: in plain view)
    const D = dbgOf(rec, k.id); F.trace = dTrace(D); const saw = D.find(d => d.sn.includes(aid)), after = saw ? D.filter(d => d.t >= saw.t && d.t <= saw.t + .5) : [];
    const gave = after.find(d => d.pl !== 'roam' || (d.pe && /gives way/.test(d.pe[3])));
    Object.assign(F, { saw: saw ? saw.t : null, answer: gave ? `${gave.pl}${gave.pe ? ' - ' + gave.pe[3] : ''} at ${gave.t} s` : 'NONE', plans: [...new Set(D.filter(d => saw && d.t >= saw.t).map(d => d.pl))] });
    F.ok = !!saw && !!gave;
    F.note = `seen at ${F.saw} s; within 0.5 s: ${F.answer}; then ${F.plans.join('>')}`;
  });
  // F4 hunger: the same sighting, fed (.25) and starving (.95)
  await scene('F4 hunger: the same sighting answered differently, fed and starving', async F => {
    await park(Bp); F.runs = [];
    for (const hu of [.25, .95]) {
      await clearK(A); await alive(A, A, aid); await place(A, 5000, LONG); await torch(A, true);
      const k = await qa({ op: 'spawn', kind: 'skinstealer', x: 5520, y: LONG, hunger: hu, ang: Math.PI }); await until(A.P, () => (window.__k3.ss || []).length > 0, null, 5000); await look(A, 5520, LONG);
      const [rec] = await stretch(A, [A], async () => { await sleep(8000); });   // (8 s: a flank - round by the room off the hall - takes longer to bring it closer than an approach)
      const tr = track(rec, k.id), D = dbgOf(rec, k.id), d0 = tr.length ? Math.hypot(tr[0][1] - tr[0][7][0], tr[0][2] - tr[0][7][1]) : 0, dm = Math.min(...tr.map(s => Math.hypot(s[1] - s[7][0], s[2] - s[7][1])));
      F.runs.push({ hu, plans: [...new Set(D.map(d => d.pl))], d0: Math.round(d0), dmin: Math.round(dm), dead: rec.some(s => s[1][5]), path: tr.filter((s, i) => i % 6 === 0).map(s => [s[0], Math.round(s[1]), Math.round(s[2]), +(s[3]).toFixed(2), s[5]]) });
    }
    const [fed, starving] = F.runs;
    F.ok = fed.plans.some(p => /leave|watch|retreat/.test(p)) && !fed.plans.some(p => /chase|approach/.test(p)) && starving.plans.some(p => /approach|chase|flank/.test(p)) && starving.dmin < fed.dmin;
    F.note = F.runs.map(r => `hunger ${r.hu}: ${r.plans.join('>')}, closest ${r.dmin} px (from ${r.d0})${r.dead ? ', the page died' : ''}`).join(' | ');
  });
  // F7 two people: A lit in the hall 450 px from it; B, dark and crouched behind it, runs a moment
  await scene('F7 two people: a sound from one while it deals with the other', async F => {
    // (a mildly hungry one in a standoff with A, lit in front of it; B crouched in the dark behind it stands and runs across, a moment)
    await place(A, 5000, LONG); await torch(A, true); await place(Bp, 5970, LONG); await torch(Bp, false); await crouch(Bp, true);
    const k = await qa({ op: 'spawn', kind: 'skinstealer', x: 5450, y: LONG, hunger: .45, ang: Math.PI }); await until(A.P, () => (window.__k3.ss || []).length > 0, null, 5000); await look(A, 5450, LONG);
    let tB = null;
    let tBa = null;
    const [rec, recB] = await stretch(A, [A, Bp], async () => { await sleep(1800); await crouch(Bp, false); tB = await Bp.P.evaluate(() => window.__k3.rec.length ? window.__k3.rec[window.__k3.rec.length - 1][0] : 0); tBa = await A.P.evaluate(() => window.__k3.rec.length ? window.__k3.rec[window.__k3.rec.length - 1][0] : 0); await keys(Bp, 0, 1, true); await sleep(700); await stop(Bp); await sleep(2500); });
    const D = dbgOf(rec, k.id), cue = D.find(d => d.t >= (tBa || 1.7) - .2 && d.lk && (d.lk[0] === 'sound' || d.lk[0] === 'motion' || (d.lk[0] === 'sight' && d.sn.includes(bid)))),   /* (a sound's snap is soon replaced by the sight of B it brings: the debug comes 6-7 times a second) */ tr = track(recB, k.id); F.trace = dTrace(D);
    const turned = tr.find(s => s[0] > (tB || 1.8) && Math.abs(angDiff(s[3] + s[4], Math.atan2(s[7][1] - s[2], s[7][0] - s[1]))) < 1.2);
    Object.assign(F, { cue: cue ? cue.lk[0] + ' at ' + cue.t + ' s' : null, headToB: turned ? turned[0] : null, bRan: tB, plans: [...new Set(D.map(d => d.pl + (d.pid ? ':P' + d.pid : '')))] });
    if (tBa !== null && D.some(d => d.t < tBa && d.sn.includes(bid))) F.void = 'it saw B before B ran';
    F.ok = !F.void && !!cue && !!turned;
    F.note = `B ran at ${tB} s (B's clock): its eyes took ${F.cue}; B's own page drew its head toward B at ${F.headToB} s; its plans ${F.plans.join('>')}`;
    await shot(Bp, 'F7_B_view', F);
  });
  if (!ARG.only || ARG.only === 'F5' || ARG.only === 'F6') { await Bp.ctx.close(); await b2.close(); R.closers = []; Bp.closed = 1; }                          // (the second browser closed: the circling page has the machine)
  // F5 circled: the page runs round a hungry creature at about 230 px (its own steering from what it sees of it)
  const circle = async (F, flip, name, R0 = 260, flipAt = 3500) => {
    await place(A, 5240, LONG); await torch(A, true);
    const k = await qa({ op: 'spawn', kind: 'skinstealer', x: 5000, y: LONG, hunger: .9, ang: 0 }); await until(A.P, () => (window.__k3.ss || []).length > 0, null, 5000);
    let flipT = null;
    const [rec] = await stretch(A, [A], async t0 => {
      await A.P.evaluate(q => { window.__k3.circ = { id: q.id, dir: 1, R: q.R }; }, { id: k.id, R: R0 });
      while (Date.now() - t0 < 10000) {
        if (flip && flipT === null && Date.now() - t0 > flipAt) { flipT = await A.P.evaluate(() => { window.__k3.circ.dir = -1; return +((window.__k3.rec.length ? window.__k3.rec[window.__k3.rec.length - 1][0] : 0)).toFixed(2); }); }
        if ((await H(A) || {}).dead) break; await sleep(200);
      }
      await A.P.evaluate(() => { window.__k3.circ = null; }); });
    const flipIdx = flipT === null ? -1 : rec.findIndex(s => s[0] >= flipT);
    const tr = track(rec, k.id), D = dbgOf(rec, k.id); F.trace = dTrace(D);
    let side = 0, n = 0, errs = 0, vmax = 0, nF = 0, errF = 0, sideF = 0, backF = 0;
    for (let i = 1; i < tr.length; i++) {
      const [t, x, y, a, , ac, v, H0] = tr[i], p = tr[i - 1], dt = .05;                     // (consecutive snapshots: 50 ms apart on the server, however the page received them)
      const mvx = (x - p[1]) / dt, mvy = (y - p[2]) / dt, f = mvx * Math.cos(a) + mvy * Math.sin(a), l = -mvx * Math.sin(a) + mvy * Math.cos(a);
      if (ac !== 13 && ac !== 12 && ac !== 14) vmax = Math.max(vmax, v);                      // (KACT: wind 12, pounce 13, recover 14 - the strike's own speed)
      const fighting = !!(tr[i][8][3].find(q => q[0] === k.id) || [])[5];                       // (its footwork on, by the debug the admin page last received)
      if (fighting) { nF++; errF += Math.abs(angDiff(a, Math.atan2(H0[1] - y, H0[0] - x))); if (Math.abs(l) > 40 && Math.abs(l) > Math.abs(f)) sideF += dt; if (f < -30) backF += dt; }
      if (Math.hypot(H0[0] - x, H0[1] - y) < 450 && v > 20 && ac !== 12 && ac !== 13 && ac !== 14) { n++; /* (close to the page and moving: what the page saw it do) */ errs += Math.abs(angDiff(a, Math.atan2(H0[1] - y, H0[0] - x))); if (Math.abs(l) > 40 && Math.abs(l) > Math.abs(f)) side += dt; }
      const ti = rec.indexOf(tr[i][8]); if (flipIdx >= 0 && ti >= flipIdx - 20 && ti < flipIdx + 40) { const pp = p[7], om = ((H0[0] - x) * (H0[1] - pp[1]) - (H0[1] - y) * (H0[0] - pp[0])) / dt / Math.max(1, Math.hypot(H0[0] - x, H0[1] - y)); (F.lat || (F.lat = [])).push([(ti - flipIdx) * 50, Math.round(l), Math.round(f), Math.round(om), Math.round(Math.hypot(H0[0] - x, H0[1] - y)), fighting ? 1 : 0, ac]); }
    }
    // (the reversal as the snapshots show it: the page's own position comes in bursts, so its way round the creature is read from the samples
    // where it moved; the creature's sideways step from every snapshot.  The old way: the most common sign of each in the second before)
    if (F.lat && F.lat.length) {
      const sg = v => v > 0 ? 1 : v < 0 ? -1 : 0, maj = a => sg(a.reduce((q, v) => q + sg(v), 0));
      const mv = r => r[6] !== 12 && r[6] !== 13 && r[6] !== 14, pre = F.lat.filter(r => r[0] < 0 && mv(r)), s0 = maj(pre.map(r => r[1])), o0 = maj(pre.filter(r => Math.abs(r[3]) > 100).map(r => r[3]));   // (|om| > 100 px/s: a sample where the page's own position moved)   // (its strike's own motion aside)
      const rev = F.lat.find(r => r[0] >= 0 && Math.abs(r[3]) > 100 && sg(r[3]) === -o0), ans = rev && F.lat.find(r => r[0] >= rev[0] && mv(r) && sg(r[1]) === -s0 && Math.abs(r[1]) > 30);
      F.struckAfterRev = !!(rev && F.lat.some(r => r[0] >= rev[0] && !mv(r) && (!ans || r[0] < ans[0])));
      Object.assign(F, { pageRevMs: rev ? rev[0] : null, answerMs: rev && ans ? ans[0] - rev[0] : null });
    }
    const deadAt = (rec.find(s => s[1][5]) || [null])[0];
    Object.assign(F, { deadAt, fightSamples: n, meanErr: n ? +(errs / n).toFixed(2) : null, side: +side.toFixed(1), footwork: nF, footErr: nF ? +(errF / nF).toFixed(2) : null, footSide: +sideF.toFixed(1), footBack: +backF.toFixed(1), vmax, flipT, dead: rec.some(s => s[1][5]), plans: [...new Set(D.map(d => d.pl))] });
    await shot(A, name, F);
  };
  await scene('F5 circled: it faces them and steps sideways after them, never faster than its run', async F => {
    await circle(F, false, 'F5_circled');
    if (F.dead && F.footwork < 10) F.void = 'the page was caught before ten snapshots of its footwork';        // (set again: nothing to judge)
    F.ok = !F.void && F.footwork >= 10 && F.footErr <= .45 && F.footSide > 0 && F.vmax <= RUN + 1;
    F.note = `in its footwork (${F.footwork} snapshots): facing off by ${F.footErr} rad on average, sideways ${F.footSide} s, backing ${F.footBack} s | all ${F.fightSamples} snapshots of it moving within 450 px: facing off by ${F.meanErr} rad, sideways ${F.side} s, fastest ${F.vmax} px/s (its run ${RUN}); plans ${F.plans.join('>')}${F.dead ? '; the page was caught' : ''}`;
  });
  await scene('F6 a feint: the reversal is answered late, then answered', async F => {
    await circle(F, true, 'F6_feint', 300, 2200);                                                  // (wider, and reversed sooner: a starving one closes in fast)
    if (F.flipT === null || F.dead && F.deadAt !== null && F.deadAt < F.flipT + 1.2) F.void = 'the page was caught before its reversal could be answered';
    // (answered late: its sideways step keeps the old way for at least a snapshot after the page's reversal reaches the server; then answered:
    // the new way within 1.2 s)
    F.ok = !F.void && F.answerMs !== null && F.answerMs >= 50 && F.answerMs <= 1200 && F.vmax <= RUN + 1;
    F.note = `the page reversed (in the snapshots: ${F.pageRevMs} ms after the keys changed); its sideways step kept the old way, and turned to the new way ${F.answerMs} ms after the page's reversal; fastest ${F.vmax} px/s (its run ${RUN}); plans ${F.plans.join('>')}${F.dead ? '; the page was caught at ' + F.deadAt + ' s' : ''}`;
  });
  R.errors = { A: A.errs, B: Bp.errs }; await A.ctx.close();
  if (VIDEO) { const v = A.P.video && A.P.video(); if (v) R.videoFile = path.basename(await v.path()); }
  R.pass = R.F.every(F => F.ok) && !A.errs.length && !Bp.errs.length;
}
/* ---------------------------------------------------------------- (R18) the owner's adversarial scenes (the overtuned experiment, section 11)
 * Each scene is real pages against one placed creature, the page moved only by its own keys and mouse; each records what it did (its speeds,
 * acts, plans, stamina - the admin's debug), and is judged on what the owner asked of it: a threat that is fair.  Run on any tree (--dir):
 * R18 beside R16i.  S1 walking away, S2 sprinting at once, S3 hesitating, S4 circling, S5 reversing, S6 hiding behind a wall, S7 another
 * way out, S8 unsuspecting prey, S9 a sound to investigate, S10 after a failed spring, S11 a fed one near somebody harmless, S12 two
 * people going different ways, S13 a long hunt against its stamina. */
async function threat(b, port, R, qa) {
  const room = 'r18t' + (Date.now() % 1e6), VP = { width: 1024, height: 640 };
  const b2 = await B.pw.chromium.launch({ args: B.LAUNCH }); R.closers = [() => b2.close()];
  // (under SwiftShader two pages draw 1-6 frames a second, and a page's own movement is frame-limited - at most 0.25 s of it a frame, 71 px
  // of a sprint: a page with its keys held covers 70-140 px/s.  A smaller second page did not help (1.4-2.5 frames a second) and left page
  // A without a line to it from S3 on: kept full size)
  const A = await B.runPage(b, port, room, VP, 'K3Ta', VIDEO), Bp = await B.runPage(b2, port, room, VP, 'K3Tb');
  await admin(A); const aid = await A.P.evaluate(() => __api.H.id), bid = await Bp.P.evaluate(() => __api.H.id); R.ids = { A: aid, B: bid };
  for (const pg of [A, Bp]) await pg.P.keyboard.press('KeyW');
  const park = async pg => { await place(pg, 8400, 900); await torch(pg, false); await crouch(pg, true); };
  R.S = [];
  const AGG = 230;                                                                 // px/s: its investigation's pace and above (R18's purposeful modes)
  const scene = async (name, fn) => { if (ARG.only && !name.startsWith(ARG.only)) return; const F = { name }; CUR.scene = name.slice(0, 3).trim(); CUR.fps = null;
    // (R18: every scene begins with page A standing - S6 and S7 end crouched, and S8-S13 were run crouched in the dark, unseen, when no
    // death in between had reset the page; a scene that wants a crouch makes it)
    try { await clearK(A); await alive(A, A, aid); await alive(Bp, A, bid); await crouch(A, false); await fn(F); } catch (e) { F.error = String(e && e.message || e).slice(0, 200); }
    F.fps = CUR.fps; R.S.push(F); console.log(`${F.ok === null ? 'NOT JUDGED' : F.ok ? 'PASS' : 'FAIL'} ${name}: ${F.note || F.error || ''} [page A ${F.fps} frames/s]`); };
  // (R18) the page's own speed over a stretch of its record, by the server's snapshots (50 ms apart, in order) - the page's clock is not
  const pageV = (rec, from, to) => { const L = rec.filter(s => s[0] >= from && s[0] <= to && !s[1][5]); if (L.length < 6) return null;
    return Math.round(Math.hypot(L[L.length - 1][1][0] - L[0][1][0], L[L.length - 1][1][1] - L[0][1][1]) / ((L.length - 1) * .05)); };
  const spawn = async (x, y, hunger, ang, goal) => { const k = await qa(Object.assign({ op: 'spawn', kind: 'skinstealer', x, y, hunger, ang }, goal ? { goal } : {})); await until(A.P, () => (window.__k3.ss || []).length > 0, null, 5000); return k; };
  // what the page's record says of creature k and page A: a sample a snapshot (50 ms)
  const sum = (rec, k, pageId = aid) => {
    const tr = track(rec, k.id), D = dbgOf(rec, k.id), mv = tr.filter(s => !(s[5] >= 12 && s[5] <= 15));
    const pace = paceOf(tr), vmax = pace.vmax, fast = mv.filter(s => s[6] >= AGG).length * .05, press = D.filter((d, i) => /its press/.test(d.why) && !(i && /its press/.test(D[i - 1].why))).length;
    const plans = []; for (const d of D) if (plans[plans.length - 1] !== d.pl) plans.push(d.pl);
    const sight = D.find(d => d.sn.includes(pageId)), dead = rec.find(s => s[1][5]), st = D.map(d => d.st).filter(v => v !== undefined && v !== null);
    const dist = s => Math.hypot(s[7][0] - s[1], s[7][1] - s[2]);
    return { tr, D, vmax, crossings: pace.crossings, fast: +fast.toFixed(2), press, plans, sightAt: sight ? sight.t : null, deadAt: dead ? dead[0] : null, stMin: st.length ? Math.min(...st) : null, stMax: st.length ? Math.max(...st) : null, dist,
      strikes: tr.filter((s, i) => s[5] === 12 && (!i || tr[i - 1][5] !== 12)).length, misses: tr.filter((s, i) => s[5] === 14 && (!i || tr[i - 1][5] !== 14)).length };
  };
  const brief = S => `plans ${S.plans.join('>')}; fastest ${S.vmax} px/s (run ${RUN}${S.crossings.length ? `; the engine's crossings excepted: ${S.crossings.map(c => `${c.prop} at ${c.t} s, ${c.vmax} px/s`).join(', ')}` : ''}), ${S.fast} s at ${AGG}+, presses ${S.press}, springs ${S.strikes}${S.stMin !== null ? `, stamina ${S.stMin}-${S.stMax}` : ''}${S.deadAt !== null ? `; the page was caught at ${S.deadAt} s` : ''}`;
  // S1 walking away: a hungry one sees a lit Wanderer 600 px off, who then walks away (172 px/s) down the long hall
  await scene('S1 walking away: walking off from a hungry one does not trivialize it', async F => {
    await park(Bp); await place(A, 4700, LONG); await torch(A, true); await look(A, 5300, LONG);
    const k = await spawn(5300, LONG, .7, Math.PI);
    let walkAt = null;
    const [rec] = await stretch(A, [A], async t0 => { while (Date.now() - t0 < 2500) { const ss = await SS(A); if (ss.length) break; await sleep(100); } await sleep(1200); walkAt = (Date.now() - t0) / 1000; await keys(A, -1, 0, false);
      while (Date.now() - t0 < 14000) { const h = await H(A); if (!h || h.dead || h.x < 3150) break; await sleep(150); } await stop(A); await sleep(800); });
    const S = sum(rec, k), i0 = S.tr.findIndex(s => s[0] >= walkAt), d0 = i0 >= 0 ? S.dist(S.tr[i0]) : null;
    const close = S.tr.find(s => s[0] >= walkAt && (S.dist(s) < 200 || s[7][5]));
    Object.assign(F, { walkAt, d0: d0 && Math.round(d0), closeAt: close ? +(close[0] - walkAt).toFixed(2) : null, vmax: S.vmax, fast: S.fast, plans: S.plans, deadAt: S.deadAt });
    F.ok = F.closeAt !== null && F.closeAt <= 9 && S.vmax <= RUN + 1;
    F.note = `the page walked off at ${walkAt} s, ${F.d0} px from it: it was within 200 px of them ${F.closeAt} s later; ${brief(S)}`;
  });
  // S2 sprinting at once: a fresh Wanderer sprints away down the long hall as soon as it is seen - a fresh sprint must still win
  await scene('S2 sprinting at once: a fresh sprint in the open still outruns its pursuit', async F => {
    await park(Bp); await place(A, 7600, LONG); await torch(A, true); await look(A, 8250, LONG);
    const k = await spawn(8250, LONG, .8, Math.PI);
    let runAt = null;
    const [rec] = await stretch(A, [A], async t0 => { await sleep(1300); runAt = (Date.now() - t0) / 1000; await keys(A, -1, 0, true);
      while (Date.now() - t0 < 13000) { const h = await H(A); if (!h || h.dead || h.x < 3300) break; await sleep(150); } await stop(A); await sleep(500); });
    const S = sum(rec, k), sprint = S.tr.filter(s => s[0] >= runAt && s[7][3] === 'run'), i0 = S.tr.findIndex(s => s[0] >= runAt + .3);
    const d0 = i0 >= 0 ? S.dist(S.tr[i0]) : null, dmin = sprint.length ? Math.min(...sprint.map(S.dist)) : null, dEnd = sprint.length ? S.dist(sprint[sprint.length - 1]) : null;
    const chased = S.D.some(d => d.t >= runAt && /chase|approach/.test(d.pl));
    // (judged only when the page really sprinted - a fresh sprint is 285 px/s; under SwiftShader a page's movement is frame-limited and a
    // page at 1-4 frames a second covers 70-140 px/s with its keys held: no race at all.  The race itself is judged on the real movement
    // code, headless: C26, PR05, P18, WL03)
    const pv = sprint.length ? pageV(rec, sprint[0][0] + .5, sprint[sprint.length - 1][0]) : null;
    Object.assign(F, { runAt, d0: d0 && Math.round(d0), dmin: dmin && Math.round(dmin), dEnd: dEnd && Math.round(dEnd), sprintS: +(sprint.length * .05).toFixed(1), caught: S.deadAt !== null, chased, pageV: pv });
    F.ok = pv === null || pv < 265 ? null : !F.caught && dEnd !== null && dEnd >= d0 - 40 && S.vmax <= RUN + 1 && chased;
    F.note = `${F.ok === null ? `the page could not sprint here (${pv} px/s with its keys held - a fresh sprint is 285): no race to judge; ` : ''}the page sprinted at ${runAt} s from ${F.d0} px: closest in the sprint ${F.dmin} px, at its end ${F.dEnd} px (${F.sprintS} s of sprint, the page at ${pv} px/s); it gave chase ${chased}; ${brief(S)}`;
  });
  // S3 hesitating: a lit Wanderer in the hall a few steps one way, then the other, looking about - a hungry one takes the chance
  await scene('S3 hesitating: a person who dithers is an opening', async F => {
    await park(Bp); await place(A, 5000, LONG); await torch(A, true); await look(A, 5650, LONG);
    const k = await spawn(5650, LONG, .7, Math.PI);
    const [rec] = await stretch(A, [A], async t0 => { let dir = 1; while (Date.now() - t0 < 12000) { const h = await H(A); if (!h || h.dead) break; await keys(A, 0, dir, false); await sleep(450); await stop(A); await look(A, 5000 + dir * 300, LONG - 300 * dir); await sleep(650); dir = -dir; } await stop(A); });
    const S = sum(rec, k), close = S.tr.find(s => S.dist(s) < 200 || s[7][5]);
    Object.assign(F, { closeAt: close ? close[0] : null, deadAt: S.deadAt, fast: S.fast, springs: S.strikes, plans: S.plans });
    F.ok = F.closeAt !== null && F.closeAt <= 8 && S.vmax <= RUN + 1;
    F.note = `within 200 px of them at ${F.closeAt} s; ${brief(S)}`;
  });
  // S4 circling and S5 reversing: the page runs round it at 260 px (its own keys, steered each snapshot); S5 reverses after 2.2 s
  const circle = async (F, flip) => {
    await park(Bp); await place(A, 5240, LONG); await torch(A, true);
    const k = await spawn(5000, LONG, .9, 0);
    let flipT = null;
    const [rec] = await stretch(A, [A], async t0 => {
      await A.P.evaluate(q => { window.__k3.circ = { id: q.id, dir: 1, R: q.R }; }, { id: k.id, R: 280 });
      while (Date.now() - t0 < 9000) { if (flip && flipT === null && Date.now() - t0 > 2200) flipT = await A.P.evaluate(() => { window.__k3.circ.dir = -1; return +((window.__k3.rec.length ? window.__k3.rec[window.__k3.rec.length - 1][0] : 0)).toFixed(2); }); if ((await H(A) || {}).dead) break; await sleep(200); }
      await A.P.evaluate(() => { window.__k3.circ = null; }); });
    const S = sum(rec, k); let nF = 0, errF = 0, sideF = 0, backF = 0;
    for (let i = 1; i < S.tr.length; i++) { const s = S.tr[i], p = S.tr[i - 1], mvx = (s[1] - p[1]) / .05, mvy = (s[2] - p[2]) / .05, f = mvx * Math.cos(s[3]) + mvy * Math.sin(s[3]), l = -mvx * Math.sin(s[3]) + mvy * Math.cos(s[3]);
      if ((s[8][3].find(q => q[0] === k.id) || [])[5]) { nF++; errF += Math.abs(angDiff(s[3], Math.atan2(s[7][1] - s[2], s[7][0] - s[1]))); if (Math.abs(l) > 40 && Math.abs(l) > Math.abs(f)) sideF += .05; if (f < -30) backF += .05; } }
    Object.assign(F, { footwork: nF, footErr: nF ? +(errF / nF).toFixed(2) : null, side: +sideF.toFixed(2), back: +backF.toFixed(2), flipT, deadAt: S.deadAt, plans: S.plans, springs: S.strikes });
    return S;
  };
  await scene('S4 circling: it faces them, sidesteps and backs, contesting their way out', async F => {
    const S = await circle(F, false);
    F.ok = (F.footwork >= 10 && F.footErr <= .5 && F.side > 0 || S.deadAt !== null && S.deadAt < 4) && S.vmax <= RUN + 1;
    F.note = `its footwork ${F.footwork} snapshots, facing off by ${F.footErr} rad, sideways ${F.side} s, backing ${F.back} s; ${brief(S)}`;
  });
  await scene('S5 reversing: a sudden reversal fools it for a moment - then it answers', async F => {
    const S = await circle(F, true);
    // (its answer: a sideways step the new way, or a spring at them, within 1.2 s of the reversal reaching the server; fooled first: the old
    // way kept for at least a snapshot)
    const i0 = S.tr.findIndex(s => F.flipT !== null && s[0] >= F.flipT); let ans = null, kept = 0, s0 = 0;
    for (let i = Math.max(1, i0 - 20); i < i0 && i > 0; i++) { const s = S.tr[i], p = S.tr[i - 1]; s0 += Math.sign(-((s[1] - p[1]) * Math.sin(s[3])) + (s[2] - p[2]) * Math.cos(s[3])); }
    const sg = Math.sign(s0);
    for (let i = i0 + 1; i0 > 0 && i < S.tr.length && i < i0 + 30; i++) { const s = S.tr[i], p = S.tr[i - 1], l = -((s[1] - p[1]) * Math.sin(s[3])) + (s[2] - p[2]) * Math.cos(s[3]);
      if (s[5] === 12) { ans = { ms: (i - i0) * 50, by: 'a spring' }; break; } if (Math.sign(l) === -sg && Math.abs(l / .05) > 30) { ans = { ms: (i - i0) * 50, by: 'a step the new way' }; break; } kept++; }
    Object.assign(F, { answer: ans, keptMs: kept * 50 });
    F.ok = (ans && ans.ms >= 50 && ans.ms <= 1200 || S.deadAt !== null && F.flipT !== null && S.deadAt < F.flipT + .3) && S.vmax <= RUN + 1;
    F.note = `reversed at ${F.flipT} s: ${ans ? `answered by ${ans.by} ${ans.ms} ms later` : 'no answer'}; ${brief(S)}`;
  });
  // S6 hiding behind solid geometry: seen in the hall, the page steps round a pillar on the hall's north side into a nook (5150, 3350) that
  // neither the creature's place nor the place it was seen at has a line to, and crouches there in the dark
  const P0 = [5200, 3480], M0 = [5100, 3450], H0 = [5150, 3350];
  const walkTo = async (pg, x, y, run, ms) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { const h = await H(pg); if (!h || Math.hypot(x - h.x, y - h.y) < 25) break; await keys(pg, x - h.x, y - h.y, run); await sleep(60); } await stop(pg); };
  await scene('S6 hiding behind a wall: it goes to where it last saw them and looks - it does not know where they are', async F => {
    await park(Bp); await place(A, P0[0], P0[1]); await torch(A, true); await look(A, 5850, LONG);
    const k = await spawn(5850, LONG, .7, Math.PI);
    let hidAt = null, lastSeen = null;
    const [rec] = await stretch(A, [A], async t0 => { await sleep(1300); await torch(A, false); await walkTo(A, M0[0], M0[1], true, 1500); await walkTo(A, H0[0], H0[1], false, 1500); await crouch(A, true); hidAt = (Date.now() - t0) / 1000; await sleep(9000); });
    const S = sum(rec, k), seen = S.D.filter(d => d.sn.includes(aid)); lastSeen = seen.length ? seen[seen.length - 1] : null;
    const atLS = lastSeen && S.tr.find(s => s[0] > lastSeen.t && Math.hypot(s[1] - P0[0], s[2] - P0[1]) < 220);
    const after = S.tr.filter(s => lastSeen && s[0] > lastSeen.t), moving = after.filter(s => s[6] >= 10 && !(s[5] >= 12));
    Object.assign(F, { hidAt, lostAt: lastSeen ? lastSeen.t : null, toLastSeen: atLS ? +(atLS[0] - lastSeen.t).toFixed(2) : null, meanV: moving.length ? Math.round(moving.reduce((a, s) => a + s[6], 0) / moving.length) : null, plans: S.plans, foundAgain: S.D.some(d => lastSeen && d.t > lastSeen.t + 1 && d.sn.includes(aid)), deadAt: S.deadAt });
    F.ok = F.lostAt !== null && F.toLastSeen !== null && F.toLastSeen <= 8 && S.vmax <= RUN + 1;
    F.note = `it lost them at ${F.lostAt} s; at the place it last saw them ${F.toLastSeen} s later (moving at ${F.meanV} px/s on average); it found them again: ${F.foundAgain}; ${brief(S)}`;
  });
  // S7 another way out: seen at the mouth of the room off the hall, the page goes in, out of its sight, and leaves by the room's far side, quietly
  await scene('S7 another way out: it follows the evidence it has, not where they really went', async F => {
    await park(Bp); await place(A, P0[0], P0[1]); await torch(A, true); await look(A, 5850, LONG);
    const k = await spawn(5850, LONG, .7, Math.PI, { x: 4300, y: LONG });   // (R18: its roam begun west, past them - at R18's walk it was 1,000 px off east before it had seen them)
    let goneAt = null, ls = null;
    const [rec] = await stretch(A, [A], async t0 => { await sleep(1300); await torch(A, false); await walkTo(A, M0[0], M0[1], true, 1500); await walkTo(A, H0[0], H0[1], false, 1500); await crouch(A, true); goneAt = (Date.now() - t0) / 1000;
      await walkTo(A, 4700, 3330, false, 6000); await sleep(2000); });   // (crouched: quiet - it leaves the nook the other way, west)
    const S = sum(rec, k), seen = S.D.filter(d => d.sn.includes(aid)); ls = seen.length ? seen[seen.length - 1] : null;
    // where it went in the 4 s after it lost them: toward the place it last saw them, or straight to where the page really was
    const lsP = ls ? (rec.find(s => s[0] >= ls.t) || [null, [5420, LONG]])[1] : null, path = S.tr.filter(s => ls && s[0] > ls.t && s[0] < ls.t + 4);
    const endP = path.length ? path[path.length - 1] : null, trueP = endP ? endP[7] : null;
    const toLS = endP && lsP ? Math.hypot(endP[1] - lsP[0], endP[2] - lsP[1]) : null, toTrue = endP && trueP ? Math.hypot(endP[1] - trueP[0], endP[2] - trueP[1]) : null;
    // (seen again: only with a line from the page's own rays at that tick or the two before - never through the pillar)
    const blind = S.D.filter(d => ls && d.t > ls.t && d.sn.includes(aid)).length, noRay = rec.filter((s, i) => ls && s[0] > ls.t && s[5] && (s[3].find(q => q[0] === k.id) || [, , , , , , []])[6].includes(aid) && [0, 1, 2].every(j => { const r = rec[i - j]; if (!r) return true; const ix = r[2].findIndex(q => q[0] === k.id); return ix < 0 || !r[4][ix]; })).length;
    F.noRay = noRay;
    Object.assign(F, { lostAt: ls ? ls.t : null, toLastSeen: toLS && Math.round(toLS), toTrue: toTrue && Math.round(toTrue), seenAgain: blind, plans: S.plans, deadAt: S.deadAt });
    F.ok = F.lostAt !== null && S.vmax <= RUN + 1 && F.noRay === 0 && (F.seenAgain > 0 || F.toLastSeen !== null);
    if (F.lostAt === null && S.vmax <= RUN + 1 && F.noRay === 0) F.ok = null;   // (R18: it never saw them - no evidence to follow: the scene's premise not met, reported)
    F.note = `${F.ok === null ? 'it never saw the page: no evidence to follow - not judged; ' : ''}lost at ${F.lostAt} s; 4 s later it was ${F.toLastSeen} px from where it last saw them and ${F.toTrue} px from where they were; seen again in ${F.seenAgain} debug samples, ${F.noRay} of them without a line from the page; ${brief(S)}`;
  });
  // S8 unsuspecting prey: a hungry one 750 px behind somebody walking away from it with their torch on, who never looks back
  await scene('S8 unsuspecting prey: a hungry one goes for somebody who does not know it is there', async F => {
    await park(Bp); await place(A, 5000, LONG); await torch(A, true); await look(A, 4000, LONG);
    const k = await spawn(5750, LONG, .75, Math.PI);
    const [rec] = await stretch(A, [A], async t0 => { await keys(A, -1, 0, false); while (Date.now() - t0 < 12000) { const h = await H(A); if (!h || h.dead || h.x < 3200) break; await look(A, h.x - 400, LONG); await sleep(300); } await stop(A); await sleep(500); });
    const S = sum(rec, k), act = S.D.find(d => S.sightAt !== null && d.t >= S.sightAt && /approach|chase|intercept|flank/.test(d.pl));
    const close = S.tr.find(s => S.dist(s) < 200 || s[7][5]);
    Object.assign(F, { sightAt: S.sightAt, actAt: act ? +(act.t - S.sightAt).toFixed(2) : null, closeAt: close ? close[0] : null, deadAt: S.deadAt, plans: S.plans });
    F.ok = F.actAt !== null && F.actAt <= 2 && F.closeAt !== null && S.vmax <= RUN + 1;
    F.note = `it saw them at ${F.sightAt} s and went for them ${F.actAt} s later; within 200 px at ${F.closeAt} s; ${brief(S)}`;
  });
  // S9 a sound to investigate: out of its sight round the corner of the room, the page runs a moment, then crouches in the dark
  await scene('S9 a sound: it goes to look, at its investigation\'s pace, and gets a line on them', async F => {
    await park(Bp); await place(A, H0[0], H0[1]); await torch(A, false); await crouch(A, true);
    const k = await spawn(5850, LONG, .6, Math.PI, { x: 4300, y: LONG });   // (R18: its roam begun west along the hall, past the room - at R18's walk it was 1,000 px off east before the page ran)
    let ranAt = null;
    const [rec] = await stretch(A, [A], async t0 => { await sleep(1000); await crouch(A, false); ranAt = (Date.now() - t0) / 1000; await walkTo(A, M0[0], M0[1], true, 700); await walkTo(A, H0[0], H0[1], true, 700); await crouch(A, true); await sleep(9000); });
    const S = sum(rec, k), heard = S.D.find(d => ranAt !== null && d.t >= ranAt && (d.lk && d.lk[0] === 'sound' || /heard/.test(d.why)));
    const moving = S.tr.filter(s => heard && s[0] > heard.t && s[6] >= 10 && !(s[5] >= 12)), fastS = moving.filter(s => s[6] >= 200).length * .05;
    Object.assign(F, { ranAt, heardAt: heard ? heard.t : null, fastS: +fastS.toFixed(2), sawAt: S.D.find(d => heard && d.t > heard.t && d.sn.includes(aid)) ? 1 : 0, nearest: Math.round(Math.min(...S.tr.map(S.dist))), plans: S.plans, deadAt: S.deadAt });
    // (its pace there is reported, not judged: within SK.closeFrom (450 px) of a person it heard it goes in quietly - a stalk - by design;
    // from farther its investigation's pace.  Judged: it heard them, went to look and got a line on them or came within 250 px)
    const hd = heard ? S.tr.find(s => s[0] >= heard.t) : null; F.dHeard = hd ? Math.round(S.dist(hd)) : null;
    F.ok = F.heardAt !== null && (F.sawAt || F.nearest < 250) && S.vmax <= RUN + 1;
    if (F.heardAt === null && !S.D.some(d => ranAt !== null && d.t >= ranAt && d.sn.includes(aid)) && S.vmax <= RUN + 1) F.ok = null;   // (R18: no sound reached it and it never saw them: the premise not met, reported)
    F.note = `${F.ok === null ? 'no sound of the page reached it and it never saw them - not judged; ' : ''}it heard them at ${F.heardAt} s (ran at ${ranAt}), ${F.dHeard} px off; ${F.fastS} s at 200 px/s or more on its way; it got a line on them: ${!!F.sawAt}, nearest ${F.nearest} px; ${brief(S)}`;
  });
  // S10 after a failed spring: the page waits for its wind-up and dodges sideways; once its recovery ends it must come again at once
  await scene('S10 a failed spring: it recovers and comes again - no sulking', async F => {
    await park(Bp); await place(A, 5000, LONG); await torch(A, true); await look(A, 5500, LONG);
    const k = await spawn(5500, LONG, .85, Math.PI);
    const [rec] = await stretch(A, [A], async t0 => { let dodged = 0;
      while (Date.now() - t0 < 14000) { const h = await H(A); if (!h || h.dead) break; const c = (await SS(A)).find(q => q.i === k.id);
        if (c && c.ac === 12 && dodged < 3) { dodged++; await keys(A, 0, dodged % 2 ? -1 : 1, true); await sleep(650); await stop(A); }
        await sleep(40); } await stop(A); });
    const S = sum(rec, k), rec14 = S.tr.findIndex((s, i) => i && S.tr[i - 1][5] === 14 && s[5] !== 14), after = rec14 >= 0 ? S.tr.slice(rec14) : [];
    const again = after.find(s => s[6] >= 150 || s[5] === 12 || s[7][5]);
    Object.assign(F, { misses: S.misses, springs: S.strikes, againMs: again && rec14 >= 0 ? Math.round((again[0] - S.tr[rec14][0]) * 1000) : null, deadAt: S.deadAt, plans: S.plans });
    F.ok = (S.misses > 0 ? F.againMs !== null && F.againMs <= 1500 : S.deadAt !== null) && S.vmax <= RUN + 1;
    F.note = `${S.misses} misses of ${S.strikes} springs; after its first recovery it came again ${F.againMs} ms later; ${brief(S)}`;
  });
  // S11 a fed one near somebody harmless: hunger .1, the page stands lit 300 px off, facing away, for 10 s
  await scene('S11 fed, near somebody harmless: it watches, it does not hunt', async F => {
    await park(Bp); await place(A, 5000, LONG); await torch(A, true); await look(A, 4500, LONG);
    const k = await spawn(5300, LONG, .1, Math.PI);
    const [rec] = await stretch(A, [A], async () => { await sleep(10000); });
    const S = sum(rec, k), hostile = S.D.some(d => /approach|chase|flank|intercept|ambush|lure/.test(d.pl));
    Object.assign(F, { hostile, springs: S.strikes, fast: S.fast, plans: S.plans, deadAt: S.deadAt });
    F.ok = !hostile && !S.strikes && S.deadAt === null && S.fast < .5;
    F.note = `${hostile ? 'it hunted them' : 'no hunt'}; ${brief(S)}`;
  });
  // S12 two people going different ways: both lit in the hall, then A walks west and B east
  await scene('S12 two people split up: it picks one and goes after them', async F => {
    await place(A, 5000, LONG); await place(Bp, 5060, LONG + 40); await torch(A, true); await torch(Bp, true); await crouch(Bp, false); await look(A, 5650, LONG); await look(Bp, 5650, LONG);
    const k = await spawn(5650, LONG, .8, Math.PI);
    const [rec, recB] = await stretch(A, [A, Bp], async t0 => { await sleep(1500); await keys(A, -1, 0, false); await keys(Bp, 1, 0.3, false); await sleep(9000); await stop(A); await stop(Bp); });
    const S = sum(rec, k), go = S.D.find(d => d.t > 1.5 && /approach|chase|intercept/.test(d.pl) && d.pid), who = go ? (go.pid === aid ? 'A' : go.pid === bid ? 'B' : 'P' + go.pid) : null;
    Object.assign(F, { pickedAt: go ? go.t : null, who, plans: S.plans, deadAt: S.deadAt, springs: S.strikes });
    F.ok = !!go && go.t <= 5 && S.vmax <= RUN + 1;
    F.note = `it went after ${who} at ${F.pickedAt} s; ${brief(S)}`;
    await park(Bp);
  });
  // S13 a long hunt against its stamina: the page keeps moving round the hall's middle for 60 s - walking, with sprints when it comes close
  await scene('S13 a long hunt: its breath runs out and comes back; it keeps hunting while it has evidence', async F => {
    await park(Bp); await place(A, 4400, LONG); await torch(A, true);
    const k = await spawn(6000, LONG, .85, Math.PI, { x: 4600, y: LONG });   // (R18: its roam begun toward the hall's middle - at R18's walk it was gone east before it had seen them)
    const pts = [[4400, LONG], [6600, LONG], [5420, LONG - 350], [7400, LONG]];
    const [rec] = await stretch(A, [A], async t0 => { let i = 1;
      while (Date.now() - t0 < 60000) { const h = await H(A); if (!h) break; if (h.dead) { await stop(A); await sleep(2000); A.cmd({ c: 'revive', id: aid }); await sleep(1500); await place(A, 4400, LONG); continue; }
        const c = (await SS(A)).find(q => q.i === k.id), g = pts[i % pts.length]; if (Math.hypot(g[0] - h.x, g[1] - h.y) < 80) i++;
        const near = c && Math.hypot(c.x - h.x, c.y - h.y) < 350; await keys(A, g[0] - h.x, g[1] - h.y, near); if (c) await look(A, c.x, c.y); await sleep(150); } await stop(A); });
    const S = sum(rec, k), st = S.D.map(d => d.st).filter(v => v !== undefined && v !== null), low = st.findIndex(v => v < 40), back = low >= 0 ? st.slice(low).some(v => v > 60) : false;
    const deaths = rec.filter((s, i) => s[1][5] && (!i || !rec[i - 1][1][5])).length, leaves = S.D.filter((d, i) => d.pl === 'leave' && (!i || S.D[i - 1].pl !== 'leave')).length;
    Object.assign(F, { stMin: S.stMin, recovered: back, deaths, leaves, presses: S.press, chases: S.D.filter((d, i) => d.pl === 'chase' && (!i || S.D[i - 1].pl !== 'chase')).length, plans: S.plans.slice(0, 30) });
    // (R18: a long hunt needs the page alive - a page at 1-3 frames a second covers 70-140 px/s with its keys held and is caught; the
    // creature then holds its kill and feeds (8 s and more) and, fed, hunts less.  Caught before its breath ran low: no long hunt to judge,
    // reported as such.  Its breath against a true runner is judged headless: SK11, SK22, PR05, P18 and tools/threat_sim.js)
    const lowAt = low >= 0 ? S.D.filter(d => d.st !== undefined && d.st !== null)[low].t : null, died = rec.find(s => s[1][5]);
    F.diedFirst = !!died && (lowAt === null || died[0] < lowAt); F.neverSaw = !S.D.some(d => d.sn.includes(aid));
    F.ok = F.diedFirst || F.neverSaw ? null : st.length > 0 && S.stMin !== null && S.stMin < 40 && back && (F.presses + F.chases) >= 2 && S.vmax <= RUN + 1;
    F.note = `${F.neverSaw ? 'it never saw the page: no hunt to judge; ' : F.diedFirst ? `the page was caught at ${died[0]} s, before its breath ran low: no long hunt to judge; ` : ''}stamina down to ${S.stMin}, ${back ? 'back over 60 after' : 'never back over 60'}; ${F.chases} chases, ${F.presses} presses, ${leaves} departures; the page died ${deaths} times; fastest ${S.vmax} px/s${S.crossings.length ? ` (the engine's crossings excepted: ${S.crossings.map(c => `${c.prop}, ${c.vmax} px/s`).join(', ')})` : ''}`;
  });
  R.errors = { A: A.errs, B: Bp.errs }; await A.ctx.close();
  if (VIDEO) { const v = A.P.video && A.P.video(); if (v) R.videoFile = path.basename(await v.path()); }
  R.pass = R.S.every(F => F.ok !== false) && !A.errs.length && !Bp.errs.length;
  if (ARG.raw) fs.writeFileSync(ARG.raw, require('zlib').gzipSync(JSON.stringify({ ids: R.ids, scenes: RAWS })));   // (R18: every scene's records, both pages - for analysis)
}
/* ---------------------------------------------------------------- the continuous campaign */
const SPOTS = [{ x: 3300, y: LONG }, { x: 4200, y: LONG }, { x: 5000, y: LONG }, { x: 5600, y: LONG }, { x: 5600, y: LONG - 600 }, { x: 6400, y: LONG }, { x: 7200, y: LONG }, { x: 8200, y: LONG }, { x: 5600, y: LONG - 300 }, { x: 5000, y: LONG + 400 }];
async function continuous(b, port, R, qa) {
  const room = 'r16gc' + (Date.now() % 1e6), VP = { width: 1024, height: 640 }, MINS = +ARG.mins;
  const b2 = await B.pw.chromium.launch({ args: B.LAUNCH }); R.closers = [() => b2.close()];
  const A = await B.runPage(b, port, room, VP, 'K3Ca', VIDEO), Bp = await B.runPage(b2, port, room, VP, 'K3Cb');
  await admin(A); const ids = { A: await A.P.evaluate(() => __api.H.id), B: await Bp.P.evaluate(() => __api.H.id) }; R.ids = ids;
  for (const pg of [A, Bp]) await pg.P.keyboard.press('KeyW');
  await place(A, 3300, LONG); await place(Bp, 4200, LONG + 400 > 0 ? LONG : LONG); await torch(A, true); await torch(Bp, true);
  const K1 = await qa({ op: 'spawn', kind: 'skinstealer', x: 7600, y: LONG, hunger: .6, ang: Math.PI }); R.K = [K1];
  for (const pg of [A, Bp]) await pg.P.evaluate(REC);
  A.cmd({ c: 'freeze', on: false });
  const t0 = Date.now(), T = MINS * 60 * 1000, bots = [{ pg: A, id: ids.A, name: 'A', mode: 'explore', until: 0, goal: null, stuck: 0, last: null }, { pg: Bp, id: ids.B, name: 'B', mode: 'explore', until: 0, goal: null, stuck: 0, last: null }];
  const log = R.log = []; let second = false, nextShot = 30000, deaths = { A: 0, B: 0 };
  const MODES = ['explore', 'explore', 'hide', 'peek', 'circle', 'feint', 'explore', 'flee'];
  while (Date.now() - t0 < T) {
    const now = Date.now() - t0;
    if (!second && now > T / 2) { second = true; const K2 = await qa({ op: 'spawn', kind: 'skinstealer', x: 3300, y: LONG - 600, hunger: .9 }); R.K.push(K2); log.push([+(now / 1000).toFixed(1), 'a second Skin-Stealer, hunger .9']); }
    for (const bot of bots) {
      const pg = bot.pg, h = await H(pg); if (!h) continue;
      if (h.dead) { deaths[bot.name]++; log.push([+(now / 1000).toFixed(1), `${bot.name} died`]); await stop(pg); await sleep(2500); A.cmd({ c: 'revive', id: bot.id }); await sleep(1800); await place(pg, SPOTS[(deaths[bot.name] * 3) % SPOTS.length].x, SPOTS[(deaths[bot.name] * 3) % SPOTS.length].y); bot.mode = 'explore'; bot.until = 0; continue; }
      const ks = await SS(pg), near = ks.map(c => Object.assign({ d: Math.hypot(c.x - h.x, c.y - h.y) }, c)).sort((p, q) => p.d - q.d)[0];
      if (now > bot.until) { bot.mode = MODES[Math.floor(Math.random() * MODES.length)]; bot.until = now + 15000 + Math.random() * 20000; bot.goal = null; bot.dir = Math.random() < .5 ? 1 : -1; log.push([+(now / 1000).toFixed(1), `${bot.name}: ${bot.mode}`]);
        await torch(pg, bot.mode !== 'hide'); await crouch(pg, bot.mode === 'hide'); }
      // flee from a creature that comes close and fast (as a player would), whatever the mode
      if (near && near.d < 330 && bot.mode !== 'circle' && bot.mode !== 'feint') { await keys(pg, h.x - near.x, h.y - near.y, true); await look(pg, near.x, near.y); continue; }
      let gx = null, gy = null, run = false;
      if ((bot.mode === 'circle' || bot.mode === 'feint') && near && near.d < 700) {
        if (bot.mode === 'feint' && Math.random() < .03) bot.dir = -bot.dir;
        const a = Math.atan2(h.y - near.y, h.x - near.x); gx = near.x + Math.cos(a + bot.dir * .5) * 240; gy = near.y + Math.sin(a + bot.dir * .5) * 240; run = true; await look(pg, near.x, near.y);
      } else if (bot.mode === 'hide') { if (!bot.goal) bot.goal = SPOTS[Math.floor(Math.random() * SPOTS.length)]; gx = bot.goal.x; gy = bot.goal.y; }
      else if (bot.mode === 'peek' && near) { gx = near.x + (h.x - near.x) / Math.max(1, near.d) * 520; gy = near.y + (h.y - near.y) / Math.max(1, near.d) * 520; await look(pg, near.x, near.y); }
      else { if (!bot.goal || Math.hypot(bot.goal.x - h.x, bot.goal.y - h.y) < 60) bot.goal = SPOTS[Math.floor(Math.random() * SPOTS.length)]; gx = bot.goal.x; gy = bot.goal.y; run = bot.mode === 'flee'; if (near && near.d < 900) await look(pg, near.x, near.y); else await look(pg, gx, gy); }
      if (gx === null) { await stop(pg); continue; }
      // stuck against a pillar: a sidestep for a moment, then another goal
      if (bot.last && Math.hypot(h.x - bot.last.x, h.y - bot.last.y) < 4) bot.stuck++; else bot.stuck = 0; bot.last = { x: h.x, y: h.y };
      if (bot.stuck > 8) { await keys(pg, -(gy - h.y), gx - h.x, false); await sleep(350); bot.goal = null; bot.stuck = 0; continue; }
      if (Math.hypot(gx - h.x, gy - h.y) < 40) await stop(pg); else await keys(pg, gx - h.x, gy - h.y, run);
    }
    if (SHOTS && now > nextShot) { nextShot += 60000; await shot(A, `C_A_${Math.round(now / 1000)}s`, R); await shot(Bp, `C_B_${Math.round(now / 1000)}s`, R); }
    await sleep(80);
  }
  A.cmd({ c: 'freeze', on: true });
  const recs = [await A.P.evaluate(STOPREC).catch(() => []), await Bp.P.evaluate(STOPREC).catch(() => [])];
  R.deaths = deaths; R.secs = Math.round((Date.now() - t0) / 1000); R.samples = recs.map(r => r.length);
  R.fps = [+(await A.P.evaluate(() => window.__k3.frames).catch(() => 0) / R.secs).toFixed(1), +(await Bp.P.evaluate(() => window.__k3.frames).catch(() => 0) / R.secs).toFixed(1)];
  R.errors = { A: A.errs, B: Bp.errs }; await A.ctx.close();
  if (VIDEO) { const v = A.P.video && A.P.video(); if (v) R.videoFile = path.basename(await v.path()); }
  if (ARG.raw) require('fs').writeFileSync(ARG.raw, require('zlib').gzipSync(JSON.stringify({ ids, recs, deaths: R.deaths, errors: R.errors })));   // (the pages' whole record, for analysis and for judging again with --part judge; R17: kept with the evidence - synthetic names only)
  judge(R, recs, ids);
}
/* the hard failures (section 8) and the record, from what the pages had and the admin's debug */
function judge(R, recs, ids) {
  const [rA, rB] = recs, V = R.checks = [], ev = R.events = { preempt: 0, kept: 0, snaps: { sound: 0, motion: 0, sight: 0 }, fight: 0, strikes: 0, kills: 0 }, chk = (id, ok, why) => V.push({ id, ok: !!ok, why });
  const kids = [...new Set(rA.flatMap(s => s[2].map(k => k[0])))];
  const LIB = require(path.join(B.DIR, 'dev', 'tests', 'lib.js')), G = LIB.geo();   // (the shared geometry: the server's own line of sight, reported beside the pages')
  const CROSS = LIB.WORLD.PROPS.filter(p => p.type === 'low' || p.type === 'window');                     // (R17: what a vault crosses)
  const tkey = s => JSON.stringify(s[2].map(k => [k[0], k[1], k[2], k[3]])), keyB = new Map(); rB.forEach((s, j) => { const k = tkey(s); if (s[2].length && !keyB.has(k)) keyB.set(k, j); });
  let unaligned = 0;
  let walkOn = [], blind = 0, blindN = 0, over = 0, stuck = [], flips = 0, headMax = 0;
  for (const id of kids) {
    const D = dbgOf(rA, id), tA = track(rA, id), tB = track(rB, id);
    // its interruptions, its eyes, its footwork - each counted once as it begins
    let lastPe = null, lastLk = null, lastFt = false, lastAc = null;
    for (const d of D) {
      if (d.pe && (!lastPe || d.pe[3] !== lastPe[3] || d.pe[0] < lastPe[0])) { if (d.pe[2]) ev.kept++; else ev.preempt++; }
      lastPe = d.pe;
      if (d.lk && (!lastLk || d.lk[0] !== lastLk[0])) ev.snaps[d.lk[0]] = (ev.snaps[d.lk[0]] || 0) + 1; lastLk = d.lk;
      if (d.ft && !lastFt) ev.fight++; lastFt = !!d.ft;
    }
    for (const s of tA) { if (s[5] === 12 && lastAc !== 12) ev.strikes++; lastAc = s[5]; headMax = Math.max(headMax, Math.abs(s[4])); }
    // F-a: walks on along its route after newly seeing a person it may hunt (hunger >= .4) - within 0.5 s its plan changes or it says why not
    for (let i = 1; i < D.length; i++) {
      const d = D[i], p = D[i - 1];
      for (const who of [ids.A, ids.B]) if (d.sn.includes(who) && !p.sn.includes(who) && d.pl === 'roam' && d.hu >= .4) {
        // (R17: its debug says 'roam' whenever it has no plan - also while it holds a kill, committed (the feed act, 15; "it has P<n>"),
        // or springs (12-14): then it walks no route and answers nobody by design (T4, T5). Such sightings are counted, not judged)
        const k = tA.reduce((b, s) => Math.abs(s[0] - d.t) < Math.abs((b || [1e9])[0] - d.t) ? s : b, null);
        if (k && k[5] >= 12 && k[5] <= 15) { R.heldSightings = (R.heldSightings || 0) + 1; continue; }
        const later = D.filter(q => q.t > d.t && q.t <= d.t + .5);
        if (!later.some(q => q.pl !== 'roam' || q.pe)) walkOn.push(+d.t.toFixed(1));
      }
      // F-f: flips: a plan, another, the first again, all within a second
      if (i >= 2 && D[i].pl === D[i - 2].pl && D[i - 1].pl !== D[i].pl && D[i].t - D[i - 2].t < 1) flips++;
    }
    // F-c: it sees a person whose own page has no clear line to it.  Its sight (the debug's list of whom it sees) is of its last think, at
    // most 0.1 s before the tick that carries it, so each sighting is held against that person's own page over that tick and the two before
    // it (0.1 s, in snapshot order): a blind sighting is one where none of the page's three rays reached its body in any of them.  B's page
    // is matched to the admin's tick by the snapshot itself (the creatures' places, identical in every page's copy of one tick).  The
    // server's own line (the shared geometry, dev/tests' Level 0) between it and where the server had them is reported beside it.
    for (const [i, s] of rA.entries()) { if (!s[5]) continue; const d = s[3].find(q => q[0] === id); if (!d) continue;
      const jB = keyB.get(tkey(s));
      for (const who of [ids.A, ids.B]) { if (!d[6].includes(who)) continue;
        const r = who === ids.A ? rA : rB, j = who === ids.A ? i : jB; if (j === undefined) { unaligned++; continue; }
        const k = r[j][2].find(q => q[0] === id); if (!k) continue; const dd = Math.hypot(k[1] - r[j][1][0], k[2] - r[j][1][1]); if (dd > 650) continue;
        const win = [j - 2, j - 1, j].filter(x => x >= 0).map(x => { const o = r[x], q = o[2].find(z => z[0] === id); return q ? o[4][o[2].indexOf(q)] : null; }).filter(v => v !== null);
        const srv = who === ids.B ? (s[6].find(q => q[0] === who) || null) : jB !== undefined ? (rB[jB][6].find(q => q[0] === who) || null) : null;
        const sLos = srv ? G.g.los(k[1], k[2], srv[1], srv[2]) : null;
        blindN++; if (win.length && win.every(v => v === 0)) { blind++; (R.blindAt || (R.blindAt = [])).push({ t: s[0], id, who, k: [k[1], k[2]], p: [r[j][1][0], r[j][1][1]], srv: srv ? [srv[1], srv[2]] : null, serverLos: sLos, d: Math.round(dd), plan: d[1] }); } } }
    // F-d: faster than its run (the page's own record of its speed; the strike's own lunge excepted - and (R17) the engine's crossing of a
    // low obstacle or a window: a vault carries every species over in a fixed time whatever its pace (ai.entity.js's stepTrav, R8's code;
    // its speed peaks near 450 px/s for a third of a second). A run of samples over its run is a crossing only if it lies within 70 px of
    // one such prop and ends on the other side of it from where it began; every crossing is counted and listed, never silently dropped)
    const runs = (tr, hit) => { const out = []; let cur = null; tr.forEach((s, i) => { if (hit(s)) { if (!cur) cur = { a: i, b: i }; else cur.b = i; } else if (cur) { out.push(cur); cur = null; } }); if (cur) out.push(cur); return out; };
    const fast = s => s[6] > RUN + 1 && s[5] !== 12 && s[5] !== 13 && s[5] !== 14;
    const crossed = (tr, g) => { const a = tr[Math.max(0, g.a - 1)], b = tr[Math.min(tr.length - 1, g.b + 1)];
      return CROSS.find(P => { const r = P.rect, near = s => s[1] > r.x - 70 && s[1] < r.x + r.w + 70 && s[2] > r.y - 70 && s[2] < r.y + r.h + 70;
        const side = s => r.w < r.h ? Math.sign(s[1] - (r.x + r.w / 2)) : Math.sign(s[2] - (r.y + r.h / 2));
        return tr.slice(g.a, g.b + 1).every(near) && side(a) !== 0 && side(a) === -side(b); }) || null; };
    for (const [tr, page] of [[tA, 'A'], [tB, 'B']]) for (const g of runs(tr, fast)) {
      const P = crossed(tr, g), n = g.b - g.a + 1, vmax = Math.max(...tr.slice(g.a, g.b + 1).map(s => s[6]));
      if (P) { (R.crossings || (R.crossings = [])).push({ page, id, t: tr[g.a][0], n, vmax, prop: P.id + ' (' + P.type + ')' }); continue; }
      over += n;
      if (page === 'A') for (let i = g.a; i <= g.b; i++) { const s = tr[i], q = tr[i - 1], d = D.find(x => Math.abs(x.t - s[0]) < .1);
        (R.overAt || (R.overAt = [])).push({ t: s[0], id, v: s[6], ac: s[5], at: [s[1], s[2]], prev: q ? [q[1], q[2], q[6], q[5]] : null, plan: d ? d.pl : '' }); }
    }
    // F-e: stuck: not moving 8 s on end while its plan is one that moves it
    let still = null; for (const s of tA) { const d = D.find(q => Math.abs(q.t - s[0]) < .06); const moving = d && /approach|chase|search|flank|intercept|leave/.test(d.pl);
      if (moving && s[6] < 5) { if (still === null) still = s[0]; else if (s[0] - still > 8) { stuck.push(+still.toFixed(1)); still = null; } } else still = null; }
  }
  ev.kills = (R.deaths.A || 0) + (R.deaths.B || 0);
  chk('a. it never walks on along its route after newly seeing somebody it may hunt (an answer within 0.5 s)', !walkOn.length, (walkOn.length ? `at ${walkOn.join(', ')} s` : 'every new sighting at hunting hunger while it roamed was answered within 0.5 s') + `; ${R.heldSightings || 0} sightings while it held a kill or sprang, not judged`);
  chk('b. its head turns (snaps seen in the debug, and drawn: the page\'s head angle)', ev.snaps.sound + ev.snaps.motion + ev.snaps.sight > 0 && headMax > .5, `snaps: ${JSON.stringify(ev.snaps)}, the largest head angle the pages drew from ${headMax.toFixed(2)} rad`);
  chk('c. it never sees through a wall (whenever it sees a person within 650 px, that person\'s own page has a clear line to it at that tick or the two before)', blind <= Math.max(1, blindN * .01), `${blind} of ${blindN} sightings with no ray from the person's page in 0.1 s (the server's own line clear in ${(R.blindAt || []).filter(b => b.serverLos).length} of them); ${unaligned} of B's not matched to a tick of B's page`);
  const cx = R.crossings || [];
  chk('d. never faster than its run (the pages\' record of its speed, the strike\'s lunge and the engine\'s crossing of a low obstacle or a window excepted)', over === 0, `${over} samples over ${RUN} px/s` + (cx.length ? `; ${cx.length} crossings excepted (${cx.reduce((q, c) => q + c.n, 0)} samples, at most ${Math.max(...cx.map(c => c.vmax))} px/s): ${cx.map(c => `${c.prop} at ${c.t.toFixed(0)} s on page ${c.page}`).join(', ')}` : '; no crossing'));
  chk('e. never stuck (8 s still in a plan that moves it)', !stuck.length, stuck.length ? `at ${stuck.join(', ')} s` : 'none');
  chk('f. no plan flips back and forth within a second', flips <= 2, `${flips} flips`);
  chk('g. no page error', !R.errors.A.length && !R.errors.B.length, JSON.stringify(R.errors).slice(0, 300));
  R.blindChecked = blindN;
  R.pass = V.every(c => c.ok);
}
// (--part judge --raw FILE: the hard-failure checks again on a saved record, without a browser)
if (ARG.part === 'judge') { const X = JSON.parse(require('zlib').gunzipSync(fs.readFileSync(ARG.raw))), R = { part: 'judge', deaths: X.deaths || {}, errors: X.errors || { A: [], B: [] } }; judge(R, X.recs, X.ids);
  for (const c of R.checks) console.log((c.ok ? 'PASS ' : 'FAIL ') + c.id + '  ' + c.why); if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n'); process.exit(0); }
(async () => {
  const { p: srv, port, qa } = await B.serve();
  const b = await B.pw.chromium.launch({ args: B.LAUNCH });
  const R = { tool: 'dev/trial-3-r9-overhaul/tools/r16g_campaign.js', part: ARG.part, chromium: b.version(), tree: path.basename(B.DIR) };
  try { if (ARG.part === 'continuous') await continuous(b, port, R, qa); else if (ARG.part === 'threat') await threat(b, port, R, qa); else await focused(b, port, R, qa); }
  catch (e) { R.error = e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ').replace(/\/[^\s|:]*\//g, '') : String(e); }
  finally { for (const f of R.closers || []) await f().catch(() => { }); delete R.closers; await b.close().catch(() => { }); try { process.kill(srv.pid); } catch (e) { } }
  if (R.checks) { for (const c of R.checks) console.log((c.ok ? 'PASS ' : 'FAIL ') + c.id + '  ' + c.why); console.log(`events: ${JSON.stringify(R.events)}; deaths ${JSON.stringify(R.deaths)}; ${R.secs} s; samples ${JSON.stringify(R.samples)}; frames a second ${JSON.stringify(R.fps)}`); }
  if (R.F) console.log(`FOCUSED: ${R.pass ? 'PASS' : 'FAIL'} - ${R.F.filter(F => F.ok).length} of ${R.F.length}`);
  if (R.S) console.log(`THREAT: ${R.pass ? 'PASS' : 'FAIL'} - ${R.S.filter(F => F.ok).length} of ${R.S.length}${R.S.some(F => F.ok === null) ? `, not judged ${R.S.filter(F => F.ok === null).length}` : ''}`);
  if (R.checks) console.log(`CONTINUOUS: ${R.pass ? 'PASS' : 'FAIL'}`);
  if (R.error) console.log('ERROR ' + R.error);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
})();
