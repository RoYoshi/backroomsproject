/* Stage 3H engine modernization, H3M-0 - the preflight inventory (development only; reads Git, writes JSON/CSV where --out says).
 *
 *   node dev/stage-3h-modernization/tools/m0_inventory.js [--ref HEAD] --out DIR
 *
 * Writes into DIR:
 *   root.json            every entry at the repository root at REF, classified (launch/config, runtime script, report, media, folder)
 *   tracked.json         tracked files and bytes per top-level folder
 *   scripts.json         index.html's script and preload order (the page's boot contract)
 *   requires.json        every require() in the server-side runtime files, in source order
 *   generators.json      the three generated runtime files and the parts their build scripts concatenate
 *   bundle.json          the compiled client bundle: its history in Git, its chunks (SHA-256, imports, the chunk it names but lacks)
 *   path_consumers.json  for every runtime file and every root report: the tracked files that name it, by kind
 *                        (code = .js/.py/.sh/.bat/.ps1/.yml outside evidence folders; docs; evidence; root reports)
 *   ROOT_ARCHIVE_PLAN.csv  one row per root report: where H3M-7 proposes to move it, its blob, its SHA-256, who names it
 * Nothing is moved or changed by this tool. */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ARG = { ref: 'HEAD' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..'), OUT = path.resolve(ARG.out);
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { maxBuffer: 1 << 30 });
const gitTry = (...a) => { try { return git(...a).toString(); } catch (e) { return e.stdout ? e.stdout.toString() : ''; } };
const ref = git('rev-parse', ARG.ref).toString().trim(), tree = git('rev-parse', ref + '^{tree}').toString().trim();
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const show = p => git('show', `${ref}:${p}`);
fs.mkdirSync(OUT, { recursive: true });
const W = (f, o) => fs.writeFileSync(path.join(OUT, f), typeof o === 'string' ? o : JSON.stringify(o, null, 1) + '\n');

/* ---------- tracked files ---------- */
const ls = git('ls-tree', '-r', '-l', ref).toString().trim().split('\n').map(l => { const [meta, p] = l.split('\t'); const [mode, type, blob, size] = meta.split(/\s+/); return { p, blob, size: +size, mode }; });
const byTop = {};
for (const f of ls) { const t = f.p.includes('/') ? f.p.split('/')[0] + '/' : '(root)'; const o = byTop[t] = byTop[t] || { files: 0, bytes: 0 }; o.files++; o.bytes += f.size; }
W('tracked.json', { ref, tree, files: ls.length, bytes: ls.reduce((s, f) => s + f.size, 0), byTop });

/* ---------- the root ---------- */
const RUNTIME_ROOT = new Set(['ai.js', 'camcorder.js', 'camera_policy.js', 'death_srv.js', 'dphys.js', 'ents.js', 'glitch.js', 'gore.js', 'hud.js', 'inventory.js', 'light.js', 'move.js', 'mp.js', 'redirect.js', 'server.js', 'sfx.js', 'sim.js', 'timing_policy.js', 'world.js']);
const LAUNCH = new Set(['README.md', 'package.json', 'index.html', 'favicon.ico', 'run_linux.sh', 'run_windows.bat']);
const rootTree = git('ls-tree', ref).toString().trim().split('\n').map(l => { const [meta, p] = l.split('\t'); const [mode, type, blob] = meta.split(/\s+/); return { p, type, blob }; });
const kindOf = e => e.type === 'tree' ? 'folder' : RUNTIME_ROOT.has(e.p) ? 'runtime script' : LAUNCH.has(e.p) ? 'launch / config / page' : /\.(md|txt)$/.test(e.p) ? 'report' : /\.(jpg|png)$/.test(e.p) ? 'report image' : 'other';
const root = rootTree.map(e => ({ path: e.p, type: e.type, kind: kindOf(e), blob: e.blob, bytes: e.type === 'blob' ? ls.find(f => f.p === e.p).size : null }));
const rootCount = {}; for (const r of root) rootCount[r.kind] = (rootCount[r.kind] || 0) + 1;
W('root.json', { ref, entries: root.length, byKind: rootCount, root });

