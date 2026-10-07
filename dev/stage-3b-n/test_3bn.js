/* Stage 3B-N - fast checks (node, no browser; development only, never served).
 *
 *   node dev/stage-3b-n/test_3bn.js [--only N1,N3]        (exit 1 on any failure)
 *
 * Each section belongs to one Stage 3B-N correction; the browser checks are in camera_3bn.js / visibility_3bn.js. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..', '..'), read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const argv = process.argv.slice(2), ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const sections = [];
const section = (id, fn) => sections.push([id, fn]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------------------------------------------------------- N1 camera / timing policy serving */
section('N1', async () => {
  const PORT = 9472, get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { let b = ''; q.on('data', d => b += d); q.on('end', () => r({ code: q.statusCode, body: b })); }).on('error', () => r({ code: 0 })));
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  try {
    for (let i = 0; i < 60; i++) { if ((await get('/index.html')).code === 200) break; await sleep(100); }
    const srcs = [...read('index.html').matchAll(/<script[^>]*\ssrc="\.?\/?([^"]+)"/g)].map(m => '/' + m[1].replace(/^\.\//, ''));
    const codes = {}; for (const s of srcs) codes[s] = (await get(s)).code;
    const bad = Object.entries(codes).filter(([, c]) => c !== 200);
    check('N1-1 every script index.html loads is served (200): camera_policy.js and timing_policy.js included', !bad.length && srcs.includes('/camera_policy.js') && srcs.includes('/timing_policy.js'),
      `${srcs.length} scripts; ${bad.length ? 'NOT served: ' + bad.map(([s, c]) => s + ' ' + c).join(', ') : 'all 200'}`);
    const priv = ['/server.js', '/sim.js', '/ai.js', '/death_srv.js', '/package.json', '/dev/tests/run.js', '/dev/stage-3b-n/test_3bn.js', '/../server.js'];
    const pc = {}; for (const p of priv) pc[p] = (await get(p)).code;
    check('N1-2 server-only and development files are still never served', Object.values(pc).every(c => c === 404 || c === 400), Object.entries(pc).map(([p, c]) => p + ' ' + c).join(', '));
    const cam = (await get('/camera_policy.js')).body, tim = (await get('/timing_policy.js')).body;
    check('N1-3 the served policies are the repository files byte for byte (policy contents unchanged)', cam === read('camera_policy.js') && tim === read('timing_policy.js'));
  } finally { srv.kill(); }
  const B = read('assets/index-DKbV5Nv9.js');
  const usesCam = /this\.baseScale=window\.__cameraPolicy\?window\.__cameraPolicy\.baseScale\(innerWidth,innerHeight\)/.test(B), usesTim = /__tm=window\.TFB_TIMING\|\|/.test(B);
  const order = [...read('index.html').matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  check('N1-4 the bundle reads both policies at start-up, and index.html loads them before the bundle (classic scripts run before the deferred module)', usesCam && usesTim && order.indexOf('./camera_policy.js') < order.indexOf('./assets/index-DKbV5Nv9.js') && order.indexOf('./timing_policy.js') < order.indexOf('./assets/index-DKbV5Nv9.js'),
    `camera hook ${usesCam}, timing hook ${usesTim}, order ${order.slice(0, 3).join(' ')}`);
  const pol = require(path.join(ROOT, 'camera_policy.js')), bad = [];
  for (const [w, h] of [[1920, 1080], [1280, 720], [2560, 1440], [3840, 2160], [1920, 1200], [1600, 1200], [2560, 1080], [3440, 1440], [5120, 1440], [1080, 1920], [390, 844], [844, 390]]) {
    const v = pol.visibleWorld(w, h); if (v.width > pol.MAX_WORLD_WIDTH + 1e-6 || v.height > pol.MAX_WORLD_HEIGHT + 1e-6) bad.push(w + 'x' + h); }
  check('N1-5 the policy never shows more than the canonical 1627 x 915 world at any CSS size (DPR is not an input)', !bad.length, bad.length ? 'exceeds: ' + bad.join(', ') : '12 viewports including 32:9, portrait and phones');
});

