/* Night Vision Camcorder + light-source runtime (client only).
   The bundle owns the lighting / line-of-sight maths; this file owns the *camera side* of the game:
   raise state feedback, night-vision overheating, zoom, grain / tint overlay, HUD, audio and the
   per-entity night-vision effect registry.

   NV is NOT x-ray. It only brightens the part of the current, valid line-of-sight polygon that is
   already being rendered (the bundle punches the NV hole inside the LOS clip). Nothing here ever
   touches visibility of things behind walls, and zoom never extends line of sight.

   v23 (Part 2, stage 2C-IR) - ACTIVE INFRARED.  Night vision is two parts:
     the SENSOR (N)        sees what is lit: it amplifies visible light (lamps) and shows infrared.
     the IR ILLUMINATOR    (B: OFF / LOW / HIGH) a real directional light in the infrared - a strong core and a weaker
                           outer field, finite range with a smooth fall-off, stopped by walls (the same wall-clipped fan as
                           the torches), plus a little spill at the lens.  Without the sensor nobody sees it: not this
                           player with NV off, not another player without NV, and never the monsters (it is not sent to the
                           AI at all - server.js keeps it on the connection, not on the player the simulation sees).
     HEAT comes from the emitter: HIGH ~18 s to overheat, LOW ~75 s, emitter OFF none (the sensor alone does not heat).
                           An overheated emitter shuts down (the sensor stays on) until it has cooled to half.
     OVEREXPOSURE          HIGH (and LOW, less) pointed at a surface close to the lens floods the picture: the near
                           image blooms and distant detail washes out, easing in and out.

   Stage 3B-L QA2 - THE INFRARED IS DRAWN BY BR-RoLE.  The illuminator's picture is no longer a stack of wall-clipped fans
   (a stepped cone with a hard rim and a flat disc at the lens): while this sensor is on, BR-RoLE lights every emitter it
   sees (yours, and other camcorders') as a carried light of its own - its field, the shadows walls, pillars and props cast
   from the lens, and the wall / pillar faces it reaches - added to the picture inside the line of sight (irLights below).
   Its field (irProfile) is v23's own picture made smooth: the six stacked fans' coverage - the core under all six, the
   outer field under fewer, each fan out to its own range - with every step eased into the next and the edge and the end of
   the range faded (no stepped cone, no rim); the same range, power, core and arc.  What the sensor reads (irFrom: an
   entity's readability) keeps v23's own profile, with its two hard places eased: the step at the core's edge (over
   +-.075 rad) and the straight ramp over the last 30 % of the range (a smooth tail).  Still a sensor channel only: never
   sent to the AI, never counted as visible light, nothing without this player's sensor on.  (If BR-RoLE is off the old
   fans draw it.)

   ---------------------------------------------------------------------------------------------
   BALANCE  – every number is in CFG below (also live-editable from the console: __cam.CFG.X = …)
   ---------------------------------------------------------------------------------------------
   NV_MAX_HEAT              heat at which the NV sensor shuts down
   NV_HEAT_RATE             (v23: unused - heat now comes from the IR emitter, IR[n].heat below)
   NV_COOL_RATE             heat lost per second while NV is off / locked  (100/5  =  20 s full cool)
   NV_REENABLE_THRESHOLD    heat that must be reached before NV comes back (after the lockout)
   NV_OVERHEAT_LOCKOUT      minimum seconds NV stays dead after a shutdown
   ZOOM_LEVELS              camera zoom stops (1x / 2x / 4x)
   ZOOM_HEAT_MULT           optional heat multiplier per zoom stop (1 = zoom does not heat faster)
   There are no batteries. Heat is the only resource.                                             */
