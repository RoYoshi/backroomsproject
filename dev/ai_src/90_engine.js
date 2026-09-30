
/* ---------------------------------------------------------------- the engine: sound bus, level of detail, capture loop, snapshots */
const SPECIES = { hound: HOUND, smiler: SMILER };
const STRIDE = { 1: 64, 2: 82, 3: 56, 4: 42 };                      // px of travel per footfall: walk, run, crouch, crawl
const TIER = { near: 1900, mid: 3800 };                             // px to the nearest living player: full AI / reduced AI / asleep
const EV_NOISE = {                                                   // discrete movement events the client reports (see move.js)
  21: { r: 'vaultSlow', I: .3, type: 'vault' }, 22: { r: 'vaultNormal', I: .55, type: 'vault' }, 23: { r: 'vaultFast', I: .85, type: 'vault' },
  24: { r: 'land', k: .45, I: .25, type: 'land' }, 25: { r: 'land', k: .7, I: .5, type: 'land' }, 26: { r: 'land', k: 1, I: .75, type: 'land' },
  30: { r: 'slide', I: .8, type: 'slide' },
};

function create(cfg) {
  const rng = cfg.rng || Math.random;
  const eng = {
    rng, geo: new Geo(cfg.adapter), now: 0, ticks: 0, entities: [], nextId: 1, caps: [], capId: 0, sites: [], recentKills: {}, pressure: 0,
    events: [], sounds: [], pl: [], byId: new Map(), hash: new Hash(), lights: [], pst: new Map(), packT: 0,
    stats: { sense: 0, paths: 0, sounds: 0, capture: 0 },
    debugOn: false, forceCapture: null, log: [], logSeq: 0,
  };
  const geo = eng.geo;
  /* a short human-readable trail of what the entities decided (state changes, catches, kills, releases, lamp failures): the admin DEBUG tab reads it */
  eng.note = function (text) { this.log.push({ s: ++this.logSeq, t: +this.now.toFixed(1), x: text }); if (this.log.length > 60) this.log.shift(); };
  const tagOf = (kind, id) => String(kind || '?')[0].toUpperCase() + '#' + id;
  eng.emit = ev => {
    if (eng.events.length < 200) eng.events.push(ev);
    switch (ev.t) {
      case 'caught': eng.note(`${tagOf(ev.kind, ev.eid)} caught P${ev.pid} (${ev.ph})`); break;
      case 'kill': eng.note(`${tagOf(ev.kind, ev.eid)} KILLED P${ev.pid} · variant ${ev.variant} · ${ev.why}`); break;
      case 'release': eng.note(`E#${ev.eid} released P${ev.pid} · ${ev.why}`); break;
      case 'phase': eng.note(`E#${ev.eid} P${ev.pid} now ${ev.ph}`); break;
      case 'lightfail': eng.note(`lamps fail near ${Math.round(ev.x)},${Math.round(ev.y)} for ${(+ev.dur).toFixed(1)}s`); break;
    }
  };

  /* ------------------------------------------------------------ what the engine may know about people: a list handed in every step */
  eng.setPlayers = function (list) {
    this.pl = list; this.byId.clear(); this.hash.clear(); this.lights.length = 0;
    for (const p of list) {
      this.byId.set(p.id, p);
      if (p.alive) { this.hash.add(p, p.x, p.y); if (p.light) this.lights.push(p); }
    }
  };
  eng.playerById = function (id) { return this.byId.get(id) || null; };
  eng.nearPlayers = function (x, y, r) { const out = []; this.hash.near(x, y, r, p => { if (Math.hypot(p.x - x, p.y - y) <= r) out.push(p); }); return out; };
  eng.candidates = function (e, r) { return this.nearPlayers(e.x, e.y, r); };
  eng.nearestPlayerDist = function (x, y) { let b = 1e9; for (const p of this.pl) if (p.alive) { const d = Math.hypot(p.x - x, p.y - y); if (d < b) b = d; } return b; };
  eng.lightPlayers = function () { return this.lights; };
  eng.lightFail = function (x, y, r, dur) {
    geo.fails.push({ x, y, r, until: this.now + dur });
    this.emit({ t: 'lightfail', x, y, r, dur });
  };
  eng.blackout = () => geo.a.blackout();

  /* ------------------------------------------------------------ the sound bus: an event goes to every entity once; each decides what it makes of it */
  eng.sound = function (ev) {
    this.stats.sounds++;
    if (ev.ent) this.sounds.push([ev.type, Math.round(ev.x), Math.round(ev.y), +ev.I.toFixed(2), ev.ent]);       // entity sounds are also for the players' ears
    for (const e of this.entities) {
      if (e.id === ev.ent || e.tier === 'far') continue;
      hearEvent(e, this, ev);
    }
  };
  /* players make sound by what they do: standing is silent, walking is quiet, running carries, crouching almost vanishes */
  function playerNoise(dt) {
    const NZ = WORLD.NOISE;
    for (const p of eng.pl) {
      let s = eng.pst.get(p.id); if (!s) eng.pst.set(p.id, s = { d: 0, br: 0, sl: 0, str: 0 });
      if (p.evq && p.evq.length) {
        const q = p.evq.splice(0);
        if (p.alive) for (const [c, v] of q) {
          const d = EV_NOISE[c]; if (!d) continue;
          const surf = WORLD.SURF[geo.surface(p.x, p.y)] || WORLD.SURF.carpet;
          eng.sound({ x: p.x, y: p.y, r: NZ[d.r] * (d.k || 1) * surf.step, I: d.I * (.6 + .4 * v / 100), type: d.type, src: p.id, st: p.st, vx: p.vx, vy: p.vy });
        }
      }
      if (!p.alive) continue;
      const st = p.st | 0, sp = p.sp || Math.hypot(p.vx, p.vy);
      if (p.caught) {                                                          // struggling under something
        s.str -= dt; if (s.str <= 0) { s.str = .9; eng.sound({ x: p.x, y: p.y, r: 320, I: .5, type: 'struggle', src: p.id, st }); }
        continue;
      }
      if (STRIDE[st] && sp > 10) {
        s.d += sp * dt;
        if (s.d >= STRIDE[st]) {
          s.d -= STRIDE[st];
          const surf = WORLD.SURF[geo.surface(p.x, p.y)] || WORLD.SURF.carpet;
          const base = st === 1 ? NZ.walk : st === 2 ? NZ.run : st === 3 ? NZ.crouchMove : NZ.crawl, I = st === 1 ? .42 : st === 2 ? .9 : st === 3 ? .14 : .16;
          eng.sound({ x: p.x, y: p.y, r: base * surf.step, I, type: W_SN[st], src: p.id, st, vx: p.vx, vy: p.vy });
        }
      } else if (st === 5) {                                                    // the drag of a slide
        s.sl -= dt; if (s.sl <= 0) { s.sl = .3; eng.sound({ x: p.x, y: p.y, r: NZ.slide * .6, I: .5, type: 'slide', src: p.id, st, vx: p.vx, vy: p.vy }); }
      }
      // ragged breathing: an exhausted player is audible even standing still, but only close by, and hard to pin down
      const need = p.ex ? 1 : p.stamina < 26 ? .45 : 0;
      if (need > 0) { s.br -= dt; if (s.br <= 0) { s.br = p.ex ? 1.4 : 2.3; eng.sound({ x: p.x, y: p.y, r: NZ.exhaled * need, I: .35 + .15 * need, type: 'breath', src: p.id, st }); } }
    }
  }

  /* ------------------------------------------------------------ spawning */
  eng.spawn = function (kind, x, y, opts) {
    const e = mkEntity(this, kind, this.nextId++, x, y, opts || {});
    e.tierT = 0; e.senseDt = 0; e.wd = { x, y, t: 0 }; this.entities.push(e);
    return e;
  };
  eng.remove = function (id) {
    const i = this.entities.findIndex(e => e.id === id); if (i < 0) return false;
    const e = this.entities[i]; if (e.cap) finishCapture(this, e.cap, this.playerById(e.cap.pid), e);
    this.entities.splice(i, 1); return true;
  };
  eng.count = function (kind) { let n = 0; for (const e of this.entities) if (e.kind === kind) n++; return n; };
  eng.clear = function () { for (const e of this.entities.slice()) this.remove(e.id); this.caps.length = 0; this.sites.length = 0; this.recentKills = {}; this.sounds.length = 0; geo.fails.length = 0; this.pst.clear(); };

  /* ------------------------------------------------------------ one entity, one step */
  function sense(e, dt) {
    eng.stats.sense++;
    for (const id of e.mem.p.keys()) if (!eng.byId.has(id)) e.mem.p.delete(id);
    const cands = e.tier === 'near' ? eng.candidates(e, 1750) : [];
    updateVision(e, eng, dt, cands);
    decayMemory(e, dt, eng.now);
    moodTick(e, dt);
  }
  function onTier(e, nt) {
    const was = e.tier; e.tier = nt;
    if (nt === 'far') e.farSince = eng.now;
    if (was === 'far' && e.farSince !== undefined) { decayMemory(e, Math.max(0, eng.now - e.farSince), eng.now); e.farSince = undefined; }     // a sleeper's memory of the last hours fades all the same
    if (nt === 'far' && !e.cap) { e.path = []; e.trav = null; e.lunge = null; e.speed = 0; if (e.kind === 'hound') { if (e.state !== S.DORMANT) { setState(e, S.DORMANT); if (e.roam) e.roam.goal = null; } e.farT = 0; } else if (e.state !== S.HIDDEN) beginHidden(eng, e); }
    if (was === 'far' && nt !== 'far') { e.wake = 1; e.thinkT = 0; if (e.state === S.DORMANT && e.kind === 'hound') setState(e, S.ROAMING); }
  }
  function farStep(e, dt) {
    e.speed = 0; if (e.cap) return;
    if (e.kind === 'hound') {
      e.farT = (e.farT || 0) - dt;
      if (!e.path.length && e.farT <= 0) { const g = randomFloor(eng, e, 900, 2800); if (g) plan(eng, e, g.x, g.y); e.farT = rand(eng, 3, 12); }
      coarseMove(eng, e, dt);
    }
  }
  /* an entity that has not gone anywhere for a long while is stuck: set it back on open floor and let it think again */
  function watchdog(e, dt) {
    const w = e.wd; w.t += dt;
    if (w.t < 6) return;
    const moved = Math.hypot(e.x - w.x, e.y - w.y); w.x = e.x; w.y = e.y; w.t = 0;
    const idle = e.act === 'listen' || e.act === 'rest' || e.act === 'feed' || e.state === S.HIDDEN || e.state === S.WATCHING || e.state === S.PLAYING || e.state === S.ALERT || e.state === S.CURIOUS || e.state === S.DORMANT || e.state === S.CAUTIOUS || e.state === S.EXCITED || e.cap;
    const embedded = !e.trav && !geo.clear(e.x, e.y, 12, e.mode || 'walk');
    if ((moved < 26 && !idle) || embedded) {
      e.unstuck = (e.unstuck || 0) + 1;
      const c = geo.snap(e.x, e.y, e.caps, 4);
      if (embedded && c >= 0) { e.x = geo.cx(c); e.y = geo.cy(c); }
      e.path = []; e.trav = null; e.aim = null; e.pathAge = 99; e.goalKey = ''; e.speed = 0;
      if (e.kind === 'hound' && e.state !== S.HUNTING) { setState(e, S.ROAMING); e.roam.goal = null; }
      if (e.kind === 'smiler' && e.state !== S.HIDDEN && e.state !== S.PLAYING) beginHidden(eng, e);
    }
  }
  /* hounds that are up and about near one another act as a pack; the bond holds for a few seconds after they drift apart (they are still following the same scent) */
  function packs() {
    const hs = eng.entities.filter(e => e.kind === 'hound'), now = eng.now, fresh = new Map();
    const up = h => h.state !== S.ROAMING && h.state !== S.DORMANT;
    for (const a of hs) for (const b of hs) {
      if (a === b || !up(a) || !up(b) || Math.hypot(a.x - b.x, a.y - b.y) > 760) continue;
      const id = Math.min(a.id, b.id, fresh.get(a) || 1e9, fresh.get(b) || 1e9); fresh.set(a, id); fresh.set(b, id);
    }
    for (const h of hs) {
      const f = fresh.get(h);
      if (f) { h.pack = f; h.packOld = f; h.packUntil = now + 7; }
      else if (h.packUntil > now && h.packOld && up(h) && hs.some(o => o !== h && o.packOld === h.packOld && o.packUntil > now && up(o))) h.pack = h.packOld;
      else h.pack = 0;
    }
  }

  eng.step = function (dt) {
    const now = (this.now += dt); geo.now = now; this.ticks++;
    playerNoise(dt);
    if (geo.fails.length) geo.fails = geo.fails.filter(f => f.until > now);
    for (const e of this.entities) {
      if (e.state !== e.lgS) { if (e.lgS !== undefined) this.note(`${tagOf(e.kind, e.id)} ${e.lgS} -> ${e.state}${e.act ? ' /' + e.act : ''}`); e.lgS = e.state; }
      e.t += dt; e.stateT += dt; e.actT += dt;
      e.tierT -= dt; if (e.tierT <= 0) { e.tierT = .4 + this.rng() * .15; const nt = tierOf(e, this); if (nt !== e.tier) onTier(e, nt); }
      if (e.deaf > 0) e.deaf -= dt;
      if (e.tier === 'far') { farStep(e, dt); continue; }
      e.thinkT -= dt; e.senseDt += dt;
      let thinkNow = false;
      if (e.thinkT <= 0) { e.thinkT = e.tier === 'near' ? .1 : .35; thinkNow = true; sense(e, e.senseDt); e.senseDt = 0; }
      e.pathAge += dt;
      const res = e.sp.tick(this, e, dt, thinkNow);
      if (res && res.pv && res.pv.alive && !res.pv.caught && !e.cap) { this.stats.capture++; beginCapture(this, e, res.pv, { dir: res.dir, speed: res.speed, style: res.style }); }
      watchdog(e, dt);
    }
    for (const cap of this.caps.slice()) capStep(this, cap, dt);
    this.packT -= dt; if (this.packT <= 0) { this.packT = .5; packs(); }
  };

  /* admin aid (DEATHS tab): one chosen death on one player, through the real kill path (see previewKill in the capture part) */
  eng.previewKill = function (e, variant, pv) { return previewKill(this, e, variant, pv); };

  /* admin aid: put an entity at (x,y) and set it on the trail of a spot */
  eng.summon = function (e, x, y, tx, ty, pid) {
    if (e.cap) return false;
    e.x = x; e.y = y; e.path = []; e.trav = null; e.lunge = null; e.speed = 0; e.tier = 'near'; e.tierT = 1;
    const r = rec(e, pid || 0); r.lkx = tx; r.lky = ty; r.conf = 1; r.aw = .9; r.seenAt = this.now; r.heardAt = this.now;
    if (e.kind === 'hound') { beginSearch(this, e, r, 'sound'); e.search.goal = { x: tx, y: ty }; e.search.first = false; setAct(e, ''); }
    else { setState(e, S.WATCHING, 'watch'); e.target = pid || 0; e.watch = { until: this.now + 8, rid: pid || 0 }; sFace(e, 1); }
    return true;
  };

  /* ------------------------------------------------------------ what goes over the wire / to the debug overlay */
  eng.snapshot = function () {
    const h = [], m = [];
    for (const e of this.entities) (e.kind === 'hound' ? h : m).push(e.sp.snap(e));
    return { h, m };
  };
  eng.drainSounds = function () { const s = this.sounds; this.sounds = []; return s; };
  eng.drainEvents = function () { const s = this.events; this.events = []; return s; };
  eng.debugInfo = function () {
    const out = [];
    for (const e of this.entities) {
      const tgt = e.target > 0 ? e.mem.p.get(e.target) : null, tp = tgt && this.playerById(tgt.id);
      let best = tgt; if (!best) { const b = bestLead(e, this.now); best = b && b[0]; }
      const near = this.nearPlayers(e.x, e.y, 1500).filter(p => p.alive).length;
      const sr = e.search && e.search.goal, cap = e.cap;
      out.push({
        i: e.id, k: e.kind, x: Math.round(e.x), y: Math.round(e.y), a: +e.ang.toFixed(2), s: e.state, ac: e.act || '-', tier: e.tier, v: Math.round(e.speed),
        mood: [+e.mood.arousal.toFixed(2), +e.mood.frustration.toFixed(2), +e.mood.excitement.toFixed(2), +e.mood.boredom.toFixed(2)],
        tg: tp ? tp.id : 0,
        lk: best ? { x: Math.round(best.lkx), y: Math.round(best.lky), age: +(this.now - Math.max(best.seenAt, best.heardAt)).toFixed(1), c: +best.conf.toFixed(2), seen: best.seen ? 1 : 0, aw: +best.aw.toFixed(2) } : null,
        vr: Math.round(e.sp.vision.range * (.5 + .7 * e.tr.VISION)),
        hr: e.hear ? { x: Math.round(e.hear.x), y: Math.round(e.hear.y), t: +(this.now - e.hear.t).toFixed(1), I: +e.hear.I.toFixed(2), ty: e.hear.type } : null,
        sg: sr ? { x: Math.round(sr.x), y: Math.round(sr.y) } : null, near,
        cp: cap ? { m: cap.mode, ph: cap.phase, v: cap.variant, t: +cap.t.toFixed(1), d: +Math.max(0, cap.decideAt - cap.t).toFixed(1), n: cap.plays } : null,
        cd: e.dbg.capture || null,
        path: e.path.slice(0, 7).map(w => [Math.round(w.x), Math.round(w.y)]),
        pu: e.dbg.pursuit || null,
        lit: e.lit !== undefined ? +e.lit.toFixed(2) : undefined,
        sm: e.kind === 'smiler' ? { q: e.quirk || '-', enc: e.dbg.enc || '', le: e.dbg.lightEv || '', ex: +(e.exposed || 0).toFixed(2), rt: e.dbg.returned | 0, bk: e.dbg.backed | 0, sd: e.dbg.stoodDown | 0, iv: e.dbg.investigated | 0 } : undefined,
      });
    }
    return out;
  };
  return eng;
}
return { create, S, SNAMES, SCODE, HACT, SACT, TRAITS, SPECIES, HOUND, SMILER, mkRng, Geo, hearEvent, TIER };
});
