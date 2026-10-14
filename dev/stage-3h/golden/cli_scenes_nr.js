/* Stage 3H2 (before C-3) - client golden scenes for NEW RUN's client side (development only; loaded by cli_lib_h2.js's harness page right
 * after Stage 3H0's cli_scenes.js, whose runner window.__RUN and page record it uses; never by the game).
 *
 * B++'s mp.js (Stage 3D HQ2): __net.nr(ok) - what the bundle's NEW RUN button calls - sends only an intent {t:'nr', q, w}.  The pause
 * dialog's button (#reset) says what is happening: '…' and disabled while a press waits for its answer; 'WAIT N S' (the cooldown) or
 * 'NOT NOW' (any other refusal) for 2.5 s; then its own label again.  An approval calls ok(m) and puts its words in the run menu
 * (#runMenu .eyebrow / .intro); join() puts the menu's own words back.  A press does nothing while one waits (2.5 s), within 300 ms of
 * the last, or after an approval until the next join; with no answer in 2.5 s the button comes back; a closed connection forgets the
 * press.  These scenes drive exactly that with the environment's fake socket and clock, and record the button, the menu's words and
 * window.__nrDebug() after every step (the environment records every send, timer and DOM listener itself).  The installApi and snap
 * helpers are copies of cli_scenes.js's (that file keeps them to itself). */
(() => {
  'use strict';
  const H = window.__H, rec = window.__rec, watch = H.watch, gfx = H.gfx, S = window.__SC;
  if (!S) throw new Error('cli_scenes_nr.js needs Stage 3H0 cli_scenes.js loaded first');
  const $ = id => document.getElementById(id);
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
  const snap = (st, o = {}) => Object.assign({ t: 's', p: o.p || [], e: o.noE ? undefined : Object.assign({ st, h: [], m: [], b: 0, p: .1, gw: [], it: [], lf: [], sn: [] }, o.e || {}), me: o.me || '', ms: o.ms || 0, cp: o.cp || 0 },
    o.mk ? { mk: o.mk } : {}, o.ad ? { ad: o.ad, you: o.you } : {}, o.dbg ? { dbg: o.dbg, dx: o.dx } : {});
  const snapW = (st, w) => Object.assign(snap(st), { w });

  /* what the player sees and what mp.js believes, after a step */
  const ui = tag => {
    const b = $('reset'), r = $('runMenu'), e = r && r.querySelector('.eyebrow'), i = r && r.querySelector('.intro');
    rec('nr.ui', tag, b ? [b.textContent, b.disabled, b.dataset.label === undefined ? '~u' : b.dataset.label] : '~none',
      e && i ? [e.textContent, i.textContent, e.dataset.fade === undefined ? '~u' : e.dataset.fade, r.hidden] : '~none', window.__nrDebug ? window.__nrDebug() : '~none');
  };
  const okf = n => m => rec('nr.ok', n, m);
  const press = n => rec('nr.press', n, window.__net.nr(okf(n)));
  const Q = () => window.__nrDebug().q;                                       // the number of the last press sent (the server answers that one)

  /* one connection: every answer the server can give, every press the client keeps to itself, the timers */
  S.nr_answers = async () => {
    installApi({ started: true });
    ui('load');
    press('offline');                                                         // no connection: false (the bundle then does its own local fade)
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 }); window.__net.join(); H.msg(snapW(20, 3)); ui('joined, world 3');
    press(1); ui('1 pressed'); H.advance(120); H.msg({ t: 'nra', q: Q(), ok: 0, why: 'cooldown', wait: 12.34 }); ui('1 refused: cooldown 12.34');
    H.advance(1000); ui('1 +1 s'); H.advance(1600); ui('1 +2.6 s');
    press(2); H.advance(150); press('2 again 150 ms later'); ui('2 pressed twice');
    H.advance(1000); press('2 again while waiting'); ui('2 waiting');
    H.advance(1300); ui('2 at 2.45 s'); H.advance(150); ui('2 at 2.6 s: no answer');
    H.msg({ t: 'nra', q: Q(), ok: 0, why: 'held' }); ui('2 answered late: held');
    for (const [n, why] of [[3, 'state'], [4, 'dead'], [5, 'epoch'], [6, 'held']]) { H.advance(2700); press(n); H.advance(60); H.msg({ t: 'nra', q: Q(), ok: 0, why }); ui(n + ' refused: ' + why); }
    H.advance(2700); press(7); H.advance(60); H.msg({ t: 'nra', q: Q(), ok: 0, why: 'cooldown' }); ui('7 refused: cooldown without wait');
    H.advance(2700); press(8); H.advance(60); H.msg({ t: 'nra', q: Q(), ok: 0, why: 'cooldown', wait: 0.04 }); ui('8 refused: cooldown 0.04');
    H.advance(190); press('8 again 250 ms after it, already answered'); ui('a press within 300 ms of the last');
    H.advance(100); press('8 again 350 ms after it'); H.advance(60); H.msg({ t: 'nra', q: Q(), ok: 0, why: 'cooldown', wait: 1.5 }); ui('the press 350 ms later refused: cooldown 1.5');
    H.msg({ t: 'nra', q: Q() + 50, ok: 0, why: 'state' }); ui('an answer to a press never made');
    H.advance(2700); H.msg(snapW(20.05, 4)); ui('world 4');
    press(9); ui('9 pressed in world 4'); H.advance(80); H.msg({ t: 'nra', q: Q(), ok: 1, de: 12, w: 4 }); ui('9 approved');
    H.advance(400); press('10 after the approval'); ui('approved: a press does nothing');
    H.msg({ t: 'nra', q: Q(), ok: 1, de: 12, w: 4 }); ui('the approval again');
    H.advance(3000); ui('approved +3.4 s');
    window.__net.join(); ui('joined again');
    H.advance(400); press('next run'); H.advance(50); H.msg({ t: 'nra', q: Q(), ok: 0, why: 'cooldown', wait: 29.5 }); ui('the next press refused: cooldown 29.5');
    H.advance(500); window.__net.join(); ui('joined while the refusal shows'); H.advance(2500); ui('+2.5 s');
    await flush();
  };

  /* a press whose connection drops before the answer; the reconnect; an approval, then a drop; the press after that reconnect; an answer
   * naming a press of a connection that is gone */
  S.nr_reconnect = async () => {
    installApi({ started: true });
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 }); window.__net.join(); H.msg(snapW(30, 5)); ui('joined, world 5');
    press(1); ui('1 pressed'); H.advance(300); H.close(); ui('closed while 1 waits'); press('while closed'); ui('closed: a press');
    H.advance(1100); H.open(); ui('reopened'); H.msg({ t: 'hi', id: 8, sim: 1 }); H.msg(snapW(30.05, 6)); ui('world 6');
    H.advance(400); press(2); ui('2 pressed'); H.advance(50); H.msg({ t: 'nra', q: Q(), ok: 1, de: 4, w: 6 }); ui('2 approved');
    H.close(); ui('closed after the approval'); H.advance(1100); H.open(); H.msg({ t: 'hi', id: 9, sim: 1 }); H.msg(snapW(30.1, 6)); ui('reopened again');
    H.advance(400); press(3); ui('3 pressed after a reconnect'); H.advance(2600); ui('3: no answer');
    H.msg({ t: 'nra', q: 1, ok: 1, de: 9, w: 6 }); ui('an approval naming the first connection\'s press (forgotten: no beat)');
    await flush();
  };
})();
