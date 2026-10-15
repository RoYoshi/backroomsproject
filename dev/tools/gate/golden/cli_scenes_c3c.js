/* Stage 3H continuation C3c (M-024) - client golden scenes for what Stage 3H0's and 3H2's scenes leave unrun in mp.js (development only;
 * loaded by cli_lib_c3c.js's harness page after Stage 3H0's cli_scenes.js, whose runner window.__RUN and page record it uses, and after
 * Stage 3H2's scenes; never by the game).
 *
 * C3c turns mp.js's parts into modules, and the code that moves most is the code these scenes drive:
 *   c3c_poses       B++'s fresher poses ('caps', every kind of 'q': applied, a jump, stale, another world, unknown, dead, malformed), the
 *                   solid peers (held by an entity, dead, while we are dying, held, out of a run, after our exit and once we join again),
 *                   the soft correction ('tp' with pc: blended by the fixed-step tick, a jump beyond 600 px, a plain tp stopping a
 *                   blend), window.__peerNet, __epochDebug
 *   c3c_epoch       the world epoch: replays and dying lights of world 5, our own death in it, an admin reset ('world': A.worldEnd, the
 *                   old world's replays, lights, wall stains, kill and held state gone), late messages naming world 5 (dropped), the
 *                   same world again, a lone player's new run (the first snapshot of world 7), NEW RUN approved (not solid) and the next run
 *   c3c_deathlight  G.I.B.'s light timeline (Stage 3D HQ1): replays with the physics' release, corpse records with the server's light
 *                   profile, our own death from the server's kill record (window.__dvic) and its corpse, the anchors on the server's clock,
 *                   a NEW RUN blast's gibs (gibFrame, gore.js's gibs), the wall stains, a frozen clock, the fallbacks when dphys.js lacks
 *                   releaseOf or lightPower, 70 deaths and 70 corpses at once (the timeline keeps the newest 64), window.__deathLight
 *   c3c_misc        a lamp's failure sound (ents' onFail), the hum's offline check (__net.testHum), the cartograph picked up offline, a
 *                   message that is not JSON, a second hello, UNLIMITED NEW RUN's answers, pongs, an answer to a command, more entities
 *                   than the page has slots for, the admin panel (an empty passcode not sent, a place found near glitched walls, COPY
 *                   REPORT when the clipboard refuses and with none, a refused NEW RUN in the deaths tab), a Smiler's kill and a kill by
 *                   a Hound the page does not mirror, the exit twice, and a WebSocket that cannot be made (no retry after it)
 *   c3c_mode_a/_b   the same peers under ?peers=a (Stage 3D HQ5's drawing) and ?peers=b (B without the fresher poses): jumps, easing
 * Every input is the scene's own number (never Math.random, which belongs to mp.js), so B++'s mp.js and this tree's receive exactly the
 * same inputs at the same fake times.  The scenes add a richer game where they need one: a death's physics (jl.ph, its torch, its wall
 * marks), dphys.js's and gore.js's functions (window.__dphys, window.__gore), A.worldEnd, our own corpse records, ents' death and blast
 * voices - each a small recorder, the same on both sides.  The installApi, frame and snapshot helpers are copies of cli_scenes.js's
 * (that file keeps them to itself), with those additions. */
