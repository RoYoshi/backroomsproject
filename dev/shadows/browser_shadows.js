/* 2D Lighting & Shadows - browser checks against the real client served by the shipped `node server.js`.
 *
 *   node dev/shadows/browser_shadows.js [--game PATH] [--out DIR]      (exit code 1 on any failure)
 *
 * B01 the page loads; the module attaches above the carpet; no new page/console errors (only the parent's known 404s)
 * B02 the darkness overlay (#light) is byte-identical at every shadow quality (frozen clock), lights on and in a blackout
 * B03 entity presentation is untouched: hound / smiler / player views keep the same position, alpha, tint, visibility at every quality
 * B04 the network is untouched: what the client sends is the same with shadows OFF and HIGH
 * B05 SETTINGS > CUSTOMIZE > SHADOWS switches quality, is remembered on this device, and survives a reload
 * B06 the shadow debug view exists only for an admin with DEBUG MODE on; ordinary players never get it
 * B07 Smiler concealment: no shadow is ever drawn for a smiler, lit or dark, at any quality
 * B08 no page error, console error or module warning on any client
 * B09 WebGL really draws the light-weighted cast shadows: with the flashlight on a prop, the floor in its shadow inside the
 *     beam is darker at HIGH than at OFF and comes back at OFF; the lit floor before the prop does not change */
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const H = require('./harness_lib.js');
const { sleep, frames, lightHash } = H;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..'));
const OUT = opt('out') ? path.resolve(opt('out')) : null; if (OUT) fs.mkdirSync(OUT, { recursive: true });
const PORT = +(opt('port') || 9491);
const results = []; const check = (name, ok, note) => { results.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '   ' + note : '')); };
const KNOWN_404 = ['/camera_policy.js', '/timing_policy.js'];                 // pre-existing at the v23.3.6 parent (SH0_FREEZE.md item 1)
function get(p) { return new Promise(res => { http.get({ host: '127.0.0.1', port: PORT, path: p }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', () => res(0)); }); }
const sharp = (() => { try { return require('sharp'); } catch (e) { try { return require(path.join(execSync('npm root -g').toString().trim(), 'sharp')); } catch (x) { return null; } } })();
/* mean RGB of a small screen patch around a world point (the composited page: the Pixi world under the overlay) */
async function patch(P, wx, wy, r = 4) {
  const [sx, sy] = await P.evaluate(([x, y]) => { const w = __api.floor().parent; return [w.position.x + x * w.scale.x, w.position.y + y * w.scale.y]; }, [wx, wy]);
  const buf = await P.screenshot({ clip: { x: Math.round(sx) - r, y: Math.round(sy) - r, width: 2 * r, height: 2 * r } });
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true }); let t = 0; for (const v of data) t += v;
  return +(t / (info.width * info.height * 3)).toFixed(2);
}
const views = P => P.evaluate(() => { const r = v => +(+v).toFixed(4); const A = __api;
  return { person: (() => { const p = A.layer().parent.children.find(c => typeof c.deathPose === 'function'); return p && [r(p.x), r(p.y), r(p.alpha), p.visible, r(p.rotation)]; })(),
    creatures: A.layer().children.filter(v => v.__hound || v.__smiler || typeof v.deathPose === 'function').map(v => [v.__hound ? 'h' : v.__smiler ? 's' : 'p', r(v.x), r(v.y), r(v.alpha), v.visible, r(v.rotation), v.tint === undefined ? null : v.tint, (v.children || []).map(c => [r(c.alpha), c.visible, c.tint === undefined ? null : c.tint])]) }; });

(async () => {
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if (await get('/index.html') === 200) break; await sleep(100); }
  const browser = await H.pw.chromium.launch({ args: H.ARGS });
  const room = 'shb' + (Date.now() % 100000);
  try {
    /* ---- B01 ---- */
    const A = await H.join(browser, PORT, room, 'ALICE'), P = A.P;
    const st = await P.evaluate(() => ({ s: window.__shadows && __shadows.stats(), v: window.__shadows && __shadows.version, idx: window.__shadows && __shadows.snapshot().layerIndex, q: window.__shadows && __shadows.quality() }));
    check('B01 the module loads from assets/, attaches right above the carpet, and adds no page or console error', st.s && st.s.attached && !st.s.disabled && st.idx === 1 && !A.errs.length && A.missing.every(m => KNOWN_404.includes(m)),
      `version ${st.v}, quality ${st.q}, layer ${st.idx}, errors ${JSON.stringify(A.errs)}, 404s ${JSON.stringify([...new Set(A.missing)])}`);
    const staged = await H.stage(P);
    await H.place(P, 1060, 3300, -0.25); await sleep(1200);
    /* one frozen instant per pass, every quality.  B02 runs with no monster in the room: a smiler draws its own face on the
     * overlay and its idle animation keeps a minimum time step, so it would change the overlay by itself between captures. */
    const tiers = ['off', 'low', 'medium', 'high', 'off'], rows = [];
    const pass = async (tag, modes) => {
      for (const mode of modes) {
        if (!(await H.setLights(P, mode))) throw Error('could not set the lights to ' + mode);
        await sleep(800); await P.evaluate(() => __clock.freeze(true)); await H.settle(P);
        for (const q of tiers) {
          await P.evaluate(q => __shadows.setQuality(q), q); await frames(P, 6); await sleep(120);
          const snap = await P.evaluate(() => __shadows.snapshot()), sm = await P.evaluate(() => __api.layer().children.filter(v => v.__smiler && v.visible).map(v => [v.x, v.y, v.alpha]));
          rows.push({ tag, mode, q, blackout: await P.evaluate(() => !!__api.V.blackout), light: await lightHash(P), views: JSON.stringify(await views(P)), snap, smilers: sm });
        }
        await P.evaluate(() => __clock.thaw()); await sleep(300);
      }
    };
    await pass('b02', ['off', 'on']);
    const sel = (t, m) => rows.filter(r => r.tag === t && r.mode === m);
    const same = (k, t, m) => new Set(sel(t, m).map(r => r[k])).size === 1;
    check('B02 the darkness overlay is byte-identical at OFF / LOW / MEDIUM / HIGH (lamps on and in a blackout)', same('light', 'b02', 'off') && same('light', 'b02', 'on') && sel('b02', 'off').every(r => !r.blackout) && sel('b02', 'on').every(r => r.blackout) && sel('b02', 'off')[0].light !== sel('b02', 'on')[0].light,
      `lit ${sel('b02', 'off').map(r => r.q + ':' + r.light.slice(0, 8)).join(' ')} · blackout ${sel('b02', 'on').map(r => r.q + ':' + r.light.slice(0, 8)).join(' ')} (staged: ${JSON.stringify(staged)})`);
    const hp = await H.near(P, 'hound'), sp = await H.near(P, 'smiler'); await sleep(1500);
    await pass('b03', ['off', 'on']);
    check('B03 hound / smiler / player views are untouched at every quality (position, alpha, tint, visibility)', same('views', 'b03', 'off') && same('views', 'b03', 'on') && hp && sp,
      `${JSON.parse(sel('b03', 'off')[0].views).creatures.length} creature views compared over ${rows.filter(r => r.tag === 'b03').length} captures; hound ${hp && hp.map(Math.round)}, smiler ${sp && sp.map(Math.round)}`);
    const smilerShadow = rows.some(r => r.smilers.some(([sx, sy]) => r.snap.ents.some(e => Math.hypot(e.x - sx, e.y - sy) < 60)));
    check('B07 Smiler concealment: no shadow is drawn for a smiler at any quality, lit or blackout', !smilerShadow && rows.some(r => r.smilers.length), `smilers in view ${Math.max(...rows.map(r => r.smilers.length))}; entity shadows drawn ${Math.max(...rows.map(r => r.snap.ents.length))}`);
    /* ---- B04 network identity ---- */
    const sentDuring = async q => { await P.evaluate(q => { __shadows.setQuality(q); window.__sent = []; }, q); await sleep(3500);
      return P.evaluate(() => window.__sent.map(([, d]) => { try { const m = JSON.parse(d); return m.t === 'p' ? JSON.stringify({ t: m.t, x: m.x, y: m.y, vx: m.vx, vy: m.vy, a: m.a, r: m.r, l: m.l, ir: m.ir, k: m.k, lp: m.lp, n: m.n, c: m.c, f: m.f, lk: m.lk, mv: m.mv }) : JSON.stringify({ t: m.t, keys: Object.keys(m).sort() }); } catch (e) { return 'raw'; } })); };
    const offMsgs = await sentDuring('off'), hiMsgs = await sentDuring('high');
    const uniq = a => [...new Set(a)].sort();
    check('B04 the network is untouched: the client sends the same messages with shadows OFF and HIGH', offMsgs.length >= 4 && hiMsgs.length >= 4 && JSON.stringify(uniq(offMsgs)) === JSON.stringify(uniq(hiMsgs)),
      `${offMsgs.length} / ${hiMsgs.length} messages, distinct ${uniq(offMsgs).length} / ${uniq(hiMsgs).length}`);
    /* ---- B09 the light-weighted cast shadows render in WebGL ---- */
    if (sharp) {
      const L2 = await P.evaluate(() => WORLD.PROPS.find(p => p.id === 'L2').rect), cx = L2.x + L2.w / 2;
      await H.setLights(P, 'off'); await H.place(P, cx, L2.y + L2.h + 150, -Math.PI / 2); await sleep(1500);
      await P.evaluate(() => __clock.freeze()); await frames(P, 8);      // the +1 us test clock: Pixi keeps rendering (an exact freeze stops it)
      const probe = async q => { await P.evaluate(q => __shadows.setQuality(q), q); await frames(P, 30); await sleep(250);
        return { q, inShadow: await patch(P, cx, L2.y - 40), beforeProp: await patch(P, cx + 70, L2.y + L2.h + 75), light: await lightHash(P) }; };
      const r9 = [await probe('off'), await probe('high'), await probe('off')];
      await P.evaluate(() => __clock.thaw()); await P.evaluate(() => __shadows.setQuality('medium'));
      check('B09 WebGL draws the light-weighted cast shadows: the floor in a prop\'s shadow inside the beam darkens at HIGH and comes back at OFF; the lit floor before the prop does not change',
        r9[1].inShadow < r9[0].inShadow - 3 && Math.abs(r9[2].inShadow - r9[0].inShadow) < 1.5 && Math.abs(r9[1].beforeProp - r9[0].beforeProp) < 1.5, JSON.stringify(r9.map(r => ({ q: r.q, inShadow: r.inShadow, beforeProp: r.beforeProp }))));
    } else check('B09 WebGL draws the light-weighted cast shadows', false, 'sharp not available');
    /* ---- B06 debug gating ---- */
    const Bob = await H.join(browser, PORT, room, 'BOB', { admin: false });
    const bobHas = () => Bob.P.evaluate(() => !!document.getElementById('shadowDebugBtn') || !!document.getElementById('shadowDebug'));
    const aliceBtn = () => P.evaluate(() => !!document.getElementById('shadowDebugBtn'));
    await P.keyboard.press('Backquote'); await P.fill('#admPass', 'smoor'); await P.keyboard.press('Enter'); await sleep(900);
    const before = await aliceBtn();
    await P.evaluate(() => { const t = document.querySelector('[data-a=tab][data-t=debug]'); t && t.click(); }); await sleep(300);
    await P.evaluate(() => { const b = document.querySelector('[data-a="dbg"]'); b && b.click(); }); await H.until(aliceBtn, 4000);
    const onBtn = await aliceBtn(); await P.evaluate(() => document.getElementById('shadowDebugBtn') && document.getElementById('shadowDebugBtn').click()); await frames(P, 3); await sleep(300);
    const cv = await P.evaluate(() => !!document.getElementById('shadowDebug'));
    if (OUT) await P.screenshot({ path: path.join(OUT, 'b06-debug.png') });
    const bobSaw = await bobHas();
    await P.evaluate(() => { const b = document.querySelector('[data-a="dbg"]'); b && b.click(); }); await H.until(async () => !(await aliceBtn()), 4000);
    const after = await P.evaluate(() => !!document.getElementById('shadowDebugBtn') || !!document.getElementById('shadowDebug'));
    await P.evaluate(() => { const p = document.getElementById('adminPanel'); if (p) p.hidden = true; });
    check('B06 the shadow debug view is admin-only: it appears with DEBUG MODE, disappears without it, and a non-admin never gets it', !before && onBtn && cv && !bobSaw && !after, `before ${before}, debug-on button ${onBtn}, canvas ${cv}, bob ${bobSaw}, after ${after}`);
    /* ---- B05 settings control + persistence ---- */
    await P.evaluate(() => { const b = document.getElementById('settingsBtn'); b && b.click(); }); await sleep(400);
    await P.evaluate(() => { const t = document.querySelector('#settings [data-tab="custom"]'); t && t.click(); }); await sleep(300);
    const ui = await P.evaluate(() => [...document.querySelectorAll('#stShadows [data-shq]')].map(b => b.dataset.shq));
    if (OUT) { await P.evaluate(() => { const b = document.getElementById('stShadows'); b && b.scrollIntoView(); }); await P.screenshot({ path: path.join(OUT, 'b05-settings.png') }); }
    await P.evaluate(() => document.querySelector('#stShadows [data-shq="low"]').click()); await sleep(200);
    const q1 = await P.evaluate(() => [__shadows.quality(), localStorage.getItem('tfb.shadows.quality')]);
    const Carol = await H.join(browser, PORT, room, 'CAROL', { admin: false });   // a fresh browser profile = another device
    const q2 = await Carol.P.evaluate(() => __shadows.quality());
    await P.reload(); await sleep(2500); const q3 = await P.evaluate(() => __shadows.quality());
    check('B05 SETTINGS > CUSTOMIZE > SHADOWS switches quality and is remembered on this device (reload keeps it; another device keeps its own)', JSON.stringify(ui) === '["off","low","medium","high"]' && q1[0] === 'low' && q1[1] === 'low' && q3 === 'low' && q2 === 'medium',
      `buttons ${JSON.stringify(ui)}, after click ${JSON.stringify(q1)}, other device ${q2}, after reload ${q3}`);
    const allErr = [...A.errs, ...Bob.errs, ...Carol.errs];
    check('B08 no page error, console error or module warning on any of the three clients', !allErr.length, JSON.stringify(allErr).slice(0, 300));
    await Bob.ctx.close(); await Carol.ctx.close(); await A.ctx.close();
  } catch (e) { check('harness', false, String(e && e.stack || e).slice(0, 500)); }
  await browser.close(); srv.kill('SIGTERM');
  const pass = results.filter(r => r.ok).length; console.log(`\n${pass}/${results.length} passed`);
  if (OUT) fs.writeFileSync(path.join(OUT, 'browser_shadows.json'), JSON.stringify(results, null, 1));
  process.exit(pass === results.length ? 0 : 1);
})();
