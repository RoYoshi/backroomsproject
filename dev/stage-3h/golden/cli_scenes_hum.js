/* Stage 3H2 (before C-4) - a client golden scene for mp.js's fluorescent hum (development only; loaded by cli_lib_h2.js's harness page
 * after Stage 3H0's cli_scenes.js and cli_scenes_nr.js; never by the game).
 *
 * Stage 3H0's hum_dread scene stands by fixture 0 (index 0 flickers whatever the rule: 0 is a multiple of anything), and its ordinary
 * hum lasts 1.7 s, so two rules of humUpdate were invisible to every golden: which fixtures flicker (every 13th) and how far apart the
 * ordinary crackles are (1.4 to 6.9 s).  This scene stands by fixture 1 (an ordinary one) for 12 s, then by fixture 13 (a flickering
 * one) and by fixture 12 (an ordinary one) for 3 s each, then by fixture 26 through a blackout and back.  Everything the hum does is
 * recorded by the environment's audio context (every node, connection, parameter change, start and stop on the fake clock).
 * The installApi helper is a copy of cli_scenes.js's (that file keeps it to itself); the frame helper is its frame() without the DOM
 * record, which the hum does not touch. */
(() => {
  'use strict';
  const H = window.__H, rec = window.__rec, watch = H.watch, gfx = H.gfx, S = window.__SC;
  if (!S) throw new Error('cli_scenes_hum.js needs Stage 3H0 cli_scenes.js loaded first');
  const DT = 1000 / 60;
  const LOS = (x, y, a, d) => (Math.abs(Math.round(a * 100)) % 3 === 0 ? d * .5 : d);
  const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

  /* ---------- the game API, as the bundle installs it ---------- */
  const DEFS = { flashlight: [['body'], ['lens'], ['ring']], headlamp: [['strap'], ['lamp'], ['band']], lantern: [['cage'], ['glass'], ['handle'], ['base']], camcorder: [['body'], ['grip'], ['lens']] };
  const DEF = { flashlight: { body: '#ffe7b2', lens: '#333333', ring: '#888888' }, headlamp: { strap: '#222222', lamp: '#ffeecc', band: '#555555' },
    lantern: { cage: '#ffaa66', glass: '#222222', handle: '#999999', base: '#444444' }, camcorder: { body: '#202020', grip: '#303030', lens: '#404040' } };
  let objN = 0;
  function installApi({ started = false, audio = false } = {}) {
    const S = { started, paused: false, fall: -1, death: { attacker: { x: 1010.4, y: 3270.6, angle: .7 }, finished: false }, bodies: [] };
    const Hp = watch({ x: 960, y: 3264, vx: 0, vy: 0, angle: .25, id: null, stamina: 100, exhausted: false, sprinting: false,
      equipment: { kind: 'flashlight', color: '#ffe7b2', parts: { flashlight: { body: '#ffd090', lens: '#333333', ring: '#888888' } } } }, 'H');
    const G = watch({ x: -9e4, y: -9e4, angle: 0, state: 'patrol', distance: 0, caught: false, caughtBy: '', grace: 0, pressure: 0 }, 'G');
    const q = Array.from({ length: 64 }, (_, i) => watch({ x: -9e4, y: -9e4, angle: 0, distance: 0, off: true, state: 'lurk', ls: 'lurk', face: 0, side: 0 }, 'q' + i));
    const V = watch({ blackout: false }, 'V');
    const layer = H.container('layer'), floor = H.container('floor');
    const avatar = (id, gear) => gfx(id, { gear: watch({ visible: true }, id + '.gear'), beam: null,
      update: (now, light, x, src) => rec('av.update', id, now, light, x, src), deathPose: (...a) => rec('av.deathPose', id, ...a) });
    class Jl {
      constructor() { this.__rid = 'jl' + (++objN); rec('api.Jl.new', this.__rid); this.blood = gfx(this.__rid + '.blood'); this.foreground = gfx(this.__rid + '.fg'); this.debris = gfx(this.__rid + '.debris');
        this.body = { x: 0, y: 0, angle: 0, scaleX: 1, scaleY: 1, alpha: 1 }; this.attacker = { x: 0, y: 0, angle: 0 }; this.injury = 0; this.impact = 0; this.elapsed = 0; this.grip = 0; this.variant = 'A'; }
      start(k, now, src, slot, victim, opt) { rec('jl.start', this.__rid, k, now, src, slot, victim, opt); this.t0 = now; this.body.x = victim.x; this.body.y = victim.y; this.attacker.x = src.x; this.attacker.y = src.y; this.variant = (opt && opt.v) || 'A'; }
      frame(now) { const e = now - this.t0; this.elapsed = e; this.body.angle = e * .3; this.body.scaleX = 1 + e * .01; this.body.alpha = Math.max(0, 1 - e / 10); this.injury = Math.min(1, e / 2); this.impact = e < .5 ? 1 : 0; this.grip = e < 1 ? 1 : 0; this.attacker.angle = e; return e > 2.5; }
    }
    class Gl { constructor(o) { const id = 'gl' + (++objN); rec('api.Gl.new', id, o); return gfx(id); } }
    class Wl { constructor() { const id = 'wl' + (++objN); rec('api.Wl.new', id); return gfx(id, { attackPose: (...a) => rec('wl.attackPose', id, ...a) }); } }
    const ctx = audio ? H.audioCtx() : null, gain = ctx ? ctx.createGain() : null;
    const A = {
      G, H: Hp, q, V, Ic: { x: 960, y: 3264 },
      look: { hat: 'cap', texture: 'freckles', hands: '#e6bb76', main: '#3a6ea5', backpack: 'none' },
      gear: { defs: DEFS, parts: (eq, k) => { rec('api.gear.parts', k); return Object.assign({}, DEF[k], eq && eq.parts && eq.parts[k]); } },
      started: () => S.started, paused: () => S.paused, unpause: () => { rec('api.unpause'); S.paused = false; },
      tp: (x, y) => { rec('api.tp', x, y); Hp.x = x; Hp.y = y; }, revive: () => rec('api.revive'), win: () => rec('api.win'),
      bodies: list => { rec('api.bodies', list); S.bodies = list; }, bodyList: () => S.bodies,
      death: () => S.death, fall: () => S.fall, layer: () => layer, floor: () => floor,
      mkAvatar: (look, gear) => { const id = 'av' + (++objN); rec('api.mkAvatar', id, look, gear); return avatar(id, gear); },
      Jl, Gl, Wl,
      zc: (tx, ty) => ((tx * 7 + ty * 3) % 5) !== 0, Hc: (nx, ny) => ((nx + ny * 2) % 4) === 0,
      sl: (x, y, r) => ((((x / 96) | 0) * 3 + ((y / 96) | 0)) % 4) !== 0, Uc: (x, y, a, max) => Math.min(max, 40 + (Math.abs(Math.round(x * .37 + y * .11 + a * 97)) % 260)),
      lamps: Array.from({ length: 40 }, (_, i) => ({ x: 192 + (i % 8) * 384, y: 192 + ((i / 8) | 0) * 384 })),
      audio: () => ctx ? { context: ctx, gain, muted: false } : null,
    };
    window.__api = A;
    rec('api.installed', { started, audio });
    return { A, S };
  }
  function frame(A, o = {}) {
    const ms = o.ms || DT; H.advance(ms);
    const p = A.H, arg = { p, cam: { x: Math.round(p.x), y: Math.round(p.y) }, sc: o.sc || 1, run: !!o.run, started: !!o.started, light: o.light !== false, G: A.G, q: A.q, los: LOS, t: ms / 1000 };
    window.__mp(arg);
  }
  const at = (A, i) => { const L = A.lamps[i]; A.H.x = L.x + 40; A.H.y = L.y + 30; rec('hum.at', i); };   // 50 px from fixture i

  S.hum_fixtures = async () => {
    const { A } = installApi({ started: true, audio: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }));
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 });
    at(A, 1); for (let f = 0; f < 720; f++) frame(A, { run: true, started: true });          // fixture 1, 12 s: the ordinary hum and its crackles
    at(A, 13); for (let f = 0; f < 180; f++) frame(A, { run: true, started: true });         // fixture 13: one that flickers
    at(A, 12); for (let f = 0; f < 180; f++) frame(A, { run: true, started: true });         // fixture 12: an ordinary one again
    at(A, 26);
    for (let f = 0; f < 300; f++) { if (f === 60) A.V.blackout = true; if (f === 180) A.V.blackout = false; frame(A, { run: true, started: true }); }   // fixture 26 (flickers), a blackout and back
    await flush();
  };
})();
