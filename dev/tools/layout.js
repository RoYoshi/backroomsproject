/* dev/tools/layout.js - where the game's files are, for development tools and tests (development only; zero dependencies).
 *
 * Stage 3H's engine modernization moved every runtime file from the repository root to its owner (src/), the web root to public/, and
 * the files the server loads that are assembled from parts to generated/server/.  Tests and tools that used to read "mp.js" or require
 * "sim.js" at the root ask this module instead, so they keep working on the new layout - and on an old-layout tree too (a B++ or
 * Stage 3H2 export), which is how the gate compares the two.
 *
 *   const L = require('<path>/dev/tools/layout.js');
 *   L.at('mp.js')          absolute path of what was <root>/mp.js in this repository (the built file the browser gets: public/mp.js)
 *   L.at('sim.js')         ... src/core/server/sim.js (the sim's composition, which the server requires; continuation C3)
 *   L.at('server/ws.js')   ... src/frameworks/bpp/server/ws.js
 *   L.at('dev/ents_src/10_hound.js')   ... src/frameworks/br-r/client/ents.hound.js (a part's canonical source)
 *   L.forTree(dir)         the same API for another game folder (an export); detects the old layout and maps names to themselves
 *   L.isModern(dir)        true when dir has the public/ web root or the generated/server/ folder
 *   L.webRoot(dir)         the folder the server serves (dir/public, or dir itself on the old layout)
 *   L.serverFiles()        the server-side runtime files (relative paths); L.serverSource() the server's own code as one text
 *   L.simFiles()           (C3) the sim's own files: its composition and the modules it requires (relative paths); L.simSource() their
 *                          text, for the tests that read the sim's code (s_ir I1, light_test)
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
  'sim.js': 'src/core/server/sim.js', 'ai.js': 'generated/server/ai.js', 'death_srv.js': `${F}/gib/server/death_srv.js`,   // (C3) the sim: its composition
  'server/newrun.js': `${F}/bpp/server/newrun.js`, 'server/aftermath.js': `${F}/gib/server/aftermath.js`, 'server/peers.js': `${F}/space/server/peers.js`,
  'server/ws.js': `${F}/bpp/server/ws.js`, 'server/fields.js': `${F}/ward/server/fields.js`, 'server/static.js': `${F}/ward/server/static.js`,
  /* the old development sources of the assembled files -> their canonical parts (dev/sim_glue.js has none: since H3M-3 it was nine parts, and
   * since C3 the sim is modules, simFiles) */
  'dev/ents_src/00_head.js': `${F}/br-r/client/ents.head.js`, 'dev/ents_src/10_hound.js': `${F}/br-r/client/ents.hound.js`, 'dev/ents_src/20_smiler.js': `${F}/br-r/client/ents.smiler.js`,
  'dev/ents_src/25_death.js': `${F}/gib/client/ents.death.js`, 'dev/ents_src/30_audio.js': `${F}/spacious-audio/client/ents.audio.js`, 'dev/ents_src/40_debug.js': `${F}/overseer/client/ents.debug.js`,
};
for (const n of ['00_head', '10_geo', '20_senses', '22_intelligence', '25_light', '30_entity', '40_capture', '50_hound', '60_smiler', '90_engine']) MAP[`dev/ai_src/${n}.js`] = `${F}/nani/server/ai.${n.slice(3)}.js`;
/* the modern layout: a public/ web root or a generated/server/ folder (a copy of only the server side has no public/) */
const isModern = dir => fs.existsSync(path.join(dir, 'public', 'index.html')) || fs.existsSync(path.join(dir, 'generated', 'server'));
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
  /* the server-side runtime files of this tree, relative paths: what a copy of "the server" must contain to run.  Modern layout:
   * server.js, the generated server files, and the src/ modules the server requires (files under a server/ folder that are not parts
   * of a built output: the parts only reach the server through generated/) */
  const serverFiles = () => {
    if (!modern) return ['server.js', 'sim.js', 'ai.js', 'world.js', 'death_srv.js', 'dphys.js', ...fs.readdirSync(path.join(dir, 'server')).filter(f => f.endsWith('.js')).map(f => 'server/' + f)];
    const walk = d => fs.readdirSync(path.join(dir, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    const recipes = JSON.parse(fs.readFileSync(path.join(dir, 'src', 'build-recipes.json'), 'utf8')), parts = new Set(recipes.outputs.flatMap(o => o.parts || []));
    const gen = walk(path.join('generated', 'server')).map(f => f.split(path.sep).join('/')).filter(f => f.endsWith('.js'));
    const mods = walk('src').map(f => f.split(path.sep).join('/')).filter(f => /\/server\/[^/]+\.js$/.test(f) && !parts.has(f));
    return ['server.js', ...gen, ...mods];
  };
  /* (C3) the sim's own files, relative paths: on the modern layout its composition (src/core/server/sim.js) and every module the
   * composition requires from src/, in the composition's order; on the old layout sim.js alone */
  const simFiles = () => {
    if (!modern) return ['sim.js'];
    const root = rel('sim.js'), out = [root];
    for (const m of fs.readFileSync(path.join(dir, root), 'utf8').matchAll(/require\('(\.{1,2}\/[^']+)'\)/g)) {
      const f = path.posix.normalize(path.posix.join(path.posix.dirname(root), m[1]));
      if (f.startsWith('src/') && !out.includes(f)) out.push(f);
    }
    return out;
  };
  const simSource = () => simFiles().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  /* (H3M-2) the server's own code as one text: server.js and every module split out of it (Stage 3H0, 3H2, H3M-2), on either layout, for
   * the tests that read the server's code (s_ir I1, s_humanqa_hotfix X02).  The world's files (sim.js and, since C3, its modules; ai.js,
   * world.js, dphys.js) are not server.js's code and are left out. */
  const serverSource = () => { const sim = new Set(simFiles()); return serverFiles().filter(f => !f.startsWith('generated/') && !sim.has(f) && !['sim.js', 'ai.js', 'world.js', 'dphys.js'].includes(f))
    .sort((a, b) => a === 'server.js' ? -1 : b === 'server.js' ? 1 : a < b ? -1 : a > b ? 1 : 0).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n'); };
  return {
    root: dir, modern, rel,
    at: name => path.join(dir, rel(name)),
    webRoot: () => modern ? path.join(dir, 'public') : dir,
    serverFiles, serverSource, simFiles, simSource,
  };
}
/* The runtime of a tree under its old (root-relative) names: [old name, absolute path] for every file the game serves or the server loads.
 * Modern layout: every file under public/ (its URL path), the server-side files by the map (sim.js -> generated/server/sim.js, ...), and
 * server.js and package.json.  Old layout: the same names, where they are.  Dev files, reports and sources are not runtime. */
function runtimeOf(dir) {
  const T = forTree(dir), out = new Map();
  const walk = (base, d = '') => fs.readdirSync(path.join(base, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(base, path.join(d, e.name)) : [path.join(d, e.name).split(path.sep).join('/')]);
  if (T.modern) for (const f of walk(path.join(T.root, 'public'))) out.set(f, path.join(T.root, 'public', f));
  else {
    for (const f of fs.readdirSync(T.root)) if (/\.(js|html|ico)$/.test(f) && fs.statSync(path.join(T.root, f)).isFile() && f !== 'redirect.js') out.set(f, path.join(T.root, f));
    for (const d of ['assets', 'sounds', 'server']) if (fs.existsSync(path.join(T.root, d))) for (const f of walk(path.join(T.root, d))) out.set(d + '/' + f, path.join(T.root, d, f));
  }
  for (const n of ['server.js', 'package.json', 'sim.js', 'ai.js', 'world.js', 'dphys.js', 'death_srv.js', ...Object.keys(MAP).filter(k => k.startsWith('server/'))]) {
    const p = T.at(n); if (fs.existsSync(p)) out.set(n, p);
  }
  /* (H3M-2) a server module made after the modernization has no old name: it is runtime under its own path (src/...) */
  if (T.modern) {
    const named = new Set([...out.values()].map(p => path.relative(T.root, p).split(path.sep).join('/')));
    for (const f of T.serverFiles()) if (!named.has(f)) out.set(f, path.join(T.root, f));
  }
  return out;
}
/* The layout's own path edits (H3M-1): text that names where a file now lives, and the text it replaced.  projectOld writes these files
 * with the old text back, so that the projection is the old layout; each edit must be found exactly once. */
const PATH_EDITS = {
  'death_srv.js': [["path.join(__dirname, '..', '..', '..', '..', 'generated', 'server', 'dphys.js')", "path.join(__dirname, 'dphys.js')"]],
};
/* Write a tree's runtime, under its old names, into an empty folder: an old-layout copy of a modern tree, which a pre-modernization
 * server.js (B++'s, 3H2's) can run as if it were its own folder.  A file with a layout path edit is written with that edit undone
 * (PATH_EDITS).  (C3) The sim's composition, written as sim.js, has each of its requires pointed at where this copy puts that file: its
 * old name if it has one (./world.js, ./ai.js), else its own path (./src/frameworks/.../sim.*.js, copied there as runtime); a require
 * that names no runtime file stops the copy.  Returns the old names written. */
function projectOld(dir, outDir) {
  const R = runtimeOf(dir), modern = isModern(path.resolve(dir));
  const byPath = new Map([...R].map(([n, p]) => [path.resolve(p), n]));
  for (const [n, p] of R) {
    const o = path.join(outDir, n); fs.mkdirSync(path.dirname(o), { recursive: true });
    if (modern && PATH_EDITS[n]) {
      let t = fs.readFileSync(p, 'utf8');
      for (const [now, was] of PATH_EDITS[n]) { if (t.split(now).length !== 2) throw new Error(`projectOld: the layout edit in ${n} is not found exactly once`); t = t.replace(now, was); }
      fs.writeFileSync(o, t);
    } else if (modern && n === 'sim.js') {
      const t = fs.readFileSync(p, 'utf8').replace(/require\('(\.{1,2}\/[^']+)'\)/g, (all, r) => {
        const to = byPath.get(path.resolve(path.dirname(p), r));
        if (!to) throw new Error(`projectOld: the sim's composition requires ${r}, which is not a runtime file`);
        return `require('./${to}')`;
      });
      fs.writeFileSync(o, t);
    } else fs.copyFileSync(p, o);
  }
  return [...R.keys()].sort();
}
const self = forTree(path.resolve(__dirname, '..', '..'));
module.exports = Object.assign({ forTree, isModern, MAP, PATH_EDITS, runtimeOf, projectOld, webRoot: dir => forTree(dir).webRoot() }, { root: self.root, at: self.at, rel: self.rel, modern: self.modern, serverFiles: self.serverFiles, serverSource: self.serverSource, simFiles: self.simFiles, simSource: self.simSource });
/* command line, for tools in other languages:  node dev/tools/layout.js at <old name> [--dir <tree>]   prints the absolute path;
 * sim-files [--dir <tree>]   prints the absolute path of each of the sim's files, one per line (C3) */
if (require.main === module) {
  const a = process.argv.slice(2), i = a.indexOf('--dir'), T = i >= 0 ? forTree(a[i + 1]) : self;
  if (a[0] === 'at' && a[1]) process.stdout.write(T.at(a[1]) + '\n');
  else if (a[0] === 'web-root') process.stdout.write(T.webRoot() + '\n');
  else if (a[0] === 'sim-files') process.stdout.write(T.simFiles().map(f => path.join(T.root, f)).join('\n') + '\n');
  else { process.stderr.write('usage: layout.js at <name> [--dir <tree>] | web-root [--dir <tree>] | sim-files [--dir <tree>]\n'); process.exitCode = 2; }
}
