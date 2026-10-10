/* Stage 3C QA1, Q0 - what a menu visitor actually is, measured in a browser (development only; never served).
 *
 *   node dev/stage-3c-qa1/q0_lifecycle.js [--game DIR] [--port 9701] [--out FILE.json]
 *
 * Page A loads the game and stays on the main menu (no ENTER) for IDLE seconds; page B is a player inside Level 0 (test admin).
 * Recorded for A while it idles: the game's own hide-self flag, whether its light counts as on, whether its avatar is drawn
 * (the person container's visibility), how many 'join' and position packets it sent, what its connection line says, and what
 * the server's admin snapshot (seen by B) says about A. Then A presses ENTER LEVEL 0 and the same is recorded once more. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('../stage-3c/ui_lib.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PORT = +(opt('port') || 9701), OUT = opt('out'), IDLE = +(opt('idle') || 8);
const SELF = () => {
  const b = window.__api && __api.beam && __api.beam(); let vis = null, n = 0;
  if (b) { vis = true; for (let o = b; o && n < 12; o = o.parent, n++) if (o.visible === false) vis = false; }
  const sent = (window.__sent || []).map(x => { try { return JSON.parse(x[1]).t; } catch (e) { return '?'; } });
  return { started: __api.started(), hideSelf: window.__hideSelf === undefined ? 'undefined' : window.__hideSelf, lightOn: __api.lightOn(), avatarDrawn: vis,
    joinsSent: sent.filter(t => t === 'join').length, positionPacketsSent: sent.filter(t => t === 'p').length, net: (document.getElementById('net') || {}).textContent || null,
    wsOpen: !!(window.__ws && __ws.readyState === 1), myId: window.__wsTap && __wsTap.id };
};
(async () => {
  const srv = await U.serve(GAME, PORT), b = await U.browser(), room = 'q0life' + Date.now() % 1e6, R = { game: GAME, idleSeconds: IDLE };
  try {
    const B = await U.page(b, PORT, { room }); await U.start(B.P, 'Observer'); await U.admin(B.P); await H.stage(B.P);
    const A = await U.page(b, PORT, { room }); await sleep(IDLE * 1000);
    R.menuVisitor = await A.P.evaluate(SELF);
    const seen = async () => { await sleep(1500); return B.P.evaluate(id => { const a = window.__wsTap && __wsTap.admin, me = a && a.pl && a.pl.find(q => q.id === id);
      return { serverSaysActive: me ? !!me.a : null, adminListed: !!me, observerNet: (document.getElementById('net') || {}).textContent,
        observerPeerAvatars: __api.layer().children.filter(c => c.look && c.look !== __api.look).length }; }, R.menuVisitor.myId); };
    R.observerWhileVisitorInMenu = await seen();
    await U.start(A.P, 'Visitor'); await sleep(2500);
    R.afterEnter = await A.P.evaluate(SELF);
    R.observerAfterEnter = await seen();
    R.errors = [...A.errs, ...B.errs];
    await A.ctx.close(); await B.ctx.close();
  } catch (e) { R.error = String(e && e.stack || e); console.log(e); }
  finally { await U.close(b, srv); }
  console.log(JSON.stringify(R, null, 1));
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
})();
