#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/art_lab.js - R14: the Skin-Stealer's body as the page draws it, laid out for review (development tool;
 * checkpoint evidence, not a gate step).  Trial 3 and its refinements are not owner-approved.
 *
 *   node dev/trial-3-r9-overhaul/tools/art_lab.js --out FILE.png [--dir TREE] [--acts "label:act[:speed],..."]
 *
 * The tree's own built page script (public/assets/skinstealer.js: its mirror, its body) runs in a VM; its Pixi classes are recorders that
 * write what it draws as SVG; Chromium (Playwright) turns the SVG into a PNG.  Each row is one act at eight headings (0, 45 ... 315 deg),
 * moving at its speed (a negative speed: backing away), mirrored and drawn for 2.5 s at 60 fps exactly as the page does; at the left a
 * Wanderer (the bundle's player-view.ts: a 36 px body, two hands) for scale.  One px of the sheet is one px of the floor (the game's
 * camera then zooms 0.9).  No light, no darkness, no floor texture: the real page's look is r9_browser.js --scene gallery. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');
const ARG = { acts: 'stand:,watch:watch,listen:listen,pace (open approach):pace:90,back (feint):back:-60,creep:creep:62,run (chase):chase:255,wait (coiled):wait,wind-up:wind,pounce:pounce:380,recover:recover,feed:feed' };
for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const DIR = path.resolve(ARG.dir || path.join(__dirname, '..', '..', '..')), OUT = path.resolve(ARG.out || 'lineup.png');
const KACT = ['', 'watch', 'back', 'leave', 'wait', 'lure', 'intercept', 'search', 'listen', 'approach', 'creep', 'chase', 'wind', 'pounce', 'recover', 'feed', 'mimic', 'rest', 'pace'];
const hex = c => '#' + (c >>> 0).toString(16).padStart(6, '0');
class FakeC {
  constructor() { this.children = []; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y === undefined ? x : y; } };
    this.scale = { x: 1, y: 1, set: (x, y) => { this.scale.x = x; this.scale.y = y === undefined ? x : y; } }; this.rotation = 0; this.alpha = 1; this.visible = true; this.tint = 0xffffff; }
  addChild(c) { this.children.push(c); c.parent = this; return c; } removeChild(c) { this.children = this.children.filter(x => x !== c); } destroy() { }
}
/* a Graphics that writes SVG: a path is built by moveTo / lineTo / curves / shapes and closed by fill or stroke (a fill then a stroke use the
 * same path, as Pixi's do; the next shape after either starts a new one) */