(() => {
  'use strict';
  const CFG = {
    NV_MAX_HEAT: 100,
    NV_HEAT_RATE: 100 / 35,
    NV_COOL_RATE: 5,
    NV_REENABLE_THRESHOLD: 50,
    NV_OVERHEAT_LOCKOUT: 9,
    ZOOM_LEVELS: [1, 2, 4],
    ZOOM_HEAT_MULT: [1, 1, 1],
    ZOOM_EASE: 7,
    STAGE_SLIGHT: .5,          // fractions of NV_MAX_HEAT where the picture starts to degrade
    STAGE_NOISY: .75,
    STAGE_UNSTABLE: .9,
    GRAIN_CLEAN: .05, GRAIN_SLIGHT: .12, GRAIN_NOISY: .22, GRAIN_UNSTABLE: .34,
    NV_BRIGHTNESS: .95,       // overall night-vision picture gain (CSS brightness)
    // the IR illuminator (v23): range px, core / outer field (rad), strength, heat per second, distance at which a surface starts to flood the sensor
    IR: { 1: { name: 'LOW', range: 340, core: .5, arc: 1.05, power: .72, heat: 100 / 75, bloomR: 80, bloom: .65 },
          2: { name: 'HIGH', range: 560, core: .5, arc: 1.05, power: .86, heat: 100 / 18, bloomR: 115, bloom: 1 } },
    IR_DEFAULT: 1,
    SENSOR_GAIN: 1.45,        // how much the sensor amplifies visible light (lamps) on screen
    SHAKE_BASE: .5, SHAKE_ZOOM: 1.6,
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const S = {
    kind: 'flashlight', active: false, nvOn: true, ir: 1, bloom: 0, heat: 0, locked: false, lockT: 0,
    zoomIdx: 0, zoomCur: 1, rec: 0, dt: 0, t: 0,
    shakeAmp: 0, interfere: 0, stat: 0, glitchT: 0, hint: 0, hints: 0,
    msg: '', msgT: 0, wasActive: false, lastWheel: 0, whine: null,
  };
  const FX = Object.create(null);

  /* ---------------------------------------------------------------- audio (synthesised) */
  const A = () => { const z = window.__api && window.__api.audio && window.__api.audio(); return z && z.context && z.gain ? z : null; };
  function tone(o) {
    const z = A(); if (!z) return; const c = z.context, t = c.currentTime + (o.at || 0);
    const osc = c.createOscillator(), g = c.createGain(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t); if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.d);
    const v = o.v == null ? .1 : o.v; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.a || .006)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    let n = osc; if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); n = f; }
    n.connect(g); g.connect(z.gain); osc.start(t); osc.stop(t + o.d + .05);
  }
  function noise(o) {
    const z = A(); if (!z) return; const c = z.context, t = c.currentTime + (o.at || 0), len = Math.max(64, c.sampleRate * o.d | 0);
    const b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = o.type || 'bandpass'; f.frequency.value = o.f || 2400; f.Q.value = o.q || 1;
    g.gain.value = o.v == null ? .1 : o.v; s.connect(f); f.connect(g); g.connect(z.gain); s.start(t);
  }
  const snd = {
    click(on) { noise({ d: .018, f: on ? 3400 : 2600, q: 3, v: .16 }); tone({ f0: on ? 1900 : 1400, d: .012, v: .03, type: 'square', at: .004 }); },
    soft(on) { noise({ d: .03, f: 1800, q: 1.2, v: .1 }); tone({ f0: on ? 700 : 520, d: .05, v: .03, type: 'triangle' }); },
    thunk(on) { tone({ f0: on ? 180 : 130, f1: 70, d: .11, v: .16, type: 'triangle', lp: 700 }); noise({ d: .04, f: 900, q: .8, v: .09 }); },
    raise() { tone({ f0: 240, f1: 620, d: .3, v: .05, type: 'sawtooth', lp: 900 }); noise({ d: .28, f: 1300, q: .7, v: .04 }); noise({ d: .02, f: 3000, q: 3, v: .12, at: .3 }); },
    lower() { tone({ f0: 620, f1: 220, d: .26, v: .05, type: 'sawtooth', lp: 900 }); noise({ d: .24, f: 1100, q: .7, v: .04 }); noise({ d: .02, f: 2200, q: 3, v: .12, at: .26 }); },
    nvOn() { tone({ f0: 900, f1: 2700, d: .18, v: .07, type: 'sine' }); tone({ f0: 5400, d: .05, v: .012, at: .15 }); noise({ d: .12, f: 5000, q: .6, v: .025 }); },
    nvOff() { tone({ f0: 1900, f1: 520, d: .14, v: .06 }); },
    zoom() { tone({ f0: 340, f1: 470, d: .16, v: .035, type: 'sawtooth', lp: 800 }); },
    shutdown() { tone({ f0: 1200, f1: 50, d: .55, v: .1, type: 'sawtooth', lp: 1800 }); noise({ d: .5, f: 1500, q: .5, v: .12 }); tone({ f0: 90, d: .35, v: .09, type: 'square', at: .1, lp: 300 }); },
    deny() { tone({ f0: 300, d: .09, v: .06, type: 'square', lp: 700 }); tone({ f0: 240, d: .1, v: .06, type: 'square', at: .11, lp: 700 }); },
    ready() { tone({ f0: 1300, d: .07, v: .06 }); tone({ f0: 1950, d: .1, v: .06, at: .09 }); },
    warn() { tone({ f0: 2400, d: .05, v: .03 }); },
  };
  // continuous, quiet instability whine that rises with heat (only past the "noisy" stage)
  function whine(level) {
    const z = A(); if (!z) return;
    if (!S.whine || S.whine.c !== z.context) {
      if (level <= 0) return;
      const c = z.context, o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sine'; o.frequency.value = 3600; g.gain.value = 0; lfo.frequency.value = 9; lg.gain.value = 140; lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(z.gain); o.start(); lfo.start(); S.whine = { c, o, g, lfo };
    }
    const w = S.whine, t = w.c.currentTime; w.g.gain.setTargetAtTime(level * .028, t, .12); w.o.frequency.setTargetAtTime(3200 + level * 1400, t, .2);
  }

  /* ---------------------------------------------------------------- DOM */
  const css = document.createElement('style'); css.id = 'camCss';
  css.textContent = `
#camFx{position:fixed;inset:0;z-index:4;pointer-events:none;display:none;--b:.95;
 background:radial-gradient(ellipse at center,#0000 46%,#0009 100%),linear-gradient(#0000 50%,#0000000f 50%);background-size:100% 100%,100% 3px}
#camFx::after{content:"";position:absolute;inset:104px 26px 26px;pointer-events:none;opacity:.55;
 background:linear-gradient(#cfe9cf,#cfe9cf) left top/26px 2px no-repeat,linear-gradient(#cfe9cf,#cfe9cf) left top/2px 26px no-repeat,
 linear-gradient(#cfe9cf,#cfe9cf) right top/26px 2px no-repeat,linear-gradient(#cfe9cf,#cfe9cf) right top/2px 26px no-repeat,
 linear-gradient(#cfe9cf,#cfe9cf) left bottom/26px 2px no-repeat,linear-gradient(#cfe9cf,#cfe9cf) left bottom/2px 26px no-repeat,
 linear-gradient(#cfe9cf,#cfe9cf) right bottom/26px 2px no-repeat,linear-gradient(#cfe9cf,#cfe9cf) right bottom/2px 26px no-repeat}
body.cam-raised #camFx{display:block;-webkit-backdrop-filter:saturate(.5) contrast(1.06) brightness(1.05);backdrop-filter:saturate(.5) contrast(1.06) brightness(1.05)}
body.cam-nv #camFx{-webkit-backdrop-filter:grayscale(1) sepia(1) hue-rotate(58deg) saturate(2.4) brightness(var(--b)) contrast(1.18);backdrop-filter:grayscale(1) sepia(1) hue-rotate(58deg) saturate(2.4) brightness(var(--b)) contrast(1.18)}
body.cam-nv #camFx::before{content:"";position:absolute;inset:0;background:#0aff3a0a;mix-blend-mode:screen}
body:not(.cam-nv) #camBloom{display:none}
#camBloom{position:fixed;inset:0;z-index:4;pointer-events:none;opacity:0;mix-blend-mode:screen;background:radial-gradient(circle at 50% 50%,#eaffe6 0,#c8ffcf66 10%,#a8f0b022 26%,#0000 46%)}
#camGrain{position:fixed;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;image-rendering:pixelated;display:none;mix-blend-mode:normal}
body.cam-raised #camGrain{display:block}
#camTear{position:fixed;left:0;right:0;z-index:4;pointer-events:none;display:none;height:14px;background:#b9ffc633;-webkit-backdrop-filter:brightness(1.7) contrast(1.4);backdrop-filter:brightness(1.7) contrast(1.4)}
#camHud{position:fixed;inset:0;z-index:6;pointer-events:none;display:none;font:500 12px IBM Plex Mono,monospace;letter-spacing:2px;color:#d6f2d6;text-shadow:0 0 6px #000,0 1px 3px #000}
body.cam-raised #camHud{display:block}
#camHud .rec{position:absolute;top:96px;left:50%;transform:translateX(-50%);white-space:nowrap}
#camHud .rec i{font-style:normal;color:#ff4136;margin-right:8px;animation:camBlink 1.1s steps(2,end) infinite}
#camHud .side{position:absolute;top:96px;right:40px;text-align:right;line-height:1.75}
#camHud .side b{font-weight:500}
#camHud .nv.off{opacity:.6}
#camHud .nv.lock{color:#ff8a5c}
#camHud .temp.warn{color:#ffd166}
#camHud .temp.hot{color:#ff5a4d;animation:camBlink .5s steps(2,end) infinite}
#camHud .msg{position:absolute;left:50%;bottom:22%;transform:translateX(-50%);padding:9px 18px;border:1px solid #ff8a5c;background:#140805d0;color:#ffb08c;letter-spacing:3px;opacity:0;transition:opacity .25s;white-space:nowrap}
#camHud .msg.ok{border-color:#8fe89f;background:#06120acc;color:#bff5c8}
#camHud .msg.on{opacity:1}
#camHud .hint{position:absolute;left:50%;top:124px;transform:translateX(-50%);font-size:10px;opacity:0;transition:opacity .6s;color:#b8d8bb;white-space:nowrap}
#camHud .hint.on{opacity:.7}
@keyframes camBlink{50%{opacity:.15}}
body.cam-raised .location,body.cam-raised .coordinates,body.cam-raised #hud .keyline,body.cam-raised #lightStatus{display:none!important}
#hud .camkey{display:none}
body.cam-kind #hud .camkey{display:inline}
#touch .camBtn{display:none}
body.cam-kind #touch .camBtn{display:inline-block}
@media (max-width:700px){#camHud .rec,#camHud .side{top:70px}#camHud .side{right:14px}}
`;
  document.head.appendChild(css);

  const fx = document.createElement('div'); fx.id = 'camFx';
  const grain = document.createElement('canvas'); grain.id = 'camGrain'; grain.width = 200; grain.height = 112;
  const tear = document.createElement('div'); tear.id = 'camTear';
  const bloomEl = document.createElement('div'); bloomEl.id = 'camBloom';
  const hud = document.createElement('div'); hud.id = 'camHud';
  hud.innerHTML = '<div class="rec"><i>●</i>REC <span id="camRec">00:00</span></div><div class="side"><div class="nv" id="camNv">NV ON</div><div id="camZoom">ZOOM 1.0x</div><div class="temp" id="camTemp">TEMP <b>▯▯▯▯▯</b></div></div><div class="msg" id="camMsg"></div><div class="hint" id="camHint">N · NIGHT VISION &nbsp;&nbsp; B · IR POWER &nbsp;&nbsp; WHEEL · ZOOM &nbsp;&nbsp; F · LOWER</div>';
  const mount = () => {
    if (!document.body) return false;
    document.body.append(fx, bloomEl, grain, tear, hud);
    const touch = document.getElementById('touch');
    if (touch) {
      const mk = (id, txt, fn) => { const b = document.createElement('button'); b.id = id; b.className = 'camBtn'; b.textContent = txt; b.addEventListener('click', fn); touch.appendChild(b); };
      mk('touchNV', 'NV', () => api.toggleNV()); mk('touchIR', 'IR', () => api.cycleIR()); mk('touchZoom', 'ZOOM', () => api.cycleZoom());
    }
    return true;
  };
  if (!mount()) document.addEventListener('DOMContentLoaded', mount);
  const $ = id => document.getElementById(id);
  const gctx = grain.getContext('2d'), gimg = gctx.createImageData(grain.width, grain.height);

  /* ---------------------------------------------------------------- helpers */
  const frac = () => S.heat / CFG.NV_MAX_HEAT;
  const stage = () => { const f = frac(); return f >= 1 ? 4 : f >= CFG.STAGE_UNSTABLE ? 3 : f >= CFG.STAGE_NOISY ? 2 : f >= CFG.STAGE_SLIGHT ? 1 : 0; };
  const raised = () => S.active;
  const nvNow = () => S.active && S.nvOn;                            // the sensor (v23: overheating shuts the emitter, not the sensor)
  const irNow = () => nvNow() && !S.locked ? S.ir : 0;               // the emitter: 0 off / 1 low / 2 high
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  /* QA2: the sensor's reading of the field (irFrom).  radial (u = d / range): v23's 1, .83 at .25, .28 at .7, then a
   * smooth (Hermite) tail to 0 at the range instead of a straight ramp; angular (da off the axis): the core (1) eased into
   * the outer field (.45) over +-.075 rad round core / 2 (v23: a step), the outer field fading smoothly to 0 at arc / 2 as
   * before; the spill at the lens: .3 inside 20 px, 0 by 70 px (v23's) */
  const irRadial = u => { if (u <= 0) return 1; if (u < .25) return 1 - .17 * u / .25; if (u < .7) return .83 - .55 * (u - .25) / .45; if (u >= 1) return 0;
    const t = (u - .7) / .3; return (2 * t * t * t - 3 * t * t + 1) * .28 - (t * t * t - 2 * t * t + t) * .55 / .45 * .3; };
  const irAngular = (da, P) => { if (da >= P.arc / 2) return 0; const c = P.core / 2; return .55 * (1 - ss(c - .075, c + .075, da)) + .45 * (1 - ss(c, P.arc / 2, da)); };
  const irSpill = d => (1 - ss(20, 70, d)) * .3;
  /* QA2: the picture (BR-RoLE draws it): v23's six stacked fans (drawFan below: fan k of n spans arc - (arc - core) k / (n - 1)
   * out to range (.82 + .18 k / (n - 1)), each 1 - (1 - power)^(1/n) strong, through v23's radial stops) made smooth - each
   * fan's edge eased over the gap to the next (so the steps blend), the widest one's over twice that (the cone's soft rim,
   * gone by halfWidth), each fan's radial ending in the smooth tail.  Relative to the core's strength at the lens (x power =
   * the picture) */
  const FANS = 6, PIC = { w: .5, rim: 1.1 };
  const picAngular = (da, P) => { const a1 = 1 - (1 - P.power) ** (1 / FANS), g = (P.arc - P.core) / (FANS - 1); let n = 0;
    for (let k = 0; k < FANS; k++) { const h = (P.arc - (P.arc - P.core) * k / (FANS - 1)) / 2, w = g * (k ? PIC.w : PIC.rim); n += 1 - ss(h - w, h + w, da); }
    return (1 - (1 - a1) ** n) / P.power; };
  const picRadial = (u, P) => { const a1 = 1 - (1 - P.power) ** (1 / FANS); let keep = 1;
    for (let k = 0; k < FANS; k++) keep *= 1 - a1 * irRadial(u / (.82 + .18 * k / (FANS - 1)));
    return (1 - keep) / P.power; };
  /* infrared reaching (x,y) from an illuminator at src {x,y,angle} at power level lvl: 0..1, 0 behind a wall */
  function irFrom(src, lvl, x, y) {
    const P = CFG.IR[lvl], A = window.__api; if (!P || !src || !A || !A.Uc) return 0;
    const dx = x - src.x, dy = y - src.y, d = Math.hypot(dx, dy);
    let v = irSpill(d);                                                 // spill at the lens
    if (d < P.range) {
      const da = Math.abs(angDiff(Math.atan2(dy, dx), src.angle || 0));
      if (da < P.arc / 2) v = Math.max(v, P.power * irAngular(da, P) * irRadial(d / P.range));
    }
    if (v <= 0) return 0;
    if (d > 2 && A.Uc(src.x, src.y, Math.atan2(dy, dx), d + 1) < d - .5) return 0;
    return v;
  }
  /* the fan, drawn with the bundle's own wall-clipped light fan (mk) as cut-outs of the darkness: stacked, so the core is strongest
   * (QA2: only when BR-RoLE is off - it draws the infrared itself) */
  const brIR = () => { const B = window.__brRole; return !!(B && B.ir && B.on && B.on()); };
  function drawFan(mk, src, lvl) {
    const P = CFG.IR[lvl]; if (!P) return; const f = mk(src, 0, 0, 0), n = 6, a1 = 1 - (1 - P.power) ** (1 / n);
    for (let k = 0; k < n; k++) f(src.angle || 0, P.arc - (P.arc - P.core) * k / (n - 1), P.range * (.82 + .18 * k / (n - 1)), a1);
    f(0, Math.PI * 2, 70, .3);
  }
  function say(text, ok, ms) { S.msg = text; S.msgT = ms || 2.2; const m = $('camMsg'); if (m) { m.textContent = text; m.classList.toggle('ok', !!ok); m.classList.add('on'); } }
  function playing() {
    const h = id => { const e = $(id); return !e || e.hidden || getComputedStyle(e).display === 'none'; };
    const hud0 = $('hud'); if (!hud0 || hud0.hidden) return false;
    return h('dialog') && h('caught') && h('won') && h('appearancePanel');
  }
  const typing = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };
  function glitchBurst(dur) { S.glitchT = Math.max(S.glitchT, dur || .18); }

  /* ---------------------------------------------------------------- public API */
  const api = window.__cam = {
    CFG, S,
    get nv() { return nvNow(); },
    get ir() { return irNow(); },                                    // the local emitter right now
    get irSel() { return S.ir; },
    get irNet() { return irNow(); },                                 // what other players' sensors may see (mp.js sends it; presentation only)
    get bloom() { return S.bloom; },
    irFrom,
    irProfile: { radial: picRadial, angular: picAngular, halfWidth: P => P.arc / 2 + (P.arc - P.core) / (FANS - 1) * PIC.rim, spill: irSpill, spillR: 70 },   // QA2: the picture (BR-RoLE; halfWidth: where its soft rim reaches 0); irFrom reads irRadial / irAngular
    /* QA2: the infrared emitters this sensor sees this frame (BR-RoLE draws them): yours (src: the lens; none when null),
     * then every other camcorder's.  Nothing at all without this player's sensor on */
    irLights(src) {
      const out = []; if (!nvNow()) return out; const L = irNow();
      if (L && src && Number.isFinite(src.x + src.y)) out.push({ x: src.x, y: src.y, angle: src.angle || 0, lvl: L, P: CFG.IR[L], own: true });
      const P = window.__peerLights; if (P) for (const p of P) if (p && p.ir > 0 && !p.dead && CFG.IR[p.ir] && Number.isFinite(p.x + p.y)) out.push({ x: p.x, y: p.y, angle: p.angle || 0, lvl: p.ir, P: CFG.IR[p.ir], own: false });
      return out;
    },
    /* infrared at a point from this player's emitter and every other camcorder's (only meaningful while this sensor is on) */
    irAt(x, y) {
      if (!nvNow()) return 0; let v = 0; const A = window.__api;
      const L = irNow(); if (L && A && A.beam) { const b = A.beam() || A.H; if (b) v = irFrom({ x: b.x, y: b.y, angle: b.angle ?? A.H.angle }, L, x, y); }
      const P = window.__peerLights; if (P) for (const p of P) if (p.ir > 0 && !p.dead) v = Math.max(v, irFrom(p, p.ir, x, y));
      return v;
    },
    /* the bundle's readability under NV: visible light amplified by the sensor, infrared where it really falls, distant detail washed out by a flooded sensor */
    nvRead(x, y, a, dist) {
      let v = Math.max(Math.min(.9, a * CFG.SENSOR_GAIN), this.irAt(x, y));
      if (S.bloom > .01) v *= 1 - .7 * S.bloom * ss(120, 300, dist);
      return v;
    },
    irDraw(mk, src) { if (irNow() && !brIR()) drawFan(mk, src, irNow()); },
    peerIR(mk, p) { if (nvNow() && p.ir > 0 && !p.dead && !brIR()) drawFan(mk, { x: p.x, y: p.y, angle: p.angle }, p.ir); },
    lampGain() { return nvNow() ? CFG.SENSOR_GAIN : 1; },
    cycleIR() {
      if (!S.active || !playing()) return;
      S.ir = (S.ir + 1) % 3; snd.click(S.ir > 0);
      if (S.locked && S.ir) say('IR EMITTER OVERHEATED', false, 1.4); else say('IR ' + (S.ir ? CFG.IR[S.ir].name : 'OFF'), true, 1);
    },
    get raised() { return raised(); },
    get zoomCur() { return S.zoomCur; },
    get heat() { return S.heat; },
    get locked() { return S.locked; },
    get stage() { return stage(); },
    shakeX(t) { return S.shakeAmp * (Math.sin(t * 9.7) * .6 + Math.sin(t * 23.1 + 1.3) * .4) + (S.glitchT > 0 ? (Math.random() - .5) * 10 : 0); },
    shakeY(t) { return S.shakeAmp * (Math.cos(t * 8.3 + .7) * .6 + Math.sin(t * 19.7) * .4) * .8; },

    /* Per-entity night-vision behaviour. Nothing is registered by default, so entities look exactly as
       the game already draws them. Register props for any entity kind (string key used by the bundle):
         onlyNV:true      visible only while NV is on           obscure:0..1  harder to make out
         gain:n           brighter (>1) / darker (<1)           distort:0..1  wobble / skew
         interfere:0..1   camera interference bands            static:0..1   extra grain
         glitch:0..1      recording glitches / tearing
       e.g.  __cam.registerFx('hound', { gain: 1.25 })                                               */
    registerFx(kind, props) { if (props) FX[kind] = Object.assign({}, props); else delete FX[kind]; },
    fx(kind) { return FX[kind] || null; },
    touch(f, a) {
      const w = clamp((a - .2) / .6, 0, 1);
      if (f.interfere) S.interfere = Math.max(S.interfere, f.interfere * w);
      if (f.static) S.stat = Math.max(S.stat, f.static * w);
      if (f.glitch && Math.random() < f.glitch * w * Math.min(.1, S.dt) * 8) glitchBurst(.12 + Math.random() * .15);
    },

    /* F key / touch LIGHT button: bundle toggles its own `au`, we only give feedback */
    toggled(kind, on) {
      if (kind === 'camcorder') { on ? snd.raise() : snd.lower(); if (on) { S.hints < 2 && (S.hint = 6, S.hints++); } else S.zoomIdx = 0; }
      else if (kind === 'lantern') snd.thunk(on);
      else if (kind === 'headlamp') snd.soft(on);
      else snd.click(on);
    },
    reset() { S.heat = 0; S.locked = false; S.lockT = 0; S.nvOn = true; S.ir = CFG.IR_DEFAULT; S.bloom = 0; S.zoomIdx = 0; S.interfere = S.stat = 0; S.rec = 0; },

    toggleNV() {
      if (S.kind !== 'camcorder' || !playing()) return;
      if (!S.active) {                       // lowered camcorder: N raises it with NV armed
        S.nvOn = true; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF', key: 'f' })); return;
      }
      S.nvOn = !S.nvOn;
      S.nvOn ? snd.nvOn() : snd.nvOff();
      if (S.nvOn && S.locked && S.ir) say('IR EMITTER OVERHEATED', false, 1.6);
    },
    cycleZoom() {
      if (!S.active || !playing()) return;
      S.zoomIdx = (S.zoomIdx + 1) % CFG.ZOOM_LEVELS.length; snd.zoom();
    },
    setZoom(dir) {
      if (!S.active) return; const n = clamp(S.zoomIdx + dir, 0, CFG.ZOOM_LEVELS.length - 1);
      if (n !== S.zoomIdx) { S.zoomIdx = n; snd.zoom(); }
    },

    /* called every frame by the bundle. active = camcorder equipped, raised and the game is running */
    tick(dt, active, kind) {
      dt = Math.min(dt || 0, .1); S.dt = dt; S.t += dt; S.kind = kind;
      const was = S.active; S.active = !!active && kind === 'camcorder';
      if (was && !S.active) S.zoomIdx = 0;
      const nvOn = nvNow(), z = CFG.ZOOM_LEVELS[S.zoomIdx] || 1;

      // --- heat model (v23): the IR emitter makes the heat, by its power; the sensor alone does not ---
      const ir = irNow();
      if (dt > 0) {
        if (ir) {
          S.heat += CFG.IR[ir].heat * (CFG.ZOOM_HEAT_MULT[S.zoomIdx] || 1) * dt;
          if (S.heat >= CFG.NV_MAX_HEAT) { S.heat = CFG.NV_MAX_HEAT; S.locked = true; S.lockT = CFG.NV_OVERHEAT_LOCKOUT; snd.shutdown(); say('IR EMITTER OVERHEATED', false, 3.2); glitchBurst(.45); }
        } else {
          S.heat = Math.max(0, S.heat - CFG.NV_COOL_RATE * dt);
        }
        if (S.locked) {
          S.lockT -= dt;
          if (S.lockT <= 0 && S.heat <= CFG.NV_REENABLE_THRESHOLD) { S.locked = false; if (S.active && S.nvOn && S.ir) { snd.ready(); say('IR ONLINE', true, 1.6); } }
        }
        // overexposure: the emitter's core hitting a surface close to the lens floods the sensor (eased, so a sweep past a pillar is a flash, not a strobe)
        let tgt = 0; const IRc = CFG.IR[irNow()], A0 = window.__api;
        if (IRc && A0 && A0.Uc && A0.beam) { const b = A0.beam() || A0.H; if (b) { const d0 = A0.Uc(b.x, b.y, b.angle ?? A0.H.angle, IRc.bloomR + 5); tgt = clamp((IRc.bloomR - d0) / (IRc.bloomR - 22), 0, 1) * IRc.bloom; } }
        S.bloom += (tgt - S.bloom) * (1 - Math.exp(-dt / (tgt > S.bloom ? .16 : .45)));
      }
      const st = stage(), f = frac();

      // --- zoom / shake easing ---
      const zt = S.active ? z : 1;
      S.zoomCur += (zt - S.zoomCur) * (1 - Math.exp(-CFG.ZOOM_EASE * dt));
      let amp = 0;
      if (S.active) amp = CFG.SHAKE_BASE + CFG.SHAKE_ZOOM * (S.zoomCur - 1) / 3 + (nvOn ? (st >= 3 ? 1.6 : st === 2 ? .6 : 0) : 0) + S.interfere * 2;
      S.shakeAmp += (amp - S.shakeAmp) * (1 - Math.exp(-6 * dt));
      S.interfere = Math.max(0, S.interfere - dt * 1.2); S.stat = Math.max(0, S.stat - dt * 1.2); S.glitchT = Math.max(0, S.glitchT - dt);
      if (S.active && nvOn && st === 3 && dt > 0 && Math.random() < dt * .8) glitchBurst(.08 + Math.random() * .12);
      if (S.active) S.rec += dt;

      // --- audio warning: whine past the noisy stage while NV is drawing heat ---
      whine(irNow() && st >= 2 ? clamp((f - CFG.STAGE_NOISY) / (1 - CFG.STAGE_NOISY), .05, 1) : 0);

      // --- DOM state ---
      const b = document.body; if (!b) return;
      b.classList.toggle('cam-kind', kind === 'camcorder');
      b.classList.toggle('cam-raised', S.active);
      b.classList.toggle('cam-nv', S.active && nvOn);
      bloomEl.style.opacity = S.active && nvOn ? (S.bloom * .5).toFixed(3) : '0';      // (lowered / NV off: gone at once, not left over)
      if (!S.active || !nvOn) S.bloom = 0;
      if (!S.active) { if (S.msgT > 0) { S.msgT = 0; const m = $('camMsg'); m && m.classList.remove('on'); } return; }
      if (S.msgT > 0) { S.msgT -= dt; if (S.msgT <= 0) { const m = $('camMsg'); m && m.classList.remove('on'); } }
      if (S.hint > 0) { S.hint -= dt; const h = $('camHint'); h && h.classList.toggle('on', S.hint > 0); }
      // brightness flicker when unstable
      const flick = nvOn ? (st >= 3 ? .78 + Math.random() * .5 : st === 2 ? .94 + Math.random() * .12 : 1) : 1;
      fx.style.setProperty('--b', (CFG.NV_BRIGHTNESS * flick * (1 + .28 * S.bloom)).toFixed(2));
      this._hud(st, z);
      this._grain(nvOn, st, z);
      // recording tear
      if (S.glitchT > 0) { tear.style.display = 'block'; tear.style.top = (Math.random() * 100).toFixed(1) + '%'; tear.style.height = (6 + Math.random() * 26 | 0) + 'px'; tear.style.transform = 'translateX(' + ((Math.random() - .5) * 30 | 0) + 'px)'; }
      else if (tear.style.display !== 'none') tear.style.display = 'none';
    },
    _hud(st, z) {
      const s = Math.floor(S.rec), rec = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      const set = (id, txt) => { const e = $(id); if (e && e.textContent !== txt) e.textContent = txt; };
      set('camRec', rec); set('camZoom', 'ZOOM ' + z.toFixed(1) + 'x');
      const nv = $('camNv'); if (nv) {
        const txt = !S.nvOn ? 'NV OFF' : 'NV ON · IR ' + (!S.ir ? 'OFF' : S.locked ? 'HOT' : CFG.IR[S.ir].name);
        if (nv.textContent !== txt) nv.textContent = txt; nv.classList.toggle('off', !S.nvOn); nv.classList.toggle('lock', S.locked && S.nvOn && !!S.ir);
      }
      const seg = frac() <= 0 ? 0 : Math.min(5, Math.ceil(frac() * 5 - 1e-6)), bar = '▮'.repeat(seg) + '▯'.repeat(5 - seg);
      const tp = $('camTemp'); if (tp) { const bb = tp.firstElementChild; if (bb && bb.textContent !== bar) bb.textContent = bar; tp.classList.toggle('warn', seg >= 4 && seg < 5 || (seg === 5 && !S.locked)); tp.classList.toggle('hot', S.locked); }
    },
    _grain(nvOn, st, z) {
      S._gT = (S._gT || 0) + S.dt; if (S._gT < 1 / 22) return; S._gT = 0;
      let inten = nvOn ? [CFG.GRAIN_CLEAN, CFG.GRAIN_SLIGHT, CFG.GRAIN_NOISY, CFG.GRAIN_UNSTABLE, CFG.GRAIN_UNSTABLE][st] : .04;
      inten += (S.zoomIdx * .035) + S.stat * .3 + S.interfere * .15;
      const d = gimg.data, W = grain.width, H = grain.height, k = 255 * clamp(inten, 0, .7);
      const bands = nvOn && (st >= 2 || S.interfere > .1);
      const roll = st >= 3 && nvOn ? ((S.t * 60) % (H + 20)) - 10 : -99;
      for (let y = 0; y < H; y++) {
        let m = 1, off = 0;
        if (bands && ((y * 7 + (S.t * 30 | 0)) % 43) < (st >= 3 ? 4 : 2) && Math.random() < .5) m = 2.4;
        if (Math.abs(y - roll) < 3) { m = 3; off = 60; }
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4, v = Math.random() * 255 + off;
          d[i] = v * .78; d[i + 1] = v; d[i + 2] = v * .78; d[i + 3] = Math.random() * k * m;
        }
      }
      gctx.putImageData(gimg, 0, 0);
    },
  };

  /* ---------------------------------------------------------------- input */
  window.addEventListener('keydown', e => {
    if (e.repeat || typing(e) || S.kind !== 'camcorder' || !playing()) return;
    if (e.code === 'KeyN') { api.toggleNV(); }
    else if (e.code === 'KeyZ' && S.active) api.cycleZoom();
    else if (e.code === 'KeyB' && S.active) api.cycleIR();
  });
  window.addEventListener('wheel', e => {
    if (!S.active || !playing()) return;
    if (e.target && e.target.closest && e.target.closest('#inventory,#settings,#adminPanel,#appearancePanel,#mapPanel')) return;
    e.preventDefault(); const now = performance.now(); if (now - S.lastWheel < 140) return; S.lastWheel = now; api.setZoom(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  window.addEventListener('contextmenu', e => { if (S.active && playing()) { e.preventDefault(); api.toggleNV(); } });
  window.addEventListener('blur', () => { whine(0); });
})();
