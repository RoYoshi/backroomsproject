/* Stage 3C QA1, Q2 - the menu / run boundary (development only; never served).
 *
 *   node dev/stage-3c-qa1/probe_q2.js [--game DIR] [--port 9721] [--out FILE.json] [--idle 8]
 *
 * Two pages in one room: B is a player inside Level 0 (the retained suites' test admin, god mode, monsters removed); A loads the
 * game and stays on the main menu. Checked for A before ENTER LEVEL 0: not started, the game's hide-self state on, its light not
 * shining, its wanderer not drawn, no join sent, held movement keys move nothing and spend no stamina, the server lists it as
 * not in the world, B counts only itself and draws no avatar for it, and a Hound let loose on A's spot never catches it.
 * Then: ENTER LEVEL 0 -> exactly one join, A drawn with its light, B sees it, A walks; NEW RUN -> the run menu hides A and B
 * stops counting it; SPAWN -> one join; NEW RUN -> END -> the menu is clean again; ENTER -> one join; caught by a Hound ->
 * RESPAWN -> back in the run (a respawn, not a join), drawn. Exit 0 when every check passes. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('../stage-3c/ui_lib.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PORT = +(opt('port') || 9721), OUT = opt('out'), IDLE = +(opt('idle') || 8);
const R = { game: GAME, idleSeconds: IDLE, checks: [], errors: [], notes: {} };
const check = (name, ok, note) => { R.checks.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + JSON.stringify(note).slice(0, 700) : '')); };
const adm = (P, o) => P.evaluate(o => { const ws = window.__ws; if (ws && ws.readyState === 1) { ws.send(JSON.stringify(Object.assign({ t: 'a' }, o))); return true; } return false; }, o);
/* the visitor's own person in the world scene (the display object with its beam and look) and every container above it
   (lifecycle.js explains why this replaces Q0's beam-chain reading) */
const SELF = () => {
  let root = __api.layer(); while (root.parent) root = root.parent;
  let person = null; const walk = (o, d) => { if (person || d > 6 || !o.children) return; for (const c of o.children) { if (c.beam && c.look === __api.look) { person = c; return; } walk(c, d + 1); } }; walk(root, 0);
  let vis = null; if (person) { vis = true; for (let o = person; o; o = o.parent) if (o.visible === false || o.alpha === 0) vis = false; }
  const sent = (window.__sent || []).map(x => { try { return JSON.parse(x[1]).t; } catch (e) { return '?'; } });
  const A = __api;
  return { started: A.started(), hideSelf: window.__hideSelf === undefined ? 'undefined' : window.__hideSelf, lightOn: A.lightOn(), avatarDrawn: vis,
    joins: sent.filter(t => t === 'join').length, respawns: sent.filter(t => t === 'respawn').length, positionPackets: sent.filter(t => t === 'p').length,
    x: Math.round(A.H.x), y: Math.round(A.H.y), stamina: Math.round(A.H.stamina), caught: !!A.G.caught, state: window.__ui && __ui.state(), net: (document.getElementById('net') || {}).textContent,
    railInside: (document.getElementById('mmInside') || {}).textContent, myId: window.__wsTap && __wsTap.id };
};
/* what the server says: the admin data it attaches to its snapshots (taken fresh, after the call) */
const TAP = () => { if (window.__adTap || !window.__ws) return; window.__adTap = 1; __ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.ad) { window.__ad = m.ad; window.__adAt = Date.now(); } } catch (x) { } }); };
const OBS = async (P, id) => { await P.evaluate(TAP); const t = Date.now(); for (let i = 0; i < 40; i++) { if (await P.evaluate(t => (window.__adAt || 0) > t, t)) break; await sleep(150); }
  return P.evaluate(id => { const a = window.__ad, me = a && a.pl && a.pl.find(q => q.id === id);
  return { serverActive: me ? !!me.a : null, serverDead: me ? me.d || '' : null, listed: !!me, net: (document.getElementById('net') || {}).textContent,
    peerAvatars: __api.layer().children.filter(c => c.look && c.look !== __api.look).length }; }, id); };
/* the observer's view once it shows what is expected (a fresh admin snapshot each try, up to 10 s): on this software renderer a
   page's messages can queue for seconds behind slow frames, so one snapshot can still be an old one. waitedMs is recorded. */
