/* Stage 3D HQ2 - a quiet observer of a room, for the browser tests (development only)
 *
 *   node dev/stage-3d-hq2/ws_watch.js --port PORT --room ROOM --pass PASS --secs S --out FILE.json
 *
 * Opens a WebSocket to the room without joining it, unlocks admin with the (synthetic) test passcode so the server's snapshots carry its
 * own player list (`ad.pl`: id, active, dead, x, y), and records for S seconds, with Date.now() arrival times (the same machine clock as
 * the server and the pages): every player-list snapshot, every `fx` (deaths, vanishings and any later NEW RUN event), every `bodies`
 * version (records summarised) and any other message.  It sends nothing else, so it never changes what it watches. */
'use strict';
const fs = require('fs');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const out = { tool: 'dev/stage-3d-hq2/ws_watch.js', room: ARG.room, startedAt: Date.now() / 1000, pl: [], fx: [], bodies: [], other: [] };
const ws = new WebSocket(`ws://127.0.0.1:${ARG.port}/ws?room=${encodeURIComponent(ARG.room)}`);
const finish = () => { try { ws.close(); } catch (e) { } fs.writeFileSync(ARG.out, JSON.stringify(out) + '\n'); process.exit(0); };
ws.onopen = () => ws.send(JSON.stringify({ t: 'admin', pass: ARG.pass, quiet: 1 }));
ws.onmessage = ev => {
  let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
  const t = +(Date.now() / 1000).toFixed(3);
  if (m.t === 's') { if (m.ad) out.pl.push([t, m.ad.pl.map(p => [p.id, p.a, p.d ? 1 : 0, p.x, p.y])]); }
  else if (m.t === 'fx') out.fx.push(Object.assign({ at: t }, m, { lk: undefined, ep: undefined }));
  else if (m.t === 'bodies') out.bodies.push({ at: t, v: m.v, b: (m.b || []).map(b => ({ k: b.k, c: b.c, x: b.x, y: b.y, de: b.de, lo: b.lo })) });
  else if (m.t !== 'pong' && m.t !== 'hi') out.other.push(Object.assign({ at: t }, m));
};
process.on('SIGTERM', finish);
setTimeout(finish, (+ARG.secs || 60) * 1000);
