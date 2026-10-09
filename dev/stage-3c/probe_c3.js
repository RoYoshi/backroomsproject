/* Stage 3C C3 - customize (WANDERER and LOADOUT), checked in a browser (development only; never served).
 *
 *   node dev/stage-3c/probe_c3.js [--game DIR] [--port 9613] [--out FILE.json] [--shots DIR]
 *
 * Wanderer: the hat and texture chips, the body and hand swatches and the custom colour pickers drive the game's own look
 * (saved, live); there is no backpack anywhere, and a saved legacy backpack loads as "none". Loadout: the four devices, the
 * beam colour, the parts; the camcorder has no beam and says it emits no visible light. The preview renderer draws only while
 * the panel is open. During a run the device is locked (one per run) while the look can still change. Two wanderers in one
 * room see each other's look and light; an older client's backpack is not drawn. Exit 0 when every check passes. */
'use strict';
const path = require('path'), fs = require('fs');
const U = require('./ui_lib.js'); const { sleep, H } = U;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), PORT = +(opt('port') || 9613), OUT = opt('out');
const R = { checks: [], errors: [] };
const check = (name, ok, note) => { R.checks.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  - ' + (typeof note === 'string' ? note : JSON.stringify(note)) : '')); };
const CAM_LINE = 'Night Vision Camcorder emits no visible light; its night vision uses infrared.';
const saved = (P, k) => P.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), k);
(async () => {
  const srv = await U.serve(GAME, PORT), b = await U.browser(), room = 'c3cz' + Date.now() % 1e6;
  try {
    // ---- page A: a legacy save with a backpack
    const A = await U.page(b, PORT, { room, storage: { 'wanderer-appearance': JSON.stringify({ hat: 'none', texture: 'plain', hands: '#e6bb76', main: '#ffcc77', backpack: 'canvas' }) } }); const P = A.P;
    const mig = await P.evaluate(() => ({ look: __api.look.backpack, saved: JSON.parse(localStorage.getItem('wanderer-appearance')).backpack, opts: [...document.getElementById('avatarBackpack').options].map(o => o.value),
      shown: [...document.querySelectorAll('#appearancePanel *')].some(e => /backpack/i.test(e.textContent) && e.children.length === 0 && e.getClientRects().length) }));
    check('a saved legacy backpack loads as "none" (look and save); the backpack field offers only "none" and nothing visible mentions a backpack', mig.look === 'none' && mig.saved === 'none' && mig.opts.join() === 'none' && !mig.shown, mig);
    const t0 = await P.evaluate(() => ({ app: !!window.__avatarApp, started: window.__avatarApp && __avatarApp.ticker.started }));
    await P.click('#menu .mm-item[data-go="customize"]'); await sleep(900);
    const o1 = await P.evaluate(() => ({ st: __ui.state(), tab: document.getElementById('appearancePanel').dataset.tab, sel: document.getElementById('czTab_wanderer').getAttribute('aria-selected'), focus: document.activeElement && document.activeElement.id,
      started: __avatarApp.ticker.started, wPane: !document.getElementById('czWanderer').hidden, lPane: !document.getElementById('czLoadout').hidden }));
    check('the preview renderer is idle while customize is closed and draws once it opens (WANDERER tab first, focus on the tab)', t0.app && t0.started === false && o1.st === 'customize' && o1.tab === 'wanderer' && o1.sel === 'true' && o1.focus === 'czTab_wanderer' && o1.started === true && o1.wPane && !o1.lPane, { t0, o1 });
    // chips
    await P.click('#czWanderer [data-for="avatarHat"] [data-v="cap"]'); await P.click('#czWanderer [data-for="avatarTexture"] [data-v="patched"]'); await sleep(200);
    const c1 = await P.evaluate(() => ({ hat: __api.look.hat, tex: __api.look.texture, aria: document.querySelector('[data-for="avatarHat"] [data-v="cap"]').getAttribute('aria-checked') }));
    await P.focus('#czWanderer [data-for="avatarHat"] [data-v="cap"]'); await P.keyboard.press('ArrowRight'); await sleep(200);
    const c2 = await P.evaluate(() => ({ hat: __api.look.hat, focus: document.activeElement && document.activeElement.dataset.v }));
    const s1 = await saved(P, 'wanderer-appearance');
    check('hat and texture chips set the game\'s look and save it; arrow keys move and select', c1.hat === 'cap' && c1.tex === 'patched' && c1.aria === 'true' && c2.hat === 'beanie' && c2.focus === 'beanie' && s1.hat === 'beanie' && s1.texture === 'patched', { c1, c2, s1 });
    // swatches and custom colours
    await P.click('#czWanderer [data-for="avatarMain"] [data-v="#a7b298"]'); await P.click('#czWanderer [data-for="avatarHands"] [data-v="#55524a"]'); await sleep(200);
    const w1 = await P.evaluate(() => ({ main: __api.look.main, hands: __api.look.hands }));
    await P.evaluate(() => { const i = document.getElementById('avatarMain'); i.value = '#123456'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(200);
    const w2 = await P.evaluate(() => ({ main: __api.look.main, pick: document.querySelector('#avatarMain').closest('.cz-pick').classList.contains('on'), none: ![...document.querySelectorAll('[data-for="avatarMain"] [aria-checked="true"]')].length }));
    const s2 = await saved(P, 'wanderer-appearance');
    check('body and hand swatches set the colours; a custom colour clears the swatches and marks the picker; all saved', w1.main === '#a7b298' && w1.hands === '#55524a' && w2.main === '#123456' && w2.pick && w2.none && s2.main === '#123456' && s2.hands === '#55524a', { w1, w2, s2 });
    // loadout
    await P.click('#czTab_loadout'); await sleep(500);
    const l0 = await P.evaluate(() => ({ cards: [...document.querySelectorAll('#lightCards .lc')].map(c => c.dataset.kind), disabled: [...document.querySelectorAll('#lightCards .lc')].some(c => c.disabled), parts: !!document.querySelector('#lightParts input[data-part]'), zoom: !!document.getElementById('lightZoom') }));
    check('LOADOUT lists the four devices (flashlight, headlamp, lantern, Night Vision Camcorder) with parts and a close-up', l0.cards.join() === 'flashlight,headlamp,lantern,camcorder' && !l0.disabled && l0.parts && l0.zoom, l0);
    await P.click('#lightCards .lc[data-kind="headlamp"]'); await sleep(400);
    await P.click('#czBeam [data-v="#ffc98a"]'); await sleep(200);
    const part = await P.evaluate(() => { const i = document.querySelector('#lightParts input[data-part]'); i.value = '#336699'; i.dispatchEvent(new Event('input', { bubbles: true })); return i.dataset.part; }); await sleep(200);
    const l1 = await P.evaluate(p => ({ kind: __api.gear.eq.kind, color: __api.gear.eq.color, part: (__api.gear.eq.parts.headlamp || {})[p], note: document.getElementById('czKindNote').textContent, beam: !document.getElementById('czBeam').hidden }), part);
    const s3 = await saved(P, 'wanderer-light');
    check('choosing the headlamp, a beam colour and a part colour drives the game\'s equipment and saves it', l1.kind === 'headlamp' && l1.color === '#ffc98a' && l1.part === '#336699' && /Headlamp/.test(l1.note) && l1.beam && s3.kind === 'headlamp' && s3.color === '#ffc98a', { l1, s3 });
    await P.click('#lightCards .lc[data-kind="camcorder"]'); await sleep(400);
    const l2 = await P.evaluate(() => ({ kind: __api.gear.eq.kind, beam: document.getElementById('czBeam').hidden, note: document.getElementById('czKindNote').textContent, card: document.querySelector('#lightCards .lc[data-kind="camcorder"]').textContent }));
    check('the Night Vision Camcorder has no beam colour and says: "' + CAM_LINE + '"', l2.kind === 'camcorder' && l2.beam && l2.note.includes(CAM_LINE) && /no visible light/i.test(l2.card) && /infrared/i.test(l2.card), l2);
    await P.click('#lightCards .lc[data-kind="lantern"]'); await sleep(300);
    await P.keyboard.press('Escape'); await sleep(700);
    const c3 = await P.evaluate(() => ({ st: __ui.state(), started: __avatarApp.ticker.started, paused: __api.paused(), kind: document.getElementById('mmKind').textContent }));
    check('Escape closes customize back to the menu: preview idle again, nothing paused, the PLAY panel shows the new device', c3.st === 'menu' && c3.started === false && !c3.paused && /lantern/i.test(c3.kind), c3);
    // ---- the run: one device per run; the look can still change
    await U.start(P, 'Alpha'); await U.admin(P); await H.stage(P); await H.place(P, 1200, 3408, 0, { light: true, kind: 'lantern' });
    await P.keyboard.press('Escape'); await sleep(500); await P.click('#pauseCustomize'); await sleep(800);
    await P.click('#czTab_loadout'); await sleep(400);
    const k0 = await P.evaluate(() => ({ dis: [...document.querySelectorAll('#lightCards .lc')].every(c => c.disabled), lock: !document.getElementById('lightLock').hidden, kind: __api.gear.eq.kind }));
    await P.evaluate(() => document.querySelector('#lightCards .lc[data-kind="flashlight"]').click()); await sleep(300);
    const k1 = await P.evaluate(() => __api.gear.eq.kind);
    await P.click('#czTab_wanderer'); await sleep(300); await P.click('#czWanderer [data-for="avatarHat"] [data-v="hardhat"]'); await sleep(200);
    const k2 = await P.evaluate(() => __api.look.hat);
    await P.click('#doneAppearance'); await sleep(600);
    const k3 = await P.evaluate(() => ({ st: __ui.state(), paused: __api.paused() }));
    check('during a run the device is locked (cards disabled, lock note, a click changes nothing) while the hat can still change; Done returns to the pause', k0.dis && k0.lock && k0.kind === 'lantern' && k1 === 'lantern' && k2 === 'hardhat' && k3.st === 'paused' && k3.paused, { k0, k1, k2, k3 });
    await P.keyboard.press('Escape'); await sleep(400);
    // ---- page B in the same room sees A's look and light; an older client's backpack is not drawn
    const B = await U.page(b, PORT, { room }); const Q = B.P;
    await U.start(Q, 'Bravo'); await U.admin(Q); await sleep(800);
    const legacy = new H.ScriptedPeer(PORT, room, 'Legacy', 'flashlight', '#ffe7b2'); await legacy.ready; legacy.pos = { x: 1320, y: 3408 };
    legacy.send({ t: 'join' }); legacy.timer = setInterval(() => legacy.send({ t: 'p', x: legacy.pos.x, y: legacy.pos.y, vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: 'Legacy', c: '#ffe7b2', lk: 'cap|stripes|#112233|#445566|utility', mv: { s: 0, st: 100, ex: 0, sp: 0, ev: [] } }), 50);
    await H.place(Q, 1260, 3408, Math.PI, { light: true, kind: 'flashlight' }); await sleep(2500);
    const seen = await Q.evaluate(() => { const mine = __api.look; return __api.layer().children.filter(c => c.look && c.look !== mine).map(c => ({ look: { ...c.look }, kind: c.lightGear && c.lightGear.kind, color: c.lightGear && c.lightGear.color })); });
    const a = seen.find(s => s.look.hat === 'hardhat'), l = seen.find(s => s.look.main === '#445566');
    const peerLights = await Q.evaluate(() => (window.__peerLights || []).map(p => ({ kind: p.kind, color: p.color })));
    check('a second wanderer sees the first one\'s look (hard hat, patched, custom body and hands) and light (lantern, amber)', a && a.look.texture === 'patched' && a.look.main === '#123456' && a.look.hands === '#55524a' && a.look.backpack === 'none' && a.kind === 'lantern' && a.color === '#ffc98a' && peerLights.some(p => p.kind === 'lantern' && p.color === '#ffc98a'), { a, peerLights });
    check('an older client still sending a backpack is drawn without it', l && l.look.backpack === 'none' && l.look.hat === 'cap', l);
    if (opt('shots')) await U.shot(Q, path.join(path.resolve(opt('shots')), 'c3_peer_view.png'));   // what the second wanderer sees: the first (hard hat, lantern) and the older client
    legacy.close();
    R.errors.push(...A.errs.map(e => 'A: ' + e), ...B.errs.map(e => 'B: ' + e));
    await A.ctx.close(); await B.ctx.close();
    // ---- touch: customize fits the screen
    { const s = await U.page(b, PORT, { viewport: { width: 390, height: 844 }, mobile: true, dpr: 2 }); const M = s.P;
      await M.tap('#menu .mm-item[data-go="customize"]'); await sleep(900);
      const m1 = await M.evaluate(() => { const c = document.querySelector('#appearancePanel .cz').getBoundingClientRect(), d = document.getElementById('doneAppearance').getBoundingClientRect(); return { w: Math.round(c.width), over: document.documentElement.scrollWidth - innerWidth, done: d.bottom <= innerHeight && d.height >= 44 }; });
      await M.tap('#czTab_loadout'); await sleep(500);
      const m2 = await M.evaluate(() => [...document.querySelectorAll('#lightCards .lc')].every(c => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
      await M.tap('#doneAppearance'); await sleep(600);
      const m3 = await M.evaluate(() => __ui.state());
      check('390 x 844 touch: customize fills the screen, Done stays reachable, the cards fit, Done returns to the menu', m1.w === 390 && m1.over <= 0 && m1.done && m2 && m3 === 'menu', { m1, m2, m3 });
      R.errors.push(...s.errs.map(e => 'touch: ' + e)); await s.ctx.close(); }
  } catch (e) { R.errors.push('probe: ' + (e && e.stack || e)); console.log(e); }
  finally { await U.close(b, srv); }
  check('no page errors', !R.errors.length, R.errors);
  R.ok = R.checks.every(c => c.ok);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
  console.log(R.ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
  process.exit(R.ok ? 0 : 1);
})();