const OBSUNTIL = async (P, id, ok) => { const t0 = Date.now(); let o; do { o = await OBS(P, id); if (ok(o)) break; await sleep(300); } while (Date.now() - t0 < 10000); return Object.assign(o, { waitedMs: Date.now() - t0 }); };
const OUT_OF_WORLD = o => o.serverActive === false && /· 1 WANDERER\b/.test(o.net) && o.peerAvatars === 0;
(async () => {
  const srv = await U.serve(GAME, PORT), b = await U.browser(), room = 'q2gate' + Date.now() % 1e6;
  try {
    const B = await U.page(b, PORT, { room }); await U.start(B.P, 'Observer'); await U.admin(B.P); await H.stage(B.P);
    const A = await U.page(b, PORT, { room }); await sleep(IDLE * 1000);
    const a0 = await A.P.evaluate(SELF); await sleep(1500); const o0 = await OBS(B.P, a0.myId);
    R.notes.menuVisitor = a0; R.notes.observerWhileVisitorInMenu = o0;
    check(`after ${IDLE} s on the menu: not started, the game's hide-self state on, its light not shining, its wanderer not drawn, no join sent`,
      !a0.started && a0.hideSelf === true && a0.lightOn === false && a0.avatarDrawn === false && a0.joins === 0, a0);
    check('the server lists the visitor as not in the world; the player inside counts only itself and draws no avatar for it; the visitor\'s menu counts the one wanderer inside',
      o0.listed && o0.serverActive === false && /· 1 WANDERER\b/.test(o0.net) && o0.peerAvatars === 0 && /^One other wanderer/.test(a0.railInside), { o0, railInside: a0.railInside });
    // held movement keys on the menu move nothing and spend no stamina
    await A.P.evaluate(() => document.activeElement && document.activeElement.blur());
    await A.P.keyboard.down('KeyD'); await A.P.keyboard.down('ShiftLeft'); await sleep(1500); await A.P.keyboard.up('ShiftLeft'); await A.P.keyboard.up('KeyD');
    const a1 = await A.P.evaluate(SELF);
    check('held D + Shift on the menu: the wanderer does not move and spends no stamina', a1.x === a0.x && a1.y === a0.y && a1.stamina === a0.stamina && !a1.started, { before: [a0.x, a0.y, a0.stamina], after: [a1.x, a1.y, a1.stamina] });
    // a Hound loose on the visitor's spot (B goes there in god mode, places it, lets the halls run) never catches the visitor
    await B.P.evaluate(([x, y]) => __api.tp(x, y), [a0.x, a0.y]); await sleep(1200);   // B (an admin: the server takes its position as sent) stands there
    const bAt = await B.P.evaluate(() => [Math.round(__api.H.x), Math.round(__api.H.y)]); R.notes.observerMovedTo = bAt;
    await adm(B.P, { c: 'freeze', on: 0 }); await adm(B.P, { c: 'near', k: 'hound' }); await adm(B.P, { c: 'near', k: 'smiler' }); await sleep(400);
    await adm(B.P, { c: 'summon' });                                       // the nearest Hound dropped a short way from this spot, on the trail
    let minD = 1e9, caughtSeen = false, sampled = 0;
    for (let k = 0; k < 40; k++) {
      const d = await B.P.evaluate(([x, y]) => Math.min(1e9, ...(window.__hounds || []).filter(Boolean).map(o => Math.hypot(o.x - x, o.y - y)), ...__api.q.filter(o => o && !o.off).map(o => Math.hypot(o.x - x, o.y - y))), [a0.x, a0.y]);
      minD = Math.min(minD, d); sampled++;
      const s = await A.P.evaluate(() => ({ c: !!__api.G.caught, cv: !document.getElementById('caught').hidden })); if (s.c || s.cv) caughtSeen = true;
      await sleep(250);
    }
    const o1 = await OBS(B.P, a0.myId), a2 = await A.P.evaluate(SELF);
    await H.stage(B.P);                                                     // monsters removed and the halls frozen again
    check('a Hound summoned onto the visitor\'s spot and a Smiler nearby, loose for 10 s (closer than a Hound sees): the visitor is never caught (the server keeps it out of the world)',
      !caughtSeen && !a2.caught && o1.serverActive === false && !o1.serverDead && minD < 620, { minDistanceToVisitorSpot: Math.round(minD), observerAt: bAt, visitorSpot: [a0.x, a0.y], samples: sampled, server: o1 });
    // ENTER LEVEL 0: exactly one start / join; drawn, lit, seen; walks
    await U.start(A.P, 'Visitor'); await sleep(2500);
    await U.admin(A.P); await adm(A.P, { c: 'god', id: a0.myId }); await sleep(900);
    const a3 = await A.P.evaluate(SELF), o3 = await OBSUNTIL(B.P, a0.myId, o => o.serverActive === true && /· 2 WANDERERS\b/.test(o.net) && o.peerAvatars === 1);
    await A.P.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await A.P.keyboard.down('KeyD'); await sleep(1200); await A.P.keyboard.up('KeyD'); await sleep(300);
    const a4 = await A.P.evaluate(SELF);
    check('ENTER LEVEL 0: exactly one join; the wanderer is drawn with its light; the player inside counts and draws it; it walks',
      a3.started && a3.joins === 1 && a3.hideSelf === false && a3.lightOn === true && a3.avatarDrawn === true && o3.serverActive === true && /· 2 WANDERERS\b/.test(o3.net) && o3.peerAvatars === 1 && Math.hypot(a4.x - a3.x, a4.y - a3.y) > 40,
      { a3, o3, walked: Math.round(Math.hypot(a4.x - a3.x, a4.y - a3.y)) });
    // NEW RUN -> the run menu (not in the world) -> SPAWN (one join)
    await A.P.keyboard.press('Escape'); await sleep(500); const vanish1 = Date.now(); await A.P.click('#reset'); await A.P.waitForFunction(() => __ui.state() === 'run', null, { timeout: 15000 }).catch(() => { });
    await sleep(1800); const a5 = await A.P.evaluate(SELF), o5 = await OBSUNTIL(B.P, a0.myId, OUT_OF_WORLD);
    await A.P.click('#runSpawn'); await sleep(2200); const a6 = await A.P.evaluate(SELF);
    check('NEW RUN: the run menu hides the wanderer and the player inside stops counting it; SPAWN starts exactly one new run, drawn again',
      a5.state === 'run' && !a5.started && a5.hideSelf === true && a5.avatarDrawn === false && o5.serverActive === false && /· 1 WANDERER\b/.test(o5.net) && o5.peerAvatars === 0
      && a6.started && a6.joins === a5.joins + 1 && a6.avatarDrawn === true && a6.hideSelf === false, { a5: [a5.state, a5.started, a5.hideSelf, a5.avatarDrawn], o5, a6: [a6.started, a6.joins, a6.avatarDrawn] });
    // NEW RUN -> END: the menu is clean; ENTER: one join
    // the server allows one NEW RUN vanish every 30 s (sim.js VANISH_CD, unchanged since Stage 2): a second NEW RUN sooner is refused
    // by the server (the wanderer stays in the world) - the parent's rule, measured separately by newrun_cooldown.js. Wait it out, with a
    // margin: the server starts its 30 s when the vanish reaches it, which on this slow renderer can be seconds after the click.
    const cdWait = Math.max(0, vanish1 + 40000 - Date.now()); R.notes.newRunCooldownWaitMs = cdWait; await sleep(cdWait);
    await A.P.keyboard.press('Escape'); await sleep(500); await A.P.click('#reset'); await A.P.waitForFunction(() => __ui.state() === 'run', null, { timeout: 15000 }).catch(() => { });
    await A.P.click('#runEnd'); await sleep(1500);
    const a7 = await A.P.evaluate(SELF), o7 = await OBSUNTIL(B.P, a0.myId, OUT_OF_WORLD);
    await U.start(A.P, 'Visitor'); await sleep(2000); const a8 = await A.P.evaluate(SELF);
    check('END returns to a clean menu (not started, hidden, unlit, not counted); ENTER LEVEL 0 again: exactly one join',
      a7.state === 'menu' && !a7.started && a7.hideSelf === true && a7.lightOn === false && a7.avatarDrawn === false && o7.serverActive === false && /· 1 WANDERER\b/.test(o7.net)
      && a8.started && a8.joins === a7.joins + 1 && a8.avatarDrawn === true, { a7: [a7.state, a7.started, a7.hideSelf, a7.lightOn, a7.avatarDrawn], o7, a8: [a8.started, a8.joins - a7.joins, a8.avatarDrawn] });
    // caught -> RESPAWN: back in the run (a respawn, not a join), drawn
    await adm(A.P, { c: 'god', id: a0.myId }); await sleep(600);                   // god off (the command toggles; confirmed from the server)
    await A.P.evaluate(TAP); const t9 = Date.now(); for (let i = 0; i < 40; i++) { if (await A.P.evaluate(t => (window.__adAt || 0) > t, t9)) break; await sleep(150); }
    const godNow = await A.P.evaluate(id => { const a = window.__ad, me = a && a.pl && a.pl.find(q => q.id === id); return me ? me.g : null; }, a0.myId);
    if (godNow) { await adm(A.P, { c: 'god', id: a0.myId }); await sleep(900); }
    await adm(A.P, { c: 'freeze', on: 0 }); await adm(A.P, { c: 'near', k: 'hound' }); await adm(A.P, { c: 'summon' });
    let caught = false; for (let k = 0; k < 120 && !caught; k++) { await sleep(500); caught = await A.P.evaluate(() => !document.getElementById('caught').hidden); }
    const a9 = await A.P.evaluate(SELF);
    if (caught) { await sleep(800); await A.P.click('#retry'); await sleep(2500); }
    const a10 = await A.P.evaluate(SELF);
    await H.stage(B.P);
    check('caught by a Hound -> RESPAWN: back in the run by a respawn (no extra join), the wanderer drawn and lit', caught && a10.started && !a10.caught && a10.respawns === a9.respawns + 1 && a10.joins === a9.joins && a10.avatarDrawn === true && a10.hideSelf === false,
      { caught, before: [a9.joins, a9.respawns], after: [a10.started, a10.caught, a10.joins, a10.respawns, a10.avatarDrawn, a10.hideSelf] });
    R.errors.push(...A.errs.map(e => 'A: ' + e), ...B.errs.map(e => 'B: ' + e));
    await A.ctx.close(); await B.ctx.close();
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); console.log(e); }
  finally { await U.close(b, srv); }
  check('no page errors', !R.errors.length, R.errors);
  R.ok = R.checks.every(c => c.ok);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  console.log(R.ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
  process.exit(R.ok ? 0 : 1);
})();
