/* Stage 3B - the content hash of the Level 0 presentation authority (development only; never served).
 *
 *   node dev/stage-3b/visuals_hash.js [--write]
 *
 * contentHash = SHA-256 of canonical(definition without its contentHash), the Part 3A Stage B identity scheme (donor
 * 4d1f17a world_geometry.js contentHash; `canonical` is copied from there verbatim, see STAGE_3B_DONOR_LEDGER.md row 2).
 * --write puts the fresh hash into assets/level0_visuals.js. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const FILE = path.join(__dirname, '../../assets/level0_visuals.js');
/* donor 4d1f17a world_geometry.js canonical() - copied verbatim */
function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
function contentHash(def) { const { contentHash: _, ...data } = def; return crypto.createHash('sha256').update(canonical(data), 'utf8').digest('hex'); }
function load() { delete require.cache[require.resolve(FILE)]; return require(FILE).definition; }
if (require.main === module) {
  const d = load(), h = contentHash(d);
  console.log(JSON.stringify({ assetId: d.assetId, revision: d.revision, recorded: d.contentHash, computed: h, match: d.contentHash === h }));
  if (process.argv.includes('--write') && d.contentHash !== h) {
    const src = fs.readFileSync(FILE, 'utf8'), out = src.replace(/contentHash: '[0-9a-f]{64}'/, `contentHash: '${h}'`);
    if (out === src) { console.error('contentHash line not found'); process.exit(1); }
    fs.writeFileSync(FILE, out); console.log('written');
  }
}
module.exports = { canonical, contentHash, load };
