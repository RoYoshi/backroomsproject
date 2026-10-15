/* Stage 3H continuation (C3b) - the page scripts' differential: the scenes (development only; loaded last by
 * dev/tools/gate/golden/page_scripts.js's harness page, after the one script under test).
 *
 * Each scene drives one script through its public surface the way the bundle and mp.js do, on the fake clock, and records what it
 * returns and what it leaves behind (its object's state, the Graphics it draws into, the page's elements); cli_env.js and page_env.js
 * record the rest (every canvas call, every Web Audio node and parameter, every listener).  The same scene runs B++'s script and this
 * tree's, and the two traces must be equal line for line.  window.__RUN(name) returns the trace's digests, the page's elements and the
 * errors. */
(() => {
  'use strict';
  const H = window.__H, rec = window.__rec;
  const r3 = v => Math.round(v * 1000) / 1000;
  const audioZ = () => { const ac = H.audioCtx(), gain = ac.createGain(); return { context: ac, gain }; };
  const frames = (n, dt, fn) => { for (let i = 0; i < n; i++) { fn(i); H.advance(dt * 1000); } };
  const SC = {};

  /* move.js: the wanderer's movement, its poses and its sounds */
  SC.move = () => {
    const L = H.level, Z0 = audioZ(), Q = new Set();
    const P = { x: 1056, y: 3264, vx: 0, vy: 0, angle: 0, stamina: 100, exhausted: false, sprinting: false, distance: 0 };
    window.__api = { H: P, keys: Q, Oc: L.Oc, Bc: (x, y) => L.Bc(x, y), audio: () => Z0 };
    window.__peerBodies = [];
    const mv = window.__mv, Zs = { footstep: (d, sp, w) => rec('Z.footstep', r3(d), r3(sp), w) };
    const av = { body: H.G('body'), hands: [H.G('handL'), H.G('handR')], hat: H.G('hat'), pack: H.G('pack') };
    const look = (tag) => rec('mv', tag, mv.s, r3(mv.t), r3(mv.speed), r3(P.x), r3(P.y), r3(P.vx), r3(P.vy), r3(P.stamina), P.exhausted, P.sprinting, r3(P.distance), mv.crouch, !!mv.slide, !!mv.vault, mv.surf, mv.zone && mv.zone.id, r3(mv.prof));
    const drive = (tag, n, ix, iy, run, keys = []) => frames(n, 1 / 60, i => {
      Q.clear(); for (const k of keys) Q.add(k);
      mv.step(ix, iy, run, 1 / 60);
      mv.foot(Zs, mv.surf);
      window.__pose.apply(av, { mv: P.mv }, i / 60, false);
      if (i % 6 === 0) { look(tag); rec('net', mv.net(), mv.label(true), mv.label(false)); rec('pose', av.body.x, av.body.rotation, av.body.scale.x, av.body.scale.y, av.hat.y, av.pack.y, av.hands.map(h => [r3(h.x), r3(h.y)])); }
    });
    mv.reset(); look('start');
    drive('walk-east', 90, 1, 0, false);
    drive('run-east', 120, 1, 0, true);
    drive('crouch-edge', 2, 1, 0, true, ['KeyC']); drive('slide', 60, 1, 0, true);           // C while running fast: a slide
    drive('stand', 40, 0, 0, false);
    drive('crouch', 2, 0, 0, false, ['KeyC']); drive('crouch-walk', 80, 0, 1, false); drive('uncrouch', 2, 0, 0, false, ['KeyC']);
    /* to each low prop, and over it; to a hole, and through it crouched */
    for (const p of window.WORLD.PROPS) {
      P.x = p.cx + (p.cross === 'x' ? -90 : 0); P.y = p.cy + (p.cross === 'y' ? -90 : 0); P.vx = P.vy = 0; mv.reset();
      const ix = p.cross === 'x' ? 1 : 0, iy = p.cross === 'y' ? 1 : 0;
      if (p.type === 'gap' || p.type === 'under') { drive('to-' + p.id, 2, 0, 0, false, ['KeyC']); drive('crawl-' + p.id, 150, ix, iy, false); }
      else drive('vault-' + p.id, 120, ix, iy, true);
    }
    /* stamina: run until winded, then rest */
    P.x = 1056; P.y = 3264; mv.reset(); P.stamina = 30;
    drive('winded', 300, 1, .3, true); drive('rest', 240, 0, 0, false);
    /* down and dragged (the server's word), then up */
    mv.down = 'down'; mv.dragTo = [P.x + 120, P.y]; drive('down', 60, 1, 0, false); mv.down = 'crawl'; drive('down-crawl', 60, -1, 0, false); mv.down = 0; mv.dragTo = null; drive('up', 30, 0, 0, false);
    /* other living players in the way */
    window.__peerBodies = [[P.x + 60, P.y], [P.x + 60, P.y + 30]]; drive('peers', 90, 1, 0, false); drive('peers-run', 60, 1, .1, true); window.__peerBodies = [];
    mv.event(3, .5); mv.event(4); rec('take', mv.take(), mv.take());
    for (const s of ['crouch', 'crawl', 'slide', 'vault', 'down', 'walk']) { window.__pose.apply(av, { mv: { s, t: .2, sp: 40, st: 15, ex: 1, vp: .4, lean: -1, tw: 1 } }, 1.7, false); rec('pose-' + s, av.body.x, av.body.rotation, av.body.scale.x, av.body.scale.y, av.hat.y, av.pack.y, av.hands.map(h => [r3(h.x), r3(h.y)])); }
    window.__pose.apply(av, null, 1, false); window.__pose.apply(av, { mv: { s: 'run' } }, 1, true);
    const X = window.__mvSfx; X.slideStart('wet', 250); X.slideStart('concrete', 100); X.slideStart('carpet', 300); X.slideEnd(); X.vaultStart(0); X.vaultStart(2); X.vaultLand(0); X.vaultLand(1); X.vaultLand(2); X.crouchStep(1, 'wet'); X.crawlStep(.5); X.breath(.7);
  };

  /* camcorder.js: raising, night vision, infrared, heat, zoom, the overlay, the sound */
  SC.camcorder = () => {
    const L = H.level, Z0 = audioZ();
    for (const id of ['dialog', 'caught', 'won', 'appearancePanel']) { const e = document.getElementById(id); if (e) e.hidden = true; }
    if (!document.getElementById('hud')) { const h = document.createElement('div'); h.id = 'hud'; document.body.appendChild(h); }
    const P = { x: 1056, y: 3264, angle: 0 };
    window.__api = { H: P, Uc: (x, y, a, m) => L.Uc(x, y, a, m), beam: () => ({ x: P.x, y: P.y, angle: P.angle }), audio: () => Z0 };
    window.__peerLights = [{ x: 1300, y: 3264, angle: Math.PI, ir: 2, dead: false }, { x: 900, y: 3400, angle: 0, ir: 1, dead: false }];
    const C = window.__cam, look = tag => rec('cam', tag, C.raised, C.nv, C.ir, C.irSel, C.irNet, r3(C.bloom), r3(C.zoomCur), r3(C.heat), C.locked, C.stage, r3(C.lampGain()), r3(C.shakeX(H.now / 1000)), r3(C.shakeY(H.now / 1000)));
    const mk = (src, a, b, c) => { rec('mk', r3(src.x), r3(src.y), a, b, c); return (ang, arc, range, alpha) => rec('fan', r3(ang), r3(arc), r3(range), r3(alpha)); };
    const tick = (tag, n, active, kind) => frames(n, 1 / 60, i => { C.tick(1 / 60, active, kind); P.angle += .01; if (i % 10 === 0) { look(tag); rec('ir', r3(C.irAt(P.x + 120, P.y)), r3(C.nvRead(P.x + 80, P.y, .3, 200)), C.irLights({ x: P.x, y: P.y, angle: P.angle }).map(l => [r3(l.x), l.lvl, !!l.own])); C.irDraw(mk, { x: P.x, y: P.y, angle: P.angle }); C.peerIR(mk, window.__peerLights[0]); } });
    C.reset(); look('start');
    C.toggled('flashlight', true); C.toggled('lantern', false); C.toggled('headlamp', true);
    C.toggled('camcorder', true); tick('raise', 60, true, 'camcorder');
    C.toggleNV(); tick('nv-off', 30, true, 'camcorder'); C.toggleNV(); tick('nv-on', 30, true, 'camcorder');
    C.cycleIR(); tick('ir-1', 30, true, 'camcorder'); for (let k = 0; k < 3 && C.irSel !== 2; k++) C.cycleIR(); rec('irSel', C.irSel);
    tick('ir-2', 1300, true, 'camcorder');                                                                    // HIGH until it overheats (about 18 s)
    tick('locked', 760, true, 'camcorder');                                                                   // the lockout, then cooled to half: back online
    C.cycleIR(); C.cycleIR(); tick('cooling', 600, true, 'camcorder');
    for (const id of ['touchNV', 'touchNV', 'touchIR', 'touchZoom', 'touchZoom']) { const b = document.getElementById(id); rec('touch', id, !!b); if (b) b.click(); tick('after-' + id, 12, true, 'camcorder'); }
    for (let k = 0; k < 2; k++) { const ev = new MouseEvent('contextmenu', { cancelable: true, bubbles: true }); window.dispatchEvent(ev); rec('contextmenu', ev.defaultPrevented); tick('after-contextmenu', 12, true, 'camcorder'); }
    const IP = C.irProfile; for (const lv of [1, 2]) { const Pr = C.CFG.IR[lv]; rec('irProfile', lv, [0, .1, .3, .5, .7, .85, 1, 1.2].map(u => r3(IP.radial(u, Pr))), [0, .1, .25, .4, .55, .8, 1.2].map(da => r3(IP.angular(da, Pr))), r3(IP.halfWidth(Pr)), [0, 20, 50, 70, 90].map(d => r3(typeof IP.spill === 'function' ? IP.spill(d) : 0)), IP.spillR); }
    C.cycleZoom(); tick('zoom-2', 40, true, 'camcorder'); C.setZoom(1); C.setZoom(1); tick('zoom-4', 40, true, 'camcorder'); C.setZoom(-1); C.setZoom(-2); tick('zoom-1', 40, true, 'camcorder');
    C.registerFx('hound', { gain: 1.25, interfere: .6, static: .5, glitch: .9 }); rec('fx', C.fx('hound'), C.fx('smiler'));
    frames(120, 1 / 60, i => { C.touch(C.fx('hound'), .3 + (i % 7) / 10); C.tick(1 / 60, true, 'camcorder'); if (i % 10 === 0) look('touch'); });
    C.registerFx('hound', null);
    P.x = 1300; P.angle = Math.PI; tick('near-wall', 60, true, 'camcorder');                      // the emitter's core on a close surface: bloom
    C.toggled('camcorder', false); tick('lower', 60, false, 'camcorder'); tick('other-kind', 30, true, 'flashlight');
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN', key: 'n' })); window.dispatchEvent(new Event('blur'));
    tick('end', 30, true, 'camcorder'); C.reset(); look('reset');
  };

  /* glitch.js: the glitched walls and the cartograph drawn, their sound, the tear */
  SC.glitch = () => {
    const L = H.level, Z0 = audioZ();
    window.__api = { audio: () => Z0 };
    window.__glitches = [[1400, 3264, 1, 0], [2200, 3000, 0, -1]]; window.__items = [[1250, 3300, 'cartograph']];
    const los = (x, y, a, d) => L.Uc(x, y, a, d), cam = { x: 1056, y: 3264 }, p = { x: 1056, y: 3264 };
    const frame = (tag, n, run) => frames(n, 1 / 60, i => { window.__glitchFrame({ p, cam, sc: 1, los, W: 1280, H: 720, t: H.now / 1000, run }); p.x += 4; cam.x = p.x; if (i % 10 === 0) rec('tear', document.getElementById('glitchTear').style.opacity); });
    frame('approach', 120, true); frame('out-of-run', 20, false);
    document.body.classList.add('gl-out'); frame('exited', 20, false); document.body.classList.remove('gl-out');
    window.__glitchSound.burst(); frame('after-burst', 80, true);                                       // the burst's zaps and its fade (1.1 s)
    window.__glitches = []; window.__items = null; frame('none', 10, true);
  };

  /* ents.js: the entities' slots, the Hound and the Smiler drawn, their deaths and sounds, the debug overlay */
  SC.ents = () => {
    const L = H.level, Z0 = audioZ(), E = window.__ents;
    const P = { x: 1056, y: 3264, angle: 0, vx: 0, vy: 0, stamina: 80, exhausted: false };
    let death = null;
    window.__api = { H: P, x: P.x, y: P.y, Uc: (x, y, a, m) => L.Uc(x, y, a, m), Bc: (x, y) => L.Bc(x, y), sl: (x, y, r) => L.sl(x, y, r), audio: () => Z0, death: () => death };
    E.setTables(null); E.setTables({ s: E.tab.s, h: E.tab.h, m: E.tab.m });
    const view = () => { const v = H.G('view'); v.limbs = H.G('limbs'); v.limbs.constructor = H.Gclass; v.body = H.G('body'); v.body.constructor = H.Gclass; return v; };   // the bundle's view: the Hound takes its Graphics class from view.limbs, the Smiler from view.body
    const hv = [view(), view()], sv = [view(), view()], ho = [{ x: 0, y: 0, angle: 0, distance: 0 }, { x: 0, y: 0, angle: 0, distance: 0 }], so = [{ x: 0, y: 0, angle: 0 }, { x: 0, y: 0, angle: 0 }];
    const lookG = (tag, o) => rec(tag, Object.keys(o).sort().map(k => [k, typeof o[k] === 'number' ? r3(o[k]) : o[k] && typeof o[k] === 'object' ? (o[k].__gid || '~obj') : o[k]]));
    frames(600, 1 / 60, i => {
      const t = H.now / 1000;
      for (let k = 0; k < 2; k++) {
        const hs = (i >> 6) % 19, ha = (i >> 5) % 17;
        E.slotH(ho[k], { x: 1500 + k * 200 + Math.sin(i / 30) * 300, y: 3264 + Math.cos(i / 40) * 120, a: i / 50, s: hs, ac: ha, v: (i % 40) / 10, h: Math.sin(i / 20), lh: i % 90 < 45 ? undefined : .3, l: i % 120 > 100 ? 1 : 0, tg: k, cp: 0, k: 1 }, 1 / 60, i % 200 > 150 ? { x: 1600, y: 3200, a: .5 } : null);
        E.drawHound(hv[k], ho[k], t, 1 / 60);
        E.slotS(so[k], { x: 900 + k * 300, y: 3100 + Math.sin(i / 25) * 80, a: -i / 60, s: (i >> 5) % 19, ac: (i >> 4) % 19, v: 1, f: (i % 50) / 50, h: .2, tg: 0, cp: 0, lt: i % 2, sp: i % 3, i: k }, 1 / 60, null);
        const pres = E.smilerPresence((i % 100) / 100, sv[k]);
        E.drawSmiler(sv[k], so[k], t, 1 / 60, pres, { x: P.x, y: P.y });
        if (i % 30 === 0) { lookG('hound' + k, ho[k]); lookG('smiler' + k, so[k]); }
      }
      if (i % 20 === 0) E.entAudio(1 / 60, ho.map((o, k) => Object.assign({ view: hv[k], id: k + 1 }, o)), so.map((o, k) => Object.assign({ view: sv[k], id: k + 3 }, o)));
    });
    const ctx = document.createElement('canvas').getContext('2d');
    const glow = document.createElement('canvas').getContext('2d');                                    // the darkness layer: a real (recorded) 2D context
    for (let k = 0; k < 6; k++) { sv[0].x = P.x + 120 + k * 150; sv[0].y = P.y + 20; E.smilerGlow(glow, sv[0], so[0], k / 3, P, .5 + k / 4); }   // near the player and further away
    E.attackHound(hv[0], { x: 10, y: -20 }, .6, 1, null); E.attackHound(hv[1], null, 0, 2, null);
    E.attackSmiler(sv[0], 2.5, 1 / 60);
    for (const [x, y, ty] of [[1200, 3264, 'growl'], [1250, 3264, 'guard'], [1300, 3264, 'bark'], [1400, 3200, 'howl'], [1500, 3300, 'snarl'], [1300, 3300, 'lungecue'], [1150, 3264, 'kill'], [4000, 3264, 'growl']]) E.houndVoice(x, y, ty, .7);
    E.houndStep(1100, 3264, 200, 2); E.houndBreath(1100, 3264, true); E.houndBreath(1100, 3264, false); E.houndScrape(1100, 3264);
    for (const ty of ['giggle', 'whisper', 'blackout', 'scream', 'laugh']) E.smilerVoice(1000, 3200, ty);
    E.sfxKnock(); E.sfxGasp(); E.sfxRelease(); E.boomVoice(1100, 3264); E.deathVoice('hound', 1100, 3264, [[1, .5]]); E.deathVoice('smiler', 1100, 3264, null);
    E.footfall(ho[0], 180, 1); E.lamp(1056, 3264, 1.5);
    /* the light failures the server announces ([x, y, r, seconds left]), and mp.js's hook */
    E.onFail = f => rec('onFail', r3(f.x), r3(f.y), r3(f.r), r3(f.until));
    E.setFails([[1100, 3264, 300, 5]]); E.setFails([[1100, 3264, 300, 5], [1500, 3300, 200, 3]]);
    for (let k = 0; k < 12; k++) rec('lamp', r3(E.lamp(1000 + k * 50, 3264, k * .37)));
    H.advance(6000); rec('lamp-after', r3(E.lamp(1100, 3264, 2))); E.setFails([]);
    /* the local kill choice (offline): around the start, facing every way, each kind */
    for (let k = 0; k < 24; k++) { const at = { x: 900 + (k % 6) * 90, y: 3150 + ((k / 6) | 0) * 90, angle: k * .7, stamina: k % 3 ? 80 : 10, exhausted: k % 5 === 0 }; rec('localKill', k, E.localKill(k % 2 ? 'Smiler' : 'Hound', at, { x: at.x + Math.cos(k) * 70, y: at.y + Math.sin(k) * 70 })); }
    /* the deaths, as the bundle stages one: its record, the plan (E.deathPlan), B++'s dphys.js simulating it, the attacker drawn from the
     * simulation (E.attackHound) or the Smiler's attack, the extras, the death's sounds (E.deathEvent, __dsndHits); the death lab's overlay */
    const D = window.__dphys, gore = H.G('gore');
    const deathRun = (tag, kind, K, at, viz) => {
      const vic = { x: at[0], y: at[1], angle: at[2] }, src = { x: at[0] + Math.cos(at[3]) * 64, y: at[1] + Math.sin(at[3]) * 64 }, ang = Math.atan2(vic.y - src.y, vic.x - src.x);
      const jl = { active: true, kind, startAt: H.now / 1000, attackerIndex: 0, source: { x: src.x, y: src.y }, victim: vic, angle: ang, direction: { x: Math.cos(ang), y: Math.sin(ang) },
        body: { x: vic.x, y: vic.y, angle: 0, scaleX: 1, scaleY: 1, alpha: 1 }, attacker: { x: src.x, y: src.y, angle: 0 }, torch: { x: 0, y: 0, angle: 0 }, debris: { visible: false },
        foreground: { alpha: 1 }, bursts: [], elapsed: 0, drawBlood() {}, drawShadow() {} };
      const Pn = E.deathPlan(jl, kind, K);
      Object.assign(jl, { variant: Pn ? Pn.v : 'A', wall: Pn ? Pn.wall : null, hits: Pn ? Pn.hits : null, kt: Pn ? Pn.kt : [.08, .36], dw: Pn ? Pn.dw : [2.03, 3.12], blackFn: Pn ? Pn.black : null });
      jl.duration = (D.DURS[kind] || D.DURS.Hound)[jl.variant] || 4.4;
      rec('plan', tag, Pn && Object.keys(Pn).sort().map(k => [k, typeof Pn[k] === 'function' ? 'fn' : Pn[k]]));
      jl.ph = D.begin(jl, Pn, { hat: 'cap', eqKind: kind === 'Smiler' ? 'lantern' : 'flashlight', exhausted: K && K.v === 'D', vx: 40, vy: -20 });
      rec('begin', tag, !!jl.ph, r3(jl.knock || 0), r3(jl.drag || 0));
      if (!jl.ph) return;
      const lab = window.__dlab; if (viz) window.__dlab = { viz: true };
      death = jl;
      const n = Math.ceil(jl.duration * 60) + 10;
      for (let i = 0; i <= n; i++) {
        const t = i / 60; D.frame(jl, t); jl.elapsed = t;
        if (kind === 'Hound') E.attackHound(hv[0], jl.grip, jl.impact, jl.variant, jl); else if (kind === 'Smiler') E.attackSmiler(sv[0], t, 1 / 60);
        E.deathExtras(gore, jl, t);
        if (i % 12 === 0) { rec('death', tag, r3(t), r3(jl.body.x), r3(jl.body.y), r3(jl.body.angle), r3(jl.body.alpha), r3(jl.attacker.x), r3(jl.attacker.y), r3(jl.impact), r3(jl.grip), r3(jl.black), jl.phase, jl.settle, jl.bursts.length, (window.__dsndHits(kind) || []).length); if (viz) E.drawDebug(ctx, { sc: 1, W: 1280, H: 720, cam: { x: vic.x, y: vic.y } }); }
        H.advance(1000 / 60);
      }
      rec('death-end', tag, jl.finished, r3(jl.shade), jl.gearHeld, jl.hatOn);
      death = null; window.__dlab = lab;
    };
    let wallK = null; for (let k = 0; k < 400 && !wallK; k++) { const at = { x: 700 + (k % 20) * 70, y: 2900 + ((k / 20) | 0) * 50, angle: 0, stamina: 80 }; const src = { x: at.x - 70, y: at.y }; const r = E.localKill('Hound', at, src); if (r.v === 'C' && r.w) wallK = [r, at]; }
    rec('wallK', wallK && wallK[0]);
    for (const v of ['A', 'B', 'D']) deathRun('hound-' + v, 'Hound', { v, s: 3 }, [1056, 3264, .4, Math.PI], v === 'A');
    if (wallK) deathRun('hound-C', 'Hound', { v: 'C', w: wallK[0].w, s: 4 }, [wallK[1].x, wallK[1].y, 0, Math.PI]);
    for (const v of ['A', 'B', 'C']) deathRun('smiler-' + v, 'Smiler', { v, s: 6 }, [1056, 3264, -.8, .3]);
    deathRun('boom', 'Boom', { s: 5, d: .7 }, [1056, 3264, 0, 0]);
    /* the debug overlay with the server's own records (B++'s sim, the same on both sides): every panel, an entity selected, both sides */
    const FIX = window.__FIX || { frames: [] };
    window.__mv = { s: 'run', speed: 210, surf: 'carpet', q: 1, prof: 1.2, down: 0 };
    const cfgAll = { on: true, ai: true, you: true, srv: true, log: true, compact: false, side: 'right', search: true, crawl: true, evid: true, nav: true, col: true, grid: true, links: true };
    FIX.frames.forEach((f, k) => {
      const fx = f.dbg.find(d => d.fx);                                                                  // the record given eye contact: selected, every panel on
      Object.assign(E.dbgCfg, cfgAll, !fx && k % 3 === 1 ? { compact: true, side: 'left' } : {}, !fx && k % 3 === 2 ? { nav: false, search: false, evid: false } : {});
      E.navSel = fx ? fx.i : f.dbg.length ? f.dbg[k % f.dbg.length].i : 0;
      window.__mv.s = ['run', 'walk', 'crouch', 'crawl', 'slide', 'vault'][k % 6]; P.exhausted = k % 4 === 3;
      E.setDebug(f.dbg); E.setDebugX({ lg: f.lg, pf: f.pf }); E.dbgX.ping = 30 + k;
      E.drawDebug(ctx, { sc: 1 + (k % 2) * .5, W: 1280, H: 720, cam: { x: f.dbg.length ? f.dbg[0].x : 1056, y: f.dbg.length ? f.dbg[0].y : 3264 } });
      H.advance(500);
    });
    rec('dbg', E.dbg && E.dbg.length, E.dbgX.lg.length, r3(E.fps));
    E.setDebug(null); E.drawDebug(ctx, { sc: 1, W: 1280, H: 720, cam: { x: 1056, y: 3264 } }); H.advance(2000); E.drawDebug(ctx, { sc: 1, W: 1280, H: 720, cam: { x: 1056, y: 3264 } });
    E.clearDebug(); E.dbgCfg.on = false; E.drawDebug(ctx, { sc: 1, W: 1280, H: 720, cam: { x: 1056, y: 3264 } });
    rec('views', hv.concat(sv).map(v => v.children.length));
  };

  /* run one scene; return the trace as digests of 2,000-line chunks (two 32-bit FNV-1a hashes of each line's JSON text, chained), or,
   * with opt.lines = [from, to], those lines in full (to show where two runs part) */
  window.__RUN = (name, opt) => {
    const e = [], t0 = H.realNow(); try { SC[name](); } catch (x) { e.push('scene.throw ' + String(x && x.stack || x).slice(0, 400)); }
    const ms = H.realNow() - t0;                                  // real time spent in the scene (the --perf mode's measure; never traced)
    const T = window.__T, out = { n: T.length, kinds: new Set(T.map(x => x[1])).size, dom: H.dom(), errs: H.errs.concat(e), ms };
    if (opt && opt.lines) { out.lines = T.slice(opt.lines[0], opt.lines[1]).map(x => JSON.stringify(x)); return out; }
    const CH = 2000; out.chunks = [];
    for (let i = 0; i < T.length; i += CH) {
      let a = 0x811c9dc5, b = 0x9dc5811c;
      for (let j = i; j < Math.min(T.length, i + CH); j++) { const s = JSON.stringify(T[j]); for (let c = 0; c < s.length; c++) { const ch = s.charCodeAt(c); a = Math.imul(a ^ ch, 16777619); b = Math.imul(b ^ ch, 0x5bd1e995); } a = Math.imul(a ^ 10, 16777619); b = Math.imul(b ^ 10, 0x5bd1e995); }
      out.chunks.push((a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0'));
    }
    return out;
  };
})();
