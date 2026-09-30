/* Offline review clip using the shipped procedural avatar/entity Graphics
 * calls and the actual death/corpse hooks. This is a motion review, not a full
 * browser screenshot or a replacement for the game's visibility renderer. */
const { harness, draw } = require('./physical-harness');
const { createCanvas } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/@napi-rs/canvas');
const fs = require('fs'), path = require('path');
const out = process.argv[2] || '/tmp/physical-preview'; fs.mkdirSync(out, { recursive: true });
const W = 1100, H = 800, canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
const definitions = [['HOUND / TACKLE', 'Hound', 'A'], ['HOUND / DRAG', 'Hound', 'B'], ['HOUND / WALL IMPACT', 'Hound', 'C'], ['SMILER / CAPTURE', 'Smiler', 'A']];
const scenes = definitions.map(([label, kind, variant]) => {
  const walls = variant === 'C' ? [{ x: 360, y: 120, w: 30, h: 260 }] : [];
  const h = harness(walls), d = new h.Death(); d.start(kind, 0, { x: 200, y: 240 }, -1, null, { v: variant, w: variant === 'C' ? [360, 240, 0] : 0 });
  const entity = kind === 'Hound' ? new h.Hound() : new h.Smiler({ x: 200, y: 240, angle: 0, state: 'ATTACKING' });
  return { label, kind, variant, walls, h, d, entity };
});
for (let frame = 0; frame < 165; frame++) {
  const t = frame / 30;
  ctx.fillStyle = '#0b1110'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e0dcc4'; ctx.font = 'bold 23px sans-serif'; ctx.fillText('V16 / BODY + TWO HANDS', 30, 38);
  ctx.fillStyle = '#869488'; ctx.font = '14px sans-serif'; ctx.fillText('Original player artwork · continuous motion · final pose becomes the corpse', 30, 63);
  scenes.forEach((s, i) => {
    const ox = 20 + (i % 2) * 545, oy = 82 + Math.floor(i / 2) * 345;
    ctx.save(); ctx.beginPath(); ctx.roundRect(ox, oy, 530, 330, 9); ctx.clip();
    ctx.fillStyle = '#77734a'; ctx.fillRect(ox, oy, 530, 330);
    for (let n = 0; n < 4000; n++) { const x = (n * 127.91) % 530, y = (n * 91.13) % 330; ctx.fillStyle = n % 2 ? '#635f3c33' : '#aba07122'; ctx.fillRect(ox + x, oy + y, 1.4, 1.1); }
    ctx.translate(ox + 270, oy + 180); ctx.scale(1.55, 1.55); ctx.translate(-240, -240);
    if (s.kind === 'Smiler') { const g = ctx.createLinearGradient(95, 0, 235, 0); g.addColorStop(0, '#000'); g.addColorStop(1, '#00000000'); ctx.fillStyle = g; ctx.fillRect(55, 90, 180, 310); }
    for (const w of s.walls) { ctx.fillStyle = '#c4b96c'; ctx.fillRect(w.x, w.y, w.w, w.h); ctx.fillStyle = '#37331e'; ctx.fillRect(w.x - 3, w.y, 3, w.h); }
    const d = s.d, h = s.h; h.ctx.performance.now = () => t * 1000; d.frame(t);
    if (!s.corpse && d.finished) { const f = new h.Finish(); f.death = d; f.completeDeath(t); s.corpse = new h.Corpse(h.corpses[0]); }
    const torch = d.torch; ctx.save(); ctx.translate(torch.x, torch.y); ctx.rotate(torch.angle);
    const light = ctx.createRadialGradient(0, 0, 0, 0, 0, 200); light.addColorStop(0, '#fff5a825'); light.addColorStop(1, '#fff5a800');
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 200, -.35, .35); ctx.closePath(); ctx.fillStyle = light; ctx.fill(); ctx.restore();
    if (s.corpse) draw(ctx, s.corpse);
    else {
      draw(ctx, d.blood); s.entity.position.set(d.attacker.x, d.attacker.y); s.entity.rotation = d.attacker.angle + Math.PI / 2;
      if (s.kind === 'Hound') s.entity.attackPose(d.grip, d.impact, d.variant);
      else h.win.__ents.attackSmiler(s.entity, t, 1 / 30);
      draw(ctx, s.entity);
      h.av.update(t, true, false, h.H); h.av.position.set(d.body.x, d.body.y); h.av.rotation = d.body.angle; h.av.scale.set(d.body.scaleX, d.body.scaleY); h.av.deathPose(d.injury, d.impact, t > .24, d.physicalPose);
      draw(ctx, h.av); draw(ctx, d.debris);
    }
    ctx.restore();
    ctx.fillStyle = '#0b1110d9'; ctx.fillRect(ox, oy, 530, 38); ctx.fillStyle = '#ddd7b8'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(s.label, ox + 14, oy + 25);
    ctx.fillStyle = '#a6b295'; ctx.font = '12px sans-serif'; ctx.fillText(t < 3.85 ? 'CONTACT / ' + t.toFixed(2) + 's' : 'PERSISTENT CORPSE', ox + 357, oy + 25);
  });
  ctx.fillStyle = '#8c9989'; ctx.font = '14px sans-serif'; ctx.fillText('One rounded body. Two circular hands. No player limbs or skeleton.', 30, 786);
  const png = canvas.toBuffer('image/png'); fs.writeFileSync(path.join(out, String(frame).padStart(4, '0') + '.png'), png);
  if (frame === 35 || frame === 125) fs.writeFileSync(path.join(out, frame === 35 ? 'contact.png' : 'corpses.png'), png);
}
console.log('Rendered 165 frames from actual death/corpse classes');
