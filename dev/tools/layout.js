/* dev/tools/layout.js - where the game's files are, for development tools and tests (development only; zero dependencies).
 *
 * Stage 3H's engine modernization moved every runtime file from the repository root to its owner (src/), the web root to public/, and
 * the files the server loads that are assembled from parts to generated/server/.  Tests and tools that used to read "mp.js" or require
 * "sim.js" at the root ask this module instead, so they keep working on the new layout - and on an old-layout tree too (a B++ or
 * Stage 3H2 export), which is how the gate compares the two.
 *
 *   const L = require('<path>/dev/tools/layout.js');
 *   L.at('mp.js')          absolute path of what was <root>/mp.js in this repository (the built file the browser gets: public/mp.js)
 *   L.at('sim.js')         ... generated/server/sim.js (what the server loads)
 *   L.at('server/ws.js')   ... src/frameworks/bpp/server/ws.js
 *   L.at('dev/ents_src/10_hound.js')   ... src/frameworks/br-r/client/ents.hound.js (a part's canonical source)
 *   L.forTree(dir)         the same API for another game folder (an export); detects the old layout and maps names to themselves
 *   L.isModern(dir)        true when dir has the public/ web root
 *   L.webRoot(dir)         the folder the server serves (dir/public, or dir itself on the old layout)
 * A name the map does not know is returned as <root>/<name> (an unmoved file such as server.js or a dev/ path). */
'use strict';
const fs = require('fs'), path = require('path');
const F = 'src/frameworks';
/* the old root-relative name -> its path in the modern layout */
const MAP = {
  /* served to browsers: the built files and the static files, by URL path */
  'index.html': 'public/index.html', 'favicon.ico': 'public/favicon.ico',
  'camera_policy.js': 'public/camera_policy.js', 'timing_policy.js': 'public/timing_policy.js', 'move.js': 'public/move.js',
  'camcorder.js': 'public/camcorder.js', 'sfx.js': 'public/sfx.js', 'gore.js': 'public/gore.js', 'light.js': 'public/light.js', 'ents.js': 'public/ents.js',
  'glitch.js': 'public/glitch.js', 'mp.js': 'public/mp.js', 'hud.js': 'public/hud.js', 'inventory.js': 'public/inventory.js',
  /* loaded by the server as well as served: the server's copy (byte-identical to the served one: both are built from the same parts) */
  'world.js': 'generated/server/world.js', 'dphys.js': 'generated/server/dphys.js',
  /* loaded by the server only */
  'sim.js': 'generated/server/sim.js', 'ai.js': 'generated/server/ai.js', 'death_srv.js': `${F}/gib/server/death_srv.js`,
  'server/newrun.js': `${F}/bpp/server/newrun.js`, 'server/aftermath.js': `${F}/gib/server/aftermath.js`, 'server/peers.js': `${F}/space/server/peers.js`,
  'server/ws.js': `${F}/bpp/server/ws.js`, 'server/fields.js': `${F}/ward/server/fields.js`, 'server/static.js': `${F}/ward/server/static.js`,
  /* the old development sources of the assembled files -> their canonical parts */
  'dev/sim_glue.js': 'src/core/server/sim.glue.js',
  'dev/ents_src/00_head.js': `${F}/br-r/client/ents.head.js`, 'dev/ents_src/10_hound.js': `${F}/br-r/client/ents.hound.js`, 'dev/ents_src/20_smiler.js': `${F}/br-r/client/ents.smiler.js`,
  'dev/ents_src/25_death.js': `${F}/gib/client/ents.death.js`, 'dev/ents_src/30_audio.js': `${F}/spacious-audio/client/ents.audio.js`, 'dev/ents_src/40_debug.js': `${F}/overseer/client/ents.debug.js`,
};
for (const n of ['00_head', '10_geo', '20_senses', '22_intelligence', '25_light', '30_entity', '40_capture', '50_hound', '60_smiler', '90_engine']) MAP[`dev/ai_src/${n}.js`] = `${F}/nani/server/ai.${n.slice(3)}.js`;
const isModern = dir => fs.existsSync(path.join(dir, 'public', 'index.html'));
function forTree(dir) {
  dir = path.resolve(dir);
  const modern = isModern(dir);
  const rel = name => {
    const n = String(name).replace(/^\.?\/+/, '');
    if (!modern) return n;
    if (MAP[n]) return MAP[n];
    if (/^(assets|sounds)\//.test(n)) return 'public/' + n;                 // every assets/ and sounds/ URL is served from public/
    return n;
  };
  return {
    root: dir, modern, rel,
    at: name => path.join(dir, rel(name)),
    webRoot: () => modern ? path.join(dir, 'public') : dir,
    /* the server-side runtime files of this tree, relative paths: what a copy of "the server" must contain to run */
    serverFiles() {
      if (!modern) return ['server.js', 'sim.js', 'ai.js', 'world.js', 'death_srv.js', 'dphys.js', ...fs.readdirSync(path.join(dir, 'server')).filter(f => f.endsWith('.js')).map(f => 'server/' + f)];
      const walk = d => fs.readdirSync(path.join(dir, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
      return ['server.js', ...walk('generated'), ...walk('src')].filter(f => /\.(js|json)$/.test(f)).map(f => f.split(path.sep).join('/'));
    },
  };
}
const self = forTree(path.resolve(__dirname, '..', '..'));
module.exports = Object.assign({ forTree, isModern, MAP, webRoot: dir => forTree(dir).webRoot() }, { root: self.root, at: self.at, rel: self.rel, modern: self.modern, serverFiles: self.serverFiles });
