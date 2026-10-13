/* Stage 3D HQ2 - a TCP proxy that adds lag, for a real browser page (development only)
 *
 *   node dev/stage-3d-hq2/lag_proxy.js --listen PORT --to PORT --ms N
 *
 * Everything a page loads and says through http://127.0.0.1:LISTEN/ reaches the game server on TO, and everything back, N milliseconds
 * late in each direction (the page's WebSocket is opened to the host it was loaded from, so it goes through here too).  Order is kept:
 * every chunk waits the same N ms.  Prints "ready" when listening; stops on SIGTERM. */
'use strict';
const net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const TO = +ARG.to, MS = +(ARG.ms || 0);
const later = (sock, d) => { if (MS) setTimeout(() => { if (!sock.destroyed) sock.write(d); }, MS); else sock.write(d); };
const srv = net.createServer(c => {
  const s = net.connect(TO, '127.0.0.1'); c.setNoDelay(true); s.setNoDelay(true);
  c.on('data', d => later(s, d)); s.on('data', d => later(c, d));
  const end = () => { setTimeout(() => { c.destroy(); s.destroy(); }, MS + 5); };
  c.on('close', end); s.on('close', end); c.on('error', end); s.on('error', end);
});
srv.listen(+ARG.listen, '127.0.0.1', () => console.log('ready'));
process.on('SIGTERM', () => process.exit(0));
