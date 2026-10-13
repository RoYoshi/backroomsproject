/* Stage 3D HQ2 - the admin world reset, sent a set time after a death or a NEW RUN blast begins; and what the server then says (development only)
 *
 *   node dev/stage-3d-hq2/ws_reset.js --port PORT --room ROOM --pass PASS --victim ID --kind death|boom --after MS --out FILE.json
 *
 * dev/stage-3d-hq1/ws_admin.js's precise hand, for HQ2: a WebSocket to the room that never joins, unlocks admin with the synthetic
 * passcode, waits for the replay message of the victim's next death (kind death) or NEW RUN blast (kind boom) and, MS milliseconds after
 * it arrives, sends WORLD (NEW RUN FOR EVERYONE).  Records (Date.now: the machine clock the server and the pages share): when it saw the
 * event, its id and world; when it sent the reset; and every message the server sent it from then on for 3 s - the 'world' message, the
 * 'end' of each event in progress, and anything that still names the old world (there must be none).  0.15 s after the reset it removes
 * the new world's monsters (a reset brings new ones; a kill by one would be another test). */
'use strict';
const fs = require('fs');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const out = { tool: 'dev/stage-3d-hq2/ws_reset.js', kind: ARG.kind || 'death', victim: +ARG.victim, after: +ARG.after, sawEvent: null, de: null, w0: null, sent: null, answer: null, after3s: [] };
const ws = new WebSocket(`ws://127.0.0.1:${ARG.port}/ws?room=${encodeURIComponent(ARG.room)}`);
const finish = () => { try { ws.close(); } catch (e) { } fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n'); process.exit(0); };
ws.onopen = () => ws.send(JSON.stringify({ t: 'admin', pass: ARG.pass, quiet: 1 }));
ws.onmessage = ev => {
  let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
  const t = Date.now() / 1000;
  if (out.sent && t < out.sent + 3) { if (m.t !== 's' && m.t !== 'pong') out.after3s.push({ at: +(t - out.sent).toFixed(3), t: m.t, k: m.k, id: m.id, de: m.de, w: m.w, x: m.x, y: m.y, n: m.b ? m.b.length : undefined, msg: m.msg }); else if (m.t === 's') out.snapW = Math.max(out.snapW || 0, m.w); }
  if (m.t === 'fx' && m.k === out.kind && m.id === out.victim && !out.sawEvent) {
    out.sawEvent = t; out.de = m.de; out.w0 = m.w;
    setTimeout(() => {
      ws.send(JSON.stringify({ t: 'a', c: 'world' })); out.sent = Date.now() / 1000; setTimeout(finish, 3200);
      setTimeout(() => { for (let i = 0; i < 6; i++) ws.send(JSON.stringify({ t: 'a', c: 'hounds', mode: 'remove' })); for (let i = 0; i < 8; i++) ws.send(JSON.stringify({ t: 'a', c: 'smilers', mode: 'remove' })); }, 150);   // (the new world's monsters: none of this test's business)
    }, out.after);
  } else if (m.t === 'ares' && out.sent && !out.answer) out.answer = m.msg;          // (the reset's own answer: the first after it)
};
setTimeout(finish, 120000);
