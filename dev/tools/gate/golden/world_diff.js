/* Stage 3H continuation (C3b) - B++'s world.js and this tree's, side by side: the same object, the same answers (development only; the
 * gate's page_scripts step runs it).
 *
 *   node dev/tools/gate/golden/world_diff.js [--old-ref 143b63f] [--out FILE.json] [--tree DIR]
 *
 * world.js is the one script the page and the server both load (window.WORLD; require on the server).  Each side is loaded fresh from
 * its own text (B++'s from Git; this tree's public/world.js, the page's) in its own module scope, and compared; the server's copy
 * (generated/server/world.js) must be the page's byte for byte:
 *   - the object: its keys in order, each value's type, every data value (the props, crawlspaces, lamps table, surfaces, movement and
 *     noise constants, state numbers, profiles), serialised;
 *   - every function, called with the same arguments on both sides: propAt / lowZone / crawlAt over a grid of points with pads and type
 *     filters; segRect / concealedBy over segments; blocks and addNear in every mode (setMode); carve on a copy of Level 0's grid;
 *     surfaceAt with Level 0's rooms; lamps with Level 0's rooms, floor and pillars (built by L.O.S.T.'s sim.level0.js with each side's
 *     WORLD, so the whole level - lamps, collision, ray casts - is compared too); canCrawl; verify; drawProps into a recording Graphics
 *     (every call and argument).
 * Every result must be equal.  The counts show what was reached. */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const ARG = { 'old-ref': '143b63ff42b88c6780c5043e0f61d64100f81f40' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const TREE = ARG.tree ? path.resolve(ARG.tree) : REPO, LAYOUT = require(path.join(REPO, 'dev', 'tools', 'layout.js')).forTree(TREE);
const load = text => { const m = { exports: {} }; new Function('module', 'exports', 'require', 'self', text)(m, m.exports, require, undefined); return m.exports; };
const MODERN = (() => { try { execFileSync('git', ['-C', REPO, 'cat-file', '-e', `${ARG['old-ref']}:public/index.html`], { stdio: 'ignore' }); return true; } catch (e) { return false; } })();   // (C5) an old side on the modern layout (M8): public/world.js
const oldText = execFileSync('git', ['-C', REPO, 'show', `${ARG['old-ref']}:${MODERN ? 'public/' : ''}world.js`]).toString('utf8'), newFile = path.join(LAYOUT.webRoot(), 'world.js'), newText = fs.readFileSync(newFile, 'utf8');
const serverCopy = LAYOUT.at('world.js'), serverSame = serverCopy === newFile || fs.readFileSync(serverCopy, 'utf8') === newText;   // the server's copy must be the page's, byte for byte
const level0Text = fs.readFileSync(path.join(REPO, 'src', 'frameworks', 'lost', 'server', 'sim.level0.js'), 'utf8');
const level0 = load(level0Text);
const SIDES = [load(oldText), load(newText)];
const R = { tool: 'dev/tools/gate/golden/world_diff.js', old: `${ARG['old-ref'].slice(0, 7)}:world.js`, new: path.relative(TREE, newFile), serverCopy: path.relative(TREE, serverCopy), serverCopySame: serverSame, comparisons: 0, differences: 0, first: [], reached: {}, ok: serverSame };
const J = v => JSON.stringify(v, (k, x) => typeof x === 'function' ? 'fn:' + x.length : x instanceof Uint8Array ? 'u8:' + Buffer.from(x).toString('base64').length + ':' + require('crypto').createHash('sha1').update(Buffer.from(x)).digest('hex') : x);
const same = (what, f) => {
  R.comparisons++; R.reached[what.split(' ')[0]] = (R.reached[what.split(' ')[0]] || 0) + 1;
  let a, b; try { a = J(f(SIDES[0], 0)); } catch (e) { a = 'THROW ' + e.message; } try { b = J(f(SIDES[1], 1)); } catch (e) { b = 'THROW ' + e.message; }
  if (a !== b) { R.differences++; R.ok = false; if (R.first.length < 10) R.first.push({ what, old: String(a).slice(0, 400), new: String(b).slice(0, 400) }); }
};
/* the object */
same('keys', W => Object.keys(W));
same('types', W => Object.keys(W).map(k => [k, typeof W[k]]));
same('data', W => Object.fromEntries(Object.entries(W).filter(([, v]) => typeof v !== 'function')));
/* each side's own Level 0, built with its WORLD (the server's level module, unchanged) */
const LV = SIDES.map(W => level0(W));
same('level', (W, i) => { const L = LV[i]; return { FBW: L.FBW, FBH: L.FBH, Oc: L.Oc, Ic: L.Ic, Fc: L.Fc, al: L.al, W: L.W, ll: L.ll }; });
/* points across Level 0, with pads and type filters */
const pts = []; for (let y = 50; y < 72 * 96; y += 97) for (let x = 30; x < 96 * 96; x += 113) pts.push([x, y]);
for (const pad of [0, 12, 40]) {
  same(`propAt pad ${pad}`, W => pts.map(([x, y]) => { const p = W.propAt(x, y, pad); return p && p.id; }));
  same(`propAt-typed pad ${pad}`, W => pts.map(([x, y]) => { const p = W.propAt(x, y, pad, ['low', 'window']); return p && p.id; }));
  same(`lowZone pad ${pad}`, W => pts.map(([x, y]) => { const p = W.lowZone(x, y, pad); return p && p.id; }));
  same(`crawlAt pad ${pad}`, W => pts.map(([x, y]) => { const c = W.crawlAt(x, y, pad); return c && c.id; }));
}
/* near every prop, finely */
for (const p of SIDES[0].PROPS) for (let dy = -60; dy <= 60; dy += 15) for (let dx = -60; dx <= 60; dx += 15) {
  const x = p.cx + dx, y = p.cy + dy;
  same(`near-prop ${p.id}`, W => [W.propAt(x, y) && W.propAt(x, y).id, W.lowZone(x, y, 5) && W.lowZone(x, y, 5).id, W.crawlAt(x, y, 3) && W.crawlAt(x, y, 3).id]);
}
/* segments */
for (let k = 0; k < 400; k++) {
  const a = pts[(k * 37) % pts.length], b = pts[(k * 91 + 5) % pts.length];
  same('concealedBy', W => { const c = W.concealedBy(a[0], a[1], b[0], b[1]); return c && c.id; });
  same('segRect', W => W.PROPS.slice(0, 6).map(p => W.segRect(a[0], a[1], b[0], b[1], p.rect)));
}
/* collision in every mode; the mode itself, as WORLD.mode shows it after setMode */
same('mode', W => ['walk', 'under', 'crawl', 'any', 'walk'].map(m => { W.setMode(m); return W.mode; }));
for (const mode of ['walk', 'under', 'crawl', 'any']) {
  same(`blocks ${mode}`, W => { W.setMode(mode); const r = W.PROPS.map(p => W.blocks(p)); W.setMode('walk'); return [r, W.mode]; });
  same(`addNear ${mode}`, W => { W.setMode(mode); const r = pts.filter((_, i) => i % 3 === 0).map(([x, y]) => W.addNear([], x, y).length); W.setMode('walk'); return r; });
  same(`level-collision ${mode}`, (W, i) => { W.setMode(mode); const L = LV[i]; const r = pts.filter((_, j) => j % 2 === 0).map(([x, y]) => [L.Bc(x, y).length, L.sl(x, y), L.sl(x, y, 8)]); W.setMode('walk'); return r; });
}
same('carve', (W, i) => { const kc = new Uint8Array(96 * 72); W.carve(kc, 96); return kc; });
same('surfaceAt', (W, i) => pts.map(([x, y]) => W.surfaceAt(x, y, LV[i].Oc)).concat([W.surfaceAt(10, 10), W.surfaceAt(5000, 5000, null)]));
same('lamps', (W, i) => { const L = LV[i]; return W.lamps(L.Oc, (n, r) => L.zc(n, r), [], 96, 72); });
same('canCrawl', W => W.CRAWL.map(c => [W.canCrawl({ CAN_CRAWL: true }, c), W.canCrawl({ CAN_USE_TIGHT_GAPS: true }, c), W.canCrawl(null, c)]));
same('ray', (W, i) => { const L = LV[i]; const r = []; for (let k = 0; k < 300; k++) { const [x, y] = pts[(k * 13) % pts.length]; r.push(Math.round(L.Uc(x, y, k * .37, 900) * 1000)); } return r; });
same('route', (W, i) => { const L = LV[i]; const r = []; for (let k = 0; k < 40; k++) { const a = pts[(k * 29) % pts.length], b = pts[(k * 53 + 7) % pts.length]; r.push(L.fl({ x: a[0], y: a[1] }, { x: b[0], y: b[1] }).length); } return r; });
same('verify', (W, i) => { const kc = new Uint8Array(96 * 72); for (let k = 0; k < kc.length; k++) kc[k] = LV[i].zc(k % 96, (k / 96) | 0) ? 1 : 0; return W.verify(kc, 96, 72); });
/* the props' art: every call into a recording Graphics */
same('drawProps', W => {
  const calls = [];
  const g = new Proxy({}, { get(t, k) { if (k === 'toJSON') return undefined; return (...a) => { calls.push([String(k), ...a.map(x => typeof x === 'number' ? Math.round(x * 1000) / 1000 : x)]); return g; }; } });
  W.drawProps(g); return calls;
});
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(`reached: ${Object.entries(R.reached).map(([k, n]) => `${k} ${n}`).join(', ')}`);
for (const f of R.first) console.log(`DIFFERENT ${f.what}\n  old ${f.old}\n  new ${f.new}`);
if (!serverSame) console.log(`DIFFERENT ${R.serverCopy}: not the page's ${R.new} byte for byte`);
console.log(`WORLD DIFF: ${R.ok ? 'SAME' : 'DIFFERENT'} - ${R.comparisons} comparisons, ${R.differences} differences; the server's copy ${serverSame ? 'is' : 'is NOT'} the page's, byte for byte`);
process.exitCode = R.ok ? 0 : 1;
