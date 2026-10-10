/* ADAPTED COPY of dev/stage-3c-qa1/lifecycle.js for Stage 3C QA2 - written by dev/stage-3c-qa2/regress/run.js; do not edit by hand.
 *   - helpers from ui_lib_gate.js: each page passes the QA2 boot and its ready gate (one key press, as a player would) before the probe acts on it
 *   - the same default game folder (the repository root) from the copy's location
 */
/* Stage 3C QA1, Q2 - what a menu visitor actually is, measured the same way for any build (development only; never served).
 *
 *   node dev/stage-3c-qa1/lifecycle.js [--game DIR] [--port 9722] [--out FILE.json] [--idle 8]
 *
 * The corrected successor of q0_lifecycle.js (kept as it was, with its Q0 output). Two corrections:
 *   - "avatar drawn" is now the visibility of the visitor's own person object in the world scene (the display object that carries
 *     its beam and its look, found from the world layer's root) and of every container above it. Q0 followed __api.beam(),
 *     which is a plain object with no parent chain, so it always read "drawn"; the Q1 captures are what showed the parent's
 *     visitor standing at the spawn with its flashlight on.
 *   - what the server says about the visitor is read from the admin data the server attaches to its snapshots (msg.ad, every
 *     admin interval) instead of the reply to the admin login, which was taken before the visitor connected.
 * Page B is a player inside Level 0 (test admin, god mode, monsters removed); page A loads the game and stays on the main menu
 * for IDLE seconds, then presses ENTER LEVEL 0. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('./ui_lib_gate.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..', '..')), PORT = +(opt('port') || 9722), OUT = opt('out'), IDLE = +(opt('idle') || 8);
const SELF = () => {
  let root = __api.layer(); while (root.parent) root = root.parent;
  let person = null; const walk = (o, d) => { if (person || d > 6 || !o.children) return; for (const c of o.children) { if (c.beam && c.look === __api.look) { person = c; return; } walk(c, d + 1); } }; walk(root, 0);
  let drawn = null; if (person) { drawn = true; for (let o = person; o; o = o.parent) if (o.visible === false || o.alpha === 0) drawn = false; }
  const sent = (window.__sent || []).map(x => { try { return JSON.parse(x[1]); } catch (e) { return {}; } });
  const lastP = sent.filter(m => m.t === 'p').slice(-1)[0] || null;
  return { started: __api.started(), hideSelf: window.__hideSelf === undefined ? 'undefined' : window.__hideSelf, lightOn: __api.lightOn(), personFound: !!person, avatarDrawn: drawn,
    joinsSent: sent.filter(m => m.t === 'join').length, positionPacketsSent: sent.filter(m => m.t === 'p').length, lastPositionPacketLightBit: lastP ? lastP.l : null,
    net: (document.getElementById('net') || {}).textContent || null, menuConnection: (document.getElementById('mmInside') || {}).textContent || null,
    wsOpen: !!(window.__ws && __ws.readyState === 1), myId: window.__wsTap && __wsTap.id, x: Math.round(__api.H.x), y: Math.round(__api.H.y), stamina: Math.round(__api.H.stamina) };
};
const TAP = () => { if (window.__adTap || !window.__ws) return; window.__adTap = 1; __ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.ad) { window.__ad = m.ad; window.__adAt = Date.now(); } } catch (x) { } }); };
async function server(P, id) {                                             // a fresh admin snapshot from after this call
  await P.evaluate(TAP); const t = Date.now();
  for (let i = 0; i < 40; i++) { const ok = await P.evaluate(t => (window.__adAt || 0) > t, t); if (ok) break; await sleep(150); }
  return P.evaluate(id => { const a = window.__ad, me = a && a.pl && a.pl.find(q => q.id === id);
    return { listed: !!me, active: me ? !!me.a : null, dead: me ? me.d || '' : null, x: me ? me.x : null, y: me ? me.y : null,
      observerNet: (document.getElementById('net') || {}).textContent, observerPeerAvatars: __api.layer().children.filter(c => c.look && c.look !== __api.look).length }; }, id);
}
(async () => {
  const srv = await U.serve(GAME, PORT), b = await U.browser(), room = 'life' + Date.now() % 1e6, R = { game: GAME, idleSeconds: IDLE };
  try {
    const B = await U.page(b, PORT, { room }); await U.start(B.P, 'Observer'); await U.admin(B.P); await H.stage(B.P); await B.P.evaluate(TAP);
    const A = await U.page(b, PORT, { room }); await sleep(IDLE * 1000);
    R.menuVisitor = await A.P.evaluate(SELF);
    R.serverWhileVisitorInMenu = await server(B.P, R.menuVisitor.myId);
    await U.start(A.P, 'Visitor'); await sleep(2500);
    R.afterEnter = await A.P.evaluate(SELF);
    R.serverAfterEnter = await server(B.P, R.menuVisitor.myId);
    R.errors = [...A.errs, ...B.errs];
    await A.ctx.close(); await B.ctx.close();
  } catch (e) { R.error = String(e && e.stack || e); console.log(e); }
  finally { await U.close(b, srv); }
  console.log(JSON.stringify(R, null, 1));
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
})();
