/* dev/tools/lineage/recorded.js - the compiled client as the lineage records it: B++'s bytes (development only; Stage 3H continuation C4b).
 *
 *   const { recorded } = require('dev/tools/lineage/recorded.js');  recorded('bundle') / recorded('css') -> Buffer
 *
 * Until continuation C4a the page was served public/assets/index-DKbV5Nv9.js and index-D7hdwmUU.css as the client lineage replays them:
 * the v11 build output and its recorded steps (src/core/client/bundle/lineage/ledger.json), the bytes B++ shipped.  Since C4b the served
 * files are built from the maintained TypeScript in src/core/client/game/: the same program (dev/stage-3h-modernization/tools/
 * c4_alpha_all.mjs) and the same behaviour (dev/tools/gate/golden/bundle_diff.js), minified again, so their text is not B++'s.  A test
 * that reads the compiled client's text - a marker in its minified code, or B++'s level and light code cut out of it to run as the
 * game's own implementation - reads it here: the replay, every step checked by its SHA-256, ending at the recorded result. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const REPO = path.resolve(__dirname, '..', '..', '..'), LIN = path.join(REPO, 'src', 'core', 'client', 'bundle', 'lineage');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const cache = new Map();
function recorded(key) {
  if (cache.has(key)) return cache.get(key);
  const F = JSON.parse(fs.readFileSync(path.join(LIN, 'ledger.json'), 'utf8')).files[key];
  if (!F || key === 'html') throw new Error(`recorded(${JSON.stringify(key)}): 'bundle' or 'css'`);
  let cur = fs.readFileSync(path.join(REPO, F.base.path)); if (sha(cur) !== F.base.sha256) throw new Error(`the ${key} lineage base is not the recorded file`);
  for (const st of F.steps) {
    const P = JSON.parse(fs.readFileSync(path.join(LIN, st.patch), 'utf8')); if (P.before.sha256 !== sha(cur)) throw new Error(`${st.id} was not made on the version before it`);
    const parts = []; let pos = 0;
    for (const [at, del, ins] of P.hunks) { const d = Buffer.from(del, 'utf8'); if (!cur.subarray(at, at + d.length).equals(d)) throw new Error(`${st.id}: a hunk does not match`); parts.push(cur.subarray(pos, at), Buffer.from(ins, 'utf8')); pos = at + d.length; }
    parts.push(cur.subarray(pos)); cur = Buffer.concat(parts); if (sha(cur) !== P.after.sha256) throw new Error(`${st.id} did not give the recorded bytes`);
  }
  if (sha(cur) !== F.result.sha256) throw new Error(`the ${key} replay did not end at the recorded result`);
  cache.set(key, cur); return cur;
}
module.exports = { recorded };
