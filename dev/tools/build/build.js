#!/usr/bin/env node
/* dev/tools/build/build.js - the project's build: every script the browser or the server loads that is assembled from source in src/
 * (development tool; zero dependencies; Node 18 or later).
 *
 *   node dev/tools/build/build.js            build every output listed in src/build-recipes.json, and generated/BUILD_MANIFEST.json
 *   node dev/tools/build/build.js --check    build in memory and compare with what is on disk; exit 1 on any difference (CI / the gate)
 *   node dev/tools/build/build.js --clean    delete every built output and the manifest (a file no recipe lists, such as index.html or the media, is never touched)
 *   node dev/tools/build/build.js --list     print each output and its parts
 *   (npm run build, npm run build:check)
 *
 * The recipes (src/build-recipes.json) list, for each output, either its parts in order:
 *   { "out": "public/mp.js", "parts": ["src/core/client/mp.js"] }
 * or a replay of the client lineage ledger (Stage 3H, H3M-6: the compiled bundle and its stylesheet):
 *   { "out": "public/assets/index-DKbV5Nv9.js", "replay": { "ledger": "src/core/client/bundle/lineage/ledger.json", "chain": "bundle" } }
 * A replay starts from the chain's base (the original v11 build output, src/core/client/bundle/original-v11/dist/...) and applies the
 * ledger's steps in order; every step's patch must find the bytes it was made on (SHA-256 before) and give the bytes it records (SHA-256
 * after), or the build stops.  So the shipped bundle is the recovered TypeScript's build output plus forty recorded edits, and nothing
 * else (src/core/client/bundle/README.md).  The bundle's PixiJS chunks are parts outputs whose one part is the v11 build output's own file.
 * A parts output is the concatenation of its parts' text.  A part's text is its file's bytes, less one leading part header if the file begins
 * with one: a comment that starts the file with "/** @part " and ends at the first "*\/" and the newline after it.  The header is
 * where a part names its output, its owner and its interface; it never reaches the output.  Nothing else is changed: no
 * minification, no transpilation, no wrapping.  So an output is byte-identical to the file it replaced whenever its parts are.
 *
 * Outputs are committed (the production host runs `node server.js` from a fresh pull, with no build step), and written only when their
 * bytes change.  generated/BUILD_MANIFEST.json records every output and part with SHA-256, the recipes' and this tool's SHA-256; it
 * holds nothing machine-specific, so it builds the same everywhere.  --check verifies it too. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const REPO = path.resolve(__dirname, '..', '..', '..');
const RECIPES = 'src/build-recipes.json', MANIFEST = 'generated/BUILD_MANIFEST.json';
const HEADER = /^\/\*\* @part [\s\S]*?\*\/\r?\n/;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const rd = p => fs.readFileSync(path.join(REPO, p));
const mode = process.argv[2] || '--build';

function load() {
  const r = JSON.parse(rd(RECIPES).toString('utf8'));
  if (!Array.isArray(r.outputs) || !r.outputs.length) throw new Error(`${RECIPES}: no outputs`);
  const seenOut = new Set();
  for (const o of r.outputs) {
    if (o.replay) {                                                 // a lineage replay (H3M-6)
      if (!o.out || o.parts || !o.replay.ledger || !o.replay.chain) throw new Error(`${RECIPES}: ${o.out}: a replay needs "ledger" and "chain" and no "parts"`);
      if (!/^(public|generated)\//.test(o.out)) throw new Error(`${RECIPES}: ${o.out} is outside public/ and generated/`);
      if (seenOut.has(o.out)) throw new Error(`${RECIPES}: ${o.out} listed twice`); seenOut.add(o.out);
      if (!o.replay.ledger.startsWith('src/') || !fs.existsSync(path.join(REPO, o.replay.ledger))) throw new Error(`${RECIPES}: ${o.out}: ledger ${o.replay.ledger} is not a file under src/`);
      continue;
    }
    if (!o.out || !Array.isArray(o.parts) || !o.parts.length) throw new Error(`${RECIPES}: an output without "out" or "parts"`);
    if (seenOut.has(o.out)) throw new Error(`${RECIPES}: ${o.out} listed twice`);
    if (!/^(public|generated)\//.test(o.out)) throw new Error(`${RECIPES}: ${o.out} is outside public/ and generated/`);
    seenOut.add(o.out);
    for (const p of o.parts) {                                      // (a part may feed two outputs: a shared file built for the browser and the server)
      if (!p.startsWith('src/')) throw new Error(`${RECIPES}: ${o.out}: part ${p} is outside src/`);
      if (!fs.existsSync(path.join(REPO, p))) throw new Error(`${RECIPES}: ${o.out}: part ${p} does not exist`);
    }
  }
  return r;
}
/* a lineage replay, in memory: the chain's base, then every step's patch, each checked by its hashes before and after */
function replay(o) {
  const L = JSON.parse(rd(o.replay.ledger).toString('utf8')), F = L.files && L.files[o.replay.chain];
  if (!F) throw new Error(`${o.replay.ledger}: no chain "${o.replay.chain}"`);
  if (F.file !== o.out) throw new Error(`${o.replay.ledger}: chain "${o.replay.chain}" is the record of ${F.file}, not of ${o.out}`);
  const dir = path.dirname(o.replay.ledger);
  let cur = rd(F.base.path);
  if (sha(cur) !== F.base.sha256) throw new Error(`${o.out}: the replay's base ${F.base.path} is not the recorded file`);
  const patches = [];
  for (const s of F.steps) {
    const pp = path.posix.join(dir, s.patch), P = JSON.parse(rd(pp).toString('utf8'));
    if (P.step !== s.id || P.before.sha256 !== sha(cur)) throw new Error(`${o.out}: step ${s.id} was not made on the version before it`);
    const parts = []; let pos = 0;
    for (const [at, del, ins] of P.hunks) {
      const d = Buffer.from(del, 'utf8');
      if (at < pos || !cur.subarray(at, at + d.length).equals(d)) throw new Error(`${o.out}: step ${s.id}: a hunk does not match at byte ${at}`);
      parts.push(cur.subarray(pos, at), Buffer.from(ins, 'utf8')); pos = at + d.length;
    }
    parts.push(cur.subarray(pos)); cur = Buffer.concat(parts);
    if (sha(cur) !== P.after.sha256 || sha(cur) !== s.after.sha256) throw new Error(`${o.out}: step ${s.id} did not give the recorded bytes`);
    patches.push({ step: s.id, path: pp, sha256: sha(rd(pp)) });
  }
  if (sha(cur) !== F.result.sha256) throw new Error(`${o.out}: the replay did not end at the recorded result`);
  return { out: o.out, bytes: cur.length, sha256: sha(cur), replay: { ledger: o.replay.ledger, ledgerSha256: sha(rd(o.replay.ledger)), chain: o.replay.chain, base: { path: F.base.path, sha256: F.base.sha256 }, steps: patches }, buf: cur };
}
/* one output, in memory */
function assemble(o) {
  if (o.replay) return replay(o);
  const parts = o.parts.map(p => {
    const b = rd(p), t = b.toString('latin1'), m = t.match(HEADER);
    const body = m ? b.subarray(Buffer.byteLength(m[0], 'latin1')) : b;
    return { path: p, sha256: sha(b), headerBytes: m ? Buffer.byteLength(m[0], 'latin1') : 0, body };
  });
  const out = Buffer.concat(parts.map(p => p.body));
  return { out: o.out, bytes: out.length, sha256: sha(out), parts: parts.map(({ body, ...p }) => p), buf: out };
}
function manifest(r, built) {
  return Buffer.from(JSON.stringify({
    note: 'Written by dev/tools/build/build.js. Every built output, its parts in order and their SHA-256. Do not edit: run npm run build.',
    recipes: RECIPES, recipesSha256: sha(rd(RECIPES)), tool: 'dev/tools/build/build.js', toolSha256: sha(rd('dev/tools/build/build.js')),
    outputs: built.map(({ buf, ...b }) => b),
  }, null, 1) + '\n');
}
function main() {
  const r = load();
  if (mode === '--list') { for (const o of r.outputs) console.log(o.out + '\n  ' + (o.replay ? `replay of ${o.replay.ledger} (${o.replay.chain})` : o.parts.join('\n  '))); return 0; }
  if (mode === '--clean') {
    let n = 0; for (const o of r.outputs.map(x => x.out).concat(MANIFEST)) { const f = path.join(REPO, o); if (fs.existsSync(f)) { fs.unlinkSync(f); n++; } }
    console.log(`removed ${n} built files`); return 0;
  }
  const built = r.outputs.map(assemble), man = manifest(r, built);
  const all = built.map(b => [b.out, b.buf]).concat([[MANIFEST, man]]);
  if (mode === '--check') {
    const bad = [];
    for (const [p, buf] of all) { const f = path.join(REPO, p); if (!fs.existsSync(f)) bad.push(`${p}: missing`); else if (!fs.readFileSync(f).equals(buf)) bad.push(`${p}: differs from what its sources build`); }
    for (const b of bad) console.log('NOT BUILT: ' + b);
    console.log(bad.length ? `BUILD CHECK: FAIL (${bad.length} of ${all.length})` : `BUILD CHECK: PASS (${built.length} outputs and the manifest are what src/ builds)`);
    return bad.length ? 1 : 0;
  }
  if (mode !== '--build') { console.error('usage: build.js [--build|--check|--clean|--list]'); return 2; }
  let wrote = 0;
  for (const [p, buf] of all) {
    const f = path.join(REPO, p); if (fs.existsSync(f) && fs.readFileSync(f).equals(buf)) continue;
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); wrote++; console.log('wrote ' + p);
  }
  console.log(`built ${built.length} outputs (${wrote} files written, ${all.length - wrote} already up to date)`);
  return 0;
}
try { process.exitCode = main(); } catch (e) { console.error('BUILD ERROR: ' + e.message); console.log(mode === '--check' ? 'BUILD CHECK: FAIL (the sources do not build)' : 'BUILD: FAIL'); process.exitCode = 1; }
