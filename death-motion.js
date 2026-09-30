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
      this.o = options; this.rects = options.rects || (() => []);
      this.surface = options.surface || (() => 'carpet');
      this.kind = options.kind || 'Hound'; this.variant = options.variant || 'A'; this.duration = options.duration || 3.85;
      const v = options.victim, src = options.source;
      this.seed = options.initial && options.initial.seed !== undefined ? options.initial.seed >>> 0 : hash(this.kind + this.variant + [v.x, v.y, src.x, src.y].map(Math.round));
      this.sign = this.seed & 1 ? 1 : -1;
      this.direction = Math.atan2(v.y - src.y, v.x - src.x);
      this.away = { x: Math.cos(this.direction), y: Math.sin(this.direction) };
      this.body = particle(v.x, v.y, 18, v.angle + Math.PI / 2);
      this.origin = { x: v.x, y: v.y, angle: this.body.angle };
      const initial = options.initial || {}, hands = initial.h || [[-13, -13], [13, -13]];
      this.initial = { seed: this.seed, h: hands.map(a => a.map(round)), b: (initial.b || [1, 1, 0]).map(round), gv: (initial.gv || [13, -13, 0]).map(round) };
      this.hands = hands.map((h, i) => { const p = rotate(h[0], h[1], this.body.angle); return Object.assign(particle(v.x + p.x, v.y + p.y, 6), { side: i ? 1 : -1, initial: h.slice(), plant: null }); });
      this.gear = particle(v.x, v.y, 5, v.angle + this.initial.gv[2]);
      this.hat = particle(v.x, v.y, 9, this.body.angle);
      this.gear.detached = false; this.hat.detached = false;
      this.headlamp = options.gearKind === 'headlamp'; this.hasHat = options.hat !== 'none';
      this.t = 0; this.tick = 0; this.hitIndex = 0; this.impact = 0; this.lastImpact = -100; this.collisions = 0;
      this.bursts = []; this.finished = false; this.scaleX = this.initial.b[0]; this.scaleY = this.initial.b[1];
      this.updateAttachments(0); this.pose = this.snapshot();
    }
    impulse(speed, angle = this.direction, spin = 0) {
      this.body.vx += Math.cos(angle) * speed; this.body.vy += Math.sin(angle) * speed; this.body.omega += spin;
    }
    drive(dt) {
      const t = this.t, b = this.body, hound = this.kind === 'Hound', v = this.variant;
      if (this.tick === 10 && hound) {
        let speed = v === 'B' ? 125 : v === 'D' ? 48 : 350, angle = this.direction;
        if (v === 'C' && this.o.wall) { const w = this.o.wall; angle = Math.atan2(w.y - b.y, w.x - b.x); speed = clamp((Math.hypot(w.x - b.x, w.y - b.y) - 18) * 6.5 + 110, 180, 580); }
        this.impulse(speed, angle, this.sign * (v === 'D' ? .6 : 3.4)); this.impact = 1;
      }
      const hits = this.o.hits || (hound ? [.2, .62, 1.05, 1.55] : [.35, .82, 1.31]);
      while (this.hitIndex < hits.length && t >= hits[this.hitIndex]) {
        const i = this.hitIndex++; this.impact = Math.max(this.impact, hound ? .7 : .28);
        this.bursts.push({ x: b.x, y: b.y, at: hits[i], seed: i });
        if (hound && t < 1.7) this.impulse(v === 'D' ? 7 : v === 'B' ? -13 : 28, this.direction + this.sign * .2, this.sign * .45);
      }
      let pull = 0;
      if (hound && v === 'B') pull = smooth(.43, .75, t) * (1 - smooth(2.0, 2.48, t)) * 360;
      if (!hound) {
        const start = v === 'C' ? .32 : v === 'D' ? .85 : .58;
        pull = smooth(start, start + .6, t) * (1 - smooth(v === 'D' ? 2.15 : 1.85, v === 'D' ? 2.7 : 2.4, t)) * (v === 'B' ? 125 : 230);
      }
      if (pull) {
        b.vx -= this.away.x * pull * dt; b.vy -= this.away.y * pull * dt;
        // Gradual alignment: the mass rotates under tension instead of snapping to a pose.
        const desired = this.direction + Math.PI / 2 + this.sign * (hound ? .23 : .45);
        b.omega += (delta(desired, b.angle) * 8 - b.omega * 4) * dt;
      }
      if (t > 2.55) { const d = Math.exp(-9 * dt); b.vx *= d; b.vy *= d; b.omega *= d; }
    }
    moveHands(dt) {
      const b = this.body, t = this.t, hound = this.kind === 'Hound';
      const purpose = 1 - smooth(hound ? 1.2 : 1.6, hound ? 2.15 : 2.65, t);
      this.hands.forEach((h, i) => {
        const side = h.side, shoulder = rotate(side * 11, 0, b.angle);
        const attack = rotate(-this.away.x, -this.away.y, -b.angle);
        const impactSpread = this.impact * smooth(.12, .28, t);
        const startEase = smooth(.04, .42, t);
        // Side-specific targets stay on their own side of the rounded body.
        const braceX = side * (17 + impactSpread * 8) + clamp(attack.x * 5, -3, 3);
        const braceY = clamp(attack.y * 15, -18, 15) + Math.sin(t * 23 + i * 2.4 + this.seed % 9) * 2.3 * purpose;
        let gx = h.initial[0] * (1 - startEase) + (braceX * purpose + side * (22 + i * 2) * (1 - purpose)) * startEase;
        let gy = h.initial[1] * (1 - startEase) + (braceY * purpose + (5 + i * 4) * (1 - purpose)) * startEase;
        if (!hound && t < .6) { gx = h.initial[0] + side * smooth(.1, .5, t) * 2; gy = h.initial[1] + Math.sin(t * 9 + i) * 1.1; }
        let goal = rotate(gx, gy, b.angle); goal.x += b.x; goal.y += b.y;
        // Brief planted resistance during a drag; release once reach is exhausted.
        if (hound && this.variant === 'B' && t > .85 + i * .33 && t < 1.06 + i * .33) {
          if (!h.plant) h.plant = { x: h.x, y: h.y };
          if (Math.hypot(h.plant.x - b.x - shoulder.x, h.plant.y - b.y - shoulder.y) < 26) goal = h.plant;
          else h.plant = null;
        } else h.plant = null;
        const stiffness = 70 + purpose * 90, damping = 16 + (1 - purpose) * 4;
        h.vx += ((goal.x - h.x) * stiffness - h.vx * damping) * dt;
        h.vy += ((goal.y - h.y) * stiffness - h.vy * damping) * dt;
        integrate(h, dt, .6, this.rects, .05);
        // Invisible arm reach and side constraints. The hand remains a circle.
        for (let pass = 0; pass < 3; pass++) {
          let local = rotate(h.x - b.x, h.y - b.y, -b.angle);
          local.x = side * Math.max(7, side * local.x);
          const hx = local.x - side * 11, hy = local.y, len = Math.hypot(hx, hy);
          if (len > 27) { local.x = side * 11 + hx * 27 / len; local.y = hy * 27 / len; }
          const point = rotate(local.x, local.y, b.angle); h.x = b.x + point.x; h.y = b.y + point.y;
          resolve(h, this.rects, .05);
        }
      });
    }
    updateAttachments(dt) {
      const t = this.t, b = this.body;
      const release = this.kind === 'Hound' ? (this.variant === 'D' ? .62 : .24) : (this.variant === 'C' ? .36 : .92);
      const gv = this.initial.gv, hp = rotate(0, -7, b.angle);
      const go = rotate(gv[0] - this.initial.h[1][0], gv[1] - this.initial.h[1][1], b.angle);
      const gp = this.headlamp ? rotate(0, this.o.hat === 'cap' || this.o.hat === 'hardhat' ? -33 : -26.5, b.angle) : {
        x: this.hands[1].x - b.x + go.x, y: this.hands[1].y - b.y + go.y
      };
      for (const [p, offset, at, enabled] of [[this.gear, gp, release, !this.headlamp], [this.hat, hp, release + .13, this.hasHat]]) {
        if (!p.detached) {
          p.x = b.x + offset.x; p.y = b.y + offset.y;
          p.angle = p === this.gear ? b.angle - Math.PI / 2 + (this.headlamp ? 0 : gv[2]) : b.angle;
          if (enabled && t >= at) {
            p.detached = true;
            const kick = rotate(this.sign * (p === this.gear ? 28 : -35), -26, b.angle);
            p.vx = b.vx + kick.x - b.omega * offset.y; p.vy = b.vy + kick.y + b.omega * offset.x;
            p.omega = b.omega + this.sign * (p === this.gear ? 5 : -4);
          }
        } else {
          const floor = this.surface(p.x, p.y), f = floor === 'wet' ? 1.7 : floor === 'concrete' ? 3.4 : 5;
          integrate(p, dt, t > 2.55 ? f + 9 : f, this.rects, .22);
          if (t > 2.55) p.omega *= Math.exp(-9 * dt);
        }
      }
    }
    step() {
      this.tick++; this.t = this.tick * DT; this.impact *= Math.exp(-14 * DT); this.drive(DT);
      const floor = this.surface(this.body.x, this.body.y);
      const friction = floor === 'wet' ? 1.65 : floor === 'concrete' ? 3.0 : floor === 'deep' ? 5.0 : 4.3;
      const hit = integrate(this.body, DT, friction, this.rects);
      if (hit > 35) {
        this.impact = Math.max(this.impact, clamp(hit / 260, .25, 1)); this.body.omega += this.sign * hit / 130;
        if (this.t - this.lastImpact > .16) { this.collisions++; this.lastImpact = this.t; if (this.bursts.length < 6) this.bursts.push({ x: this.body.x, y: this.body.y, at: this.t, seed: 20 + this.collisions }); }
      }
      this.moveHands(DT); this.updateAttachments(DT);
      const base = this.initial.b, recover = 1 - smooth(0, .6, this.t);
      this.scaleX = 1 + (base[0] - 1) * recover + this.impact * .07;
      this.scaleY = 1 + (base[1] - 1) * recover - this.impact * .07;
    }
    advance(time) {
      const ticks = Math.min(Math.floor((Math.max(0, time) + 1e-7) / DT), Math.floor(this.duration / DT));
      while (this.tick < ticks) this.step();
      this.finished = time >= this.duration;
      if (this.finished) for (const p of [this.body, ...this.hands, this.gear, this.hat]) p.vx = p.vy = p.omega = 0;
      this.pose = this.snapshot(); return this.pose;
    }
    snapshot() {
      const b = this.body;
      return { v: 1, seed: this.seed, h: this.hands.map(h => { const p = rotate(h.x - b.x, h.y - b.y, -b.angle); return [round(p.x), round(p.y)]; }),
        b: [round(this.scaleX), round(this.scaleY), round(this.initial.b[2] * (1 - smooth(0, .6, this.t)))],
        g: [round(this.initial.gv[0] - this.initial.h[1][0]), round(this.initial.gv[1] - this.initial.h[1][1]), this.initial.gv[2]],
        gd: this.gear.detached ? 1 : 0, hd: this.hat.detached ? 1 : 0 };
    }
  }
  function applyAvatar(avatar, pose) {
    if (!pose || pose.v !== 1) return false;
    avatar.body.position.set(0, 0); avatar.body.rotation = pose.b[2]; avatar.body.scale.set(pose.b[0], pose.b[1]);
    avatar.hands.forEach((h, i) => h.position.set(pose.h[i][0], pose.h[i][1]));
    avatar.hat.visible = !pose.hd; avatar.pack.visible = true;
    avatar.hat.y = 0; avatar.pack.y = 0;
    avatar.gear.visible = !pose.gd;
    // Attached light follows the reacting hand, not the living hand pose overwritten by update().
    if (avatar.lightGear.kind !== 'headlamp') {
      const right = pose.h[1], g = pose.g || [0, 0, 0]; avatar.gear.position.set(right[0] + g[0], right[1] + g[1]); avatar.gear.rotation = g[2];
    }
    avatar.__key = pose.seed; return true;
  }
  function install(win) {
    function rects(x, y) {
      const W = win.WORLD, old = W && W.mode;
      try { if (W) W.mode = 'crawl'; return win.__api && win.__api.Bc ? win.__api.Bc(x, y) : []; }
      finally { if (W) W.mode = old; }
    }
    const surface = (x, y) => win.WORLD && win.WORLD.surfaceAt ? win.WORLD.surfaceAt(x, y, win.__api && win.__api.Oc) : 'carpet';
    win.__deathMotion = {
      begin(d, victim, kill) {
        const av = !d.V && win.__api && win.__api.avatar && win.__api.avatar();
        if (av) av.__cause = d.kind;
        const initial = kill && kill.mi || (av ? { h: av.hands.map(h => [h.x, h.y]), b: [av.body.scale.x, av.body.scale.y, av.body.rotation], gv: [av.gear.x, av.gear.y, av.gear.rotation] } : undefined);
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
        Object.assign(d.body, { x: m.body.x, y: m.body.y, angle: m.body.angle, scaleX: 1, scaleY: 1, alpha: 1 });
        d.impact = m.impact; d.injury = smooth(.2, 1.82, d.elapsed); d.grip = smooth(.15, .4, d.elapsed); d.shake = m.impact * 7; d.bursts = m.bursts;
        // The attacker maintains contact as the victim slides; its own art is unchanged.
        const close = smooth(.06, .4, d.elapsed), reach = d.kind === 'Hound' ? 30 : 43;
        d.attacker.x = d.source.x * (1 - close) + (m.body.x - m.away.x * reach) * close;
        d.attacker.y = d.source.y * (1 - close) + (m.body.y - m.away.y * reach) * close;
        d.attacker.angle = Math.atan2(m.body.y - d.attacker.y, m.body.x - d.attacker.x);
        d.torch = { x: m.gear.x, y: m.gear.y, angle: m.gear.angle };
        d.physicalHat = { x: m.hat.x, y: m.hat.y, angle: m.hat.angle };
        d.debris.visible = true; let child = 0;
        if (!m.headlamp) { const g = d.debris.children[child++]; if (g) { g.visible = m.gear.detached; g.position.set(m.gear.x, m.gear.y); g.rotation = m.gear.angle + Math.PI / 2; } }
        if (m.hasHat) { const h = d.debris.children[child]; if (h) { h.visible = m.hat.detached; h.position.set(m.hat.x, m.hat.y); h.rotation = m.hat.angle; } }
        d.black = d.blackFn ? d.blackFn(d.elapsed) : 0;
        d.drawBlood(d.elapsed); d.drawShadow(d.elapsed); d.foreground.alpha = 1 - smooth(2.65, 3.2, d.elapsed);
        d.shade = smooth(3.12, d.duration, d.elapsed); d.finished = elapsed >= d.duration; return d.finished;
      },
      applyAvatar
    };
  }
  return { Motion, applyAvatar, install, DT, rotate, resolve };
});
