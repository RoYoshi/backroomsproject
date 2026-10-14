/* Stage 3E-0 - one admin command to a room, from a quiet connection that never joins (development only)
 *
 *   node dev/stage-3e-0/ws_admin_once.js --port PORT --room ROOM --pass PASS --cmd '{"c":"world"}'
 *
 * Unlocks admin with the (synthetic) test passcode, sends {t:'a', ...cmd}, prints the server's one-line answer ('ares') and leaves. */
'use strict';
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const ws = new WebSocket(`ws://127.0.0.1:${ARG.port}/ws?room=${encodeURIComponent(ARG.room)}`);
const done = s => { console.log(s); try { ws.close(); } catch (e) { } setTimeout(() => process.exit(0), 50); };
ws.onopen = () => ws.send(JSON.stringify({ t: 'admin', pass: ARG.pass, quiet: 1 }));
ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
  if (m.t === 'admin' && m.ok) ws.send(JSON.stringify(Object.assign({ t: 'a' }, JSON.parse(ARG.cmd))));
  else if (m.t === 'ares') done(JSON.stringify({ ok: m.ok, msg: m.msg })); };
setTimeout(() => done('timeout'), 4000);
