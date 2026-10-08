/* Stage 3B-L QA1 - every ceiling fixture is one real fixture in the running game (development only; never served).
 *
 *   node dev/stage-3b-l-qa1/fixtures_page_qa1.js [--game PATH] [--port 9491] [--quality medium] [--out FILE.json] [--every 1]
 *
 * The page (the real client, served by the real server.js; 960 x 540: the same 1536 x 864 world as 1920 x 1080), lamps on, no
 * monsters.  First, the page's lamp list is world.js
 * W.lamps on the page's own map, and the same list fixtures_qa1.js finds on the server.  Then, standing beside each fixture in
 * turn (every --every'th; 1 = all of them):
 *   - the housing: the remaster took it into its ceiling layer (its stable id lamp:NNN, in its zone: a room or a corridor);
 *   - BR-RoLE: the fixture is one of the lights drawn this frame, and its light is in the light buffer beside it;
 *   - client light truth: light.js (__light.sample) and the bundle's own Ul() see a lamp there;
 * and the server AI's lamp field is .43 at every fixture (fixtures_qa1.js T3, node).  Nothing lights the screen that gameplay
 * does not know, and gameplay knows no fixture that is not drawn. */
'use strict';
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), http = require('http');
const H = require('../shadows/harness_lib.js'); const { sleep, frames } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || '.'), PORT = +(opt('port') || 9491), Q = opt('quality') || 'medium', OUT = opt('out'), EVERY = +(opt('every') || 1);
const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS }), R = { quality: Q, every: EVERY, fixtures: [] };
  try {
    const J = await H.join(browser, PORT, 'fxp' + Date.now() % 1e5, 'FXP', { viewport: { width: 960, height: 540 }, query: '&lighting=' + Q }), P = J.P;
    await H.stage(P); await H.setLights(P, 'off');
    /* the page's list vs W.lamps on the page's own map */
    const L0 = await P.evaluate(() => { const A = __api, W = window.WORLD, FBW = 96, FBH = 72, seen = new Map();
      for (let y = 96; y < FBH * 96; y += 192) for (let x = 96; x < FBW * 96; x += 192) for (const r of (A.Bc(x, y) || [])) if (r && r.w === 56 && r.h === 56) seen.set(r.x + ',' + r.y, r);   // the page's pillars (as BR-RoLE finds them)
      const Pc = [...seen.values()].sort((a, b) => a.x - b.x || a.y - b.y), list = W.lamps(A.Oc, (x, y) => !!A.zc(x, y), Pc, FBW, FBH);
      return { page: A.lamps.map(l => [l.x, l.y]), again: list.map(l => [l.x, l.y]), hasPc: Pc.length > 0, same: A.lamps === A.Fc }; });
    const tmp = path.join(require('os').tmpdir(), 'fxq' + process.pid + '.json');
    try { execSync(`node ${JSON.stringify(path.join(__dirname, 'fixtures_qa1.js'))} --game ${JSON.stringify(GAME)} --out ${JSON.stringify(tmp)}`, { stdio: 'ignore' }); } catch (e) { /* its own checks are reported by it; the list is still written */ }
    let ref = null; try { ref = JSON.parse(fs.readFileSync(tmp, 'utf8')).lamps; fs.unlinkSync(tmp); } catch (e) { ref = null; }
    const eq = (a, b) => !!a && !!b && a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);
    check('P1 the page\'s lamp list is world.js W.lamps on the page\'s own map, and the server\'s list (fixtures_qa1.js: sim.js -> the AI engine)',
      L0.hasPc && eq(L0.page, L0.again) && eq(L0.page, ref) && L0.same, `page ${L0.page.length} (__api.lamps is the bundle's Fc: ${L0.same}), W.lamps on the page's map ${L0.again.length} (identical ${eq(L0.page, L0.again)}), server ${ref ? ref.length : '-'} (identical ${eq(L0.page, ref)})`);
    const l0v = await P.evaluate(() => { const s = window.__l0v && __l0v.stats ? __l0v.stats() : null; return s ? { ownLamps: s.ownLamps, on: s.on } : null; });
    /* beside each fixture */
    const n = L0.page.length, bad = { housing: [], brRole: [], light: [], ul: [] };
    for (let i = 0; i < n; i += EVERY) {
      const [x, y] = L0.page[i];
      await H.place(P, x, y + 120, -Math.PI / 2, { light: false });
      for (let k = 0; k < 120; k++) { await frames(P, 2); if (await P.evaluate(i => { const s = __brRole.stats(); return !!__brRole.dev.cacheInfo(i) && s.lamps.pending === 0; }, i)) break; }
      await frames(P, 6);
      const r = await P.evaluate(([i, x, y]) => {
        const pr = __brRole.probe(x, y + 30), drawn = !!pr && pr.lamps.some(l => l.i === i), buf = __brRole.dev.light([[x, y + 30]])[0];
        const ls = __light.sample(x, y + 30, false), ul = __api.Ul ? __api.Ul(x, y + 30, __api.H, false) : null;
        const s = window.__l0v && __l0v.stats ? __l0v.stats() : null, id = 'lamp:' + String(i + 1).padStart(3, '0');
        return { drawn, buf, lamp: ls.lamp, ul, housing: !!s && s.ownLamps.includes(id), dim: i % 13 === 0 };
      }, [i, x, y]);
      R.fixtures.push(Object.assign({ i, x, y }, r));
      if (!r.housing) bad.housing.push(i);
      if (!r.drawn || !(r.buf > (r.dim ? .08 : .3))) bad.brRole.push(i);
      if (!(r.lamp > .4)) bad.light.push(i);
      if (r.ul !== null && !(r.ul > 0)) bad.ul.push(i);
      if (i % 20 === 0) console.log(`  ... fixture ${i}/${n}: housing ${r.housing}, BR-RoLE drawn ${r.drawn} light ${(r.buf * 255).toFixed(0)}/255, light.js lamp ${r.lamp.toFixed(3)}, Ul ${r.ul === null ? '-' : r.ul.toFixed(3)}`);
    }
    const m = R.fixtures.length;
    check('P2 every fixture has its housing: the remaster took it into its ceiling layer (lamp:NNN in its zone: a room or a corridor)', !!l0v && !bad.housing.length && l0v.ownLamps.length === n,
      `${m - bad.housing.length}/${m} checked have their housing; the remaster holds ${l0v ? l0v.ownLamps.length : '-'} of ${n}${bad.housing.length ? '; missing ' + bad.housing.slice(0, 10).join(',') : ''}`);
    check('P3 BR-RoLE draws every fixture as a light (one of the lights of the frame; its light in the buffer beside it, a dim tube dimmer)', !bad.brRole.length,
      `${m - bad.brRole.length}/${m}; light beside a fixture ${Math.round(Math.min(...R.fixtures.filter(f => !f.dim).map(f => f.buf)) * 255)}..${Math.round(Math.max(...R.fixtures.map(f => f.buf)) * 255)}/255 (dim tubes from ${Math.round(Math.min(...R.fixtures.filter(f => f.dim).map(f => f.buf).concat([1])) * 255)})${bad.brRole.length ? '; failing ' + bad.brRole.slice(0, 10).join(',') : ''}`);
    check('P4 client light truth sees every fixture: light.js lamp light beside it (the game\'s .43 x its failure state) and the bundle\'s Ul() readable there', !bad.light.length && !bad.ul.length,
      `${m - bad.light.length}/${m} light.js lamp >= .4 (min ${Math.min(...R.fixtures.map(f => f.lamp)).toFixed(3)}); Ul > 0 at ${m - bad.ul.length}/${m}`);
    R.errs = J.errs; if (J.errs.length) console.log('page errors:', J.errs.slice(0, 5).join(' | '));
  } finally { await browser.close(); srv.kill(); }
  R.results = results; const passed = results.filter(r => r.ok).length; console.log(`\n${passed}/${results.length} passed`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
