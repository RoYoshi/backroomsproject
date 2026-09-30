/* Admin-only visual sandbox. It renders the shipped Pixi avatar/entities in an
 * independent viewport; it never sets CAUGHT/DEAD or mutates the live map/AI. */
(() => {
  'use strict';
  let authorized = false, app = null, world = null, run = null, raf = 0, lastAt = 0, token = 0;
  const box = document.createElement('section'); box.id = 'deathLab'; box.hidden = true;
  box.innerHTML = `<div class="dl-head"><b>DEATH ANIMATION LAB</b><button id="dlClose">CLOSE</button></div>
    <div class="dl-layout"><div class="dl-controls">
    <label>Entity<select id="dlKind"><option>Hound</option><option>Smiler</option></select></label>
    <label>Variant<select id="dlVariant"><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
    <label>Geometry<select id="dlGeometry"><option value="level">Actual Level 0</option><option value="open">Open room</option><option value="wall">Near wall</option><option value="corner">Near corner</option></select></label>
    <label>Victim movement<select id="dlMoving"><option value="0">Stationary</option><option value="1">Moving</option></select></label>
    <label>Stamina<input id="dlStamina" type="number" min="0" max="100" value="100"></label>
    <label>Light<select id="dlGear"><option value="flashlight">Flashlight</option><option value="headlamp">Headlamp</option><option value="lantern">Lantern</option><option value="camcorder">Camcorder</option></select></label>
    <label>View<select id="dlView"><option value="spectator">Spectator</option><option value="victim">Local victim</option></select></label>
    <label>Speed<select id="dlRate"><option value="1">1×</option><option value=".5">0.5×</option><option value=".25">0.25×</option></select></label>
    <div class="dl-coords"><label>Victim X<input id="dlVX" type="number" step="1"></label><label>Y<input id="dlVY" type="number" step="1"></label><label>Attacker X<input id="dlAX" type="number" step="1"></label><label>Y<input id="dlAY" type="number" step="1"></label></div>
    <button id="dlHere">PLACE AT MY POSITION</button><button id="dlReplay">REPLAY</button><button id="dlReset">RESET / PAUSE AT START</button><button id="dlPause">PAUSE</button><button id="dlStep">FRAME STEP / 120 HZ</button>
    <label class="dl-check"><input id="dlVectors" type="checkbox" checked> Show motion diagnostics</label>
    <label class="dl-check"><input id="dlBlood" type="checkbox" checked> Blood / wounds</label>
    <p>Cosmetic sandbox. Live multiplayer continues behind this window.</p>
    </div><div class="dl-stage"><div id="dlViewport"></div><canvas id="dlDiagnostics"></canvas><output id="dlStatus"></output></div></div>`;
  document.body.appendChild(box);
  const $ = id => document.getElementById(id), n = id => +$(id).value || 0;
  function place() { const H = window.__api.H; $('dlVX').value = Math.round(H.x); $('dlVY').value = Math.round(H.y); $('dlAX').value = Math.round(H.x - 85); $('dlAY').value = Math.round(H.y); }
  function wipe() {
    if (!run) return;
    world.removeChildren().forEach(c => c.destroy({ children: true })); run = null;
  }
  function replay() {
    if (!authorized || !app) return;
    wipe(); const A = window.__api, kind = $('dlKind').value, variant = $('dlVariant').value, geometry = $('dlGeometry').value;
    const look = { ...A.look }, gear = { ...A.H.equipment, kind: $('dlGear').value }, moving = n('dlMoving'), x = n('dlVX'), y = n('dlVY'), sx = n('dlAX'), sy = n('dlAY');
    const rectangles = geometry === 'wall' || geometry === 'corner' ? [{ x: x + 74, y: y - 155, w: 28, h: 310 }] : [];
    if (geometry === 'corner') rectangles.push({ x: x - 130, y: y + 60, w: 260, h: 28 });
    const G = A.avatar().wounds.constructor, floor = new G().rect(x - 350, y - 240, 700, 480).fill(0x77734a), beam = new G();
    const rects = geometry === 'level' ? (px, py) => { const old = window.WORLD.mode; try { window.WORLD.mode = 'crawl'; return A.Bc(px, py); } finally { window.WORLD.mode = old; } } : () => rectangles;
    const seen = new Set();
    for (let px = x - 260; px < x + 280; px += 96) for (let py = y - 160; py < y + 180; py += 96) for (const r of rects(px, py)) {
      const key = [r.x, r.y, r.w, r.h].join(':'); if (seen.has(key)) continue; seen.add(key);
      floor.rect(r.x, r.y, r.w, r.h).fill(0xc4b96c).stroke({ color: 0x39351c, width: 2 });
    }
    const victim = { id: 'lab', x, y, angle: 0, vx: moving ? 105 : 0, vy: moving ? 22 : 0, distance: 0, stamina: n('dlStamina'), exhausted: n('dlStamina') < 20, equipment: gear, hat: look.hat, appearance: look };
    const av = A.mkAvatar(look, gear); av.update(0, true, false, victim);
    let wall = 0;
    if (variant === 'C' && kind === 'Hound') {
      if (geometry === 'wall' || geometry === 'corner') wall = [x + 74, y, 0];
      else if (geometry === 'level' && A.Uc) {
        const angle = Math.atan2(y - sy, x - sx), distance = A.Uc(x, y, angle, 140);
        if (distance < 140) wall = [x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, angle];
      }
    }
    const d = new A.Jl();
    d.start(kind, 0, { x: sx, y: sy }, -1, victim, { v: variant, w: wall, mi: { seed: 93157, h: av.hands.map(h => [h.x, h.y]), b: [av.body.scale.x, av.body.scale.y, av.body.rotation], gv: [av.gear.x, av.gear.y, av.gear.rotation], mv: [victim.vx, victim.vy, 0, victim.exhausted ? .18 : victim.stamina / 100], av: [0, 0, Math.atan2(y - sy, x - sx)] } });
    d.motion.rects = rects;
    const entity = kind === 'Hound' ? new A.Wl() : new A.Gl({ x: sx, y: sy, angle: 0, state: 'ATTACKING' });
    world.addChild(floor, beam, d.blood, entity, av, d.debris);
    run = { kind, variant, geometry, victim, look, gear, av, d, entity, beam, t: 0, paused: false, root: { x, y }, trajectory: [], equipmentTrail: [], previous: -1, owner: 'lab:' + (++token), corpse: null };
    $('dlPause').textContent = 'PAUSE'; lastAt = performance.now(); render();
  }
  function render() {
    if (!run || !app) return;
    const r = run, d = r.d; d.frame(r.t); const m = d.motion;
    const w = app.screen.width, h = app.screen.height, scale = Math.min(w / 450, h / 320);
    world.scale.set(scale); world.position.set(w / 2 - r.root.x * scale, h / 2 - r.root.y * scale);
    r.entity.position.set(d.attacker.x, d.attacker.y); r.entity.rotation = d.attacker.angle + Math.PI / 2;
    if (r.kind === 'Hound') r.entity.attackPose(d.grip, d.impact, d.variant, d); else window.__ents.attackSmiler(r.entity, r.t, 1 / 60, d);
    if (!r.corpse) {
      r.av.update(r.t, true, false, r.victim); r.av.position.set(d.body.x, d.body.y); r.av.rotation = d.body.angle;
      r.av.deathPose(d.injury, d.impact, r.t > .3, d.physicalPose);
      if (!$('dlBlood').checked) r.av.wounds.clear();
      if (d.finished) {
        const rec = { id: r.owner, ownerId: r.owner, name: 'LAB', cause: r.kind, x: d.body.x, y: d.body.y, angle: d.body.angle, scaleX: 1, scaleY: 1,
          attackAngle: d.angle, appearance: r.look, equipment: r.gear, pose: m.snapshot(), dropped: { ...d.equipmentTransform }, hat: { ...d.physicalHat }, blood: d.bursts.map(b => ({ ...b })), lo: 1 };
        window.__deathMotion.registerCorpse(r.owner, r.av); r.corpse = window.__api.mkCorpse(rec); world.addChild(r.corpse); d.debris.visible = false; d.blood.visible = false;
      }
    }
    if (r.corpse) {
      r.corpse.children[0].visible = $('dlBlood').checked;
      if (!$('dlBlood').checked) r.corpse.children[1].wounds.clear();
      else r.corpse.children[1].deathPose(d.injury, d.impact, true, d.physicalPose);
    }
    else d.blood.visible = $('dlBlood').checked;
    r.beam.clear(); const light = d.torch, poly = [light.x, light.y];
    for (let i = 0; i <= 12; i++) { const a = light.angle - .4 + i * .8 / 12; poly.push(light.x + Math.cos(a) * 220, light.y + Math.sin(a) * 220); }
    r.beam.poly(poly).fill({ color: 0xffedaf, alpha: .085 });
    const cv = $('dlDiagnostics'); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const cx = cv.getContext('2d'), point = (x, y) => [(x - r.root.x) * scale + w / 2, (y - r.root.y) * scale + h / 2]; cx.clearRect(0, 0, w, h);
    if ($('dlVectors').checked) {
      if (r.t !== r.previous) { r.trajectory.push([d.body.x, d.body.y]); r.equipmentTrail.push([d.equipmentTransform.x, d.equipmentTransform.y]); } r.previous = r.t;
      cx.strokeStyle = '#f7e7ab88'; cx.lineWidth = 1; cx.beginPath(); r.trajectory.forEach((p, i) => { const q = point(...p); i ? cx.lineTo(...q) : cx.moveTo(...q); }); cx.stroke();
      cx.strokeStyle = '#e9bc6788'; cx.beginPath(); r.equipmentTrail.forEach((p, i) => { const q = point(...p); i ? cx.lineTo(...q) : cx.moveTo(...q); }); cx.stroke();
      const b = point(d.body.x, d.body.y), v = point(d.body.x + m.body.vx * .18, d.body.y + m.body.vy * .18); cx.strokeStyle = '#7fdcd1'; cx.beginPath(); cx.moveTo(...b); cx.lineTo(...v); cx.stroke();
      for (const hand of m.hands) { const target = point(hand.goal.x, hand.goal.y), actual = point(hand.x, hand.y); cx.strokeStyle = '#c6ef8b'; cx.beginPath(); cx.moveTo(...actual); cx.lineTo(...target); cx.stroke(); cx.strokeRect(target[0] - 3, target[1] - 3, 6, 6); }
      if (m.body.contact) { const p = point(m.body.contact.x, m.body.contact.y); cx.strokeStyle = '#ff9c76'; cx.strokeRect(p[0] - 4, p[1] - 4, 8, 8); }
    }
    if ($('dlView').value === 'victim') { cx.fillStyle = `rgba(0,0,0,${d.shade * .9})`; cx.fillRect(0, 0, w, h); }
    $('dlStatus').textContent = `${r.kind} ${r.variant} · ${r.t.toFixed(3)}s · ${m.phase} · |v| ${Math.hypot(m.body.vx, m.body.vy).toFixed(1)} · ω ${m.body.omega.toFixed(2)} · ${m.collisions} collisions`;
  }
  function tick(now) { if (box.hidden) return; const dt = Math.min(.06, (now - lastAt) / 1000); lastAt = now; if (run && !run.paused) run.t = Math.min(run.d.duration + .8, run.t + dt * n('dlRate')); render(); raf = requestAnimationFrame(tick); }
  const lab = window.__deathLab = {
    authorize(on) { authorized = !!on; if (!authorized) this.close(); },
    async open() {
      if (!authorized || !window.__api?.scene) return;
      box.hidden = false;
      if (!app) {
        const A = window.__api, App = A.scene().app.constructor; app = new App();
        const viewport = $('dlViewport'); await app.init({ width: Math.max(480, viewport.clientWidth), height: Math.max(330, viewport.clientHeight), background: 0x17180d, antialias: true, preference: 'webgl' });
        viewport.appendChild(app.canvas); world = new (A.layer().constructor)(); app.stage.addChild(world);
      }
      place(); replay(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    },
    close() { box.hidden = true; cancelAnimationFrame(raf); if (app) { wipe(); app.destroy(true, { children: true }); app = world = null; } },
    replay,
    snapshot() { return run ? { t: run.t, phase: run.d.motion.phase, pose: run.d.motion.snapshot(), body: { ...run.d.body }, equipment: { ...run.d.equipmentTransform } } : null; }
  };
  $('dlClose').onclick = () => lab.close(); $('dlHere').onclick = place; $('dlReplay').onclick = replay;
  $('dlReset').onclick = () => { replay(); if (run) { run.paused = true; $('dlPause').textContent = 'PLAY'; } };
  $('dlPause').onclick = () => { if (run) { run.paused = !run.paused; $('dlPause').textContent = run.paused ? 'PLAY' : 'PAUSE'; } };
  $('dlStep').onclick = () => { if (run) { run.paused = true; run.t = Math.min(run.d.duration + .8, run.t + 1 / 120); $('dlPause').textContent = 'PLAY'; render(); } };
  box.addEventListener('keydown', e => e.stopPropagation());
})();
