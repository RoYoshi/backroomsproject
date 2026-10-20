#!/usr/bin/env node
/* dev/pre-trial3-final-polish/tools/credits_check.js - pre-Trial 3 polish P6: the Credits page and the main menu's corner (development
 * only).
 *
 *   node dev/pre-trial3-final-polish/tools/credits_check.js [--dir DIR] [--ref DIR] [--out FILE.json] [--shots DIR]
 *
 * DIR: a complete game folder (default this repository).  REF: the accepted C5 game folder, whose credits and main-menu corner are what
 * must not be lost (default: none - the reference lists below are then the only reference).  Headless Chromium, the real page:
 *   team          Credits -> Created by: RoYoshi (Lead Developer, Programmer, Graphic Designer), then Mariikyu (Lead Developer, Creative
 *                 Director, Head of QA, Sound Designer)
 *   accents       RoYoshi's name neon green, Mariikyu's neon purple (by hue), each with a glow, each at least 4.5:1 against the page's
 *                 lightest background; no other name coloured
 *   accent_only_two  a name given any other accent ('red', '__proto__', 'toString') is drawn as every other name
 *   sources       Source material: The Backrooms Wiki, the change indication ("with changes"), CC BY-SA 3.0; every link the
 *                 reference's Credits page and main-menu corner had is on the page with the same address, opening in a new tab with
 *                 rel noopener; every name the reference's Credits listed (PixiJS, the typefaces) is still listed
 *   footer        at four sizes the main menu has no source credit and no link to the wiki or the licence; the version is still in its
 *                 bottom-right corner
 *   keyboard      Credits opened from the keyboard; Tab reaches every link on the page and stays in it; Escape closes it and the
 *                 focus is back on the Credits button
 *   phone         390 x 844 (touch): the page scrolls to its last line, nothing wider than the screen
 *   version_line  the page ends with "The Far Backrooms v" + window.TFB_VERSION.display
 * Every passcode is synthetic.  Servers are stopped by their PID.  Exit 0 only when every case holds. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const { spawn, execFileSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } })();
const REPO = path.resolve(__dirname, '../../..'), DIR = path.resolve(ARG.dir || REPO), REF = ARG.ref ? path.resolve(ARG.ref) : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cases = [], check = (name, ok, detail) => { cases.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail !== undefined ? ' - ' + String(detail).slice(0, 600) : ''}`); };
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const get = (port, p) => new Promise(r => http.get({ host: '127.0.0.1', port, path: p }, q => { q.resume(); q.on('end', () => r(q.statusCode)); }).on('error', () => r(0)));
// the links and names the accepted C5 had (its credits_data.js and its main-menu corner), used when no --ref is given
const C5_LINKS = ['https://backrooms-wiki.wikidot.com/level-0', 'https://backrooms-wiki.wikidot.com/entity-8', 'https://backrooms-wiki.wikidot.com/entity-3',
  'https://creativecommons.org/licenses/by-sa/3.0/', 'https://pixijs.com', 'https://fonts.google.com/specimen/Barlow+Condensed', 'https://fonts.google.com/specimen/IBM+Plex+Mono'];
const C5_NAMES = ['RoYoshi', 'PixiJS', 'Barlow Condensed', 'IBM Plex Mono'];
const TEAM = [['RoYoshi', 'Lead Developer, Programmer, Graphic Designer', 'green'], ['Mariikyu', 'Lead Developer, Creative Director, Head of QA, Sound Designer', 'purple']];
const SIZES = [['1920x1080', { viewport: { width: 1920, height: 1080 } }], ['2560x1080', { viewport: { width: 2560, height: 1080 } }],
  ['1366x768@1.5', { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1.5 }], ['390x844@3 touch', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }]];

async function serve(dir) {
  const port = await freePort(), srv = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, env: Object.assign({}, process.env, { ADMIN_PASSCODE: 'credits-synthetic-admin' }), stdio: 'ignore' });
  for (let i = 0; i < 150 && await get(port, '/index.html') !== 200; i++) await sleep(100);
  return { port, stop: () => { try { process.kill(srv.pid); } catch (e) { } } };
}
async function menu(b, port, opts) {
  const ctx = await b.newContext(Object.assign({ reducedMotion: 'reduce' }, opts || { viewport: { width: 1280, height: 720 } })), P = await ctx.newPage(), errs = [];
  P.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await P.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 900; i++) { const st = await P.evaluate(() => window.__boot ? __boot.state() : null).catch(() => null); if (st === 'ready') await P.keyboard.press('Space'); if (st === 'menu') break; await sleep(100); }
  await P.waitForFunction(() => window.__ui && document.getElementById('mmVer') && document.getElementById('mmVer').textContent, null, { timeout: 30000 }).catch(() => null);
  await sleep(400);
  return { ctx, P, errs };
}
const openCredits = async P => { await P.evaluate(() => window.__ui.go('credits')); await P.waitForFunction(() => { const s = document.getElementById('uiCredits'); return s && !s.hidden && s.querySelector('.cr-sec'); }, null, { timeout: 10000 }); await sleep(300); };
const READ = () => {
  const s = document.getElementById('uiCredits'), lum = c => { const m = c.match(/[\d.]+/g).map(Number).slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
  const bg = lum('rgb(22,18,11)');                                         // the sheet's lightest background (#16120b, its gradient's top)
  const ents = [...s.querySelectorAll('.cr-entry')].map(e => { const b = e.querySelector('b'), cs = getComputedStyle(b), c = cs.color.match(/[\d.]+/g).map(Number);
    return { section: e.closest('.cr-sec').querySelector('h3').textContent, name: b.textContent, note: e.querySelector('span').textContent, cls: e.className, rgb: c.slice(0, 3), shadow: cs.textShadow,
      contrast: +((lum(cs.color) + .05) / (bg + .05)).toFixed(2) }; });
  const links = [...s.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: a.textContent, target: a.target, rel: a.rel }));
  const src = [...s.querySelectorAll('.cr-sec')].find(x => /Source material/.test(x.querySelector('h3').textContent));
  const last = s.querySelector('.us-body').lastElementChild;
  return { ents, links, source: src ? src.textContent.replace(/\s+/g, ' ').trim() : null, last: last ? { cls: last.className, text: last.textContent } : null, version: window.TFB_VERSION || null };
};
const hue = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return null; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return Math.round(h < 0 ? h + 360 : h); };
const sat = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
async function refInfo(b) {                                                // the reference's credits links / names and its corner's links
  if (!REF) return { links: C5_LINKS, names: C5_NAMES, from: 'the lists in this tool (the accepted C5)' };
  const s = await serve(REF);
  try {
    const m = await menu(b, s.port);
    try {
      const corner = await m.P.evaluate(() => [...document.querySelectorAll('#menu .mm-foot a[href]')].map(a => a.href));
      await openCredits(m.P); const r = await m.P.evaluate(READ);
      return { links: [...new Set(r.links.map(l => l.href).concat(corner))], names: r.ents.map(e => e.name), corner, from: REF };
    } finally { await m.ctx.close(); }
  } finally { s.stop(); }
}
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const shots = ARG.shots ? path.resolve(ARG.shots) : null; if (shots) fs.mkdirSync(shots, { recursive: true });
  const R = { tool: 'dev/pre-trial3-final-polish/tools/credits_check.js', dir: DIR, ref: REF, chromium: b.version(), cases };
  try {
    const ref = R.reference = await refInfo(b);
    const s = await serve(DIR);
    try {
      // the page, read at 1280 x 720
      { const m = await menu(b, s.port);
        try {
          await openCredits(m.P); const r = R.page = await m.P.evaluate(READ);
          if (shots) await m.P.screenshot({ path: path.join(shots, 'credits_1280.png') });
          const created = r.ents.filter(e => e.section === 'Created by');
          check('team', created.length === 2 && TEAM.every(([n, note], i) => created[i] && created[i].name === n && created[i].note === note), JSON.stringify(created.map(e => [e.name, e.note])));
          const acc = TEAM.map(([n, , want]) => { const e = created.find(x => x.name === n); if (!e) return { n, ok: false }; const h = hue(e.rgb), sv = sat(e.rgb);
            const okHue = want === 'green' ? h >= 105 && h <= 160 : h >= 255 && h <= 295;
            return { n, rgb: e.rgb, hue: h, sat: +sv.toFixed(2), glow: e.shadow !== 'none', contrast: e.contrast, ok: okHue && sv >= .4 && e.shadow !== 'none' && e.contrast >= 4.5 }; });
          const plain = r.ents.filter(e => !TEAM.some(([n]) => n === e.name)), plainOk = plain.every(e => !/cr-(green|purple)/.test(e.cls) && e.shadow === 'none');
          check('accents', acc.every(a => a.ok) && plainOk, JSON.stringify({ team: acc, othersPlain: plainOk, othersColour: [...new Set(plain.map(e => e.rgb.join(',')))] }));
          // the reference's addresses compared as the page resolves them (https://pixijs.com -> https://pixijs.com/)
          const norm = u => new URL(u).href, links = r.links, missing = ref.links.filter(u => !links.some(l => l.href === norm(u))), unsafe = links.filter(l => l.target !== '_blank' || !/\bnoopener\b/.test(l.rel));
          const namesMissing = ref.names.filter(n => !r.ents.some(e => e.name === n));
          const srcOk = !!r.source && /The Backrooms Wiki/.test(r.source) && /with changes/.test(r.source) && /CC BY-SA 3\.0/.test(r.source) && /Creative Commons Attribution-ShareAlike 3\.0/.test(r.source);
          check('sources', srcOk && !missing.length && !unsafe.length && !namesMissing.length, JSON.stringify({ source: r.source, linksMissing: missing, unsafeLinks: unsafe, namesMissing, links: links.map(l => l.href), reference: ref.from }));
          const V = r.version && r.version.display;
          check('version_line', !!V && r.last && r.last.cls === 'cr-fine' && r.last.text === 'The Far Backrooms v' + V, JSON.stringify(r.last));
        } finally { await m.ctx.close(); } }
      // any accent but the two is ignored
      { const m = await menu(b, s.port);
        try {
          await m.P.evaluate(() => { window.TFB_CREDITS.sections.push({ heading: 'Accent check', entries: [{ name: 'Red one', accent: 'red' }, { name: 'Proto one', accent: '__proto__' }, { name: 'Method one', accent: 'toString' }] }); });
          await openCredits(m.P); const r = await m.P.evaluate(READ);
          const t = r.ents.filter(e => e.section === 'Accent check'), plain = r.ents.find(e => e.name === 'PixiJS');
          check('accent_only_two', t.length === 3 && t.every(e => e.cls === 'cr-entry' && e.shadow === 'none' && plain && e.rgb.join() === plain.rgb.join()), JSON.stringify(t.map(e => [e.name, e.cls, e.rgb.join(','), e.shadow])));
        } finally { await m.ctx.close(); } }
      // the main menu's corner, at four sizes
      { const rows = [];
        for (const [name, o] of SIZES) {
          const m = await menu(b, s.port, o);
          try {
            const f = await m.P.evaluate(() => { const menu = document.getElementById('menu'), v = document.getElementById('mmVer'), r = v.getBoundingClientRect();
              return { src: !!menu.querySelector('.mm-src'), wikiText: /Backrooms Wiki|CC BY-SA/.test(menu.textContent), wikiLinks: [...menu.querySelectorAll('a[href]')].filter(a => /wikidot|creativecommons/.test(a.href)).map(a => a.href),
                ver: v.textContent, right: +(innerWidth - r.right).toFixed(1), bottom: +(innerHeight - r.bottom).toFixed(1), shown: r.width > 0 && getComputedStyle(v).visibility !== 'hidden' }; });
            f.size = name; f.ok = !f.src && !f.wikiText && !f.wikiLinks.length && /^v\d+\.\d+\.\d+$/.test(f.ver) && f.shown && f.right >= 0 && f.right <= 80 && f.bottom >= 0 && f.bottom <= 80;
            rows.push(f);
            if (shots && (name === '1920x1080' || name.startsWith('390'))) await m.P.screenshot({ path: path.join(shots, `menu_${name.split('@')[0]}.png`) });
          } finally { await m.ctx.close(); }
        }
        check('footer', rows.every(x => x.ok), JSON.stringify(rows)); }
      // the keyboard
      { const m = await menu(b, s.port);
        try {
          const P = m.P;
          await P.evaluate(() => document.querySelector('#menu [data-go=credits]').focus()); await P.keyboard.press('Enter');
          await P.waitForFunction(() => { const s = document.getElementById('uiCredits'); return s && !s.hidden && s.querySelector('.cr-sec'); }, null, { timeout: 10000 }); await sleep(400);
          const want = await P.evaluate(() => [...document.querySelectorAll('#uiCredits a[href]')].map(a => a.href)), seen = new Set(); let outside = 0;
          for (let i = 0; i < want.length + 6; i++) { await P.keyboard.press('Tab'); const a = await P.evaluate(() => { const e = document.activeElement; return { inside: !!(e && e.closest('#uiCredits')), href: e && e.href || null }; }); if (!a.inside) outside++; if (a.href) seen.add(a.href); }
          await P.keyboard.press('Escape'); await sleep(500);
          const after = await P.evaluate(() => ({ hidden: document.getElementById('uiCredits').hidden, focus: document.activeElement && document.activeElement.matches('#menu [data-go=credits]') }));
          check('keyboard', want.every(h => seen.has(h)) && !outside && after.hidden && after.focus, JSON.stringify({ links: want.length, reached: seen.size, focusLeftThePage: outside, closed: after.hidden, focusBack: after.focus, errors: m.errs }));
        } finally { await m.ctx.close(); } }
      // a phone
      { const m = await menu(b, s.port, SIZES[3][1]);
        try {
          await openCredits(m.P);
          const r = await m.P.evaluate(async () => { const body = document.querySelector('#uiCredits .us-body'), last = body.lastElementChild; body.scrollTop = body.scrollHeight; await new Promise(r => setTimeout(r, 300));
            const lr = last.getBoundingClientRect(), br = body.getBoundingClientRect();
            return { scrolls: body.scrollHeight > body.clientHeight, lastInView: lr.bottom <= br.bottom + 1 && lr.top >= br.top - 1, wide: document.scrollingElement.scrollWidth > innerWidth || body.scrollWidth > body.clientWidth, lastText: last.textContent }; });
          if (shots) await m.P.screenshot({ path: path.join(shots, 'credits_phone_end.png') });
          check('phone', r.scrolls && r.lastInView && !r.wide, JSON.stringify(r));
        } finally { await m.ctx.close(); } }
    } finally { s.stop(); }
  } catch (e) { check('error', false, String(e && e.stack || e).slice(0, 400)); }
  finally { await b.close(); }
  R.ok = cases.length > 0 && cases.every(c => c.ok);
  if (ARG.out) fs.writeFileSync(path.resolve(ARG.out), JSON.stringify(R, null, 1) + '\n');
  console.log(`CREDITS: ${R.ok ? 'PASS' : 'FAIL'} - ${cases.filter(c => c.ok).length} of ${cases.length} cases`);
  process.exitCode = R.ok ? 0 : 1;
})();