/* ---------------------------------------------------------------- N2 true darkness + danger flicker (static seams; the pixels are visibility_3bn.js) */
section('N2', async () => {
  const BR = read('assets/br-role.js'), MP = read('mp.js'), EN = read('ents.js'), ES = read('dev/ents_src/40_debug.js');
  check('N2-1 BR-RoLE draws no sourceless ambient glow around the viewer (no AMB gradient left)', !/AMB\s*=\s*\{/.test(BR) && !/AMB\.r[01]/.test(BR) && !/createRadialGradient\(V\.x,\s*V\.y/.test(BR));
  const opac = [...MP.matchAll(/light\.style\.opacity/g)].length;
  check('N2-2 the danger flicker never thins the darkness overlay (mp.js sets no #light opacity)', opac === 0, `${opac} writes`);
  check('N2-3 the danger shake moves the world and its darkness overlay together (same transform)', /game\.style\.transform\s*=\s*shk;\s*light\.style\.transform\s*=\s*shk/.test(MP));
  check('N2-4 the flicker is a surge of the ceiling lamps: mp.js sets window.__dangerFlicker and __ents.lamp multiplies it in (source and build agree)',
    /window\.__dangerFlicker\s*=/.test(MP) && [EN, ES].every(s => /E\.lamp = function[^]*?window\.__dangerFlicker[^]*?return g;[^]*?let m = g;/.test(s)));
  /* __ents.lamp under the surge: 1 when calm, the surge when no failure, and a failing lamp still goes dark */
  const w = { __dangerFlicker: 1 }, perf = { now: () => 0 };
  const fn = new Function('window', 'performance', 'sm', 'E', ES.match(/E\.lamp = function[^]*?\n\};/)[0] + '; return E.lamp;');
  const E = { fails: [] }, sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lamp = fn(w, perf, sm, E);
  const calm = lamp(0, 0, 0); w.__dangerFlicker = 1.8; const surge = lamp(0, 0, 0);
  E.fails = [{ x: 0, y: 0, r: 300, until: 99 }]; const failing = lamp(0, 0, 0); w.__dangerFlicker = undefined; const unset = lamp(500, 500, 0);
  check('N2-5 __ents.lamp: calm 1, surge multiplies, a failed lamp stays nearly dark under a surge, unset flag = 1', calm === 1 && surge === 1.8 && failing < .2 && unset === 1,
    `calm ${calm}, surge ${surge}, failing+surge ${failing.toFixed(3)}, unset ${unset}`);
  check('N2-6 BR-RoLE still caps a lamp at .9 (a surge brightens lamps inside the line of sight; it cannot exceed the cap)', /return Math\.min\(\.9, \(i % 13 === 0/.test(BR));
});

/* ---------------------------------------------------------------- N3 fixture / blocker separation + LOS around pillars */
section('N3', async () => {
  const W = require(path.join(ROOT, 'world.js')), B = read('assets/index-DKbV5Nv9.js');
  const GEN = 'kc[r*FBW+n]&&Fc.push({x:(n+.5)*96,y:(r+.5)*96})});';
  const calls = { bundle: B.includes(GEN + 'window.WORLD.fixLamps(Fc,Pc,kc,FBW,FBH);var Ic='), sim_head: read('dev/sim_head.js').includes(GEN + 'WORLD.fixLamps(Fc,Pc,kc,FBW,FBH);var Ic='),
    sim_geo: read('dev/sim_geo.js').includes(GEN + 'WORLD.fixLamps(Fc,Pc,kc,FBW,FBH);var Ic='), sim: read('sim.js').includes(GEN + 'WORLD.fixLamps(Fc,Pc,kc,FBW,FBH);var Ic=') };
  check('N3-1 the fixtures are corrected where they are made, on the client (bundle) and on the server (sim.js and its dev sources): same call, right after the grid', Object.values(calls).every(Boolean), JSON.stringify(calls));
  const PCG = 'var Pc=[];for(let e of[79.5,84.5,89.5])for(let t of[9.5,14.5,19.5])Pc.push({x:e*96-28,y:t*96-28,w:56,h:56});';
  check('N3-2 the pillars are untouched (same nine 56 x 56 blockers, same code in the bundle and the sim)', B.includes(PCG) && read('sim.js').includes(PCG));
  /* the real map: the grid before the correction (sim_geo's own debug export, re-made without the call) and after */
  const geo = require(path.join(ROOT, 'dev', 'sim_geo.js'))().debug, { kc, Fc, Pc, FBW, FBH, Oc } = geo;
  const raw = []; Oc.forEach((e, t) => { if (t !== 6) for (let n = e.x + 2; n < e.x + e.w - 1; n += 5) for (let r = e.y + 2; r < e.y + e.h - 1; r += 5) kc[r * FBW + n] && raw.push({ x: (n + .5) * 96, y: (r + .5) * 96 }); });
  const onPillar = L => Pc.some(p => L.x + 45 > p.x && L.x - 45 < p.x + p.w && L.y + 13 > p.y && L.y - 15 < p.y + p.h);
  const before = raw.filter(onPillar).length, copy = raw.map(l => ({ ...l })), fix = W.fixLamps(copy, Pc, kc, FBW, FBH);
  const okAll = copy.every((L, i) => W.lampOk(L.x, L.y, Pc, kc, FBW, FBH, copy.filter((o, j) => j !== i)));
  check('N3-3 the raw grid puts a fixture on each of the 9 pillars; after fixLamps every housing is on floor, off pillars and off other housings, 9 moved one cell (+x), none removed',
    before === 9 && fix.moved.length === 9 && !fix.removed.length && fix.moved.every(m => m.to[0] - m.from[0] === 96 && m.to[1] === m.from[1]) && okAll && copy.length === raw.length,
    `${raw.length} fixtures, ${before} on a pillar before; moved ${fix.moved.map(m => m.i + ' ' + m.from + '->' + m.to).join(', ')}; removed ${fix.removed.length}; all valid after: ${okAll}`);
  const untouched = raw.every((L, i) => fix.moved.some(m => m.i === i) || (copy[i].x === L.x && copy[i].y === L.y));
  const again = W.fixLamps(copy.map(l => ({ ...l })), Pc, kc, FBW, FBH), copy2 = raw.map(l => ({ ...l })); W.fixLamps(copy2, Pc, kc, FBW, FBH);
  check('N3-4 deterministic and minimal: the other 81 fixtures keep their places, a second pass changes nothing, two runs give the same list, and the game\'s own list (sim) is that list',
    untouched && !again.moved.length && !again.removed.length && JSON.stringify(copy2) === JSON.stringify(copy) && JSON.stringify(Fc) === JSON.stringify(copy));
  const sim = require(path.join(ROOT, 'sim.js'))({ seed: 3 });
  check('N3-5 the server\'s AI uses the corrected fixtures (sim.adapter.lamps)', JSON.stringify(sim.adapter.lamps.map(l => [l.x, l.y])) === JSON.stringify(copy.map(l => [l.x, l.y])), `${sim.adapter.lamps.length} lamps`);
  try { sim.stop && sim.stop(); } catch (e) { }
  check('N3-6 the client\'s line of sight casts its critical rays at the pillar corners too (not only the wall-grid corners): exact pillar silhouettes',
    B.includes('&&Vl.push({x:t*96,y:e*96})}for(let e of Pc)Vl.push({x:e.x,y:e.y},{x:e.x+e.w,y:e.y},{x:e.x,y:e.y+e.h},{x:e.x+e.w,y:e.y+e.h});function Hl('));
});

/* ---------------------------------------------------------------- N4 Shift while crouched (the real move.js, headless; the browser check is move_3bn.js) */
section('N4', async () => {
  const { makeMover } = require(path.join(ROOT, 'dev', 'move_model.js')), sim = require(path.join(ROOT, 'sim.js'))({ seed: 4 }), W = require(path.join(ROOT, 'world.js'));
  let clock = 0; const mk = (x, y) => { const M = makeMover(sim, W, () => clock); M.H.x = x; M.H.y = y; return M; };
  const DT = 1 / 60, steps = (M, n, ix, iy, run, c) => { const out = []; for (let i = 0; i < n; i++) { if (c && i === 0) M.mv.crouch = true; M.mv.step(ix, iy, run, DT); clock += DT; out.push(M.mv.s); } return out; };
  const open = (() => { for (let y = 3000; y < 4300; y += 48) for (let x = 400; x < 2000; x += 48) { let ok = true; for (let d = 0; d < 700 && ok; d += 24) ok = sim.clearAt(x + d, y, 30); if (ok) return [x, y]; } return null; })();
  const A = mk(...open); A.mv.crouch = true; const s1 = steps(A, 30, 1, 0, true);
  const B = mk(...open); B.mv.crouch = true; B.H.exhausted = true; B.H.stamina = 0; const s2 = steps(B, 30, 1, 0, true);
  const C = mk(...open); C.mv.crouch = true; const s3 = steps(C, 30, 0, 0, true);                                  // Shift but not moving
  const under = W.PROPS.find(p => p.type === 'under' && (p.rect.w >= 120 || p.rect.h >= 120)), E = under ? mk(under.rect.x + under.rect.w / 2, under.rect.y + under.rect.h / 2) : null;
  if (E) E.mv.crouch = true; const s5 = E ? steps(E, 20, under.rect.w >= under.rect.h ? .001 : 0, under.rect.w >= under.rect.h ? 0 : .001, true) : [];
  check('N4-1 move.js (headless): crouched + Shift + moving stands and runs at once; exhausted stays crouched; Shift without moving stays crouched; under low furniture stays low',
    s1.slice(0, 2).includes('run') && s1.slice(-1)[0] === 'run' && s2.every(s => s === 'crouch') && s3.every(s => s === 'crouch') && E && s5.every(s => s === 'crawl' || s === 'crouch'),
    `open: ${[...new Set(s1)].join('>')}; exhausted: ${[...new Set(s2)].join('>')}; not moving: ${[...new Set(s3)].join('>')}; under ${under ? under.id : '-'}: ${[...new Set(s5)].join('>')}`);
  const cur = read('sim.js'), par = execSync('git show 69602e7c9e755fcc65402b1563d4d060f5a10066:sim.js', { cwd: ROOT, maxBuffer: 1 << 26 }).toString(), srv = read('server.js'), srvP = execSync('git show 69602e7c9e755fcc65402b1563d4d060f5a10066:server.js', { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
  const fnSrc = (s, name) => { const i = s.indexOf('function ' + name + '('); return i < 0 ? null : s.slice(i, s.indexOf('\n}', i) + 2); };
  const same = ['moveOk', 'hearMove', 'gaitFloor'].every(n => fnSrc(cur, n) && fnSrc(cur, n) === fnSrc(par, n)) && ['mvCheck', 'mvAccept', 'mvReset'].every(n => fnSrc(srv, n) && fnSrc(srv, n) === fnSrc(srvP, n));
  check('N4-2 server authority unchanged: the server\'s movement checks (moveOk, mvCheck, mvAccept) and what it hears of a gait (hearMove, gaitFloor) are the parent\'s, byte for byte', same);
  const mv = read('move.js');
  check('N4-3 the rule is one bounded line in move.js: Shift stands you up only when running is allowed and a standing body fits (no new movement mode, no server change)',
    /if \(mv\.crouch && run && !mv\.runHold && moving && !H\.exhausted && H\.stamina > \.1 && mv\.recover <= 0 && !zone && freeAt\(H\.x, H\.y, M\.radius, 'walk'\)\) mv\.crouch = false;/.test(mv));
});

/* ---------------------------------------------------------------- N5 Hound blind pursuit (static law checks; the behaviour is hound_3bn.js) */
section('N5', async () => {
  const H = read('dev/ai_src/50_hound.js'), SN = read('dev/ai_src/20_senses.js');
  const body = (s, name) => { const i = s.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0, k = s.indexOf('{', i); for (let j = k; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}' && !--d) return s.slice(i, j + 1); } return ''; };
  const hunt = body(H, 'hHunt'), blind = hunt.slice(hunt.indexOf('BLIND PURSUIT'), hunt.indexOf('let chaseV')), parts = [blind, body(H, 'blindRoute'), body(H, 'blindDone'), body(H, 'houndInferSource')];
  const TRUTH = /playerById|nearPlayers|candidates\(|eng\.pl\b|\.visual\b|ev\.src|ev\.vx|ev\.vy|ev\.st\b/;
  check('N5-1 the blind pursuit, its route, its hand-over and the sound inference read no live player: no playerById / nearPlayers / candidates / visual sample / the sound bus\'s source id, velocity or state',
    parts.every(p => p.length > 50) && parts.every(p => !TRUTH.test(p)), parts.map(p => p.length + ' chars' + (TRUTH.test(p) ? ' (' + p.match(TRUTH)[0] + ')' : '')).join(', '));
  const he = body(SN, 'hearEvent');
  check('N5-2 an inferred sound updates the record from the sound only (its blurred position, its type), never from the bus\'s true state (r.st from the type)',
    /r\.st = inferred \? \(W_S\[ev\.type\] \?\? r\.st\)/.test(he) && /const inferred = !identified && h\.src === 0 && e\.kind === 'hound' \? houndInferSource\(eng, e, h\) : null;/.test(he));
  check('N5-3 a committed chase is never demoted to CURIOUS by a sound (HUNTING returns before any investigation starts)', /if \(e\.state === S\.HUNTING\) \{ e\.dbg\.retarget = 'committed pursuit;[^\n]*?return; \}/.test(H));
  const built = execSync("sh -c 'cd dev/ai_src && cat 00_head.js 10_geo.js 20_senses.js 22_intelligence.js 25_light.js 30_entity.js 40_capture.js 50_hound.js 60_smiler.js 90_engine.js'", { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
  check('N5-4 ai.js is exactly its sources (dev/ai_src, build_ai.sh)', built === read('ai.js'));
});

/* ---------------------------------------------------------------- N6 Hound sound recency / urgency (the evidence functions; the behaviour is hound_3bn.js S1-S6) */
section('N6', async () => {
  const I = read('dev/ai_src/22_intelligence.js'), H = read('dev/ai_src/50_hound.js');
  const src = I.slice(I.indexOf('const SOUND_URGENCY'), I.indexOf('function soundChoice'));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), F = new Function('clamp', src + '; return { soundUrgency, leadUrgency, SOUND_URGENCY };')(clamp);
  const hurgent = +H.match(/const HURGENT = ([\d.]+);/)[1], u = (I0, type, age, c) => F.soundUrgency({ I: I0, type, t: 10 - age, c: c ?? Math.min(1, .4 + .5 * I0) }, 10);
  const sprintNear = u(.85, 'run', 0), walkFar = u(.15, 'walk', 0), sprintOld = u(.85, 'run', 3), crouchNear = u(.14, 'crouch', 0);
  check('N6-1 urgency is recency x intensity x kind x confidence: a sprint a few metres away is urgent, a far quiet step and a 3 s old sprint are not, crouching is near silent',
    sprintNear >= hurgent && walkFar < .1 && sprintOld < hurgent * .4 && crouchNear < .05 && u(.85, 'run', 1.5) < sprintNear * .4,
    `sprint near ${sprintNear.toFixed(2)} (alert at ${hurgent}), the same 1.5 s later ${u(.85, 'run', 1.5).toFixed(2)}, 3 s later ${sprintOld.toFixed(2)}; walking step far ${walkFar.toFixed(3)}; crouched step near ${crouchNear.toFixed(3)}`);
  const L = { urg: .7, t: 10 }; const l1 = F.leadUrgency(L, 11), l5 = F.leadUrgency(L, 15);
  check('N6-2 stale evidence decays: a lead keeps the urgency of its strongest sound, fading (about half per second), gone after a few seconds', l1 < .7 * .6 && l5 < .03, `.70 -> ${l1.toFixed(2)} after 1 s -> ${l5.toFixed(3)} after 5 s`);
  const anon = H.slice(H.indexOf("if (h.attribution === 'anonymous') {"), H.indexOf("const r = e.mem.p.get(h.src); if (!r) return;"));
  check('N6-3 the state decides: urgent sounds alarm an idle, curious or searching Hound (never a hunting one); a Hound already rushing an urgent sound refines it instead of freezing again; anything else is an ordinary investigation',
    /if \(e\.state === S\.HUNTING\)[^\n]*return; \}/.test(anon) && /urg >= HURGENT && !onIt && \[S\.ROAMING, S\.DORMANT, S\.CURIOUS, S\.FRUSTRATED, S\.SEARCHING\]\.includes\(e\.state\)\) hAlarm/.test(anon) && /else if \(onIt\) hLightStart\(eng, e, L, urg\);/.test(anon) && /else hLightStart\(eng, e, L\);/.test(anon));
  check('N6-4 one hypothesis at a time: more of the same trail eases the goal (35 % per sound, no restart); only a clearly more urgent sound elsewhere (1.5x + 0.1) replaces it',
    /if \(near\) \{ if \(!q0\.arrived && L\.t > q0\.t\) \{ q0\.x \+= \(L\.x - q0\.x\) \* \.35;/.test(H) && /if \(!\(newU > curU \* 1\.5 \+ \.1\)\) return true;/.test(H));
});

(async () => {
  for (const [id, fn] of sections) { if (ONLY && !ONLY.includes(id)) continue; try { await fn(); } catch (e) { check(id + ' harness', false, String(e && e.stack || e).slice(0, 500)); } }
  const pass = results.filter(r => r.ok).length;
  console.log(`\n${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
})();