class FakeG extends FakeC {
  constructor() { super(); this.clear(); }
  clear() { this.ops = []; this.cur = []; this.done = false; return this; }
  _np() { if (this.done) { this.cur = []; this.done = false; } }
  moveTo(x, y) { this._np(); this.cur.push(`M${x.toFixed(2)} ${y.toFixed(2)}`); return this; }
  lineTo(x, y) { this.cur.push(`L${x.toFixed(2)} ${y.toFixed(2)}`); return this; }
  quadraticCurveTo(a, b, x, y) { this.cur.push(`Q${a.toFixed(2)} ${b.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`); return this; }
  ellipse(x, y, rx, ry) { this._np(); this.cur.push(`M${(x - rx).toFixed(2)} ${y.toFixed(2)}a${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${(2 * rx).toFixed(2)} 0a${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${(-2 * rx).toFixed(2)} 0Z`); return this; }
  circle(x, y, r) { return this.ellipse(x, y, r, r); }
  poly(p) { this._np(); let d = ''; for (let i = 0; i < p.length; i += 2) d += (i ? 'L' : 'M') + p[i].toFixed(2) + ' ' + p[i + 1].toFixed(2); this.cur.push(d + 'Z'); return this; }
  fill(f) { const c = typeof f === 'object' ? f.color : f, a = typeof f === 'object' && f.alpha !== undefined ? f.alpha : 1; this.ops.push(`<path d="${this.cur.join('')}" fill="${hex(c)}" fill-opacity="${a}"/>`); this.done = true; return this; }
  stroke(s) { this.ops.push(`<path d="${this.cur.join('')}" fill="none" stroke="${hex(s.color)}" stroke-width="${s.width || 1}" stroke-opacity="${s.alpha === undefined ? 1 : s.alpha}" stroke-linecap="${s.cap || 'butt'}" stroke-linejoin="round"/>`); this.done = true; return this; }
}
const layer = new FakeC();
const ctx = { console, Math, performance: { now: () => 0 }, innerWidth: 1024, innerHeight: 640, document: { getElementById: () => null, querySelector: () => null }, setTimeout: () => 0 };
ctx.window = ctx; vm.createContext(ctx);
ctx.__api = { layer: () => layer, death: () => ({ blood: new FakeG() }), H: { x: 0, y: 0 }, lightOn: () => true };
ctx.__light = { mk: () => ({}), sample: () => ({ total: .8, direct: .6, dirX: -.6, dirY: -.8 }), shade: () => 1, ray: () => 60 };   // (a lamp up and to the left; nothing tinted)
vm.runInContext(fs.readFileSync(path.join(DIR, 'public', 'assets', 'skinstealer.js'), 'utf8'), ctx);
const K = ctx.__skin;
function svgOf(n) {
  if (n.visible === false) return '';
  const t = `translate(${n.position.x.toFixed(2)} ${n.position.y.toFixed(2)}) rotate(${(n.rotation * 180 / Math.PI).toFixed(2)}) scale(${n.scale.x.toFixed(3)} ${n.scale.y.toFixed(3)})`;
  return `<g transform="${t}" opacity="${n.alpha}">${n.ops ? n.ops.join('') : ''}${n.children.map(svgOf).join('')}</g>`;
}
const wanderer = (x, y) => `<g transform="translate(${x} ${y})"><circle cx="0" cy="1" r="18" fill="#8a6a4a" stroke="#413d2b" stroke-width="1.6"/><circle cx="-13" cy="-13" r="6" fill="#d2a37c" stroke="#494832" stroke-width="1.5"/><circle cx="13" cy="-13" r="6" fill="#d2a37c" stroke="#494832" stroke-width="1.5"/></g>`;
const ACTS = ARG.acts.split(',').map(s => s.split(':')), cell = 150, W = cell * 9, H = cell * ACTS.length;
let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#6b5d3a"/>`;
ACTS.forEach(([label, act, v], row) => {
  const spd = +(v || 0), y0 = row * cell + cell / 2;
  out += wanderer(cell / 2, y0) + `<text x="6" y="${row * cell + 14}" font-size="12" fill="#fff" font-family="sans-serif">${label}</text>`;
  const ents = []; for (let i = 0; i < 8; i++) ents.push({ i: 500 + i, a: i * Math.PI / 4, x0: cell * (i + 1.5), y0 });
  for (let f = 0; f < 150; f++) {
    const t = f / 60, back = spd < 0 ? Math.PI : 0, m = Math.abs(spd) * t;
    const L = ents.map(e => ({ i: e.i, x: e.x0 + Math.cos(e.a + back) * m, y: e.y0 + Math.sin(e.a + back) * m, a: e.a, s: 1, ac: KACT.indexOf(act), v: Math.abs(spd), h: 0 }));
    ctx.__api.H = { x: L.reduce((a, o) => a + o.x, 0) / L.length, y: L.reduce((a, o) => a + o.y, 0) / L.length };   // (the page's player near them: nothing culled)
    K.mirror(L, 1 / 60); ctx.performance.now = () => t * 1000; K.draw(1 / 60);
  }
  for (const c of layer.children) if (c.__id >= 500 && c.__id < 508) { const e = ents[c.__id - 500]; c.position.set(e.x0, e.y0); out += svgOf(c); }   // (each back at its cell)
  K.mirror([], 1 / 60); K.draw(1 / 60);
});
const svg = OUT.replace(/\.png$/i, '') + '.svg';
fs.writeFileSync(svg, out + '</svg>');
const groot = execFileSync('npm', ['root', '-g']).toString().trim();
const pw = (() => { try { return require('playwright'); } catch (e) { return require(path.join(groot, 'playwright')); } })();
(async () => { const b = await pw.chromium.launch(); const p = await b.newPage(); await p.setViewportSize({ width: W, height: H });
  await p.setContent(`<html><body style="margin:0">${fs.readFileSync(svg, 'utf8')}</body></html>`); await p.screenshot({ path: OUT }); await b.close(); fs.unlinkSync(svg);
  console.log(`wrote ${path.basename(OUT)}: ${ACTS.length} acts x 8 headings`); })();
