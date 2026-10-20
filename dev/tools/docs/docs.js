#!/usr/bin/env node
/* dev/tools/docs/docs.js - the generated tables in the documentation, kept current (development only; zero dependencies).
 *
 *   node dev/tools/docs/docs.js            rewrite every generated block
 *   node dev/tools/docs/docs.js --check    exit 1 if a block is not what the repository gives today (the gate's docs step)
 *
 * A document holds hand-written text and, between two markers, a block this tool writes from the repository itself:
 *   <!-- generated: NAME (dev/tools/docs/docs.js) -->   ...   <!-- end of generated block -->
 * Blocks:
 *   outputs              docs/architecture/BUILD_PIPELINE.md: every built output, how it is built, from what
 *   frameworks           docs/architecture/FRAMEWORKS.md: every framework, its folder, its files, what they go into
 *   sources:<slug>       src/frameworks/<slug>/README.md: every file of that framework, what it is, where it goes
 *   globals              docs/architecture/CONTRACTS.md: every window.__name the served scripts and index.html write or read, by file
 * "What it is" is a part's header title, or a whole file's first comment line.  The text around the blocks is written by hand.
 * Each document must hold its own block once, and no other document's: --check fails on a block missing, doubled or misplaced, and on a
 * document missing. */
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..', '..', '..'), rel = p => path.relative(REPO, p).split(path.sep).join('/');
const CHECK = process.argv.includes('--check');
const recipes = JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'build-recipes.json'), 'utf8')).outputs;
/* the frameworks: the master pack's registry of twenty names; the ones with no code are listed with their README only */
const FW = [
  ['bpp', 'B++', 'networking and replication'], ['br-role', 'BR-RoLE', 'lighting and shadows'], ['br-r', 'BR-R', 'world and actor rendering'],
  ['spacious-audio', 'Spacious Audio', 'sound presentation'], ['nani', 'N.A.N.I.', 'entity intelligence'], ['space', 'S.P.A.C.E.', 'movement, collision, placement'],
  ['gib', 'G.I.B.', 'deaths, gibs and corpses'], ['lost', 'L.O.S.T.', 'level definition and transitions'], ['pulse', 'P.U.L.S.E.', 'diagnostics and performance'],
  ['overseer', 'OVERSEER', 'administration and QA controls'], ['echo', 'E.C.H.O.', 'environmental sound occlusion (future)'], ['cashier', 'CASHIER', 'cache ownership and budgets'],
  ['logicz', 'LogicZ', 'vertical world rules (future)'], ['pocket', 'P.O.C.K.E.T.', 'inventory and usable items'], ['front', 'F.R.O.N.T.', 'menus and HUD'],
  ['ward', 'W.A.R.D.', 'trust and deployment security'], ['atlas', 'A.T.L.A.S.', 'asset provenance and packaging'], ['stage', 'S.T.A.G.E.', 'testing and QA gates'],
  ['vault', 'V.A.U.L.T.', 'local settings and future saves'], ['hands', 'H.A.N.D.S.', 'input and bindings']];
