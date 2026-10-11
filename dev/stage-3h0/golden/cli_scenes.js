/* Stage 3H0 - client golden-trace scenes (development only; loaded by the client harness page right after mp.js, never by the game).
 * Each scene installs window.__api the way the game bundle would, then drives mp.js only through what reaches it in the real game:
 * WebSocket open / message / close, the __net facade the bundle calls, the per-frame hook window.__mp, keyboard / pointer events and clicks
 * on its own admin panel, and the fake clock.  All inputs come from the scene's own numbers (never Math.random, which belongs to mp.js), so
 * the old and the new mp.js receive exactly the same inputs at exactly the same fake times. */
(() => {
  'use strict';
  const H = window.__H, rec = window.__rec, watch = H.watch, gfx = H.gfx;
  const NEWG = new Set(window.__H0_NEW_GLOBALS || []);
  const OWN = new Set(['__T', '__H', '__rec', '__SC', '__RUN', '__H0_NEW_GLOBALS']);
  const DT = 1000 / 60;
  const $ = id => document.getElementById(id);
  const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

  /* ---------- state of the page (load and end of scene) ---------- */
  const kind = v => Array.isArray(v) ? 'array:' + v.length : v instanceof Set ? 'set:' + v.size : v instanceof Map ? 'map:' + v.size : v === null ? 'null' : typeof v;
  function pageState() {
    const g = Object.keys(window).filter(k => k.startsWith('__') && !OWN.has(k) && !NEWG.has(k)).sort().map(k => [k, kind(window[k])]);
    const net = window.__net ? Object.keys(window.__net).map(k => [k, kind(window.__net[k])]) : null;
    /* the page's own <script> elements are the harness's loading order (which differs on purpose when a helper script is added), not mp.js's
     * output: they are left out of the DOM state (H0-2 fix; see evidence/h0-1b/README.md) */
    const body = [...document.body.children].filter(e => e.tagName !== 'SCRIPT').map(e => e.tagName + (e.id ? '#' + e.id : '') + (e.hidden ? '[hidden]' : '')), head = [...document.head.children].map(e => e.tagName + (e.id ? '#' + e.id : ''));
    const bc = document.body.cloneNode(true); bc.querySelectorAll('script').forEach(x => x.remove());
    const ls = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); } } catch (e) { }
    const N = window.__NET;
    return { globals: g, net, body, head, bodyHtml: [bc.innerHTML.length, fnv(bc.innerHTML)], ls,
      NET: N ? { off: N.off, DELAY: N.DELAY, lastSt: N.lastSt, epoch: N.epoch, hist: [...N.hist].map(([k, h]) => [k, h.length, h.seen]), onEpoch: typeof N.onEpoch } : null,
      pending: H.pending(), fxs: (window.__fxs || []).length, peerLights: (window.__peerLights || []).length };
  }
  rec('loaded', pageState());

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
  const LOS = (x, y, a, d) => (Math.abs(Math.round(a * 100)) % 3 === 0 ? d * .5 : d);
  let lastDigest = '';
  function dom() {
    const t = $('peerTip'), n = $('onlineNote'); rec('dom', $('dread').style.opacity, $('game').style.transform, $('light').style.opacity, $('net').textContent, t.style.display, t.textContent, t.style.left, t.style.top, n ? n.hidden : '~none', document.body.className);
    const w = window, d = JSON.stringify({ on: w.__net && w.__net.on, kill: w.__kill, killer: w.__killer, gl: w.__glitches, it: w.__items, gs: w.__glitchSolo, is: w.__itemSolo, pl: w.__peerLights,
      hb: w.__hideBodies && [...w.__hideBodies], fk: w.__fxKill && [...w.__fxKill], fs: w.__fxKillS && [...w.__fxKillS], fx: (w.__fxs || []).length, hs: (w.__hounds || []).map((o, i) => o ? [i, o.id] : 0).filter(Boolean),
      dl: w.__dlab || null, mv: w.__mv && [w.__mv.down, w.__mv.dragTo], ad: $('adminPanel') && [$('adminPanel').hidden, $('adminPanel').className], km: $('kicked') && $('kicked').hidden, am: $('adminMsg') && [$('adminMsg').hidden, $('adminMsg').textContent] });
    if (d !== lastDigest) { lastDigest = d; rec('state', JSON.parse(d)); }
  }
  function frame(A, o = {}) {
    const ms = o.ms || DT; H.advance(ms);
    const p = A.H, arg = { p, cam: { x: Math.round(p.x), y: Math.round(p.y) }, sc: o.sc || 1, run: !!o.run, started: !!o.started, light: o.light !== false, G: A.G, q: A.q, los: LOS, t: ms / 1000 };
    const t0 = H.realNow(); try { window.__mp(arg); } finally { H.perf.mpMs += H.realNow() - t0; H.perf.mpCalls++; }
    dom();
  }
  const hound = (i, x, y, a, s = 1, o = {}) => Object.assign({ i, x, y, a, s, ac: 0, v: 120, h: 0, lh: 0, l: -1, tg: 0, cp: 0, k: 0 }, o);
  const smiler = (i, x, y, a, s = 0, o = {}) => Object.assign({ i, x, y, a, s, ac: 0, v: 0, f: .5, h: 0, lh: 0, tg: 0, cp: 0, lt: 0, sp: 0 }, o);
  const peer = (id, x, y, o = {}) => Object.assign({ id, x, y, a: .5, n: 'PEER' + id, c: '#ffe7b2', d: 0, r: 0, k: 'flashlight', l: 1, ir: 0, lk: 'beanie|stripes|#112233|#445566|none', lp: '#ffe7b2,#333333,#888888', f: -1, mv: [1, 150, 90, 0] }, o);
  const snap = (st, o = {}) => Object.assign({ t: 's', p: o.p || [], e: o.noE ? undefined : Object.assign({ st, h: [], m: [], b: 0, p: .1, gw: [], it: [], lf: [], sn: [] }, o.e || {}), me: o.me || '', ms: o.ms || 0, cp: o.cp || 0 },
    o.mk ? { mk: o.mk } : {}, o.ad ? { ad: o.ad, you: o.you } : {}, o.dbg ? { dbg: o.dbg, dx: o.dx } : {});
  const body = (k, x, y, o = {}) => Object.assign({ k, n: 'BODY' + k, x, y, a: 1.2, sx: 1, sy: 1, c: 'Hound', aa: .4, lk: 'hardhat|patched|#e6bb76|#aa3322|utility',
    eq: { kind: 'lantern', color: '#ffaa66', parts: '#ffaa66,#222222,#999999,#444444' }, bl: [[x, y, 12], [x + 4, y + 2, 345]], dr: [x + 20, y - 4, .3], ht: [x - 9, y + 3, 1.1], lo: 1, ph: 1, hd: [3, -4, 5, 6], ho: 1, tr: [[x, y], [x + 2, y + 1]] }, o);
  const S = window.__SC = {};

  /* load only: what mp.js does by itself (listeners, timers, DOM, globals, the WebSocket URL), then 2.6 s of its own timers */
  S.load = async () => { H.advance(2600); await flush(); };

  /* the menu, online: p every 250 ms without movement reports, peers (look, gear, parts, falling in), entities, sounds, failing lamps, hover */
  S.menu_online = async () => {
    const { A } = installApi({ started: false });
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 }); H.msg({ t: 'bodies', v: 1, b: [] });
    let st = 50;
    for (let f = 0; f < 40; f++) { if (f % 3 === 0) { st = +(st + .05).toFixed(3); H.msg(snap(st, { e: { h: [hound(3, 4000, 3000, 1.5)] } })); } frame(A, { run: false, started: false }); }
    for (let f = 0; f < 90; f++) {
      if (f % 3 === 0) {
        st = +(st + .05).toFixed(3);
        const p11 = peer(11, f < 45 ? 900 : 900 + 420, 3000, { k: 'headlamp', lp: '' }); delete p11.lk;
        H.msg(snap(st, { p: [peer(8, 1200 + f * 2, 3300, { lk: 'cap|plain|#e6bb76|#ffcc77|canvas', mv: [1, 150, 88, 0] }), peer(9, 1500, 3400, { k: 'camcorder', l: 1, ir: 1, lp: '#101010,#202020,#303030', f: f < 30 ? +(f / 30).toFixed(2) : -1 }), p11],
          e: { h: [hound(3, 4000 - f * 5, 3000, 1.5)], m: [smiler(4, 2000, 2500 + f, -1)], sn: f === 30 ? [['growl', 4000, 3000, .8], ['bark', 1, 1, 1], 'bad', ['kill', 2, 2, 1]] : [], lf: f === 30 ? [[2000, 2500, 300, 1.5]] : [] } }));
      }
      if (f === 60) window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 640 + (1320 - 960), clientY: 360 + (3300 - 3264), bubbles: true }));
      if (f === 75) window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', clientX: 10, clientY: 10, bubbles: true }));
      frame(A, { run: false, started: false });
    }
    await flush();
  };

  /* a run, online: join, p every 50 ms with movement reports, entities and the G mirror, blackout, glitches, items and pickup, tp, revive,
   * banner, pong, capture phases, the server's kill, tick(), respawn, the exit; the dread layer near monsters */
  S.run_online = async () => {
    const { A, S: St } = installApi({ started: true });
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', clientX: 5, clientY: 5, bubbles: true }));
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 });
    window.__net.join();
    H.msg({ t: 'bodies', v: 2, b: [body(9, 1400, 3350), body(7, 1000, 3300, { c: 'Smiler', ph: 0 })] });
    let st = 300;
    for (let f = 0; f < 420; f++) {
      if (f % 3 === 0) {
        st = +(st + .05).toFixed(3);
        const near = f > 150 && f < 260, cp = f >= 200 && f < 215 ? { ph: 'down', e: 3, k: 'Hound', d: 0 } : f >= 215 && f < 230 ? { ph: 'crawl', e: 3, k: 'Hound', d: [1000, 3300] } : f >= 230 && f < 236 ? { ph: 'release', e: 3, k: 'Hound', d: 0 } : 0;
        const dead = f >= 300 && f < 330;
        H.msg(snap(st, { p: [peer(8, 1300, 3260 + (f % 30), { r: f % 2, mv: [f % 8, 150 + f, 90 - (f % 50), f > 200 ? 1 : 0] })],
          e: { h: [hound(3, near ? A.H.x + 120 - f * .2 : 3000 - f, 3264, 1.2, near ? 3 : 1), hound(5, 5000, 1000 + f, 0)], m: [smiler(4, near ? A.H.x - 200 : 2200, 2600, 2.5), smiler(6, 7000, 6000, 0)],
            b: f > 120 && f < 140 ? 1 : 0, gw: [[7200, 912, 1, 0], [5280, 2928, 0, 1]], it: f > 60 && f < 120 ? [[Math.round(A.H.x + (f < 90 ? 48 : 20)), Math.round(A.H.y), 'cartograph']] : [], p: +(.1 + f / 1000).toFixed(3) },
          cp, me: dead ? 'Hound' : '', ms: f >= 300 ? 1 : 0, mk: dead ? { v: 'A', k: 'Hound', e: 3, ax: 1080, ay: 3264, aa: 2.1, w: [1100, 3200, 1.571], x: 960, y: 3264, a: .25, why: 'test' } : undefined }));
      }
      if (f === 40) H.msg({ t: 'tp', x: 1000, y: 3300 });
      if (f === 45) H.msg({ t: 'revive' });
      if (f === 50) H.msg({ t: 'msg', text: 'the halls are watching', from: 'ADMIN' });
      if (f === 55) H.msg({ t: 'pong', ts: H.now - 120 });
      if (f === 56) H.msg({ t: 'pong', ts: H.now - 80 });
      if (f === 100) H.msg({ t: 'got', item: 'cartograph' });
      if (f === 302) { window.__net.tick(); window.__net.tick(); }
      if (f === 340) window.__net.respawn();
      if (f % 7 === 0 && (f < 55 || f > 125)) { A.H.x += 3; A.H.vx = 180; A.H.angle = +(.25 + f * .00137).toFixed(5); }
      if (f === 380) H.msg({ t: 'exit', secs: 125 });
      frame(A, { run: f < 300 || f > 340, started: true, light: f % 50 < 40 });
    }
    H.advance(1200); await flush();
  };

  /* interpolation: exact arrival times with jitter, a late packet, a repeat and a reordered snapshot, a gap (extrapolation, then hold), a 350 px
   * jump, a server clock that steps back (a new world) and one that leaps 40 s, an entity that leaves and is pruned, a snapshot without a clock,
   * a reconnect (a new timeline) */
  S.interp = async () => {
    const { A } = installApi({ started: true });
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 });
    let r = 7; const R = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
    const probe = tag => { const N = window.__NET; rec('probe', tag, window.__netPose('h3'), window.__netPose('m4'), window.__netPose('h7'), window.__netPose('h99'), N.off, N.lastSt, N.epoch, [...N.hist].map(([k, h]) => [k, h.length, h.seen, h[h.length - 1]])); };
    let x7 = 4000, x8on = 0;
    const ent = (st, x) => ({ h: [hound(3, x, 3264 + Math.sin(st) * 40, +(st % 6.283).toFixed(3)), hound(7, x7, 1500, 0)].concat(st < 230 ? [hound(5, 2000, 2000, 1)] : []).concat(x8on > 0 ? [hound(8, 6000, 6000, 0)] : []),
      m: [smiler(4, 3000 - x / 4, 2500, -1.5 + (st % 1))] });
    const plan = [];
    let st = 200, at = H.now + 30;
    for (let k = 0; k < 60; k++) { st = +(st + .05).toFixed(3); at += 50; plan.push([Math.round(at + R() * 40 + (k === 20 ? 100 : 0)), st, 1000 + k * 14]); }
    plan.push([at + 60, plan[plan.length - 1][1], 2000]);                                   // a repeat of the newest clock
    plan.push([at + 70, +(st - .1).toFixed(3), 2100]);                                     // older than the newest
    at += 450;                                                                               // a gap
    for (let k = 0; k < 10; k++) { st = +(st + .05).toFixed(3); at += 50; plan.push([at, st, (k === 3 ? 2400 : 1900) + k * 14]); }   // a 350 px jump
    at += 50; plan.push([at, +(st - .3).toFixed(3), 480]); st = +(st - .3).toFixed(3);      // the clock steps back 0.3 s: a new world
    for (let k = 0; k < 5; k++) { st = +(st + .05).toFixed(3); at += 50; plan.push([at, st, 490 + k * 3]); }
    at += 50; plan.push([at, +(st - 1).toFixed(3), 500]); st = +(st - 1).toFixed(3);         // the clock steps back 1 s
    for (let k = 0; k < 10; k++) { st = +(st + .05).toFixed(3); at += 50; plan.push([at, st, 520 + k * 14]); }
    at += 50; st = +(st + 40).toFixed(3); plan.push([at, st, 700]);                         // a leap of 40 s
    for (let k = 0; k < 170; k++) { st = +(st + .05).toFixed(3); at += 50; plan.push([at, st, 720 + k * 5, k < 10 ? 1 : 0]); }
    plan.sort((a, b) => a[0] - b[0]);
    let i = 0;
    while (i < plan.length) {
      if (plan[i][0] <= H.now + DT) {
        H.advance(Math.max(0, plan[i][0] - H.now));
        const [, s2, x, with8] = plan[i++]; x8on = with8 || 0; x7 += (i === 40 ? 299.5 : i === 44 ? 300.5 : 10); H.msg(snap(s2, { e: ent(s2, x) }));
        if (i % 9 === 0) H.msg(snap(s2, { noE: true }));
        if (i % 13 === 0) H.msg({ t: 's', p: [], e: { h: [], m: [], b: 0, p: 0, gw: [], it: [], lf: [], sn: [] }, me: '', ms: 0, cp: 0 });   // a snapshot without a clock
        probe('after-packet');
      } else { frame(A, { run: true, started: true }); probe('frame'); }
    }
    for (let f = 0; f < 30; f++) { frame(A, { run: true, started: true }); probe('tail'); }
    H.close(); probe('closed'); H.advance(1100); H.open(); probe('reopened');
    H.msg(snap(10, { e: ent(10, 900) })); probe('new-timeline');
    for (let f = 0; f < 10; f++) { frame(A, { run: true, started: true }); probe('end'); }
    await flush();
  };

  /* other players' deaths, vanishings and bodies: replays (hound with a wall, smiler, vanish, our own id, a replacement), their end, the
   * corpse records with and without hands, older clients' backpacks, lights left by corpses, dead and falling peers */
  S.fx_bodies = async () => {
    const { A } = installApi({ started: true });
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 });
    H.msg({ t: 'bodies', v: 3, b: [body(20, 1500, 3300), body(21, 1600, 3300, { ph: 0, hd: 0, tr: 0, lo: 0 }), body(22, 1700, 3300, { ph: 1, hd: [1, 2, 3] }), body(23, 1800, 3300, { c: 'Vanish', lk: 'beanie|plain|#e6bb76|#ffcc77|canvas' }),
      body(24, 900, 3200, { eq: { kind: 'camcorder', color: '#202020', parts: '#202020,#303030,#404040' } }), body(25, 1000, 3250, { eq: { kind: 'flashlight', color: '#ffe7b2', parts: 'bad' }, hd: [99, -99, 0, 0], ph: 1 }),
      body(26, 1050, 3250, { eq: { kind: 'headlamp', color: '#ffe7b2', parts: '#abc,#222222,#33333G' } })] });
    let st = 500;
    const fxA = { t: 'fx', k: 'death', id: 8, c: 'Hound', x: 1300, y: 3300, a: .4, sx: 1340, sy: 3310, v: 'C', w: [1350, 3300, 1.571], lk: 'cap|stripes|#e6bb76|#556677|none', ek: 'headlamp', ec: '#aabbcc', ep: '#111111,#222222,#333333', vx: 40, vy: -10, ex: 1 };
    for (let f = 0; f < 700; f++) {
      if (f % 3 === 0) {
        st = +(st + .05).toFixed(3);
        const dead8 = f > 30;
        H.msg(snap(st, { p: [peer(8, 1300, 3300, { d: dead8 ? 1 : 0 }), peer(9, 1250, 3330, { f: f < 60 ? +(f / 60).toFixed(2) : -1, k: 'lantern', lp: '#ffaa66,#222222,#999999,#444444' }), peer(10, 1100, 3200, { l: 0, k: 'camcorder', ir: 2 }),
          peer(12, 1150, 3150, { k: 'torch', lp: '#ffaa66,#222222,#999999' })],
          e: { h: [hound(3, 1345, 3305, 1)], m: [smiler(4, 1600, 3400, 0), smiler(6, 2600, 3400, 0)] } }));
      }
      if (f === 30) H.msg(fxA);
      if (f === 31) H.msg(Object.assign({}, fxA, { v: 'A', w: 0, srv: 1 }));
      if (f === 60) H.msg({ t: 'fx', k: 'death', id: 9, c: 'Smiler', x: 1250, y: 3330, a: -1, sx: 1590, sy: 3400, v: 'B', w: 0, lk: 'none|plain|#e6bb76|#ffcc77|none', ek: 'lantern', ec: '#ffaa66', ep: '#ffaa66,#222222,#999999,#444444', vx: 0, vy: 0, ex: 0 });
      if (f === 90) H.msg({ t: 'fx', k: 'vanish', id: 10, x: 1100, y: 3200, a: 1, lk: 'none|plain|#e6bb76|#ffcc77|none', ek: 'camcorder', ec: '#202020', ep: '' });
      if (f === 95) H.msg({ t: 'fx', k: 'death', id: 7, c: 'Hound', x: 960, y: 3264, a: 0, sx: 1000, sy: 3264 });
      if (f === 400) H.msg({ t: 'bodies', v: 4, b: [body(8, 1302, 3301), body(20, 1500, 3300)] });
      frame(A, { run: true, started: true });
      if (f % 50 === 0) rec('fxstate', (window.__fxs || []).map(x => [x.id, x.k, !!x.gone, !!x.end]), [...window.__hideBodies], [...window.__fxKill], [...window.__fxKillS], (window.__peerLights || []).length);
    }
    await flush();
  };

  /* the facade the bundle calls: deathStart (with and without a wall), vanish, bodyMade (hands / trail / killer end, and without), respawn,
   * leave, testAuth (and its replay on reconnect), fx, exitLocal, peerScreen, tick (hound and smiler kills), join while offline */
  S.facade = async () => {
    rec('facade.noApi', typeof window.__net.deathStart({ kind: 'Hound', victim: { x: 1, y: 1, angle: 0 }, source: { x: 2, y: 2 } }), typeof window.__net.vanish({ x: 1, y: 1, a: 0 }));
    window.__net.join();
    const { A, S: St } = installApi({ started: true });
    H.advance(200);
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 });
    A.H.vx = 12.6; A.H.vy = -3.2; A.H.exhausted = false; A.H.stamina = 21.5;
    window.__net.deathStart({ kind: 'Hound', victim: { x: 961.4, y: 3264.6, angle: 1.23456 }, source: { x: 1000.2, y: 3270.7 }, variant: 'C', wall: { x: 1100.5, y: 3200.4, ang: .123456 } });
    A.H.stamina = 80; A.H.exhausted = true;
    window.__net.deathStart({ kind: 'Smiler', victim: { x: 961.5, y: 3264.4, angle: -2 }, source: { x: 900.5, y: 3200.5 } });
    window.__net.vanish({ x: 900.6, y: 3300.4, a: -.98765 });
    const corpse = o => Object.assign({ name: 'QA', x: 970.4, y: 3270.6, angle: 1.11111, scaleX: 1.0456, scaleY: .9512, cause: 'Hound', attackAngle: 2.2222,
      appearance: { hat: 'hardhat', texture: 'patched', hands: '#e6bb76', main: '#aa3322', backpack: 'utility' }, equipment: { kind: 'lantern', color: '#ffaa66', parts: { lantern: { cage: '#ff0000' } } },
      lo: 1, blood: [{ x: 970.2, y: 3270.9, seed: 12 }, { x: 975.5, y: 3268.5, seed: 777 }], dropped: { x: 990.4, y: 3260.6, angle: .3333 }, hat: { x: 960.5, y: 3266.5, angle: 1.5 },
      hands: [[1.5, 2.5], [3.5, 4.5]], trail: [[970, 3270], [972, 3271]], hatOn: 1 }, o);
    window.__net.bodyMade(corpse());
    window.__net.bodyMade(corpse({ cause: 'Smiler', hands: null, trail: undefined, lo: 0, hatOn: 0 }));
    St.death = { attacker: { x: NaN, y: 1, angle: 0 } }; window.__net.bodyMade(corpse({ cause: 'Hound' }));
    St.death = null; window.__net.bodyMade(corpse({ cause: 'Vanish', equipment: { kind: 'camcorder', color: '#202020', parts: {} } }));
    window.__net.respawn(); window.__net.leave(); window.__net.testAuth('h0-synthetic-admin');
    H.msg({ t: 'admin', ok: true, q: 1 });
    window.__net.fx({ t: 'fx', k: 'vanish', id: 12, x: 1000, y: 3300, a: .5, lk: 'cap|plain|#e6bb76|#ffcc77|none', ek: 'flashlight', ec: '#ffe7b2', ep: '' });
    let st = 40;
    for (let f = 0; f < 60; f++) {
      if (f % 3 === 0) { st = +(st + .05).toFixed(3); H.msg(snap(st, { p: [peer(8, 1100, 3300), peer(9, 800, 3100, { d: 1 })], e: { h: [hound(3, 1050, 3264, 0), hound(11, 900, 3000, 1)], m: [smiler(4, 1200, 3264, 0)] }, me: f > 30 ? 'Hound' : '', ms: f > 30 ? 1 : 0,
        mk: f > 30 ? { v: 'B', k: 'Hound', e: 11, ax: 900, ay: 3000, aa: 1, w: 0, x: 960, y: 3264, a: 0, why: 'x' } : undefined })); }
      if (f === 40) { St.paused = true; }
      if (f === 45) { window.__net.tick(); }
      frame(A, { run: true, started: true });
    }
    rec('peerScreen', window.__net.peerScreen());
    A.G.caught = false;
    H.msg(snap(+(st + .05).toFixed(3), { e: { h: [hound(3, 1050, 3264, 0)], m: [smiler(4, 1200, 3264, 0)] }, me: 'Smiler', ms: 2, mk: { v: 'A', k: 'Smiler', e: 4, ax: 1200, ay: 3264, aa: 0, w: 0, x: 960, y: 3264, a: 0, why: 'y' } }));
    window.__net.tick(); frame(A, { run: true, started: true });
    window.__net.exitLocal(); H.advance(1000); await flush();
    H.close(); H.advance(1100); H.open();
    await flush();
  };

  /* the admin panel: open, unlock (synthetic passcode), every tab and command button, the death lab, place, navigation, debug mode (ping),
   * copy report, broadcast, answers, close, dock; then a kick (no reconnect afterwards) */
  S.admin = async () => {
    const { A, S: St } = installApi({ started: true });
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 });
    const key = (code, k, target) => (target || window).dispatchEvent(new KeyboardEvent('keydown', { code, key: k, bubbles: true }));
    const click = sel => { const b = document.querySelector('#adminPanel ' + sel); rec('click', sel, !!b); if (b) b.click(); };
    const all = sel => [...document.querySelectorAll('#adminPanel ' + sel)];
    key('Backquote', '`'); H.advance(10); await flush();
    $('admPass').value = 'h0-wrong'; click('[data-a="unlock"]'); H.msg({ t: 'admin', ok: false, wait: 0 });
    $('admPass').value = 'h0-synthetic-admin'; click('[data-a="unlock"]'); H.msg({ t: 'admin', ok: false, wait: 60 });
    $('admPass').value = 'h0-synthetic-admin'; $('admPass').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); H.msg({ t: 'admin', ok: true, q: 0 });
    const ad = { fz: 0, sp: 1, bo: 'auto', hn: 3, sn: 2, mh: 64, ms: 64, dh: 3, gw: 3, it: 1, pk: 1, hs: 'ROAMING,HUNTING,ROAMING', dbg: 0, cm: 'auto',
      es: [[3, 0, 'ROAMING', 1200, 3300, 'n', 0], [5, 0, 'HUNTING', 2000, 2000, 'm', 1], [4, 1, 'WATCHING', 3000, 2500, 'f', 0]],
      pl: [{ id: 7, n: 'QA-ADMIN', a: 1, d: '', g: 0, ad: 1, st: 1, x: 960, y: 3264 }, { id: 8, n: 'PEER<8>', a: 1, d: 'Hound', g: 1, ad: 0, st: 4, x: 1300, y: 3300 }, { id: 9, n: 'MENU', a: 0, d: '', g: 0, ad: 0, st: 0, x: 0, y: 0 }] };
    let st = 70;
    const tickSnap = (o = {}) => { st = +(st + .05).toFixed(3); H.msg(snap(st, Object.assign({ e: { h: [hound(3, 1200, 3300, 0)], m: [smiler(4, 3000, 2500, 0)] }, ad, you: 7 }, o))); };
    tickSnap(); frame(A, { run: true, started: true });
    window.__ents.dbg = [{ i: 3, x: 1200, y: 3300 }, { i: 5, x: 2000, y: 2000 }, { i: 4, x: 3000, y: 2500 }];
    const tabs = ['players', 'monsters', 'deaths', 'world', 'debug'];
    for (const tb of tabs) {
      click(`[data-a="tab"][data-t="${tb}"]`); tickSnap(); frame(A, { run: true, started: true });
      const btns = all('button[data-c], button[data-a]').filter(b => !['tab', 'close', 'unlock', 'copy'].includes(b.dataset.a));
      rec('tab', tb, btns.length, fnv($('admBody').innerHTML));
      for (let i = 0; i < btns.length; i++) {
        const b = all('button[data-c], button[data-a]').filter(x => !['tab', 'close', 'unlock', 'copy'].includes(x.dataset.a))[i]; if (!b) break;
        rec('press', tb, i, b.textContent, b.dataset.c || '', b.dataset.a || ''); b.click();
        H.msg({ t: 'ares', ok: i % 4 !== 3, msg: (i % 4 !== 3 ? 'DONE ' : 'NO ') + (b.dataset.c || b.dataset.a) });
        H.advance(40); if (i % 5 === 0) { tickSnap(); frame(A, { run: true, started: true }); }
      }
    }
    click('[data-a="dbg"]'); H.advance(3100); tickSnap({ dbg: [{ i: 3, x: 1200, y: 3300, s: 'ROAMING' }], dx: { lg: [[1, 2, 'x']], pf: { ms: .5 } } });
    frame(A, { run: true, started: true });
    click('[data-a="copy"]'); await flush(); H.advance(100); await flush();
    click('[data-a="tab"][data-t="players"]');
    $('admText').value = '  a broadcast  '; click('[data-a="msg"]'); $('admText').value = 'enter key'; $('admText').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    click('[data-a="dock"]'); click('[data-a="dock"]');
    St.death = { attacker: { x: 1, y: 2, angle: 3 }, finished: false };
    click('[data-a="tab"][data-t="deaths"]'); click('button[data-c="preview"][data-k="hound"][data-var="B"]'); H.msg({ t: 'ares', ok: true, msg: 'PLAYING HOUND B' });
    for (let f = 0; f < 30; f++) { if (f === 5) A.G.caught = true; if (f === 10) St.death.finished = true; if (f === 20) A.G.caught = false; if (f === 25) St.fall = -1; frame(A, { run: true, started: true }); H.advance(100); }
    click('[data-a="replay"]'); H.msg({ t: 'ares', ok: false, msg: 'NO FREE HOUND' });
    $('admPass') && $('adminPanel').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    key('Backquote', '`'); key('Backquote', '`');
    H.advance(7000);
    H.msg({ t: 'msg', text: 'from admin', from: '' });
    H.msg({ t: 'kick' }); H.close(); H.advance(10000);
    await flush();
  };

  /* never connected (SOLO), back-off, a connection that drops (cleanup, RECONNECTING), reconnect into a running game (join, admin passcode
   * kept in memory and the test passcode replayed), the offline glitched walls and cartograph, the offline exit */
  S.reconnect_solo = async () => {
    const { A } = installApi({ started: true });
    for (let k = 0; k < 3; k++) { H.close(); H.advance(1000 * (k + 1) + 50); }
    for (let k = 0; k < 12; k++) { window.__net.join(); for (let f = 0; f < 3; f++) frame(A, { run: true, started: true }); rec('solo.set', k, window.__glitches); }
    for (let f = 0; f < 30; f++) frame(A, { run: true, started: true });
    const g = (window.__glitches || [])[0], it = (window.__items || [])[0];
    rec('solo', window.__glitches, window.__items);
    if (it) { A.H.x = it[0]; A.H.y = it[1]; frame(A, { run: true, started: true }); frame(A, { run: true, started: true }); A.H.x = 960; A.H.y = 3264; }
    if (g) { A.H.x = g[0]; A.H.y = g[1]; frame(A, { run: true, started: true }); }
    H.advance(1000); frame(A, { run: true, started: true });
    window.__net.testAuth('h0-synthetic-admin');
    H.open(); H.msg({ t: 'hi', id: 3, sim: 1 }); H.msg({ t: 'admin', ok: true, q: 1 });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote', key: '`', bubbles: true }));
    $('admPass').value = 'h0-synthetic-admin'; document.querySelector('#adminPanel [data-a="unlock"]').click(); H.msg({ t: 'admin', ok: true, q: 0 });
    let st = 9;
    for (let f = 0; f < 30; f++) { if (f % 3 === 0) { st = +(st + .05).toFixed(3); H.msg(snap(st, { p: [peer(4, 1000, 3300)], e: { h: [hound(1, 3000, 3000, 0)], m: [smiler(2, 2000, 2000, 0)], gw: [[1, 2, 1, 0]], it: [[3, 4, 'cartograph']] } })); } frame(A, { run: true, started: true }); }
    window.__mv.down = 'down'; window.__mv.dragTo = [1, 2];
    H.close(); frame(A, { run: true, started: true });
    H.advance(1050); H.open(); H.msg({ t: 'hi', id: 5, sim: 1 });
    for (let f = 0; f < 10; f++) frame(A, { run: true, started: true });
    await flush();
  };

  /* the fluorescent hum (on the game's audio context): ordinary, near a flickering fixture, ballast dips, blackout drop-out and strike-back,
   * a user-supplied hum; the dread layer: drone, heartbeat, shake, flicker, sting (sound file or noise), the capture burst */
  S.hum_dread = async () => {
    const { A } = installApi({ started: true, audio: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }));
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 });
    for (let f = 0; f < 600; f++) {
      if (f === 100) { A.H.x = 192 + 20; A.H.y = 192 + 30; }                      // lamp 0: a flickering fixture
      if (f === 200) A.V.blackout = true;
      if (f === 260) A.V.blackout = false;
      if (f === 300) { window.__sfx._has.hum = true; window.__sfx._has.blackout = true; }
      if (f === 330) A.V.blackout = true;
      if (f === 360) { A.V.blackout = false; window.__sfx._has = {}; }
      if (f === 400) { A.G.x = A.H.x + 150; A.G.y = A.H.y; A.q[0].x = A.H.x - 300; A.q[0].y = A.H.y; }
      if (f === 450) window.__sfx._has.sting = true;
      if (f === 500) { document.body.classList.add('captured'); await flush(); }
      if (f === 520) { document.body.classList.remove('captured'); $('sound').textContent = 'SOUND: OFF'; await flush(); }
      if (f === 560) $('sound').textContent = 'SOUND: ON';
      frame(A, { run: f >= 380, started: true });
    }
    await flush();
  };

  /* run one scene, then the page state; the trace back to the harness */
  window.__RUN = async name => {
    rec('scene', name);
    try { await S[name](); } catch (e) { rec('scene.throw', String(e && e.message), String(e && e.stack).split('\n').slice(0, 3).join(' | ')); }
    rec('end', pageState(), H.errs);
    return JSON.stringify(window.__T);
  };
})();
