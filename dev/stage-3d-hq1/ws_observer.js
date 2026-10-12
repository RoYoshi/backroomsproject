/* Stage 3D HQ1 - a quiet observer of a room's death messages, for the light timeline's reference clock (development only)
 *
 *   node dev/stage-3d-hq1/ws_observer.js --port PORT --room ROOM --out FILE.json
 *
 * Opens a WebSocket to the room and never joins it (no player, no avatar: like a page still at the name prompt, it is sent the room's
 * replays, corpses and snapshots).  It does nothing else, so it handles each message within a millisecond of its arrival, on the same
 * machine clock (Date.now) as the server and the test's browser pages.  Logged: every death replay ('fx': id, death id, el, lf), every
 * corpse list ('bodies': death id, age ag, lf), and the first snapshot carrying each kill record (with the snapshot clock st).  Written to
 * FILE when the process is told to stop (SIGTERM / SIGINT) or after 30 minutes. */
'use strict';
const fs = require('fs');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const out = { tool: 'dev/stage-3d-hq1/ws_observer.js', room: ARG.room, opened: null, fx: [], bodies: [], snaps: 0, firstSnap: null, errors: [] };
const ws = new WebSocket(`ws://127.0.0.1:${ARG.port}/ws?room=${encodeURIComponent(ARG.room)}`);
ws.onopen = () => { out.opened = Date.now() / 1000; };
ws.onerror = e => out.errors.push(String(e && e.message || e));
ws.onmessage = ev => {
  const at = Date.now() / 1000; let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
  if (m.t === 'fx' && m.k === 'death') out.fx.push({ at, id: m.id, de: m.de, el: m.el == null ? null : m.el, lf: m.lf || null, lo: m.lo, c: m.c, v: m.v, ek: m.ek });
  else if (m.t === 'bodies') out.bodies.push({ at, b: (m.b || []).map(b => ({ k: b.k, de: b.de, ag: b.ag, lf: b.lf || null, c: b.c })) });
  else if (m.t === 's') { out.snaps++; if (!out.firstSnap && m.e) out.firstSnap = { at, st: m.e.st }; }
};
let done = false;
const finish = () => { if (done) return; done = true; try { ws.close(); } catch (e) { } fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n'); process.exit(0); };
process.on('SIGTERM', finish); process.on('SIGINT', finish); setTimeout(finish, 30 * 60 * 1000);