const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
const intoOf = p => recipes.filter(o => (o.parts || []).includes(p)).map(o => o.out);
const HEADER = /^\/\*\* @part (\S+) - (.*)$/m;
function whatIs(p) {
  if (p.endsWith('.json')) { try { const n = JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8')).note; return n ? n.split('. ')[0].replace(/\.$/, '') : ''; } catch (e) { return ''; } }   // (C4c) a definition: its note's first sentence
  const t = fs.readFileSync(path.join(REPO, p), 'utf8'), m = t.slice(0, 600).match(HEADER);
  if (m && t.startsWith('/** @part')) return m[2].trim();
  const c = /^\s*(\/\*[\s\S]*?\*\/|(?:\/\/[^\n]*\n)+)/.exec(t);                           // a whole file: the first line of text in its first comment
  if (!c) return '';
  const line = c[1].split('\n').map(l => l.replace(/^\s*(\/\*+|\*+\/?|\/\/)\s?/, '').replace(/\*\/\s*$/, '').trim()).find(l => l);
  return line || '';
}
const SIM = require(path.join(REPO, 'dev', 'tools', 'layout.js')).simFiles();   // (C3) the sim's composition and its modules
const SIM_DATA = require(path.join(REPO, 'dev', 'tools', 'layout.js')).simData();   // (C4c) the definitions the sim's composition requires
const CLIENT_INPUTS = (() => { const f = path.join(REPO, 'src', 'core', 'client', 'game', 'level-data.cjs'); return fs.existsSync(f) ? require(f).INPUTS : []; })();   // (C4c) built into the compiled client
function goesInto(p) {
  const into = intoOf(p);
  if (into.length) return into.map(o => '`' + o + '`').join(', ') + (into.length && fs.readFileSync(path.join(REPO, p), 'latin1').startsWith('/** @part') ? ' (a part)' : '');
  if (SIM.includes(p)) return p === SIM[0] ? 'the sim\'s composition: `server.js` requires it' : 'a module of the sim: `src/core/server/sim.js` requires it';
  if (SIM_DATA.includes(p) || CLIENT_INPUTS.includes(p)) return [SIM_DATA.includes(p) ? 'the sim: `src/core/server/sim.js` requires it' : '', CLIENT_INPUTS.includes(p) ? 'the compiled client: built in (`core/client/game/level-data.cjs`)' : ''].filter(Boolean).join('; ');   // (C4c)
  if (/\/server\/[^/]+\.js$/.test(p)) return 'a server module: `server.js` requires it';
  return '-';
}
const cell = s => String(s).replace(/\|/g, '\\|');
const blocks = {};
/* outputs */
{
  const L = ['| Output | How | From |', '|---|---|---|'];
  for (const o of recipes) {
    const how = o.version ? 'written from `package.json`\'s version (its one source; pre-Trial 3 polish P5)' : o.client ? 'the client build (TypeScript and Vite: `dev/tools/build/client.js`), checked against its record' : o.replay ? 'a replay of the lineage ledger' : o.parts.length > 1 ? `${o.parts.length} parts, joined in order` : /original-v11/.test(o.parts[0]) ? 'a copy of the v11 build output' : 'one source file';
    const from = o.version ? '`package.json` (`version`)' : o.client ? `\`core/client/game/\`${/\.js$/.test(o.out) && CLIENT_INPUTS.length ? ', with ' + CLIENT_INPUTS.map(p => '`' + p.replace(/^src\//, '') + '`').join(' and ') : ''} (record \`${o.client}\`)` :   // (C4c) the bundle is built with the definitions too
                o.replay ? `\`${o.replay.ledger}\` (chain \`${o.replay.chain}\`)` : o.parts.map(p => '`' + p.replace(/^src\//, '') + '`').join('<br>');
    L.push(`| \`${o.out}\` | ${how} | ${from} |`);
  }
  blocks['outputs'] = L.join('\n');
}
/* frameworks, and each framework's sources */
{
  const L = ['| Framework | Folder | What it owns | Its files | They go into |', '|---|---|---|---|---|'];
  for (const [slug, name, role] of FW) {
    const dir = path.join(REPO, 'src', 'frameworks', slug), files = walk(dir).map(rel).filter(f => !/\/README\.md$/.test(f)).sort();
    const lanes = ['client', 'server', 'shared'].map(l => [l, files.filter(f => f.includes(`/${l}/`)).length]).filter(x => x[1]);
    const outs = [...new Set(files.flatMap(intoOf))].sort(), served = files.filter(f => /\/server\/[^/]+\.js$/.test(f) && !intoOf(f).length);
    const page = outs.filter(o => o.startsWith('public/')).map(o => '`' + o.slice(7) + '`'), srv = outs.filter(o => o.startsWith('generated/server/')).map(o => '`' + o.slice(17) + '`');
    const into = [page.length ? 'page: ' + page.join(', ') : '', srv.length ? 'server: ' + srv.join(', ') : '', served.length ? `${served.length} server module${served.length > 1 ? 's' : ''}` : ''].filter(Boolean).join('; ');
    L.push(`| [${name}](../../src/frameworks/${slug}/README.md) | \`src/frameworks/${slug}/\` | ${role} | ${files.length ? lanes.map(([l, n]) => `${n} ${l}`).join(', ') : 'none: a README only'} | ${into || '-'} |`);
    const S = files.length ? ['| File | What it is | Goes into |', '|---|---|---|'].concat(files.map(f => `| [\`${f.slice(dir.length - REPO.length)}\`](${f.slice(dir.length - REPO.length)}) | ${cell(whatIs(f))} | ${goesInto(f)} |`))
      : ['No file of its own: this framework has no code in this repository yet (see above).'];
    blocks['sources:' + slug] = S.join('\n');
  }
  blocks['frameworks'] = L.join('\n');
}
/* globals: every window.NAME the served scripts write or read (NAME starting with __, or WORLD, or TFB_), by file */
{
  const served = walk(path.join(REPO, 'public')).filter(f => f.endsWith('.js') || f.endsWith('.html')).map(rel).sort(), G = new Map();
  for (const f of served) {
    const t = fs.readFileSync(path.join(REPO, f), 'utf8');
    for (const m of t.matchAll(/\b(?:window|root|self|globalThis)\.(__[A-Za-z0-9_$]+|WORLD|TFB_[A-Za-z0-9_]+)\b(\s*(?:=(?!=)|\|\|=|\?\?=))?/g)) {
      const g = G.get(m[1]) || { w: new Set(), r: new Set() }; G.set(m[1], g); (m[2] ? g.w : g.r).add(f.replace(/^public\//, ''));
    }
  }
  const L = ['| Global | Written by | Read by |', '|---|---|---|'];
  for (const [n, g] of [...G].sort((a, b) => a[0].localeCompare(b[0]))) L.push(`| \`window.${n}\` | ${[...g.w].sort().map(x => '`' + x + '`').join(', ') || '-'} | ${[...g.r].filter(x => !g.w.has(x)).sort().map(x => '`' + x + '`').join(', ') || '-'} |`);
  blocks['globals'] = L.join('\n') + `\n\n${G.size} names. Counted: \`window.NAME\` (and a UMD's \`root.NAME\`) in the served scripts, the compiled bundle and \`index.html\`'s own scripts. Not counted: a bare \`__name\` used without \`window.\`. A name nobody writes is a hook a test or the console may set.`;
}
/* write, or check, every block in the documents that have one; each document must hold exactly the blocks listed for it here */
const WHERE = { 'docs/architecture/BUILD_PIPELINE.md': ['outputs'], 'docs/architecture/FRAMEWORKS.md': ['frameworks'], 'docs/architecture/CONTRACTS.md': ['globals'] };
for (const [s] of FW) WHERE[`src/frameworks/${s}/README.md`] = ['sources:' + s];
const DOCS = Object.keys(WHERE);
const RE = /(<!-- generated: (\S+) \(dev\/tools\/docs\/docs\.js\) -->\n)([\s\S]*?)(<!-- end of generated block -->)/g;
let stale = 0, seen = 0, missing = [];
for (const d of DOCS) {
  const f = path.join(REPO, d); if (!fs.existsSync(f)) { missing.push(d); continue; }
  const t = fs.readFileSync(f, 'utf8'), here = [];
  const n = t.replace(RE, (all, open, name, body, close) => { seen++; here.push(name); if (!(name in blocks)) { stale++; console.log(`${d}: no block named ${name}`); return all; } const want = blocks[name] + '\n'; if (body !== want) { stale++; if (CHECK) console.log(`STALE ${d}: ${name}`); } return open + want + close; });
  for (const w of WHERE[d]) if (here.filter(x => x === w).length !== 1) { stale++; console.log(`${d}: must hold the block ${w} once (it holds it ${here.filter(x => x === w).length} times)`); }
  for (const x of here) if (!WHERE[d].includes(x) && x in blocks) { stale++; console.log(`${d}: holds the block ${x}, which belongs elsewhere`); }
  if (!CHECK && n !== t) fs.writeFileSync(f, n);
}
for (const d of missing) console.log('MISSING ' + d);
if (CHECK) { console.log(`DOCS CHECK: ${stale || missing.length ? 'FAIL' : 'PASS'} (${seen} generated blocks in ${DOCS.length - missing.length} documents${stale ? `; ${stale} stale` : ''})`); process.exitCode = stale || missing.length ? 1 : 0; }
else console.log(`docs: ${seen} generated blocks in ${DOCS.length - missing.length} documents; ${stale} rewritten${missing.length ? '; MISSING ' + missing.join(', ') : ''}`);
