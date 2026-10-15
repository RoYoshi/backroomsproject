/* Stage 3H continuation (C0) - the debt inventories the remaining waves work from (development only; read-only on the repository).
 *
 *   node dev/stage-3h-modernization/tools/c0_audit.js [--out-dir dev/stage-3h-modernization/inventory]
 *
 * Writes:
 *   c0_bundle_steps.csv     the 40 post-v11 steps of the compiled bundle: what each did, the framework that owns that concern, the v11
 *                           TypeScript modules whose bytes it replaced, the steps it builds on, whether it has a net effect, and the
 *                           target of its port to readable source (ADR-002 P2)
 *   c0_parts_coupling.csv   every part of every output built from parts: what it provides, uses and writes, and which of those
 *                           names belong to another owner's part (the cross-owner coupling that real modules must replace, M-024)
 *   c0_summary.json         the totals of both
 * Sources: dev/tools/checks/parts.js (run here, so the coupling is today's code), src/core/client/bundle/lineage/ (ledger.json,
 * descriptions.json, and STEPS.md's generated table of the modules each step changed). */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const ARG = { 'out-dir': 'dev/stage-3h-modernization/inventory' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..'), OUT = path.resolve(REPO, ARG['out-dir']), LIN = path.join(REPO, 'src', 'core', 'client', 'bundle', 'lineage');
const csv = rows => rows.map(r => r.map(c => { const s = String(c == null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n') + '\n';

/* 1. the bundle's steps */
const ledger = JSON.parse(fs.readFileSync(path.join(LIN, 'ledger.json'), 'utf8')), desc = JSON.parse(fs.readFileSync(path.join(LIN, 'descriptions.json'), 'utf8')).bundle;
const steps = fs.readFileSync(path.join(LIN, 'STEPS.md'), 'utf8'), modTable = new Map();
for (const m of steps.matchAll(/^\| (B\d\d) \| ([^|]*) \| ([^|]*) \|$/gm)) modTable.set(m[1], { modules: m[2].trim(), buildsOn: m[3].trim() });
const NONET = { B13: 'added __api.input; B14 removes it again: no net change', B17: 'an experiment that B18 reverts byte for byte: no net change', B18: 'reverts B17: no net change' };
const target = mods => mods === '-' ? 'the classic-script seam it opens (the TypeScript side only calls the hook)' : mods.split(',').map(x => x.trim().replace(/ \d[\d,]*$/, '')).filter(x => !/^pixi\.js/.test(x)).map(x => 'client tree: ' + x).join('; ');
const B = [['step', 'source', 'bytes_written', 'what_it_did', 'owner_today', 'v11_modules_bytes_replaced', 'builds_on', 'net_effect', 'port_target', 'state']];
for (const s of ledger.files.bundle.steps) {
  const d = desc[s.id] || ['', ''], mt = modTable.get(s.id) || { modules: '?', buildsOn: '?' };
  const src = s.source.kind === 'package' ? 'package ' + s.source.package : (s.source.commit || '').slice(0, 7) + ' ' + (s.source.date || '').slice(0, 10);
  B.push([s.id, src, s.inserted, d[0], d[1], mt.modules, mt.buildsOn, NONET[s.id] || 'yes', NONET[s.id] ? 'none (account for it in the port: nothing to carry)' : target(mt.modules), 'BLOCKED: needs the locked v11 toolchain (C1)']);
}

/* 2. the parts' coupling (today's code) */
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'c0-')), 'parts.json');
const r = spawnSync(process.execPath, [path.join(REPO, 'dev', 'tools', 'checks', 'parts.js'), '--out', tmp], { encoding: 'utf8' });
if (r.status !== 0) { console.error('parts.js failed: ' + (r.stdout || '') + (r.stderr || '')); process.exit(1); }
const parts = JSON.parse(fs.readFileSync(tmp, 'utf8')); fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
const ownerOf = p => { const m = /^src\/frameworks\/([^/]+)\//.exec(p); return m ? m[1] : 'core'; };
const P = [['output', 'part', 'owner', 'provides', 'uses', 'writes', 'cross_owner_uses', 'cross_owner_writes', 'cross_owner_uses_list', 'cross_owner_writes_list']];
const totals = { outputs: 0, parts: 0, crossUses: 0, crossWrites: 0, byOutput: {} };
const seen = new Set();
for (const o of parts.outputs) {
  totals.outputs++;
  const prov = new Map(); for (const p of o.parts) for (const n of p.provides) prov.set(n, p.path);
  const t = totals.byOutput[o.out] = { parts: o.parts.length, crossUses: 0, crossWrites: 0, owners: [...new Set(o.parts.map(p => ownerOf(p.path)))] };
  for (const p of o.parts) {
    const cu = p.uses.filter(n => prov.has(n) && ownerOf(prov.get(n)) !== ownerOf(p.path)), cw = p.writes.filter(n => prov.has(n) && ownerOf(prov.get(n)) !== ownerOf(p.path));
    const tag = n => `${n}<${ownerOf(prov.get(n))}`;
    P.push([o.out, p.path, ownerOf(p.path), p.provides.length, p.uses.length, p.writes.length, cu.length, cw.length, cu.map(tag).join(' '), cw.map(tag).join(' ')]);
    t.crossUses += cu.length; t.crossWrites += cw.length;
    if (!seen.has(p.path + '|' + o.out.replace(/^(public|generated\/server)\//, ''))) { seen.add(p.path + '|' + o.out.replace(/^(public|generated\/server)\//, '')); totals.parts++; totals.crossUses += cu.length; totals.crossWrites += cw.length; }
  }
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'c0_bundle_steps.csv'), csv(B));
fs.writeFileSync(path.join(OUT, 'c0_parts_coupling.csv'), csv(P));
const summary = { tool: 'dev/stage-3h-modernization/tools/c0_audit.js', typescript: parts.typescript, bundleSteps: B.length - 1, stepsWithNoNetEffect: Object.keys(NONET), parts: totals,
  note: 'world.js is built twice (public/ and generated/server/) from the same parts; its parts are counted once in the totals' };
fs.writeFileSync(path.join(OUT, 'c0_summary.json'), JSON.stringify(summary, null, 1) + '\n');
console.log(`bundle steps: ${summary.bundleSteps} (no net effect: ${summary.stepsWithNoNetEffect.join(', ')})`);
for (const [o, t] of Object.entries(totals.byOutput)) console.log(`${o.padEnd(28)} ${String(t.parts).padStart(2)} parts, owners ${t.owners.join(' ')}; cross-owner uses ${t.crossUses}, writes ${t.crossWrites}`);
console.log(`parts (world.js counted once): ${totals.parts}; cross-owner uses ${totals.crossUses}; cross-owner writes ${totals.crossWrites}`);
