/* v16 Codex comparison: one body mass, two anchored circular hands, loose gear.
 * No player skeleton or new anatomy. Fixed-step replay is also used by peers.
 * UMD keeps the motion model testable without a renderer or game server. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.DeathMotion = api; api.install(root); }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const DT = 1 / 120, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, t) => { const v = clamp((t - a) / (b - a), 0, 1); return v * v * (3 - 2 * v); };
  const delta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const rotate = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });
  const round = v => +v.toFixed(4);
  const ease = (a, b, t) => { const v = clamp((t - a) / (b - a), 0, 1); return v * v * v * (v * (v * 6 - 15) + 10); };
  const durationFor = (kind, variant) => kind === 'Hound' ? 4.65 : variant === 'D' ? 5.3 : 4.95;
  const HITS = { Hound: { A: [.2, .62, 1.05, 1.55], B: [.3, .85, 1.5, 2.1], C: [.2, .21, .8, 1.4], D: [.45, .95, 1.55] }, Smiler: { A: [.38, .98, 1.48], B: [.7, 1.2, 1.7], C: [.55, 1.1, 1.6], D: [.6, 1.2, 1.8] } };
  const hitsFor = (kind, v) => HITS[kind][v];
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function particle(x, y, r, angle = 0) { return { x, y, r, vx: 0, vy: 0, angle, omega: 0 }; }
  function resolve(p, rectangles, bounce) {
    let impact = 0;
    for (let pass = 0; pass < 3; pass++) {
      for (const r of rectangles(p.x, p.y)) {
        const rx = r.x, ry = r.y, rw = r.w === undefined ? r.width : r.w, rh = r.h === undefined ? r.height : r.h;
        const qx = clamp(p.x, rx, rx + rw), qy = clamp(p.y, ry, ry + rh);
        let dx = p.x - qx, dy = p.y - qy, d = Math.hypot(dx, dy), depth;
        if (d >= p.r) continue;
        if (d < .00001) {
          const faces = [[p.x - rx, -1, 0], [rx + rw - p.x, 1, 0], [p.y - ry, 0, -1], [ry + rh - p.y, 0, 1]];
          faces.sort((a, b) => a[0] - b[0]); dx = faces[0][1]; dy = faces[0][2]; depth = p.r + faces[0][0];
        } else { dx /= d; dy /= d; depth = p.r - d; }
        p.x += dx * (depth + .001); p.y += dy * (depth + .001);
        const vn = p.vx * dx + p.vy * dy;
        if (vn < 0) {
          impact = Math.max(impact, -vn);
          p.vx -= (1 + bounce) * vn * dx; p.vy -= (1 + bounce) * vn * dy;
          // Wall friction removes tangential energy as well as the normal impulse.
          const tx = -dy, ty = dx, vt = (p.vx * tx + p.vy * ty) * .18;
          p.vx -= vt * tx; p.vy -= vt * ty;
          p.contact = { x: qx, y: qy, nx: dx, ny: dy, speed: -vn };
        }
      }
    }
    return impact;
  }
  function integrate(p, dt, friction, rects, bounce = .16) {
    const damp = Math.exp(-friction * dt); p.vx *= damp; p.vy *= damp;
    const speed = Math.hypot(p.vx, p.vy); if (speed > 620) { p.vx *= 620 / speed; p.vy *= 620 / speed; }
    const steps = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * dt / 3));
    let impact = 0;
    for (let i = 0; i < steps; i++) {
      p.x += p.vx * dt / steps; p.y += p.vy * dt / steps;
      impact = Math.max(impact, resolve(p, rects, bounce));
    }
    p.angle += p.omega * dt; p.omega *= Math.exp(-4 * dt);
    return impact;
  }
  class Motion {
    constructor(options) {
      this.o = options; this.rects = options.rects || (() => []); this.surface = options.surface || (() => 'carpet');
      this.kind = options.kind || 'Hound'; this.variant = options.variant || 'A'; this.hound = this.kind === 'Hound';
      this.duration = options.duration || durationFor(this.kind, this.variant);
      const v = options.victim, src = options.source, init = options.initial || {};
      this.seed = init.seed === undefined ? hash(this.kind + this.variant + [v.x, v.y, src.x, src.y].map(Math.round)) : init.seed >>> 0;
      this.sign = this.seed & 1 ? 1 : -1; this.direction = Math.atan2(v.y - src.y, v.x - src.x);
      this.away = { x: Math.cos(this.direction), y: Math.sin(this.direction) }; this.side = { x: -this.away.y, y: this.away.x };
      this.body = particle(v.x, v.y, 18, v.angle + Math.PI / 2); this.origin = { x: v.x, y: v.y, angle: this.body.angle };
      const mv = init.mv || [v.vx || 0, v.vy || 0, 0, v.exhausted ? .18 : clamp((v.stamina ?? 100) / 100, .15, 1)];
      const hands = init.h || [[-13, -13], [13, -13]];
      this.initial = { v: 2, seed: this.seed, h: hands.map(a => a.map(round)), b: (init.b || [1, 1, 0]).map(round),
        gv: (init.gv || [13, -13, 0]).map(round), mv: mv.map(round), av: (init.av || [src.vx || 0, src.vy || 0, this.direction]).map(round) };
      this.strength = this.variant === 'D' && this.hound ? Math.min(.22, mv[3]) : mv[3];
      this.body.vx = clamp(mv[0], -400, 400); this.body.vy = clamp(mv[1], -400, 400); this.body.omega = clamp(mv[2], -4, 4);
      this.attacker = particle(src.x, src.y, this.hound ? 14 : 12, this.initial.av[2]);
      this.attacker.vx = this.initial.av[0]; this.attacker.vy = this.initial.av[1];
      this.hands = hands.map((h, i) => { const p = rotate(h[0], h[1], this.body.angle); return Object.assign(particle(v.x + p.x, v.y + p.y, 6), { side: i ? 1 : -1, initial: h.slice(), plant: null, goal: { x: v.x + p.x, y: v.y + p.y } }); });
      this.gear = particle(v.x, v.y, 5, v.angle + this.initial.gv[2]); this.hat = particle(v.x, v.y, 17, this.body.angle);
      this.headlamp = options.gearKind === 'headlamp'; this.hasHat = options.hat !== 'none';
      this.gear.detached = this.hat.detached = false;
      this.t = this.tick = this.hitIndex = 0; this.lastImpact = -100; this.collisions = 0; this.impact = 0;
      this.bursts = []; this.trail = []; this.phase = 'ACTIVE'; this.sleepClock = 0; this.finished = false;
      this.contactAt = this.hound ? (this.variant === 'C' ? .13 : .18) : .58;
      this.settleAt = this.hound ? 2.8 : this.variant === 'D' ? 3.3 : 2.9;
      this.hitFired = false; this.contactTension = 0; this.distance = 0; this.prevAtt = { x: src.x, y: src.y };
      this.squash = { x: 0, vx: 0, angle: this.direction }; this.camera = { x: 0, y: 0, vx: 0, vy: 0 };
      this.pack = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, omega: 0 };
      this.scaleX = this.initial.b[0]; this.scaleY = this.initial.b[1]; this.grip = 0;
      this.feet = [[-23, -68], [23, -64], [-26, 43], [27, 47]].map((q, i) => { const p = rotate(q[0], q[1], this.attacker.angle + Math.PI / 2); return Object.assign(particle(src.x + p.x, src.y + p.y, 2), { step: null, planted: { x: src.x + p.x, y: src.y + p.y }, index: i }); });
      this.all = [this.body, this.attacker, ...this.hands, this.gear, this.hat, ...this.feet];
      this.display = this.all.map(p => ({ x: p.x, y: p.y, angle: p.angle, vx: p.vx, vy: p.vy, omega: p.omega }));
      this.pose = { v: 2, seed: this.seed, h: [[0, 0], [0, 0]], b: [1, 1, 0], g: [0, 0, 0], pk: [0, 0, 0], gd: 0, hd: 0, bt: 0, tr: [] };
      this.updateAttachments(0); this.all.forEach(p => this.remember(p)); this.render(1);
    }
    remember(p) { p.px = p.x; p.py = p.y; p.pa = p.angle; p.pvx = p.vx; p.pvy = p.vy; }
    impulse(speed, angle = this.direction, spin = 0) {
      const b = this.body; b.vx += Math.cos(angle) * speed; b.vy += Math.sin(angle) * speed; b.omega += spin;
      this.impactEvent(Math.abs(speed), angle);
    }
    impactEvent(speed, angle) {
      this.impact = Math.max(this.impact, clamp(speed / 300, .08, 1));
      this.squash.angle = angle; this.squash.vx += Math.min(.9, speed * .0025);
      this.camera.vx -= Math.cos(angle) * Math.min(15, speed * .045); this.camera.vy -= Math.sin(angle) * Math.min(15, speed * .045);
    }
    attackerGoal() {
      const t = this.t, v = this.variant; let along = 0, lateral = 0, reach = this.hound ? 59 : 43;
      if (this.hound) {
        if (v === 'B') { along = -132 * ease(.55, 2.45, t); lateral = this.sign * 8 * ease(.7, 1.8, t); }
        else if (v === 'C') { const w = this.o.wall; along = w ? clamp(Math.hypot(w.x - this.origin.x, w.y - this.origin.y) - 27, 12, 110) * ease(.03, .43, t) : 35 * ease(.05, .45, t); }
        else if (v === 'D') along = 13 * ease(.1, .8, t);
        else { along = 65 * ease(.04, .67, t); lateral = this.sign * 5 * ease(.28, 1.5, t); }
      } else {
        if (v === 'B') along = -17 * ease(.72, 2.1, t);
        else if (v === 'C') along = -65 * ease(.4, 1.8, t);
        else if (v === 'D') along = -38 * ease(.95, 1.8, t) - 45 * ease(2.05, 3.0, t);
        else along = -34 * ease(.6, 1.3, t) - 36 * ease(1.65, 2.3, t);
        lateral = this.sign * 7 * ease(1.0, 2.5, t);
      }
      const engage = ease(0, this.hound ? .3 : .6, t);
      return { x: this.o.source.x * (1 - engage) + (this.origin.x + this.away.x * (along - reach) + this.side.x * lateral) * engage,
        y: this.o.source.y * (1 - engage) + (this.origin.y + this.away.y * (along - reach) + this.side.y * lateral) * engage };
    }
    drive(dt) {
      const b = this.body, a = this.attacker, t = this.t, v = this.variant, goal = this.attackerGoal();
      const gain = this.hound ? 64 : 36, damping = this.hound ? 14 : 12;
      a.vx += ((goal.x - a.x) * gain - a.vx * damping) * dt; a.vy += ((goal.y - a.y) * gain - a.vy * damping) * dt;
      const facing = Math.atan2(b.y - a.y, b.x - a.x);
      a.omega += (delta(facing, a.angle) * 38 - a.omega * 10) * dt;
      this.grip = ease(this.contactAt - .025, this.contactAt + .2, t) * (1 - ease(this.settleAt - .1, this.settleAt + .25, t));
      if (!this.hitFired && t >= this.contactAt && this.hound) {
        this.hitFired = true; let speed = v === 'B' ? 116 : v === 'D' ? 62 : 310, angle = this.direction;
        if (v === 'C' && this.o.wall) { angle = Math.atan2(this.o.wall.y - b.y, this.o.wall.x - b.x); speed = clamp((Math.hypot(this.o.wall.x - b.x, this.o.wall.y - b.y) - 18) * 6.4 + 90, 150, 560); }
        this.impulse(speed, angle, this.sign * (v === 'D' ? .6 : 2.3));
        // Equal-direction follow-through: the attacker also commits its mass.
        a.vx += Math.cos(angle) * speed * .31; a.vy += Math.sin(angle) * speed * .31;
      }
      const joint = this.hound ? this.grip * (v === 'A' || v === 'C' ? 8 : 28) : ease(v === 'C' ? .33 : v === 'D' ? .84 : .56, v === 'D' ? 1.18 : .94, t) * (1 - ease(this.settleAt - .1, this.settleAt + .2, t)) * 23;
      const reach = this.hound ? 59 : 43, px = a.x + Math.cos(a.angle) * reach, py = a.y + Math.sin(a.angle) * reach;
      const fx = clamp((px - b.x) * joint - (b.vx - a.vx) * joint * .11, -680, 680);
      const fy = clamp((py - b.y) * joint - (b.vy - a.vy) * joint * .11, -680, 680);
      this.contactTension = Math.hypot(fx, fy); b.vx += fx * dt; b.vy += fy * dt;
      a.vx -= fx * dt * .17; a.vy -= fy * dt * .17;
      if (joint > .5 && (v === 'B' || !this.hound)) {
        const pullAngle = Math.atan2(py - b.y, px - b.x) + Math.PI / 2;
        b.omega += (delta(pullAngle + this.sign * .18, b.angle) * (this.hound ? 5 : 3.8) - b.omega * 3.2) * dt;
      }
      // Resistance modulates forces, not a repeating flail or a pose switch.
      const resistance = this.strength * (1 - ease(.85, this.hound ? 1.85 : 2.55, t));
      if (resistance > .01 && this.grip > .1) b.omega += this.sign * -Math.sin(ease(.25, 1.9, t) * Math.PI) * resistance * 1.9 * dt;
      const hits = this.o.hits || hitsFor(this.kind, this.variant);
      while (this.hitIndex < hits.length && t >= hits[this.hitIndex]) {
        const i = this.hitIndex++;
        if (!this.bursts.length || t - this.bursts.at(-1).at > .08) this.bursts.push({ x: b.x - this.away.x * 9, y: b.y - this.away.y * 9, at: hits[i], seed: i, angle: this.direction });
        if (this.hound && t > this.contactAt + .12 && t < 2.3) {
          const recoil = v === 'D' ? 5 : v === 'B' ? 10 : 21; this.impulse(recoil, this.direction + this.sign * .18, this.sign * .22);
          a.vx -= this.away.x * recoil * .18; a.vy -= this.away.y * recoil * .18;
        }
      }
    }
    moveHands(dt) {
      const b = this.body, t = this.t, purpose = this.strength * (1 - ease(this.hound ? 1.03 : 1.5, this.hound ? 2.35 : 2.85, t));
      for (let i = 0; i < 2; i++) {
        const h = this.hands[i], side = h.side, attack = rotate(this.attacker.x - b.x, this.attacker.y - b.y, -b.angle), len = Math.hypot(attack.x, attack.y) || 1;
        const onset = ease(.02, this.hound ? .45 : .7, t), spread = this.impact * ease(.1, .28, t);
        const work = ease(.22 + i * .17, .7 + i * .23, t) * (1 - ease(.8 + i * .32, 1.42 + i * .27, t));
        const gx = side * (18 + spread * 5 + (1 - purpose) * (4 + i * 2)) + clamp(attack.x / len * 4, -3, 3) * purpose;
        const gy = attack.y / len * (14 + work * 5) * purpose + (5 + i * 3) * (1 - purpose);
        const local = { x: h.initial[0] * (1 - onset) + gx * onset, y: h.initial[1] * (1 - onset) + gy * onset };
        if (!this.hound && t < .6) { local.x = h.initial[0] + side * ease(.08, .52, t) * 1.8; local.y = h.initial[1] + ease(.1, .55, t) * (i ? -2 : 1.5); }
        const q = rotate(local.x, local.y, b.angle); h.goal.x = b.x + q.x; h.goal.y = b.y + q.y;
        const plantAt = .72 + i * .41, plantEnd = 1.06 + i * .34;
        if (this.hound && this.variant === 'B' && purpose > .12 && t > plantAt && t < plantEnd) {
          if (!h.plant) h.plant = { x: h.x, y: h.y };
          if (Math.hypot(h.plant.x - b.x, h.plant.y - b.y) < 32) {
            h.goal.x = h.plant.x; h.goal.y = h.plant.y;
            const resistance = Math.min(1, ease(plantAt, plantAt + .07, t)) * purpose;
            b.vx += (h.x - b.x) * resistance * 2.2 * dt; b.vy += (h.y - b.y) * resistance * 2.2 * dt;
          } else h.plant = null;
        } else h.plant = null;
        // One short reach for the lost light, then the hand gives way.
        if (i === 1 && this.gear.detached && this.hound && this.variant === 'A') {
          const reach = ease(.34, .55, t) * (1 - ease(.57, .87, t)) * purpose * .65;
          h.goal.x += (this.gear.x - h.goal.x) * reach; h.goal.y += (this.gear.y - h.goal.y) * reach;
        }
        const stiffness = 82 + purpose * 52, damping = 17 + (1 - purpose) * 3;
        h.vx += ((h.goal.x - h.x) * stiffness - h.vx * damping) * dt; h.vy += ((h.goal.y - h.y) * stiffness - h.vy * damping) * dt;
        integrate(h, dt, .45, this.rects, .035);
        for (let pass = 0; pass < 4; pass++) {
          const p = rotate(h.x - b.x, h.y - b.y, -b.angle); p.x = side * Math.max(7, p.x * side);
          const rx = p.x - side * 11, l = Math.hypot(rx, p.y); if (l > 27) { p.x = side * 11 + rx * 27 / l; p.y *= 27 / l; }
          const world = rotate(p.x, p.y, b.angle); h.x = b.x + world.x; h.y = b.y + world.y; resolve(h, this.rects, .035);
        }
      }
    }
    updateAttachments(dt) {
      const t = this.t, b = this.body, gv = this.initial.gv, h = this.hands[1];
      const go = rotate(gv[0] - this.initial.h[1][0], gv[1] - this.initial.h[1][1], b.angle);
      const g = this.headlamp ? rotate(0, this.o.hat === 'cap' || this.o.hat === 'hardhat' ? -33 : -26.5, b.angle) : { x: h.x - b.x + go.x, y: h.y - b.y + go.y };
      const release = this.hound ? this.variant === 'D' ? .78 : .32 : this.variant === 'C' ? .58 : this.variant === 'D' ? 1.8 : 1.2;
      const violentHat = this.hound && (this.variant === 'A' || this.variant === 'C' || this.variant === 'B' && (this.seed & 2)) || !this.hound && this.variant === 'C';
      for (const [p, q, at, enabled] of [[this.gear, g, release, !this.headlamp], [this.hat, { x: 0, y: 0 }, release + .11, this.hasHat && violentHat]]) {
        if (!p.detached) {
          const x = b.x + q.x, y = b.y + q.y, angle = p === this.gear ? b.angle - Math.PI / 2 + (this.headlamp ? 0 : gv[2]) : b.angle;
          const vx = dt ? (x - p.x) / dt : b.vx, vy = dt ? (y - p.y) / dt : b.vy, omega = dt ? delta(angle, p.angle) / dt : b.omega;
          p.x = x; p.y = y; p.angle = angle; p.vx = vx; p.vy = vy; p.omega = omega;
          if (enabled && t >= at) {
            p.detached = true; const kick = rotate(this.sign * (p === this.gear ? 18 : -27), -13, b.angle);
            p.vx += kick.x; p.vy += kick.y; p.omega = clamp(omega + this.sign * (p === this.gear ? 4 : -2), -8, 8);
          }
        } else {
          const floor = this.surface(p.x, p.y), friction = floor === 'wet' ? 1.9 : floor === 'concrete' ? 3.2 : 4.3;
          integrate(p, dt, this.phase === 'SETTLING' ? friction + 2 : friction, this.rects, .14);
          if (p === this.gear) this.resolveEquipment(p);
        }
      }
    }
    resolveEquipment(p) {
      // The light has length. Checking only its handle let the flashlight head
      // cross a wall while its mass stayed outside. Two small support circles
      // approximate the existing artwork and transfer contact into its spin.
      const kind = this.o.gearKind, offset = kind === 'flashlight' ? 17 : kind === 'lantern' ? 13 : 8, radius = kind === 'flashlight' ? 6 : 8;
      for (let pass = 0; pass < 3; pass++) {
        resolve(p, this.rects, .08);
        const dx = Math.cos(p.angle) * offset, dy = Math.sin(p.angle) * offset;
        const q = { x: p.x + dx, y: p.y + dy, r: radius, vx: p.vx - dy * p.omega, vy: p.vy + dx * p.omega };
        const x = q.x, y = q.y, vx = q.vx, vy = q.vy;
        resolve(q, this.rects, .08); p.x += q.x - x; p.y += q.y - y;
        if (q.contact) {
          p.vx += (q.vx - vx) * .6; p.vy += (q.vy - vy) * .6;
          const c = q.contact, torque = (dx * c.ny - dy * c.nx) * c.speed / 260;
          p.omega = clamp((p.omega + clamp(torque, -2, 2)) * .92, -8, 8);
        }
      }
      resolve(p, this.rects, .08);
    }
    moveFeet(dt) {
      const a = this.attacker, b = this.body, rot = a.angle + Math.PI / 2;
      this.feet.forEach((f, i) => {
        let q;
        if (i < 2 && this.grip > .15) {
          const side = i ? 1 : -1; q = { x: b.x - Math.cos(a.angle) * 8 - Math.sin(a.angle) * side * 13, y: b.y - Math.sin(a.angle) * 8 + Math.cos(a.angle) * side * 13 };
        } else {
          const local = rotate(i % 2 ? 27 : -26, i < 2 ? -66 : 44 + (i === 3 ? 3 : 0), rot); const desired = { x: a.x + local.x, y: a.y + local.y };
          if (!f.step && Math.hypot(f.planted.x - desired.x, f.planted.y - desired.y) > (i % 2 ? 22 : 17)) f.step = { x: f.x, y: f.y, tx: desired.x, ty: desired.y, at: this.t, duration: i % 2 ? .25 : .21 };
          if (f.step) { const u = ease(f.step.at, f.step.at + f.step.duration, this.t); q = { x: f.step.x + (f.step.tx - f.step.x) * u, y: f.step.y + (f.step.ty - f.step.y) * u }; if (u === 1) { f.planted = { x: q.x, y: q.y }; f.step = null; } }
          else q = f.planted;
        }
        f.vx += ((q.x - f.x) * 145 - f.vx * 24) * dt; f.vy += ((q.y - f.y) * 145 - f.vy * 24) * dt;
        integrate(f, dt, .3, this.rects, 0);
      });
    }
    step() {
      this.all.forEach(p => this.remember(p)); this.tick++; this.t = this.tick * DT;
      this.phase = this.t >= this.settleAt ? 'SETTLING' : 'ACTIVE'; this.impact *= Math.exp(-15 * DT);
      if (this.phase === 'ACTIVE') this.drive(DT); else { this.grip *= Math.exp(-9 * DT); }
      const floor = this.surface(this.body.x, this.body.y), friction = floor === 'wet' ? 1.7 : floor === 'concrete' ? 2.6 : floor === 'deep' ? 4.7 : 3.9;
      if (this.phase === 'SETTLING') { const d = Math.exp(-3 * DT); this.body.omega *= d; this.attacker.omega *= d; }
      const hit = integrate(this.body, DT, this.phase === 'SETTLING' ? friction + 3 : friction, this.rects, .11);
      const ahit = integrate(this.attacker, DT, this.phase === 'SETTLING' ? 8 : 1.1, this.rects, .06);
      if (hit > 35) {
        const c = this.body.contact; this.impactEvent(hit, Math.atan2(c.ny, c.nx)); this.body.omega += this.sign * Math.min(.8, hit / 300);
        this.attacker.vx += c.nx * hit * .12; this.attacker.vy += c.ny * hit * .12;
        if (this.t - this.lastImpact > .18) { this.lastImpact = this.t; this.collisions++; if (this.bursts.length < 6) this.bursts.push({ x: c.x, y: c.y, at: this.t, seed: 20 + this.collisions, angle: Math.atan2(c.ny, c.nx) }); }
      }
      if (ahit > 50) this.contactTension *= .8;
      this.moveHands(DT); this.updateAttachments(DT); this.moveFeet(DT);
      this.squash.vx += (-this.squash.x * 310 - this.squash.vx * 30) * DT; this.squash.x = clamp(this.squash.x + this.squash.vx * DT, -.02, .058);
      const localAngle = this.squash.angle - this.body.angle, amount = this.squash.x, recover = 1 - ease(0, .52, this.t);
      this.scaleX = 1 + (this.initial.b[0] - 1) * recover + amount * (.65 * Math.sin(localAngle) ** 2 - Math.cos(localAngle) ** 2);
      this.scaleY = 1 + (this.initial.b[1] - 1) * recover + amount * (.65 * Math.cos(localAngle) ** 2 - Math.sin(localAngle) ** 2);
      const c = this.camera; c.vx += (-c.x * 120 - c.vx * 23) * DT; c.vy += (-c.y * 120 - c.vy * 23) * DT; c.x += c.vx * DT; c.y += c.vy * DT;
      const p = this.pack, localV = rotate(this.body.vx, this.body.vy, -this.body.angle);
      const packX = -clamp(localV.x * .012, -2.5, 2.5), packY = -clamp(localV.y * .012, -2.5, 2.5), packAngle = -clamp(this.body.omega * .025, -.075, .075);
      p.vx += ((packX - p.x) * 100 - p.vx * 20) * DT; p.vy += ((packY - p.y) * 100 - p.vy * 20) * DT;
      p.x += p.vx * DT; p.y += p.vy * DT; p.omega += ((packAngle - p.angle) * 70 - p.omega * 18) * DT; p.angle += p.omega * DT;
      if (this.bursts.length) {
        const last = this.trail.at(-1);
        if (!last || Math.hypot(last[0] - this.body.x, last[1] - this.body.y) > 7) {
          if (this.trail.length === 16) this.trail.splice(1, 1);
          this.trail.push([+this.body.x.toFixed(2), +this.body.y.toFixed(2)]);
        }
      }
      const still = [this.body, ...this.hands, this.gear, this.hat].every(p => Math.hypot(p.vx, p.vy) < .55 && Math.abs(p.omega) < .025);
      this.sleepClock = still && this.phase === 'SETTLING' ? this.sleepClock + DT : 0;
      if (this.sleepClock > .2 && this.t > this.settleAt + .7) this.sleep();
    }
    sleep() { this.phase = 'SLEEPING'; for (const p of this.all) p.vx = p.vy = p.omega = 0; }
    advance(time) {
      time = clamp(time, 0, this.duration); const ticks = Math.min(Math.floor((time + 1e-7) / DT), Math.round(this.duration / DT));
      while (this.tick < ticks && this.phase !== 'SLEEPING') this.step();
      this.finished = time >= this.duration;
      if (this.finished && this.phase !== 'SLEEPING') this.sleep();
      const alpha = this.finished || this.phase === 'SLEEPING' ? 1 : clamp((time / DT) - this.tick, 0, 1);
      this.render(alpha); return this.pose;
    }
    render(alpha) {
      this.all.forEach((p, i) => { const d = this.display[i]; d.x = p.px + (p.x - p.px) * alpha; d.y = p.py + (p.y - p.py) * alpha; d.angle = p.pa + (p.angle - p.pa) * alpha; d.vx = p.vx; d.vy = p.vy; d.omega = p.omega; });
      const b = this.display[0], pose = this.pose;
      this.hands.forEach((h, i) => { const d = this.display[2 + i], q = rotate(d.x - b.x, d.y - b.y, -b.angle); pose.h[i][0] = round(q.x); pose.h[i][1] = round(q.y); });
      pose.b[0] = round(this.scaleX); pose.b[1] = round(this.scaleY); pose.b[2] = round(this.initial.b[2] * (1 - ease(0, .52, this.t)));
      pose.g[0] = round(this.initial.gv[0] - this.initial.h[1][0]); pose.g[1] = round(this.initial.gv[1] - this.initial.h[1][1]); pose.g[2] = this.initial.gv[2];
      pose.pk[0] = round(this.pack.x); pose.pk[1] = round(this.pack.y); pose.pk[2] = round(this.pack.angle);
      pose.gd = this.gear.detached ? 1 : 0; pose.hd = this.hat.detached ? 1 : 0; pose.bt = round(this.t); pose.tr = this.trail;
    }
    snapshot() { return JSON.parse(JSON.stringify(this.pose)); }
  }
  function applyAvatar(avatar, pose) {
    if (!pose || (pose.v !== 1 && pose.v !== 2)) return false;
    avatar.body.position.set(0, 0); avatar.body.rotation = pose.b[2]; avatar.body.scale.set(pose.b[0], pose.b[1]);
    avatar.hands.forEach((h, i) => h.position.set(pose.h[i][0], pose.h[i][1]));
    avatar.hat.visible = !pose.hd; avatar.pack.visible = true;
    avatar.hat.y = 0; avatar.pack.position.set(pose.pk ? pose.pk[0] : 0, pose.pk ? pose.pk[1] : 0); avatar.pack.rotation = pose.pk ? pose.pk[2] : 0;
    avatar.gear.visible = !pose.gd;
    // Attached light follows the reacting hand, not the living hand pose overwritten by update().
    if (avatar.lightGear.kind !== 'headlamp') {
      const right = pose.h[1], g = pose.g || [0, 0, 0]; avatar.gear.position.set(right[0] + g[0], right[1] + g[1]); avatar.gear.rotation = g[2];
    }
    avatar.__key = pose.seed; return true;
  }
  function install(win) {
    const donors = new Map();
    // Preserve the detailed v16 anatomy of entities while deriving their kill
    // poses from real contact and planted feet. The player remains three circles.
    if (win.__ents && !win.__ents.__fluidDeaths) {
      const E = win.__ents, oldHound = E.attackHound, oldSmiler = E.attackSmiler, oldExtras = E.deathExtras;
      const drawHound = E.drawHound, drawSmiler = E.drawSmiler;
      function returnRoot(view, g, t, dt) {
        const r = view.__deathReturn; if (!r) return null;
        const p = r.p, h = clamp(dt || 1 / 60, 0, .05), dx = g.x - p.x, dy = g.y - p.y;
        p.vx += (dx * 48 - p.vx * 14) * h; p.vy += (dy * 48 - p.vy * 14) * h;
        const speed = Math.hypot(p.vx, p.vy); if (speed > 240) { p.vx *= 240 / speed; p.vy *= 240 / speed; }
        p.omega += (delta(g.angle, p.angle) * 42 - p.omega * 12) * h;
        integrate(p, h, 0, rects, .02);
        view.position.set(p.x, p.y); view.rotation = p.angle + Math.PI / 2;
        if (t - r.at > .7 && Math.hypot(dx, dy) < .5 && Math.abs(delta(g.angle, p.angle)) < .01) delete view.__deathReturn;
        return r;
      }
      E.drawHound = function (view, g, t, dt) {
        if (!view.__deathReturn) return drawHound(view, g, t, dt);
        const r = returnRoot(view, g, t, dt), p = r.p, target = E.poseHound(view, { ...g, x: p.x, y: p.y, angle: p.angle }, t, dt), u = ease(r.at, r.at + .65, t);
        const from = r.pose;
        if (from) {
          for (const k of ['hx', 'hy', 'hr', 'jaw', 'sy', 'sx', 'bend', 'crouch', 'air', 'whip', 'lean']) target[k] = from[k] + (target[k] - from[k]) * u;
          for (const k of ['fl', 'fr', 'rl', 'rr']) {
            target.hand[k].x = from.hand[k].x + (target.hand[k].x - from.hand[k].x) * u;
            target.hand[k].y = from.hand[k].y + (target.hand[k].y - from.hand[k].y) * u;
            target.lift[k] = from.lift[k] + (target.lift[k] - from.lift[k]) * u;
          }
        }
        E.paintHound(view, target, t, dt);
      };
      E.drawSmiler = function (view, g, t, dt, vis, o) {
        const r = returnRoot(view, g, t, dt);
        drawSmiler(view, g, t, dt, vis, o);
        if (r) view.scale.set(r.scale + (view.scale.x - r.scale) * ease(r.at, r.at + .65, t));
      };
      E.__fluidDeaths = true;
      E.deathExtras = (g, d, t) => { if (!d.motion) oldExtras(g, d, t); };
      E.attackHound = function (view, grip, impact, variant, death) {
        if (!death || !death.motion) return oldHound(view, grip, impact, variant);
        if (!view.__hound) E.initHound(view);
        const m = death.motion, a = m.display[1], b = m.display[0], t = m.pose.bt;
        const S = view.__g || (view.__g = { ph: 0, px: a.x, py: a.y, vf: 0, vl: 0, hj: 0, hjT: 0, hjNext: 1, hjHold: 0, jw: 0, crouch: 0, hair: [], t0: 0, foot: [0, 0, 0, 0], step: [0, 0, 0, 0] });
        S.seed = (m.seed % 10000) / 100; S.vf = a.vx * Math.cos(a.angle) + a.vy * Math.sin(a.angle); S.vl = -a.vx * Math.sin(a.angle) + a.vy * Math.cos(a.angle);
        const names = ['fl', 'fr', 'rl', 'rr'], P = { hand: {}, lift: {}, hx: 0, hy: -44, hr: 0, jaw: 0, sy: 1, sx: 1, bend: 0, crouch: .32, air: 0, whip: .18, lean: 0 };
        names.forEach((n, i) => { const f = m.display[6 + i], q = rotate(f.x - a.x, f.y - a.y, -(a.angle + Math.PI / 2)); P.hand[n] = q; P.lift[n] = m.feet[i].step ? Math.sin(clamp((t - m.feet[i].step.at) / m.feet[i].step.duration, 0, 1) * Math.PI) * .55 : .06; });
        const victim = rotate(b.x - a.x, b.y - a.y, -(a.angle + Math.PI / 2));
        P.hx = clamp(victim.x * .28, -5, 5) + Math.sin(t * 2.4 + m.sign) * .65;
        // Bite into the near edge of the mass; burying the skull at its centre
        // hid both reacting hands and made the physical response unreadable.
        P.hy = clamp(victim.y + 28, -56, -28) + impact * 2;
        P.hr = clamp(victim.x * .007 - a.omega * .055, -.3, .3);
        P.jaw = .18 + .63 * ease(.08, .43, t) - .32 * ease(m.settleAt - .4, m.settleAt + .2, t) + impact * .08;
        P.sy = 1 + clamp(S.vf * .0003, -.03, .05); P.bend = clamp(S.vl * .013 + a.omega * 1.2, -5, 5) + m.sign * grip * 1.3;
        if (variant === 'B') { P.bend += m.sign * Math.min(3, m.contactTension / 220); P.crouch = .45; }
        if (variant === 'D') { P.crouch = .56; P.jaw *= .72; }
        // Hair receives a damped visual lag from root motion through paintHound.
        E.paintHound(view, P, t, Math.max(0, Math.min(.04, t - (S.fluidAt ?? t)))); S.fluidAt = t; view.__deathP = P;
      };
      E.attackSmiler = function (view, t, dt, death) {
        if (!death || !death.motion) return oldSmiler(view, t, dt);
        const m = death.motion; if (!view.__smiler) E.initSmiler(view); view.__s.seed = (m.seed % 9000) / 100;
        E.drawSmiler(view, { state: 'ATTACKING', act: 'rush', face: 1, head: 0, special: 0 }, m.pose.bt, Math.max(0, Math.min(.04, m.pose.bt - (view.__fluidAt ?? 0))), 1);
        view.__fluidAt = m.pose.bt;
        // Root follows the restraint, face/body motion stay deliberate and quiet.
        view.face.rotation = clamp(m.attacker.omega * -.018, -.045, .045);
        view.scale.set(1 + .12 * ease(.3, 1.7, m.pose.bt));
      };
    }
    function rects(x, y) {
      const W = win.WORLD, old = W && W.mode;
      try { if (W) W.mode = 'crawl'; return win.__api && win.__api.Bc ? win.__api.Bc(x, y) : []; }
      finally { if (W) W.mode = old; }
    }
    const surface = (x, y) => win.WORLD && win.WORLD.surfaceAt ? win.WORLD.surfaceAt(x, y, win.__api && win.__api.Oc) : 'carpet';
    win.__deathMotion = {
      returnAttacker(view, death, now) {
        const a = death.motion.display[1];
        view.__deathReturn = { p: particle(a.x, a.y, death.kind === 'Hound' ? 14 : 12, a.angle), at: now, pose: view.__deathP || null, scale: view.scale.x };
        if (view.__g) { view.__g.px = a.x; view.__g.py = a.y; view.__g.vf = view.__g.vl = 0; }
      },
      registerCorpse(owner, avatar) {
        const views = win.__api.corpseViews && win.__api.corpseViews();
        if (views) for (const view of views.values()) {
          const rec = view.record;
          if (String(rec.ownerId) !== String(owner) || rec.pose?.seed !== avatar.__key) continue;
          const old = view.children[1]; if (old !== avatar) { view.removeChild(old); old.destroy({ children: true }); view.addChildAt(avatar, 1); }
          avatar.position.set(rec.x, rec.y); avatar.rotation = rec.angle; avatar.visible = true; return;
        }
        donors.set(String(owner), avatar);
      },
      takeCorpse(owner) { const k = String(owner), av = donors.get(k); donors.delete(k); return av || null; },
      clearDonors() { donors.clear(); },
      begin(d, victim, kill) {
        // An older peer keeps its original timing/corpse protocol. Applying a
        // longer v2 replay to its unversioned event would reject its early body.
        if (d.V && kill?.legacy) return;
        const av = !d.V && win.__api && win.__api.avatar && win.__api.avatar();
        if (av) av.__cause = d.kind;
        const initial = kill && kill.mi || (av ? { h: av.hands.map(h => [h.x, h.y]), b: [av.body.scale.x, av.body.scale.y, av.body.rotation], gv: [av.gear.x, av.gear.y, av.gear.rotation],
          mv: [victim.vx || 0, victim.vy || 0, 0, victim.exhausted ? .18 : clamp((victim.stamina ?? 100) / 100, .15, 1)] } : undefined);
        if (initial && !initial.av) initial.av = [d.source.vx || 0, d.source.vy || 0, kill?.aa ?? Math.atan2(d.victim.y - d.source.y, d.victim.x - d.source.x)];
        if (kill && kill.seq !== undefined && initial) initial.seed = hash([victim.id, kill.seq, kill.e, d.kind, d.variant].join('|'));
        d.duration = durationFor(d.kind, d.variant);
        d.motion = new Motion({ kind: d.kind, variant: d.variant, victim: d.victim, source: d.source, wall: d.wall, duration: d.duration, hits: d.hits,
          initial, gearKind: victim.equipment.kind, hat: d.V ? d.V.hat : win.__api.look.hat, rects, surface });
        d.motionInitial = d.motion.initial; d.physicalPose = d.motion.pose; this.frame(d, d.startAt);
        // Preserve the actual top-down hat artwork when it leaves the body.
        if (d.motion.hasHat) {
          const donor = av || win.__api.mkAvatar(d.V.appearance || { ...win.__api.look, hat: d.V.hat }, victim.equipment);
          const index = d.motion.headlamp ? 0 : 1, old = d.debris.children[index];
          if (old && donor.hat.children[0] && donor.hat.children[0].clone) {
            const hat = donor.hat.children[0].clone(true); d.debris.removeChild(old); old.destroy(); d.debris.addChildAt(hat, index);
            hat.visible = false;
          }
          if (!av) donor.destroy({ children: true });
        }
      },
      frame(d, now) {
        if (!d.active || !d.motion) return false;
        const elapsed = Math.max(0, now - d.startAt), m = d.motion; d.physicalPose = m.advance(elapsed); d.elapsed = Math.min(elapsed, d.duration);
        const b = m.display[0], a = m.display[1], gear = m.display[4], hat = m.display[5];
        Object.assign(d.body, { x: b.x, y: b.y, angle: b.angle, scaleX: 1, scaleY: 1, alpha: 1 });
        d.impact = m.impact; d.injury = smooth(.2, 1.82, d.elapsed); d.grip = m.grip; d.shake = 0; d.bursts = m.bursts;
        d.cameraX = m.camera.x; d.cameraY = m.camera.y;
        Object.assign(d.attacker, { x: a.x, y: a.y, angle: a.angle });
        d.equipmentTransform = { x: gear.x, y: gear.y, angle: gear.angle };
        const tip = victimLightTip(m.o.gearKind); d.torch = { x: gear.x + Math.cos(gear.angle) * tip, y: gear.y + Math.sin(gear.angle) * tip, angle: gear.angle };
        d.physicalHat = { x: hat.x, y: hat.y, angle: hat.angle };
        d.debris.visible = true; let child = 0;
        if (!m.headlamp) { const g = d.debris.children[child++]; if (g) { g.visible = m.gear.detached; g.position.set(gear.x, gear.y); g.rotation = gear.angle + Math.PI / 2; } }
        if (m.hasHat) { const h = d.debris.children[child]; if (h) { h.visible = m.hat.detached; h.position.set(hat.x, hat.y); h.rotation = hat.angle; } }
        d.black = d.blackFn ? Math.min(.14, d.blackFn(d.elapsed) * .14) * ease(.45, .9, d.elapsed) : 0;
        d.drawBlood(m.pose.bt); d.foreground.clear();
        d.shade = ease(d.duration - .85, d.duration, d.elapsed); d.finished = elapsed >= d.duration; return d.finished;
      },
      applyAvatar
    };
  }
  function victimLightTip(kind) { return kind === 'flashlight' ? 23 : kind === 'lantern' ? 13 : 0; }
  return { Motion, applyAvatar, install, DT, rotate, resolve, hash, durationFor, hitsFor, victimLightTip };
});