/* ---------- the page's boot order ---------- */
const html = show('index.html').toString();
const tags = []; const re = /<(script|link)\b([^>]*)>/g; let m;
while ((m = re.exec(html))) { const a = m[2], line = html.slice(0, m.index).split('\n').length; const src = (a.match(/\b(?:src|href)="([^"]+)"/) || [])[1] || null;
  tags.push({ line, tag: m[1], src, type: (a.match(/\btype="([^"]+)"/) || [])[1] || null, rel: (a.match(/\brel="([^"]+)"/) || [])[1] || null, inline: m[1] === 'script' && !src }); }
W('scripts.json', { ref, note: 'classic scripts run in this order as the parser meets them; the type=module bundle is deferred and runs after them', tags });

/* ---------- server-side requires ---------- */
const SERVER_SIDE = ['server.js', 'sim.js', 'ai.js', 'death_srv.js', 'world.js', 'redirect.js', ...ls.filter(f => f.p.startsWith('server/') && f.p.endsWith('.js')).map(f => f.p)];
const requires = {};
for (const f of SERVER_SIDE) { const t = show(f).toString(); requires[f] = [...t.matchAll(/require\(\s*(['"`])([^'"`]+)\1\s*\)/g)].map(x => x[2]); }
W('requires.json', { ref, requires });

/* ---------- generated runtime files ---------- */
const gen = {};
for (const [script, target, dir] of [['dev/build_ai.sh', 'ai.js', 'dev/ai_src'], ['dev/build_ents.sh', 'ents.js', 'dev/ents_src']]) {
  const s = show(script).toString(), mm = s.match(new RegExp('^cat ([^>]+) > "\\$GAME/' + target.replace('.', '\\.') + '"$', 'm'));
  gen[target] = { script, parts: mm ? mm[1].trim().split(/\s+/).map(p => dir + '/' + p) : null, sha256: sha(show(target)) };
}
gen['sim.js'] = { script: 'dev/build_sim.sh', parts: ['(header printed by the script)', "dev/sim_head.js after its first 'use strict'; line", 'dev/sim_glue.js'], sha256: sha(show('sim.js')) };
W('generators.json', { ref, note: 'dev/stage-3h/tools/h1_build_check.js proves each rebuilds byte for byte', generators: gen });

/* ---------- the compiled bundle ---------- */
const B = 'assets/index-DKbV5Nv9.js', bb = show(B).toString();
const hist = git('log', '--format=%H%x09%ad%x09%s', '--date=short', ref, '--', B).toString().trim().split('\n').map(l => { const [c, d, s] = l.split('\t'); return { commit: c, date: d, subject: s }; });
const chunks = ls.filter(f => /^assets\/[^/]+\.js$/.test(f.p) && /-(?=[A-Za-z0-9_-]*[A-Z0-9_])[A-Za-z0-9_-]{8}\.js$/.test(f.p)).map(f => {   // Vite's content hashes (8 characters, never all lower case: not l0-remaster.js)
  const t = show(f.p).toString();
  return { path: f.p, bytes: f.size, sha256: sha(show(f.p)), imports: [...new Set([...t.matchAll(/from\s*"\.\/([^"]+)"/g)].map(x => x[1]))], dynamic: [...new Set([...t.matchAll(/import\(\s*"\.\/([^"]+)"\s*\)/g)].map(x => x[1]))] };
});
const mapDeps = ((bb.match(/m\.f=\[([^\]]*)\]/) || [])[1] || '').split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean);
const present = new Set(ls.map(f => f.p));
const named = new Set([...mapDeps, ...chunks.flatMap(c => [...c.imports, ...c.dynamic].map(i => 'assets/' + i))]);
const pixiVersions = [...new Set([...bb.matchAll(/`(8\.\d+\.\d+)`/g)].map(x => x[1]))].concat(...chunks.map(c => [...show(c.path).toString().matchAll(/`(8\.\d+\.\d+)`/g)].map(x => x[1])));
W('bundle.json', { ref, bundle: B, bytes: Buffer.byteLength(bb), sha256: sha(show(B)), firstCommit: hist[hist.length - 1], commitsTouching: hist.length, history: hist,
  viteMapDeps: mapDeps, chunks, namedButMissing: [...named].filter(n => !present.has(n)).sort(), pixiVersionStrings: [...new Set(pixiVersions)].sort(),
  sourceMaps: ls.filter(f => f.p.endsWith('.map')).map(f => f.p), sourceMapComments: [B, ...chunks.map(c => c.path)].filter(p => /sourceMappingURL/.test(show(p).toString())) });

/* ---------- who names what ---------- */
const reports = root.filter(r => r.kind === 'report' || r.kind === 'report image').map(r => r.path);
const targets = [...RUNTIME_ROOT, 'index.html', 'favicon.ico', 'package.json', ...ls.filter(f => /^(server|assets)\/[^/]+$/.test(f.p) && /\.(js|css|webmanifest)$/.test(f.p)).map(f => f.p), ...reports];
const isEvidence = p => /(^|\/)evidence\//.test(p) || /(^|\/)(results|stage2e-results|stage2f-results)\//.test(p) || /\.(jsonl|log)$/.test(p);
const isCode = p => /\.(js|py|sh|bat|ps1|yml|yaml|mjs|cjs)$/.test(p) && !isEvidence(p);
const consumers = {};
for (const t of targets) {
  const base = t.includes('/') ? t : t;                          // search the path as written (root files by name, others with their folder)
  const hits = gitTry('grep', '-l', '-F', '-e', base, ref, '--').trim().split('\n').filter(Boolean).map(h => h.slice(ref.length + 1)).filter(h => h !== t);
  const o = { code: [], docs: [], evidence: [], rootReports: [] };
  for (const h of hits) { if (reports.includes(h)) o.rootReports.push(h); else if (isEvidence(h)) o.evidence.push(h); else if (isCode(h)) o.code.push(h); else o.docs.push(h); }
  consumers[t] = { total: hits.length, code: o.code, docs: o.docs, evidenceCount: o.evidence.length, rootReports: o.rootReports };
}
W('path_consumers.json', { ref, note: 'a plain text search for each name; a hit is a file that mentions the name, not necessarily one that opens it by path', consumers });

/* ---------- the archive plan for root reports ---------- */
const STAGE = [[/^STAGE_2E_/, 'stage-2e'], [/^STAGE_2F_/, 'stage-2f'], [/^PART_2_/, 'part-2'], [/^2D_SHADOWS_/, '2d-shadows'], [/^BR_ROLE_/, 'br-role'], [/^STAGE_3B_/, 'stage-3b'],
  [/^STAGE_3C_/, 'stage-3c'], [/^STAGE_3D_/, 'stage-3d'], [/^STAGE_3E0_/, 'stage-3e-0'], [/^(STAGE_3H0_|3H0_)/, 'stage-3h0']];
const csv = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
const rows = [['old_path', 'proposed_new_path', 'git_blob_sha', 'sha256', 'type', 'bytes', 'named_by_code', 'named_by_docs', 'named_by_root_reports', 'named_by_evidence', 'reference_action'].join(',')];
const lower = new Map();
for (const r of reports) {
  const st = (STAGE.find(([rx]) => rx.test(r)) || [null, 'unsorted'])[1], np = `dev/archive/${st}/${r}`;
  if (lower.has(np.toLowerCase())) throw new Error('case collision: ' + np + ' / ' + lower.get(np.toLowerCase()));
  lower.set(np.toLowerCase(), np);
  const c = consumers[r], ent = root.find(e => e.path === r);
  const action = c.code.length ? 'update the code that names it (path consumer)' : c.docs.length ? 'active docs: link the archive index; historic docs: leave bytes, map in the ledger' : 'none needed (ledger only)';
  rows.push([r, np, ent.blob, sha(show(r)), r.endsWith('.jpg') ? 'image' : r.endsWith('.txt') ? 'text' : 'markdown', ent.bytes, c.code.join(' '), c.docs.join(' '), c.rootReports.length, c.evidenceCount, action].map(csv).join(','));
}
W('ROOT_ARCHIVE_PLAN.csv', rows.join('\n') + '\n');
console.log(JSON.stringify({ ref, tree, tracked: ls.length, root: rootCount, reports: reports.length, scripts: tags.filter(t => t.tag === 'script').length, bundleCommits: hist.length, missingChunks: [...named].filter(n => !present.has(n)) }));