(() => {
  'use strict';
  const H = window.__H, rec = window.__rec, watch = H.watch, gfx = H.gfx, S = window.__SC;
  if (!S) throw new Error('cli_scenes_c3c.js needs Stage 3H0 cli_scenes.js loaded first');
  const $ = id => document.getElementById(id);
  const DT = 1000 / 60;
  const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
  const r4 = v => typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : v;

  /* ---------- the game API, as the bundle installs it (cli_scenes.js's, with a death's physics, A.worldEnd and our own corpses) ---------- */
  const DEFS = { flashlight: [['body'], ['lens'], ['ring']], headlamp: [['strap'], ['lamp'], ['band']], lantern: [['cage'], ['glass'], ['handle'], ['base']], camcorder: [['body'], ['grip'], ['lens']] };
  const DEF = { flashlight: { body: '#ffe7b2', lens: '#333333', ring: '#888888' }, headlamp: { strap: '#222222', lamp: '#ffeecc', band: '#555555' },
    lantern: { cage: '#ffaa66', glass: '#222222', handle: '#999999', base: '#444444' }, camcorder: { body: '#202020', grip: '#303030', lens: '#404040' } };
  let objN = 0, gibN = 0;
  /* what gore.js draws a NEW RUN's gibs into: the replay makes one with its foreground's constructor */
  class Gib { constructor() { const id = 'gib' + (++gibN); return gfx(id, { clear: () => rec('gib.clear', id) }); } }
  function installApi({ started = false, audio = false, phys = false, worldEnd = false } = {}) {
    const S = { started, paused: false, fall: -1, death: { attacker: { x: 1010.4, y: 3270.6, angle: .7 }, finished: false }, bodies: [], local: [] };
    const Hp = watch({ x: 960, y: 3264, vx: 0, vy: 0, angle: .25, id: null, stamina: 100, exhausted: false, sprinting: false,
      equipment: { kind: 'flashlight', color: '#ffe7b2', parts: { flashlight: { body: '#ffd090', lens: '#333333', ring: '#888888' } } } }, 'H');
    const G = watch({ x: -9e4, y: -9e4, angle: 0, state: 'patrol', distance: 0, caught: false, caughtBy: '', grace: 0, pressure: 0 }, 'G');
    const q = Array.from({ length: 64 }, (_, i) => watch({ x: -9e4, y: -9e4, angle: 0, distance: 0, off: true, state: 'lurk', ls: 'lurk', face: 0, side: 0 }, 'q' + i));
    const V = watch({ blackout: false }, 'V');
    const layer = H.container('layer'), floor = H.container('floor');
    const avatar = (id, gear) => gfx(id, { gear: watch({ visible: true }, id + '.gear'), beam: id.endsWith('3') ? { x: 1, y: 2, angle: .5 } : null,
      update: (now, light, x, src) => rec('av.update', id, now, light, x, src), deathPose: (...a) => rec('av.deathPose', id, ...a) });
    class Jl {
      constructor() { this.__rid = 'jl' + (++objN); rec('api.Jl.new', this.__rid); this.blood = gfx(this.__rid + '.blood'); this.foreground = gfx(this.__rid + '.fg', phys ? { constructor: Gib } : undefined); this.debris = gfx(this.__rid + '.debris');
        this.body = { x: 0, y: 0, angle: 0, scaleX: 1, scaleY: 1, alpha: 1 }; this.attacker = { x: 0, y: 0, angle: 0 }; this.injury = 0; this.impact = 0; this.elapsed = 0; this.grip = 0; this.variant = 'A'; }
      start(k, now, src, slot, victim, opt) {
        rec('jl.start', this.__rid, k, now, src, slot, victim, opt); this.t0 = now; this.body.x = victim.x; this.body.y = victim.y; this.attacker.x = src.x; this.attacker.y = src.y; this.variant = (opt && opt.v) || 'A';
        if (!phys) return;
        /* a death's physics, as dphys.js keeps it: the seed, the hits, the pieces of a blast, both hands, when the light is let go, the wall marks */
        const kind = victim.equipment && victim.equipment.kind, n = (opt && opt.s) || 3;
        this.ph = { __n: this.__rid, ctx: { seed: n, hits: [[victim.x + 4, victim.y - 2]], eqKind: kind }, state: 'ACTIVE', stepN: 0, eqAt: kind === 'headlamp' ? -1 : .4,
          gib: k === 'Boom' ? Array.from({ length: 6 }, (_, i) => ({ x: victim.x + i * 6, y: victim.y - i * 3, rot: i * .5, z: i % 3 })) : null,
          h: [{ x: victim.x - 8, y: victim.y + 2, rot: .1, z: 1 }, { x: victim.x + 8, y: victim.y + 2, rot: -.1, z: 0 }],
          marks: k === 'Hound' ? [{ x: victim.x + 30, y: victim.y - 20, nx: 0, ny: 1 }, { x: victim.x + 31, y: victim.y - 20, nx: .6, ny: .8 }] : [] };
        this.torch = { x: victim.x + 10, y: victim.y - 5, angle: victim.angle || 0 };
      }
      frame(now) {
        const e = now - this.t0; this.elapsed = e; this.body.angle = e * .3; this.body.scaleX = 1 + e * .01; this.body.alpha = Math.max(0, 1 - e / 10); this.injury = Math.min(1, e / 2); this.impact = e < .5 ? 1 : 0; this.grip = e < 1 ? 1 : 0; this.attacker.angle = e;
        if (this.ph) { this.ph.stepN++; if (e > 1.2) this.ph.state = 'SLEEPING'; this.torch.x = +(this.torch.x + .5).toFixed(2); }
        return e > 2.5;
      }
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
      bodies: list => { rec('api.bodies', list); S.bodies = list; }, bodyList: () => S.bodies.concat(S.local),
      death: () => S.death, fall: () => S.fall, layer: () => layer, floor: () => floor,
      mkAvatar: (look, gear) => { const id = 'av' + (++objN); rec('api.mkAvatar', id, look, gear); return avatar(id, gear); },
      Jl, Gl, Wl,
      zc: (tx, ty) => ((tx * 7 + ty * 3) % 5) !== 0, Hc: (nx, ny) => ((nx + ny * 2) % 4) === 0,
      sl: (x, y, r) => ((((x / 96) | 0) * 3 + ((y / 96) | 0)) % 4) !== 0, Uc: (x, y, a, max) => Math.min(max, 40 + (Math.abs(Math.round(x * .37 + y * .11 + a * 97)) % 260)),
      lamps: Array.from({ length: 40 }, (_, i) => ({ x: 192 + (i % 8) * 384, y: 192 + ((i / 8) | 0) * 384 })),
      audio: () => ctx ? { context: ctx, gain, muted: false } : null,
    };
    if (worldEnd) A.worldEnd = (x, y) => { rec('api.worldEnd', x, y); G.caught = false; Hp.x = x; Hp.y = y; };   // the bundle ends our death where the server put us
    if (phys) {
      /* dphys.js and gore.js, as far as mp.js uses them: each a recorder with a simple, deterministic answer */
      window.__dphys = { LEN: { flashlight: 14, lantern: 9, headlamp: 4 },
        gibShapes: seed => { rec('dphys.gibShapes', seed); return Array.from({ length: 6 }, (_, i) => ({ poly: [[i, 0], [0, i + 1], [i + 1, i]], core: i % 2 })); },
        marks: ph => ph.marks || [], releaseOf: ph => ph.eqAt >= 0 ? ph.eqAt : 0,
        lightPower: (lf, t) => !lf ? 1 : t < lf[0] ? 1 : t < lf[0] + lf[1] ? 1 - (t - lf[0]) / lf[1] : 0 };
      window.__gore = { gibs: (g, pieces, hands, look, o) => rec('gore.gibs', g && g.__rid, pieces, hands, look, o),
        wallStains: { sync: want => rec('gore.wallStains.sync', want.map(w => [w.de, r4(w.x), r4(w.y), r4(w.nx), r4(w.ny)])), clear: () => rec('gore.wallStains.clear') } };
    }
    window.__api = A;
    rec('api.installed', { started, audio, phys, worldEnd });
    return { A, S };
  }
  const LOS = (x, y, a, d) => (Math.abs(Math.round(a * 100)) % 3 === 0 ? d * .5 : d);
  let lastDigest = '';
  function dom() {
    const t = $('peerTip'), n = $('onlineNote'); rec('dom', $('dread').style.opacity, $('game').style.transform, $('light').style.opacity, $('net').textContent, t.style.display, t.textContent, t.style.left, t.style.top, n ? n.hidden : '~none', document.body.className);
    const w = window, d = JSON.stringify({ on: w.__net && w.__net.on, kill: w.__kill, killer: w.__killer, gl: w.__glitches, it: w.__items, gs: w.__glitchSolo, is: w.__itemSolo, pl: w.__peerLights,
      hb: w.__hideBodies && [...w.__hideBodies], fk: w.__fxKill && [...w.__fxKill], fs: w.__fxKillS && [...w.__fxKillS], fx: (w.__fxs || []).length, hs: (w.__hounds || []).map((o, i) => o ? [i, o.id] : 0).filter(Boolean),
      dl: w.__dlab || null, mv: w.__mv && [w.__mv.down, w.__mv.dragTo], ad: $('adminPanel') && [$('adminPanel').hidden, $('adminPanel').className], km: $('kicked') && $('kicked').hidden, am: $('adminMsg') && [$('adminMsg').hidden, $('adminMsg').textContent],
      pb: w.__peerBodies });
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
  const LK = 'cap|plain|#e6bb76|#556677|none';
  const peerNet = tag => rec('c3c.peerNet', tag, window.__peerNet());
  const solid = tag => rec('c3c.solid', tag, window.__peerBodies.map(b => b.slice()));
  const epoch = tag => rec('c3c.epoch', tag, window.__epochDebug(), window.__nrDebug(), window.__deathLight.debug().own, (window.__fxs || []).map(f => [f.id, f.k, f.de === undefined ? '~u' : f.de, !!f.gone]),
    (window.__peerLights || []).map(l => [l.kind, r4(l.x), r4(l.y), l.pw === undefined ? '~u' : r4(l.pw)]));
  const light = tag => rec('c3c.light', tag, window.__deathLight.debug(), (window.__peerLights || []).map(l => [l.kind, r4(l.x), r4(l.y), l.pw === undefined ? '~u' : r4(l.pw)]));

  /* B++'s fresher poses, the solid peers, the soft correction */
  S.c3c_poses = async () => {
    const { A, S: St } = installApi({ started: true });
    peerNet('before the connection');
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 }); window.__net.join();
    H.msg({ t: 'caps', fp: 1 }); peerNet('the server takes fresher poses');
    let st = 100, k = 1000;
    const peersAt = f => [peer(8, 1200 + f * 2, 3300), peer(9, 1500, 3400, { d: f > 60 ? 1 : 0 }), peer(10, 1100 + f, 3250), peer(11, 900, 3100)];
    for (let f = 0; f < 150; f++) {
      if (f % 3 === 0) {
        st = +(st + .05).toFixed(3); k += 3;
        const held = f >= 30 && f < 45 ? 10 : 0, me = f >= 90 && f < 96 ? 'Hound' : '', cp = f >= 105 && f < 111 ? { ph: 'down', e: 3, k: 'Hound', d: 0 } : 0;
        H.msg(Object.assign(snap(st, { p: peersAt(f), e: { h: [hound(3, 2000, 3000, 0, 1, { cp: held })], m: [smiler(4, 2500, 2500, 0, 0, { cp: f >= 45 && f < 50 ? 11 : 0 })] }, me, ms: me ? 1 : 0, cp }), { w: 3, k }));
      }
      if (f % 3 === 1) {                                                                   // a fresher pose of each player, between two snapshots
        const qs = [[8, 1203 + f * 2, 3301, .6], [9, 1500, 3401, .1], [10, 1101 + f, 3251, .2], [99, 1, 1, 1], [11, NaN, 1, 1], 'bad', [8]];
        if (f === 40) qs[0] = [8, 1600, 3500, 1.1];                                           // more than PEER_SNAP away: shown at once
        H.msg({ t: 'q', w: 3, k: k + 1, p: qs });
        if (f === 52) H.msg({ t: 'q', w: 3, k: k + 1, p: qs });                             // the same tick again: stale
        if (f === 55) H.msg({ t: 'q', w: 2, k: k + 2, p: qs });                             // another world: stale
        if (f === 58) H.msg({ t: 'q', k: k + 2, p: qs });                                   // no world: stale
        if (f === 61) H.msg({ t: 'q', w: 3, k: k + 2, p: 'x' });                             // not a list: stale
      }
      if (f === 70) St.started = false;                                                      // out of a run: not solid
      if (f === 75) St.started = true;
      if (f === 80) A.G.caught = true;                                                       // dying: not solid
      if (f === 85) A.G.caught = false;
      frame(A, { run: true, started: true });
      if (f % 10 === 0) solid('frame ' + f);
    }
    peerNet('after 150 frames');
    /* the soft correction: within 600 px blended over 120 ms by the fixed-step tick (the velocity into the body dropped); further, a jump;
     * a plain tp stops a blend */
    const step = tag => { H.advance(DT); window.__net.tick(); rec('c3c.H', tag, r4(A.H.x), r4(A.H.y), r4(A.H.vx), r4(A.H.vy)); };
    A.H.vx = -50; A.H.vy = 20;
    H.msg({ t: 'tp', x: A.H.x + 40, y: A.H.y - 30, pc: 1 });
    for (let i = 0; i < 10; i++) step('blend ' + i);
    A.H.vx = 30; A.H.vy = -60;
    H.msg({ t: 'tp', x: A.H.x - 50, y: A.H.y + 20, pc: 1 }); step('second blend');
    H.msg({ t: 'tp', x: A.H.x + 10, y: A.H.y }); step('a plain tp stops it');
    H.msg({ t: 'tp', x: A.H.x + 700, y: A.H.y, pc: 1 }); step('700 px: a jump');
    H.msg({ t: 'tp', x: A.H.x + 5, y: A.H.y + 5, pc: 1 }); step('blend again');
    rec('c3c.epochDebug', window.__epochDebug());
    const again = tag => { st = +(st + .05).toFixed(3); k += 3; H.msg(Object.assign(snap(st, { p: peersAt(150) }), { w: 3, k })); solid(tag); };
    H.msg({ t: 'exit', secs: 30 }); again('out through a glitched wall: not solid');
    H.advance(1000); window.__net.join(); again('joined again: solid');
    H.close(); peerNet('closed'); solid('closed'); step('closed');
    await flush();
  };

  /* the world epoch */
  S.c3c_epoch = async () => {
    const { A } = installApi({ started: true, worldEnd: true, phys: true });
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 }); window.__net.join();
    let st = 200;
    const tick = (w, o = {}) => { st = +(st + .05).toFixed(3); H.msg(Object.assign(snap(st, Object.assign({ p: [peer(8, 1300, 3300), peer(9, 1250, 3330)], e: { h: [hound(3, 1345, 3305, 1)], m: [smiler(4, 1600, 3400, 0)] } }, o)), w === undefined ? {} : { w })); };
    tick(5); epoch('the first world: 5');
    H.msg({ t: 'fx', k: 'death', id: 8, de: 101, c: 'Hound', x: 1300, y: 3300, a: .4, sx: 1340, sy: 3310, v: 'A', w: 0, lk: LK, ek: 'flashlight', ec: '#ffe7b2', ep: '#ffe7b2,#333333,#888888', lf: [3, 1.5, 7, .4], lo: 1, el: 0 });
    H.msg({ t: 'fx', k: 'boom', id: 9, de: 102, x: 1250, y: 3330, a: 1, s: 4242, d: .7, lk: 'none|plain|#e6bb76|#ffcc77|none', ek: 'lantern', ec: '#ffaa66', ep: '#ffaa66,#222222,#999999,#444444', lo: 1, el: 0 });
    for (let f = 0; f < 30; f++) { if (f % 3 === 0) tick(5); frame(A, { run: true, started: true }); }
    epoch('two replays playing in world 5');
    tick(5, { me: 'Hound', ms: 1, mk: { v: 'A', k: 'Hound', e: 3, ax: 1340, ay: 3300, aa: 2, w: 0, x: 960, y: 3264, a: .25, de: 103, lf: [2, 1, 3, .3], why: 'epoch' } });
    window.__net.tick(); rec('c3c.dvic', window.__dvic(window.__kill)); frame(A, { run: false, started: true }); epoch('our own death in world 5');
    window.__mv.down = 'down'; window.__mv.dragTo = [1, 2];
    H.msg({ t: 'world', w: 6, x: 1500, y: 3500 }); epoch('an admin reset: world 6');
    frame(A, { run: true, started: true }); epoch('world 6, a frame later');
    H.msg({ t: 'bodies', v: 9, w: 5, b: [body(8, 1302, 3301)] });
    H.msg({ t: 'fx', k: 'death', id: 9, de: 104, wn: 5, c: 'Smiler', x: 1250, y: 3330, a: -1, sx: 1590, sy: 3400, v: 'B', w: 0, lk: LK, ek: 'lantern', ec: '#ffaa66', ep: '' });
    H.msg({ t: 'fx', k: 'boom', id: 8, de: 105, wn: 5, x: 1, y: 1, a: 0, s: 1, d: 0 });
    tick(5, { me: 'Smiler', ms: 2, mk: { v: 'B', k: 'Smiler', e: 4, ax: 1, ay: 1, aa: 0, w: 0, x: 960, y: 3264, a: 0, de: 106, why: 'late' } });
    frame(A, { run: true, started: true }); epoch('late messages naming world 5');
    H.msg({ t: 'world', w: 6 }); H.msg({ t: 'world' }); epoch('world 6 again, and no world');
    H.msg({ t: 'fx', k: 'death', id: 9, de: 107, wn: 6, c: 'Hound', x: 1250, y: 3330, a: -1, sx: 1290, sy: 3330, v: 'A', w: 0, lk: LK, ek: 'flashlight', ec: '#ffe7b2', ep: '' });
    for (let f = 0; f < 6; f++) { if (f % 3 === 0) tick(6); frame(A, { run: true, started: true }); }
    epoch('a death in world 6');
    A.G.caught = true;
    tick(7); epoch('a lone player\'s new run: the first snapshot of world 7');
    window.__net.nr(m => rec('c3c.nr.ok', m)); H.msg({ t: 'nra', q: window.__nrDebug().q, ok: 1, de: 12, w: 7 });
    for (let f = 0; f < 6; f++) { if (f % 3 === 0) tick(7); frame(A, { run: true, started: true }); }
    solid('NEW RUN approved'); epoch('NEW RUN approved');
    window.__net.join(); tick(7); solid('the next run');
    H.close(); epoch('closed');
    await flush();
  };

  /* G.I.B.'s light timeline, wall stains and gibs */
  S.c3c_deathlight = async () => {
    const { A, S: St } = installApi({ started: true, phys: true });
    window.__ents.deathVoice = (...a) => rec('ents.deathVoice', ...a); window.__ents.boomVoice = (...a) => rec('ents.boomVoice', ...a);
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 }); window.__net.join();
    let st = 300;
    const tick = (o = {}) => { st = +(st + .05).toFixed(3); H.msg(Object.assign(snap(st, Object.assign({ p: [peer(8, 1300, 3300, { d: 1 }), peer(9, 1250, 3330)], e: { h: [hound(3, 1345, 3305, 1)], m: [smiler(4, 1600, 3400, 0)] } }, o)), { w: 2 })); };
    tick(); tick();
    H.msg({ t: 'fx', k: 'death', id: 8, de: 201, c: 'Hound', x: 1300, y: 3300, a: .4, sx: 1340, sy: 3310, v: 'C', w: [1350, 3300, 1.571], lk: LK, ek: 'flashlight', ec: '#ffe7b2', ep: '#ffe7b2,#333333,#888888', lf: [3, 1.5, 7, .4], lo: 1, el: .1 });
    H.msg({ t: 'fx', k: 'death', id: 9, de: 202, c: 'Smiler', x: 1250, y: 3330, a: -1, sx: 1590, sy: 3400, v: 'B', w: 0, lk: LK, ek: 'headlamp', ec: '#aabbcc', ep: '', lf: [2, 1, 3, .2], el: 2 });
    H.msg({ t: 'bodies', v: 3, w: 2, b: [body(12, 1400, 3300, { de: 203, ag: 4, lf: [5, 2, 9, .5], bl: [[1400, 3300, 520], [1401, 3302, 12]] }), body(13, 1450, 3320, { de: 201, ag: .5, lf: [3, 1.5, 7, .4] }),
      body(14, 1500, 3340, { ag: 1, lf: [1, 2, 3] }), body(15, 1550, 3360, { de: 208, c: 'Vanish' }), body(16, 1600, 3380, { de: 209, eq: { kind: 'camcorder', color: '#202020', parts: '' } })] });
    H.msg({ t: 'fx', k: 'boom', id: 7, de: 204, x: 960, y: 3264, a: .25, s: 99, d: 1.2, lk: LK, ek: 'lantern', ec: '#ffaa66', ep: '#ffaa66,#222222,#999999,#444444', lo: 1, el: 0 });
    tick(); light('two replays, corpses, our own blast');
    for (let f = 0; f < 120; f++) { if (f % 3 === 0) tick(); frame(A, { run: true, started: true }); if (f % 30 === 0) light('frame ' + f); }
    tick({ me: 'Hound', ms: 1, mk: { v: 'A', k: 'Hound', e: 3, ax: 1340, ay: 3300, aa: 2, w: 0, x: 961.5, y: 3264.5, a: .3, vx: 12, vy: -4, ex: 1, de: 205, lf: [2, 1, 3, .3], why: 'light' } });
    window.__net.tick();
    rec('c3c.dvic', window.__dvic(window.__kill));
    St.death = { attacker: { x: 1340, y: 3300, angle: 2 }, finished: false, active: true, corpseId: 'L1',
      ph: { __n: 'own', ctx: { seed: 5, hits: [], eqKind: 'flashlight' }, eqAt: .5, marks: [{ x: 970, y: 3250, nx: 0, ny: 1 }] } };
    St.local = [{ id: 'L1', ownerId: 'r7', cause: 'Hound', lo: 1, equipment: { kind: 'flashlight', color: '#ffe7b2' }, dropped: { x: 980, y: 3260, angle: .5 }, hands: [[1, 2], [3, 4]], createdAt: H.now / 1000,
      blood: [{ x: 975, y: 3255, seed: 520 }, { x: 976, y: 3256, seed: 12 }] }];
    for (let f = 0; f < 60; f++) { if (f % 3 === 0) tick({ me: 'Hound', ms: 1 }); frame(A, { run: false, started: true }); if (f % 20 === 0) light('our own death ' + f); }
    rec('c3c.own', window.__deathLight.own());
    St.death.active = false;
    St.local.push({ id: 'L2', ownerId: 'r7', cause: 'Smiler', lo: 1, equipment: { kind: 'lantern', color: '#ffaa66' }, dropped: { x: 990, y: 3270, angle: 1 }, blood: [{ x: 990, y: 3271, seed: 530 }] });
    for (let f = 0; f < 30; f++) { if (f % 3 === 0) tick({ me: 'Hound', ms: 1 }); frame(A, { run: false, started: true }); }
    light('our corpses after the death');
    rec('c3c.dvic', window.__dvic({ de: 206, x: 1, y: 2, a: 0 })); St.death.active = true; frame(A, { run: false, started: true }); light('a server record without a light profile');
    rec('c3c.dvic', window.__dvic(null)); frame(A, { run: false, started: true }); light('an offline death');
    rec('c3c.dvic', window.__dvic({ de: 207, x: NaN, y: 2 }));
    window.__deathLightNow = () => 777.5; frame(A, { run: false, started: true }); light('a frozen clock');
    delete window.__deathLightNow;
    const D = window.__dphys, rel = D.releaseOf, lp = D.lightPower;
    delete D.releaseOf; St.death.ph.ctx.eqKind = 'headlamp'; frame(A, { run: false, started: true }); light('no releaseOf: a headlamp');
    St.death.ph.ctx.eqKind = 'lantern'; frame(A, { run: false, started: true }); light('no releaseOf: eqAt');
    St.death.ph.eqAt = -1; frame(A, { run: false, started: true }); light('no releaseOf: not let go yet');
    delete D.lightPower; frame(A, { run: false, started: true }); light('no lightPower');
    D.releaseOf = rel; D.lightPower = lp; St.death.active = false;
    const Jl = A.Jl; delete A.Jl;                                                          // (no replay is made: only the timeline notes them)
    for (let i = 0; i < 70; i++) H.msg({ t: 'fx', k: 'death', id: 20 + i, de: 300 + i, c: 'Hound', x: 1, y: 1, a: 0, sx: 2, sy: 2, el: i % 3 });
    A.Jl = Jl; tick(); light('70 deaths at once');
    H.msg({ t: 'bodies', v: 4, w: 2, b: Array.from({ length: 70 }, (_, i) => body(100 + i, 2000 + i, 3000, { de: 400 + i, ag: 1 + i / 10, lf: [3, 1, i, .5] })) });
    tick(); frame(A, { run: true, started: true }); light('70 corpses at once');
    await flush();
  };

  /* the rest: lamps, the hum's check, offline pickup, odd messages, slots, kills, exits, a socket that cannot be made */
  S.c3c_misc = async () => {
    const { A } = installApi({ started: true, audio: true });
    rec('c3c.onFail', typeof window.__ents.onFail); window.__ents.onFail({ x: 10, y: 20 });
    rec('c3c.testHum', await window.__net.testHum([60, 120.42]));
    for (let f = 0; f < 3; f++) frame(A, { run: true, started: true });
    const it = (window.__items || [])[0]; rec('c3c.items', window.__items, window.__itemSolo);
    if (it) { A.H.x = it[0]; A.H.y = it[1]; frame(A, { run: true, started: true }); rec('c3c.items', window.__items); A.H.x = 960; A.H.y = 3264; frame(A, { run: true, started: true }); }
    H.open(); H.msg('{not json'); H.msg({ t: 'hi', id: 7, sim: 1 }); window.__net.join(); H.msg({ t: 'hi', id: 8, sim: 1 });
    H.msg({ t: 'nrf', on: 1 }); H.msg({ t: 'nrf', on: 0 });
    H.msg({ t: 'pong', ts: H.now - 40 }); H.msg({ t: 'pong', ts: H.now - 60 }); H.msg({ t: 'pong' });
    H.msg({ t: 'ares', ok: 0, msg: 'NO' }); H.msg({ t: 'ares', ok: 1 });
    let st = 50;
    const many = { h: Array.from({ length: 66 }, (_, i) => hound(1000 + i, 1000 + i * 10, 3000, 0)), m: Array.from({ length: 66 }, (_, i) => smiler(2000 + i, 1000 + i * 10, 2500, 0)) };
    const tick = (o = {}) => { st = +(st + .05).toFixed(3); H.msg(snap(st, Object.assign({ e: many }, o))); };
    tick(); frame(A, { run: true, started: true }); rec('c3c.slots', window.__hounds.filter(Boolean).length, A.q.filter(s => !s.off).length);
    /* the admin panel: an empty passcode is not sent; a place found near glitched walls; COPY REPORT when the clipboard refuses, and with
     * no clipboard at all (the page's own textarea fallback) */
    const click = sel => { const b = document.querySelector('#adminPanel ' + sel); rec('c3c.click', sel, !!b); if (b) b.click(); };
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote', key: '`', bubbles: true }));
    $('admPass').value = ''; click('[data-a="unlock"]');
    $('admPass').value = 'h0-synthetic-admin'; click('[data-a="unlock"]'); H.msg({ t: 'admin', ok: true, q: 0 });
    const ad = { fz: 0, sp: 1, bo: 'auto', hn: 1, sn: 1, mh: 64, ms: 64, dh: 3, gw: 2, it: 1, pk: 0, dbg: 0, cm: 'auto', es: [[1000, 0, 'ROAMING', 1000, 3000, 'n', 0]],
      pl: [{ id: 8, n: 'QA', a: 1, d: '', g: 0, ad: 1, st: 1, x: 960, y: 3264 }] };
    tick({ ad, you: 8, e: Object.assign({}, many, { gw: [[1100, 3300, 1, 0], [900, 3200, 0, 1]] }) }); frame(A, { run: true, started: true });
    click('[data-a="tab"][data-t="debug"]'); click('[data-a="place"][data-w="door"]'); rec('c3c.admin', $('admStatus').textContent, r4(A.H.x), r4(A.H.y));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { rec('c3c.clipboard.refused', t.length); return Promise.reject(new Error('blocked')); } } });
    click('[data-a="copy"]'); await flush(); await flush(); rec('c3c.admin', $('admStatus').textContent);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    click('[data-a="copy"]'); await flush(); await flush(); rec('c3c.admin', $('admStatus').textContent);
    window.__net.nr(m => rec('c3c.nr.ok', m)); H.msg({ t: 'nra', q: window.__nrDebug().q, ok: 0, why: 'held' });
    click('[data-a="tab"][data-t="deaths"]'); tick({ ad, you: 8 }); rec('c3c.admin.deaths', ($('admBody').textContent.match(/LAST NEW RUN: [^\n]*?(?=NEW RUN \(Esc)/) || ['~none'])[0]);
    window.__net.join();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote', key: '`', bubbles: true }));
    tick({ me: 'Smiler', ms: 1, mk: { v: 'A', k: 'Smiler', e: 2003, ax: 1030, ay: 2500, aa: 0, w: 0, x: 960, y: 3264, a: 0, why: 'smiler' } });
    window.__net.tick(); rec('c3c.kill', window.__kill, window.__killer); frame(A, { run: false, started: true });
    A.G.caught = false;
    tick({ me: 'Hound', ms: 2, mk: { v: 'B', k: 'Hound', e: 999999, ax: 1, ay: 1, aa: 0, w: 0, x: 960, y: 3264, a: 0, why: 'unmirrored' } });
    window.__net.tick(); rec('c3c.kill', window.__kill, window.__killer); frame(A, { run: false, started: true });
    window.__net.respawn(); A.G.caught = false; tick(); frame(A, { run: true, started: true });
    H.msg({ t: 'exit', secs: 61 }); H.msg({ t: 'exit', secs: 62 }); H.advance(1000); frame(A, { run: true, started: true });
    { const { A: A2 } = installApi({ started: true }); H.msg({ t: 'bodies', v: 7, b: [body(30, 1000, 3000)] }); rec('c3c.id', A2.H.id); window.__api = A; }   // the bundle's API made again after the hello: the bodies tell it our id
    window.WebSocket = class { constructor(u) { rec('ws.cannot', u); throw new Error('blocked'); } };
    H.close(); H.advance(1100); frame(A, { run: true, started: true }); H.advance(9000); frame(A, { run: true, started: true });
    await flush();
  };

  /* ?peers=a and ?peers=b: the same players, drawn the HQ5 way and the B way (no fresher poses either way) */
  const modes = async () => {
    const { A } = installApi({ started: true });
    H.open(); H.msg({ t: 'hi', id: 7, sim: 1 }); window.__net.join(); H.msg({ t: 'caps', fp: 1 });
    peerNet('connected');
    let st = 10, k = 0;
    for (let f = 0; f < 90; f++) {
      if (f % 3 === 0) { st = +(st + .05).toFixed(3); k += 3; const jump = f === 45 ? 500 : f === 60 ? 150 : 0; H.msg(Object.assign(snap(st, { p: [peer(8, 1200 + f * 3 + jump, 3300 + (f % 7)), peer(9, 1000, 3200, { a: +(f * .1).toFixed(2) })] }), { w: 1, k })); }
      if (f % 3 === 1) H.msg({ t: 'q', w: 1, k: k + 1, p: [[8, 1201 + f * 3, 3301, .7]] });
      frame(A, { run: true, started: true });
    }
    peerNet('after 90 frames'); rec('c3c.peerScreen', window.__net.peerScreen());
    await flush();
  };
  S.c3c_mode_a = modes; S.c3c_mode_b = modes;
})();
