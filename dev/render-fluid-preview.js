/* Native-canvas visual QA from the actual shipped avatar/entity/death/corpse
 * Graphics calls. Not a browser capture: visibility, audio and input still
 * need a browser pass. Usage: node dev/render-fluid-preview.js OUT [--sheets]
 */
'use strict';
const { harness, draw, Container } = require('./physical-harness');
const { createCanvas } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/@napi-rs/canvas' : '@napi-rs/canvas');
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const out = process.argv[2] || '/tmp/fluid-preview', sheetsOnly = process.argv.includes('--sheets'); fs.mkdirSync(out, { recursive: true });
const definitions = [
 ['HOUND A / TACKLE', 'Hound', 'A', 'open'], ['HOUND B / DRAG', 'Hound', 'B', 'open'], ['HOUND C / WALL IMPACT', 'Hound', 'C', 'wall'], ['HOUND D / EXHAUSTED', 'Hound', 'D', 'corner'],
 ['SMILER A / RESTRAINT', 'Smiler', 'A', 'open'], ['SMILER B / CORNERED', 'Smiler', 'B', 'corner'], ['SMILER C / LAST DARK', 'Smiler', 'C', 'wall'], ['SMILER D / CONTROL', 'Smiler', 'D', 'open']
];
function scene(def, opts = {}) {
 const [label, kind, variant, geometry] = def, walls = geometry === 'open' ? [] : [{ x: 314, y: 90, w: 28, h: 300 }];
 if (geometry === 'corner') walls.push({ x: 125, y: 288, w: 189, h: 28 });
 const h = harness(walls); h.look.hat = opts.hat || 'none'; h.av.look = h.look; h.av.rebuild();
 Object.assign(h.H, { vx: opts.moving ? 105 : 0, vy: opts.moving ? 22 : 0, stamina: variant === 'D' && kind === 'Hound' ? 5 : 100, exhausted: variant === 'D' && kind === 'Hound' });
 h.av.update(0, true, false, h.H);
 const d = new h.Death(); d.start(kind, 0, { x: 160, y: 236 }, -1, null, { v: variant, w: kind === 'Hound' && variant === 'C' && geometry !== 'open' ? [314, 244, 0] : 0 });
 const entity = kind === 'Hound' ? new h.Hound() : new h.Smiler({ x: 160, y: 236, angle: 0, state: 'ATTACKING' });
 return { label, kind, variant, geometry, walls, h, d, entity, gore: opts.gore !== false };
}
function advance(s, t) {
 const { d, h } = s; h.ctx.performance.now = () => t * 1000; d.frame(t);
 s.entity.position.set(d.attacker.x, d.attacker.y); s.entity.rotation = d.attacker.angle + Math.PI / 2;
 if (s.kind === 'Hound') s.entity.attackPose(d.grip, d.impact, d.variant, d);
 else { s.entity.scale.set(1 + Math.min(1, Math.max(0, (t - .3) / 1.4)) * .9); h.win.__ents.attackSmiler(s.entity, t, 1 / 30, d); }
 if (!s.corpse) {
  h.av.update(t, true, false, h.H); h.av.position.set(d.body.x, d.body.y); h.av.rotation = d.body.angle; h.av.scale.set(1); h.av.deathPose(d.injury, d.impact, t > .24, d.physicalPose);
  if (!s.gore) h.av.wounds.clear();
  if (d.finished) { const f = new h.Finish(); f.death = d; f.person = h.av; f.creatures = new Container(); f.completeDeath(t); s.corpse = new h.Corpse(h.corpses[0]); }
 }
}
function panel(ctx, s, t, ox, oy, w, hh, local = false) {
 advance(s, t);
 ctx.save(); ctx.beginPath(); ctx.roundRect(ox, oy, w, hh, 7); ctx.clip(); ctx.fillStyle = '#77734a'; ctx.fillRect(ox, oy, w, hh);
 for (let n = 0; n < 1700; n++) { ctx.fillStyle = n % 2 ? '#635f3c30' : '#aca17125'; ctx.fillRect(ox + (n * 127.91) % w, oy + (n * 91.13) % hh, 1.5, 1.2); }
 const d = s.d, h = s.h, scale = Math.min(w / (s.variant === 'B' && s.kind === 'Hound' ? 340 : 295), (hh - 40) / 215), center = { x: s.variant === 'B' && s.kind === 'Hound' ? 175 : 220, y: 238 };
 ctx.save(); ctx.translate(ox + w * .5, oy + hh * .56); ctx.scale(scale, scale); ctx.translate(-center.x, -center.y);
 ctx.strokeStyle = '#3d39151b'; ctx.lineWidth = 1;
 for (let px = -400; px < 800; px += 96) { ctx.beginPath(); ctx.moveTo(px, -100); ctx.lineTo(px, 700); ctx.stroke(); }
 for (let py = -100; py < 700; py += 96) { ctx.beginPath(); ctx.moveTo(-400, py); ctx.lineTo(800, py); ctx.stroke(); }
 if (s.kind === 'Smiler') { const g = ctx.createLinearGradient(d.attacker.x - 90, 0, d.attacker.x + 90, 0); g.addColorStop(0, '#010301e8'); g.addColorStop(1, '#00000000'); ctx.fillStyle = g; ctx.fillRect(d.attacker.x - 200, center.y - 240, 290, 480); }
 for (const wall of s.walls) { ctx.fillStyle = '#c4b96c'; ctx.fillRect(wall.x, wall.y, wall.w, wall.h); ctx.fillStyle = '#38341e'; ctx.fillRect(wall.x - 2, wall.y, 2, wall.h); }
 const torch = d.torch; ctx.save(); ctx.translate(torch.x, torch.y); ctx.rotate(torch.angle); const light = ctx.createRadialGradient(0, 0, 0, 0, 0, 205); light.addColorStop(0, '#fff5b42c'); light.addColorStop(1, '#fff5b400'); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 205, -.36, .36); ctx.closePath(); ctx.fillStyle = light; ctx.fill(); ctx.restore();
 // Keep the attacker visible through the endpoint for motion inspection; this
 // is a laboratory render, not the live AI handoff that needs browser QA.
 if (s.gore) draw(ctx, s.corpse ? s.corpse.children[0] : d.blood);
 draw(ctx, s.corpse ? s.corpse.children[1] : h.av);
 if (s.corpse) s.corpse.children.slice(2).forEach(g => draw(ctx, g)); else draw(ctx, d.debris);
 draw(ctx, s.entity);
 ctx.restore();
 if (local && d.shade) { ctx.fillStyle = `rgba(0,0,0,${d.shade * .9})`; ctx.fillRect(ox, oy + 32, w, hh - 32); }
 ctx.fillStyle = '#10170eee'; ctx.fillRect(ox, oy, w, 34); ctx.fillStyle = '#e1dfbe'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(s.label, ox + 10, oy + 22);
 ctx.fillStyle = '#10170eda'; ctx.fillRect(ox, oy + hh - 25, w, 25); ctx.fillStyle = '#b9c3a6'; ctx.font = '11px sans-serif'; ctx.fillText(`${t.toFixed(2)}s  ·  ${s.d.motion.phase}  ·  ${s.geometry}${s.gore ? '' : '  ·  NO BLOOD'}`, ox + 10, oy + hh - 9); ctx.restore();
}
const times = [0, .18, .33, .65, 1.2, 2.15, 3.2, 5.55];
for (const def of definitions) {
 const s = scene(def), canvas = createCanvas(1440, 640), ctx = canvas.getContext('2d');
 ctx.fillStyle = '#0b1110'; ctx.fillRect(0, 0, 1440, 640); times.forEach((t, i) => panel(ctx, s, t, i % 4 * 360 + 5, Math.floor(i / 4) * 320 + 5, 350, 310));
 fs.writeFileSync(path.join(out, `${def[1].toLowerCase()}-${def[2]}-sequence.png`), canvas.toBuffer('image/png'));
}
// Detailed no-gore matrix per killer, 4 geometry/momentum cases × 4 variants.
for (const kind of ['Hound', 'Smiler']) {
 const canvas = createCanvas(1600, 1120), ctx = canvas.getContext('2d'); ctx.fillStyle = '#0b1110'; ctx.fillRect(0, 0, 1600, 1120);
 for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) { const def = [...definitions.find(d => d[1] === kind && d[2] === 'ABCD'[col])]; def[3] = row < 2 ? 'wall' : 'corner'; const s = scene(def, { moving: row % 2 === 1, gore: false }); panel(ctx, s, row < 2 ? .85 : 1.65, col * 400 + 4, row * 280 + 4, 392, 272); ctx.fillStyle = '#dfd7ac'; ctx.font = '12px sans-serif'; ctx.fillText(`${def[3]} / ${row % 2 ? 'moving' : 'stationary'}`, col * 400 + 14, row * 280 + 55); }
 fs.writeFileSync(path.join(out, `${kind.toLowerCase()}-geometry-no-gore.png`), canvas.toBuffer('image/png'));
}
console.log('Rendered all eight dense sequence sheets and wall/corner no-gore matrices');
if (sheetsOnly) process.exit(0);
(async () => {
 const W = 1440, H = 900, canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
 const encoder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-vcodec', 'png', '-r', '30', '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'v16-fluid-motion-qa.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
 for (let pass = 0; pass < 2; pass++) {
  const rate = pass ? .25 : 1, scenes = definitions.map(d => scene(d)), count = Math.round(6 / rate * 30);
  for (let frame = 0; frame < count; frame++) {
   const t = frame / 30 * rate; ctx.fillStyle = '#0b1110'; ctx.fillRect(0, 0, W, H);
   ctx.fillStyle = '#e1ddbf'; ctx.font = 'bold 25px sans-serif'; ctx.fillText(`V16 FLUID MOTION  /  ${rate === 1 ? 'NORMAL SPEED · 1×' : 'QUARTER SPEED · 0.25×'}`, 18, 35);
   ctx.fillStyle = '#91a089'; ctx.font = '13px sans-serif'; ctx.fillText('Shipped player/entity Graphics · one body + two hands · persistent endpoint · native-canvas motion review', 18, 59);
   scenes.forEach((s, i) => panel(ctx, s, t, 10 + i % 4 * 358, 77 + Math.floor(i / 4) * 398, 348, 386));
   ctx.fillStyle = '#91a089'; ctx.font = '13px sans-serif'; ctx.fillText('Open / wall / corner review · browser visibility, controls and audio remain unverified in this environment', 18, 886);
   const png = canvas.toBuffer('image/png'); if (!encoder.stdin.write(png)) await new Promise(r => encoder.stdin.once('drain', r));
   if (frame === 0 || frame % 180 === 0) console.log(`Rendered ${rate}× frame ${frame}/${count}`);
  }
 }
 encoder.stdin.end(); await new Promise((resolve, reject) => encoder.on('exit', code => code === 0 ? resolve() : reject(Error('ffmpeg exit ' + code)))); console.log('Rendered normal + quarter-speed clip');
})().catch(e => { console.error(e); process.exitCode = 1; });
