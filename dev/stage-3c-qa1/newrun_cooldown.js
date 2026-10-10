/* Stage 3C QA1, Q5 - a finding about the parent's NEW RUN rule, measured on any build (development only; never served).
 *
 *   node dev/stage-3c-qa1/newrun_cooldown.js [--game DIR] [--port 9755] [--out FILE.json]
 *
 * The server allows one NEW RUN vanish every 30 s (sim.js VANISH_CD; protected and unchanged since Stage 2). The client does not know
 * about the cooldown: a second NEW RUN sooner still plays the vanish and shows the run menu, and END shows the main menu. Meanwhile the
 * server refused the vanish and so the leave, and keeps the wanderer active in the world.
 * Page B is a player inside; page A enters, NEW RUN, SPAWN, then NEW RUN again within the cooldown, then END, and the server's view of A
 * (B's admin snapshots) and B's own count and avatars are read for 8 s. Writes what it saw; no pass / fail: it documents a rule. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('../stage-3c/ui_lib.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PORT = +(opt('port') || 9755), OUT = opt('out');
const TAP = () => { if (window.__adTap || !window.__ws) return; window.__adTap = 1; __ws.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.ad) { window.__ad = m.ad; window.__adAt = Date.now(); } } catch (x) { } }); };
const OBS = async (P, id) => { await P.evaluate(TAP); const t = Date.now(); for (let i = 0; i < 40; i++) { if (await P.evaluate(t => (window.__adAt || 0) > t, t)) break; await sleep(150); }
  return P.evaluate(id => { const a = window.__ad, me = a && a.pl && a.pl.find(q => q.id === id);
    return { serverActive: me ? !!me.a : null, net: (document.getElementById('net') || {}).textContent, peerAvatars: __api.layer().children.filter(c => c.look && c.look !== __api.look).length }; }, id); };
const SELF = () => ({ state: window.__ui ? __ui.state() : (document.getElementById('menu').hidden ? (document.getElementById('runMenu').hidden ? 'play' : 'run') : 'menu'),
  started: __api.started(), hideSelf: window.__hideSelf, sent: (window.__sent || []).map(x => { try { return JSON.parse(x[1]).t; } catch (e) { return '?'; } }).filter(t => t !== 'p') });
const R = { game: GAME, rule: 'sim.js: VANISH_CD = 30 s between NEW RUN vanishes; leave() refuses an alive player without a finished vanish', errors: [] };
(async () => {
  const srv = await U.serve(GAME, PORT), b = await U.browser(), room = 'cd' + Date.now() % 1e6;
  try {
    const B = await U.page(b, PORT, { viewport: { width: 1280, height: 720 }, room }); await U.start(B.P, 'Inside'); await U.admin(B.P); await H.stage(B.P);
    const A = await U.page(b, PORT, { viewport: { width: 1280, height: 720 }, room }); await U.start(A.P, 'Visitor'); await sleep(2500);
    const id = await A.P.evaluate(() => window.__wsTap && __wsTap.id);
    const newRun = async () => { await A.P.keyboard.press('Escape'); await sleep(500); const t = Date.now(); await A.P.click('#reset'); await A.P.waitForFunction(() => !document.getElementById('runMenu').hidden, null, { timeout: 15000 }).catch(() => { }); return t; };
    const t1 = await newRun(); await sleep(1500); const first = { self: await A.P.evaluate(SELF), observer: await OBS(B.P, id) };
    await A.P.click('#runSpawn'); await sleep(2500);
    const t2 = await newRun(); await sleep(1000); await A.P.click('#runEnd'); await sleep(1500);
    const second = { secondsAfterFirstNewRun: +((t2 - t1) / 1000).toFixed(1), self: await A.P.evaluate(SELF), observer: [] };
    for (let i = 0; i < 4; i++) { second.observer.push(await OBS(B.P, id)); await sleep(2000); }
    R.firstNewRun = { state: first.self.state, started: first.self.started, serverActive: first.observer.serverActive, insideSees: first.observer.net, insideAvatars: first.observer.peerAvatars };
    R.secondNewRunWithinCooldownThenEnd = { secondsAfterFirstNewRun: second.secondsAfterFirstNewRun, clientState: second.self.state, clientStarted: second.self.started, clientHideSelf: second.self.hideSelf,
      clientSent: second.self.sent.slice(-6), serverActiveOverNext8s: second.observer.map(o => o.serverActive), insideSees: second.observer.map(o => o.net), insideAvatars: second.observer.map(o => o.peerAvatars) };
    R.summary = `first NEW RUN: server active ${first.observer.serverActive}; second NEW RUN ${second.secondsAfterFirstNewRun} s later, then END: the client is on the ${second.self.state} (not started: ${!second.self.started}), ` +
      `the server keeps it active: ${second.observer.every(o => o.serverActive)}, and the player inside still draws it: ${second.observer.every(o => o.peerAvatars === 1)}`;
    R.errors.push(...A.errs, ...B.errs);
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); }
  finally { await U.close(b, srv); }
  console.log(JSON.stringify(R, null, 1));
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  process.exit(0);
})();
