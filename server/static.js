/* server/static.js - the static file serving of server.js.
 *
 * Stage 3H0: moved out of server.js without a change.  createStatic(ROOT) returns the request handler server.js gives http.createServer:
 *   - the path is decoded (a malformed escape or a NUL gives 400), '/' means index.html, and it is joined to ROOT and normalized;
 *   - /sounds and /sounds/ list the audio files in ROOT/sounds as JSON; /sounds/<file> serves one of them, cached for 5 minutes;
 *   - anything else is served only when it is inside ROOT and the SERVE allowlist names it, otherwise 404;
 *   - code is never cached, PNG images for a day; everything but PNG is gzipped when the client accepts gzip, and each gzipped copy is
 *     kept for the life of the process.
 * ROOT is the folder server.js lives in, passed in because this file lives one level below it.  Nothing is done at load but defining the
 * constants and the gzip cache.  Never served: SERVE does not reach this folder. */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const gz = new Map();
const SERVE = /^\/(index\.html|camera_policy\.js|timing_policy\.js|world\.js|move\.js|ents\.js|mp\.js|hud\.js|gore\.js|dphys\.js|light\.js|glitch\.js|camcorder\.js|inventory\.js|sfx\.js|assets\/[\w.\-]+)$/;   // never serve server.js / sim.js.  Stage 3B-N: camera_policy.js and timing_policy.js are client policies index.html loads (they were missing here, so the client ran on its fallbacks)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

module.exports = ROOT => (req, res) => {
  let u;
  try { u = decodeURIComponent(String(req.url || '/').split('?')[0]); }
  catch (e) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('Bad request'); }       // malformed %-escapes (e.g. "/%"): refuse, never crash
  if (u.includes('\0')) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('Bad request'); }
  if (u === '/') u = '/index.html';
  const f = path.join(ROOT, path.normalize(u));
  // drop-in custom sounds: any files in ./sounds are listed and served (see sounds/README.txt)
  const AUDIO = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.webm': 'audio/webm' };
  if (u === '/sounds' || u === '/sounds/') {
    let l = []; try { l = fs.readdirSync(path.join(ROOT, 'sounds')).filter(n => AUDIO[path.extname(n).toLowerCase()]); } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(l));
  }
  if (/^\/sounds\/[\w.\- ]+$/.test(u) && AUDIO[path.extname(u).toLowerCase()] && f.startsWith(path.join(ROOT, 'sounds'))) {
    return fs.readFile(f, (e, b) => {
      if (e) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': AUDIO[path.extname(f).toLowerCase()], 'Cache-Control': 'public, max-age=300', 'Content-Length': b.length }); res.end(b);
    });
  }
  if (!f.startsWith(ROOT) || !SERVE.test(u)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(f), h = { 'Content-Type': types[ext] || 'application/octet-stream', 'Vary': 'Accept-Encoding' };
    // code is never cached (the bundle keeps the same file name across versions); the big texture may be
    h['Cache-Control'] = ext === '.png' ? 'public, max-age=86400' : 'no-store';
    if (ext !== '.png' && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      let z = gz.get(f); if (!z) { z = zlib.gzipSync(b, { level: 9 }); gz.set(f, z); }
      h['Content-Encoding'] = 'gzip'; res.writeHead(200, h); return res.end(z);
    }
    res.writeHead(200, h); res.end(b);
  });
};
