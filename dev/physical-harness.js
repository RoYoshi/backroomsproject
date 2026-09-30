/* Execute the shipped avatar, death and corpse classes with recorded Graphics
 * calls. This tests the real renderer hooks and can render them on a 2D canvas
 * without depending on WebGL or replacing any in-game player artwork. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
class Container {
  constructor() {
    this.x = this.y = this.rotation = 0; this.visible = true; this.alpha = 1; this.children = [];
    this.scale = { x: 1, y: 1, set(x, y = x) { this.x = x; this.y = y; } };
    this.pivot = { x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; } };
    this.position = { set: (x, y = x) => { this.x = x; this.y = y; } };
  }
  addChild(...c) { c.forEach(x => { x.parent = this; this.children.push(x); }); return c[0]; }
  addChildAt(c, i) { c.parent = this; this.children.splice(i, 0, c); return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); c.parent = null; return c; }
  removeChildren() { const c = this.children; this.children = []; c.forEach(x => x.parent = null); return c; }
  destroy() { this.removeChildren(); this.destroyed = true; }
}
class Graphics extends Container {
  constructor() { super(); this.ops = []; }
  clear() { this.ops = []; return this; }
  clone() { const g = new Graphics(); g.ops = structuredClone(this.ops); return g; }
}
for (const method of ['circle', 'ellipse', 'rect', 'roundRect', 'poly', 'moveTo', 'lineTo', 'arc', 'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'fill', 'stroke', 'cut']) {
  Graphics.prototype[method] = function (...a) { this.ops.push([method, ...a]); return this; };
}
function harness(rectangles = []) {
  const s = fs.readFileSync(path.join(ROOT, 'assets/index-DKbV5Nv9.js'), 'utf8');
  const look = { hat: 'cap', texture: 'plain', hands: '#e6bb76', main: '#ffcc77', backpack: 'canvas' };
  const H = { id: 'test', name: 'Wanderer', x: 240, y: 240, angle: 0, vx: 0, vy: 0, distance: 0, equipment: { kind: 'flashlight', color: '#ffe7b2', parts: {} } };
  const win = { __api: null }, q = [], corpses = [];
  const ctx = vm.createContext({ window: win, O: Container, I: Graphics, H, U: look, Zc: H.equipment, Wc: H.equipment,
    Uc: (x, y, a, dist) => dist, Bc: () => rectangles, sl: () => true, zc: () => true, q, G: {}, au: true,
    J: (a, b, v) => { let t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); },
    ql: { Hound: [.24, .74, 1.2, 1.7], Smiler: [.38, .98, 1.48] }, Ql: rec => { rec.id = 'corpse'; corpses.push(rec); return rec; },
    document: { getElementById: () => null }, performance: { now: () => 0 }, console, Math });
  function section(a, b, prefix = '') { const start = s.indexOf(a); const end = s.indexOf(b, start); if (start < 0 || end < 0) throw Error(a); vm.runInContext(prefix + s.slice(start, end), ctx); }
  section('var PD=', 'function Pg('); section('function Pg(', 'var Gc=');
  section('var $c=class', ',el=[];');
  section('Wl=class', ',Gl=class', 'var '); section('Gl=class', ',Kl=q.map', 'var ');
  section('Jl=class', ',Yl=[]', 'var '); section('var eu=class', ',tu=class');
  const complete = s.slice(s.indexOf('completeDeath(e){'), s.indexOf('clearRemains(){', s.indexOf('completeDeath(e){')));
  vm.runInContext('var Finish=class{' + complete + '}', ctx);
  for (const file of ['gore.js', 'ents.js', 'death-motion.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx);
  const Avatar = vm.runInContext('$c', ctx), Death = vm.runInContext('Jl', ctx), Corpse = vm.runInContext('eu', ctx), Finish = vm.runInContext('Finish', ctx);
  const av = new Avatar(look, H.equipment);
  win.__api = { H, look, Bc: () => rectangles, el: [], avatar: () => av, mkAvatar: (l, g) => new Avatar(l, g), audio: () => null };
  av.update(0, true, false, H);
  return { win, ctx, Avatar, Death, Corpse, Finish, av, H, look, corpses, Hound: vm.runInContext('Wl', ctx), Smiler: vm.runInContext('Gl', ctx) };
}
const color = c => '#' + ((c === undefined ? 0 : c) >>> 0).toString(16).padStart(6, '0').slice(-6);
function drawGraphics(ctx, g) {
  let painted = true;
  const start = () => { if (painted) ctx.beginPath(); painted = false; };
  for (const [op, ...a] of g.ops) {
    if (op === 'fill' || op === 'stroke') {
      const style = typeof a[0] === 'object' ? a[0] : { color: a[0] };
      ctx.save(); ctx.globalAlpha *= style.alpha === undefined ? 1 : style.alpha;
      if (op === 'fill') { ctx.fillStyle = color(style.color); ctx.fill(); }
      else { ctx.strokeStyle = color(style.color); ctx.lineWidth = style.width || 1; ctx.lineCap = style.cap || 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
      ctx.restore(); painted = true; continue;
    }
    if (op === 'cut') continue;
    start();
    if (op === 'circle') { ctx.moveTo(a[0] + a[2], a[1]); ctx.arc(a[0], a[1], a[2], 0, Math.PI * 2); }
    else if (op === 'ellipse') { ctx.moveTo(a[0] + a[2], a[1]); ctx.ellipse(a[0], a[1], a[2], a[3], 0, 0, Math.PI * 2); }
    else if (op === 'poly') { const p = a[0]; ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); }
    else if (op === 'roundRect') ctx.roundRect(a[0], a[1], a[2], a[3], a[4]);
    else ctx[op](...a);
  }
}
function draw(ctx, obj) {
  if (!obj || !obj.visible || obj.alpha <= 0) return;
  ctx.save(); ctx.translate(obj.x, obj.y); ctx.rotate(obj.rotation); ctx.scale(obj.scale.x, obj.scale.y); ctx.translate(-obj.pivot.x, -obj.pivot.y); ctx.globalAlpha *= obj.alpha;
  if (obj.ops) drawGraphics(ctx, obj);
  for (const c of obj.children) draw(ctx, c);
  ctx.restore();
}
module.exports = { harness, draw, Container, Graphics, ROOT };
