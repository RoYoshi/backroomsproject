/* Stage 3D HQ2 - put players where a test needs them, the server's own way (development only)
 *
 *   node dev/stage-3d-hq2/ws_place.js --port PORT --room ROOM --pass PASS [--clear 1] [--god ID,ID] [--place ID:X:Y,ID:X:Y] [--out FILE.json]
 *
 * A quiet admin connection that never joins the world: it removes the monsters (--clear), puts the given players in god mode (--god;
 * harness only, so no real monster kills a watcher), and moves each player of --place to X,Y with the admin BRING command (the server
 * moves it and tells its client with `tp`; the movement check restarts there).  The test players themselves stay ordinary players, so
 * every step they then take goes through the server's movement checks.  Its own position (not in the world) is set first with a `p`. */
'use strict';
const fs = require('fs');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = { tool: 'dev/stage-3d-hq2/ws_place.js', answers: [] };
const ws = new WebSocket(`ws://127.0.0.1:${ARG.port}/ws?room=${encodeURIComponent(ARG.room)}`);
const tx = o => ws.send(JSON.stringify(o));
ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'ares') out.answers.push(m.msg); };
ws.onopen = async () => {
  tx({ t: 'admin', pass: ARG.pass, quiet: 1 }); await sleep(250);
  if (ARG.clear) { for (let i = 0; i < 6; i++) { tx({ t: 'a', c: 'hounds', mode: 'remove' }); await sleep(40); } for (let i = 0; i < 8; i++) { tx({ t: 'a', c: 'smilers', mode: 'remove' }); await sleep(40); } }
  for (const id of String(ARG.god || '').split(',').filter(Boolean)) { tx({ t: 'a', c: 'god', id: +id }); await sleep(60); }
  for (const s of String(ARG.place || '').split(',').filter(Boolean)) {
    const [id, x, y] = s.split(':').map(Number);
    await sleep(60); tx({ t: 'p', x, y, a: 0, l: 0, k: 'flashlight', n: 'PLACER' }); await sleep(80); tx({ t: 'a', c: 'bring', id }); await sleep(120);
  }
  await sleep(300);
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
  try { ws.close(); } catch (e) { } process.exit(0);
};
setTimeout(() => process.exit(2), 20000);
