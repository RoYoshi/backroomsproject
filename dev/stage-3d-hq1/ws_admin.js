/* Stage 3D HQ1 - one admin command, sent a set time after a death begins (development only; the light lifecycle test's precise hand)
 *
 *   node dev/stage-3d-hq1/ws_admin.js --port PORT --room ROOM --pass PASS --victim ID --cmd revive|world --after MS --out FILE.json
 *
 * Opens a WebSocket to the room without joining it, unlocks admin with the (synthetic) test passcode, waits for the replay message of
 * the victim's next death ('fx', which the server sends to every other connection in the same pass as the kill) and, MS milliseconds
 * after it arrives, sends the admin command ('revive' the victim, or 'world': NEW RUN FOR EVERYONE).  A browser page under load can
 * take seconds to act; this does nothing else, so the command lands when it should.  Writes when it saw the death and when it sent the
 * command (Date.now, the same machine clock as the server and the pages) and the server's answer. */
'use strict';
const fs = require('fs');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const out = { tool: 'dev/stage-3d-hq1/ws_admin.js', cmd: ARG.cmd, victim: +ARG.victim, after: +ARG.after, sawDeath: null, de: null, sent: null, answer: null };
const ws = new WebSocket(`ws://127.0.0.1:${ARG.port}/ws?room=${encodeURIComponent(ARG.room)}`);
const finish = () => { try { ws.close(); } catch (e) { } fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n'); process.exit(0); };
ws.onopen = () => ws.send(JSON.stringify({ t: 'admin', pass: ARG.pass, quiet: 1 }));
ws.onmessage = ev => {
  let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
  if (m.t === 'fx' && m.k === 'death' && m.id === out.victim && !out.sawDeath) {
    out.sawDeath = Date.now() / 1000; out.de = m.de;
    setTimeout(() => { ws.send(JSON.stringify(ARG.cmd === 'world' ? { t: 'a', c: 'world' } : { t: 'a', c: 'revive', id: out.victim })); out.sent = Date.now() / 1000; }, out.after);
  } else if (m.t === 'ares' && out.sent) { out.answer = m.msg; setTimeout(finish, 200); }
};
setTimeout(finish, 120000);
