/* src/frameworks/front/client/voice.js -> public/assets/voice.js - F.R.O.N.T.: the wanderers' voices (post-Trial 4 chat polish C4;
 * docs/architecture/CHAT.md, "Voices").
 *
 * Not recorded speech, not text-to-speech, not voice chat: a short synthesized chirp for the graphemes of a nearby line as its bubble
 * writes it out, in the speaker's own voice.  Every voice is made here with Web Audio (no sound file, no library, nothing recorded or
 * downloaded, nothing taken from any game): a small oscillator, a filter and an envelope per chirp, some voices with a little shared
 * noise.  Seven presets, all original: Classic, Soft, Deep, Electronic, Static, Hollow, Chime.
 *
 * The speaker owns the voice: its preset, pitch (-12..12 semitones) and speed (50..200 %) are saved here (tfb.voice.v1) and sent with
 * each of its lines ({t:'say', ..., v:{p, h, s}}); the server checks them (B++'s speech.js: a known preset, whole numbers in range, or
 * nothing) and passes them on with the line it accepted, so every listener hears the speaker's voice, never its own.  The listener owns
 * the hearing: voices on or off and their volume (Settings -> Sound, the composer's Options), the game's master volume and mute, and
 * its per-speaker mutes (chat.js does not ask for a muted speaker's voice at all).  A line without a voice (a page from before) is heard
 * in the default voice.
 *
 * Timing: the chirps follow the bubble's writing schedule (chat.js's typeSchedule: the same graphemes, pauses and speed), one chirp for
 * a letter, a digit or an emoji, none for a space or a mark, and never closer than a gap (so a fast speaker chirps every other step).  A
 * timer (every 40 ms, only while a voice speaks) schedules what falls in the next 350 ms on the audio clock (so a busy page whose timer
 * runs late still keeps its voices); anything already more than 100 ms late is dropped, never played in a burst.  So only a few chirps
 * are ever waiting (about six a voice), and stopping a voice (a newer line from the
 * same speaker, a mute, the speaker gone, the run over) stops them at once.  At most two voices speak together (the newest); the bus
 * has a compressor and a ceiling, so nothing peaks.  Text never waits for sound: a page whose audio is not yet allowed (the browser's
 * autoplay rule) shows the bubbles as always and starts its voices after the player's next key or tap.
 *
 * Customize -> Wanderer gets a Voice section (the presets, pitch, speed, Preview with a typed sample line, Reset voice).
 *
 * Hooks: window.__voice = { presets(), prefs(), set(o), reset(), mine() (the {p,h,s} sent with my lines), meta(v, id) (a received voice (Trial 3: an entity's key gets the entity voice),
 * checked), say(id, v, sch, at), stop(id), stopAll(), ids() (the speakers whose voice is on), place(id, gain, pan), preview(), stats()
 * (for the checks), on(f) (a change of the saved voice or hearing), chirp(ctx, dest, when,
 * preset, semis, salt, level) (one chirp into any audio context: the checks render it offline) }.  Reads window.__settings (the master
 * volume) and window.__api (the game's mute).  Nothing is sent from here; nothing about a line is kept. */
(() => {
  'use strict';
  if (window.__voice) return;
  const KEY = 'tfb.voice.v1';
  const PRESETS = [
    ['classic', 'Classic', 'Rounded, even chirps. The default.'],
    ['soft', 'Soft', 'Gentle and breathy, a little higher.'],
    ['deep', 'Deep', 'Low, resonant pulses.'],
    ['electronic', 'Electronic', 'Clipped and synthetic, falling at each step.'],
    ['static', 'Static', 'Faint and crackling, like a bad radio.'],
    ['hollow', 'Hollow', 'Airy and far away. Uneasy.'],
    ['chime', 'Chime', 'Light, glassy and ringing.'],
  ];
  const IDS = PRESETS.map(p => p[0]);
  const PITCH = [-12, 12], SPEED = [50, 200];                            // the server checks the same ranges (speech.js)
  const DEF = { preset: 'classic', pitch: 0, speed: 100, on: true, vol: 70 };
  // each voice: base frequency (Hz), wave, length (s), attack (s), filter (lowpass lp, bandpass bp, or a bandpass on the note itself
  // times bpx; its Q), the steps (semitones) its
  // chirps move between, level, and its extras: noise (crackle), breath (soft noise), glide (octaves over the chirp), bell (a partial)
  const SYN = {
    classic: { base: 300, wave: 'square', dur: .055, att: .004, lp: 1900, q: .7, steps: [0, 2, 4, 5, 7], level: .11 },
    soft: { base: 500, wave: 'triangle', dur: .075, att: .014, lp: 2600, q: .5, steps: [0, 3, 5, 7], level: .15, breath: .05 },
    deep: { base: 118, wave: 'sawtooth', dur: .085, att: .006, lp: 620, q: 1.2, steps: [0, 2, 3, 5], level: .17 },
    electronic: { base: 410, wave: 'square', dur: .05, att: .002, lp: 3200, q: 4, steps: [0, 7, 12, 5], level: .09, glide: -.35 },
    static: { base: 260, wave: 'square', dur: .05, att: .002, bp: 1800, q: 1.2, steps: [0, 1, 3], level: .3, noise: .9 },
    hollow: { base: 220, wave: 'sine', dur: .11, att: .022, bpx: 1, q: 1.4, steps: [0, 3, 6, 8], level: .09, breath: .12, glide: .04 },
    chime: { base: 880, wave: 'sine', dur: .16, att: .002, lp: 6000, q: .5, steps: [0, 4, 7, 11], level: .11, bell: 2.76 },
    // (Trial 3) the entity voice: not a preset (no row in PRESETS: nobody can choose it, the server never accepts it from a person); meta
    // gives it only to an entity's key ('e' + id, chat.js's eheard).  Low, breathy, sliding down, its steps a little off key
    mimic: { base: 196, wave: 'triangle', dur: .1, att: .012, lp: 1300, q: .9, steps: [0, -1, 1, 6, 0], level: .12, breath: .08, glide: -.06 },
  };
  const LOOK = .35, LATE = .1, TICK = 40, GAP = .055, MAXV = 2, MAXCHIRPS = 90;
  const clamp = (v, a, z) => Math.max(a, Math.min(z, v));
  const int = (v, a, z, d) => Number.isInteger(v) && v >= a && v <= z ? v : d;
  const S = (() => {                                                     // the saved voice and hearing (nothing else is saved)
    const d = Object.assign({}, DEF);
    let r = null; try { r = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { }
    if (r && r.v === 1) {
      if (IDS.includes(r.preset)) d.preset = r.preset;
      d.pitch = int(r.pitch, PITCH[0], PITCH[1], DEF.pitch); d.speed = int(r.speed, SPEED[0], SPEED[1], DEF.speed);
      if (typeof r.on === 'boolean') d.on = r.on; d.vol = int(r.vol, 0, 100, DEF.vol);
    }
    return d;
  })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(Object.assign({ v: 1 }, S))); } catch (e) { } };
  const subs = new Set();
  const changed = () => { save(); bus(); subs.forEach(f => { try { f(); } catch (e) { } }); };
  // a received voice, checked again here (the server already did): a known preset and whole numbers in range, or the default voice
  const meta = (v, id) => {
    if (typeof id === 'string' && /^e\d+$/.test(id) && v && typeof v === 'object' && v.p === 'mimic') return { p: 'mimic', h: int(v.h, PITCH[0], PITCH[1], 0), s: int(v.s, SPEED[0], SPEED[1], 100) };   // (Trial 3) an entity's line
    if (!v || typeof v !== 'object' || !IDS.includes(v.p)) return { p: DEF.preset, h: DEF.pitch, s: DEF.speed };
    return { p: v.p, h: int(v.h, PITCH[0], PITCH[1], 0), s: int(v.s, SPEED[0], SPEED[1], 100) };
  };

  /* ---------------------------------------------------------------- the sound */
  let ctx = null, out = null, noiseBuf = null, unlockArmed = false;
  const master = () => { const s = window.__settings && window.__settings.get ? window.__settings.get() : null; return s && typeof s.vol === 'number' ? clamp(s.vol, 0, 1) : 1; };
  const gameMuted = () => { try { const Z = window.__api && window.__api.audio && window.__api.audio(); return !!(Z && Z.muted); } catch (e) { return false; } };
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return null; }
      const comp = ctx.createDynamicsCompressor();                       // nothing peaks: a soft compressor, then a ceiling
      comp.threshold.value = -20; comp.knee.value = 8; comp.ratio.value = 8; comp.attack.value = .003; comp.release.value = .12;
      out = ctx.createGain(); out.connect(comp); comp.connect(ctx.destination);
      noiseBuf = noise(ctx);
      bus();
    }
    if (ctx.state === 'suspended') { ctx.resume().catch(() => { }); armUnlock(); }
    return ctx;
  }
  function armUnlock() {                                                 // the browser's autoplay rule: the next key or tap lets it play
    if (unlockArmed) return; unlockArmed = true;
    const go = () => { unlockArmed = false; for (const ev of ['keydown', 'pointerdown', 'touchend']) removeEventListener(ev, go, true); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { }); };
    for (const ev of ['keydown', 'pointerdown', 'touchend']) addEventListener(ev, go, true);
  }
  function noise(c) {                                                    // a fixed noise (deterministic), made once per audio context
    const n = Math.floor(c.sampleRate * .4), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let x = 0x9e3779b9;
    for (let i = 0; i < n; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; d[i] = ((x >>> 0) / 4294967296) * 2 - 1; }
    return b;
  }
  function bus() { if (out) out.gain.setTargetAtTime(gameMuted() ? 0 : (S.vol / 100) * master() * .9, ctx.currentTime, .03); }
  // one chirp at `when` into `dest`: its source nodes, to stop early
  function chirp(c, dest, when, id, semis, salt, level) {
    const P = SYN[id] || SYN.classic, f = P.base * Math.pow(2, (semis + P.steps[salt % P.steps.length]) / 12), end = when + P.dur;
    const env = c.createGain(); env.gain.setValueAtTime(0, when); env.gain.linearRampToValueAtTime(P.level * level, when + P.att); env.gain.exponentialRampToValueAtTime(.0001, end);
    const flt = c.createBiquadFilter(); flt.type = P.bp || P.bpx ? 'bandpass' : 'lowpass'; flt.frequency.value = P.bpx ? f * P.bpx : P.bp ? P.bp * Math.pow(2, semis / 24) : P.lp; flt.Q.value = P.q;
    flt.connect(env); env.connect(dest);
    const src = [], osc = (freq, type, gain) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, when);
      if (P.glide) o.frequency.exponentialRampToValueAtTime(freq * Math.pow(2, P.glide), end);
      let n = o; if (gain !== 1) { const g = c.createGain(); g.gain.value = gain; o.connect(g); n = g; } n.connect(flt); o.start(when); o.stop(end + .02); src.push(o); };
    osc(f, P.wave, 1);
    if (P.bell) osc(f * P.bell, 'sine', .35);
    const nz = (P.noise || 0) + (P.breath || 0);
    if (nz) {
      const buf = c === ctx ? noiseBuf : (c.__noise || (c.__noise = noise(c))), b = c.createBufferSource(), g = c.createGain(); b.buffer = buf; g.gain.value = nz * (P.noise ? 1.4 : 1);
      b.connect(g); g.connect(flt); b.start(when, (salt * .0137) % (buf.duration - .2), P.dur + .02); src.push(b);
    }
    return src;
  }

  /* ---------------------------------------------------------------- speaking: a voice per speaker, following its line's schedule */
  const V = new Map();                                                   // speaker id -> { m, sch, t0, i, last, nodes, voice, pan, born }
  const st = { scheduled: 0, late: 0, stopped: 0, cut: 0, said: 0, capped: 0, previews: 0 };
  let timer = 0;
  const VOICED = /[\p{L}\p{N}\p{Extended_Pictographic}]/u;
  function say(id, v, sch, at) {                                         // at: the line's arrival (performance.now)
    stop(id);
    if (!sch || !sch.n || !S.on) return false;
    const c = ensure(); if (!c) return false;
    bus();
    const m = meta(v, id), g = c.createGain(), pan = c.createStereoPanner ? c.createStereoPanner() : null;
    g.gain.value = 1; if (pan) { g.connect(pan); pan.connect(out); } else g.connect(out);
    V.set(id, { m, sch, t0: c.currentTime - (performance.now() - at) / 1000, i: 0, last: -1, nodes: [], voice: g, pan, born: performance.now(), n: 0 });
    st.said++;
    while (V.size > MAXV) { const old = V.keys().next().value; stop(old); st.capped++; }   // at most two speak together: the newest
    if (!timer) timer = setInterval(tick, TICK);
    tick(); return true;
  }
  function tick() {
    if (!ctx || !V.size) { clearInterval(timer); timer = 0; return; }
    if (ctx.state !== 'running') return;                                // (waiting for the next key or tap)
    const now = ctx.currentTime;
    for (const [id, u] of V) {
      u.nodes = u.nodes.filter(n => n.__end > now);
      const { at, g, n } = u.sch;
      while (u.i < n) {
        const when = u.t0 + at[u.i] / 1000;
        if (when > now + LOOK) break;
        const i = u.i++;
        if (!VOICED.test(g[i])) continue;                                 // no chirp for a space or a mark
        if (when < now - LATE) { st.late++; continue; }                   // too late: dropped, never a burst
        if (u.last >= 0 && when - u.last < GAP) continue;                 // never closer than the gap
        if (u.n >= MAXCHIRPS) continue;
        const salt = (g[i].codePointAt(0) || 0) + i * 7;
        for (const s of chirp(ctx, u.voice, Math.max(when, now), u.m.p, u.m.h, salt, 1)) { s.__end = Math.max(when, now) + .3; u.nodes.push(s); }
        u.last = when; u.n++; st.scheduled++;
      }
      if (u.i >= n && !u.nodes.length) V.delete(id);
    }
  }
  function stop(id) {
    const u = V.get(id); if (!u) return; V.delete(id);
    const t = ctx ? ctx.currentTime : 0;
    for (const s of u.nodes) { try { s.stop(t); } catch (e) { } }
    if (u.i < u.sch.n || u.nodes.length) st.stopped++;                 // a line cut short (its waiting chirps stopped, the rest never scheduled)
    st.cut += u.nodes.length;
    setTimeout(() => { try { u.voice.disconnect(); if (u.pan) u.pan.disconnect(); } catch (e) { } }, 400);
  }
  const stopAll = () => { for (const id of [...V.keys()]) if (id !== 'preview') stop(id); };   // (Customize's preview is its own)
  const ids = () => { if (!V.size) return NONE; const a = []; for (const id of V.keys()) if (id !== 'preview') a.push(id); return a; };
  const NONE = Object.freeze([]);
  // where the speaker is: a little quieter with distance (to 576 px), panned toward its side
  function place(id, gain, pan) {
    const u = V.get(id); if (!u || !ctx) return;
    const gv = clamp(gain, .2, 1), pv = clamp(pan, -.8, .8);
    if (Math.abs(gv - u.gv) > .04 || u.gv === undefined) { u.voice.gain.setTargetAtTime(gv, ctx.currentTime, .08); u.gv = gv; }
    if (u.pan && (Math.abs(pv - u.pv) > .04 || u.pv === undefined)) { u.pan.pan.setTargetAtTime(pv, ctx.currentTime, .08); u.pv = pv; }
  }
  // hearing follows the game's own volume (Settings, hud.js: loaded after this script, so subscribed at start) and its mute (checked
  // each second while a voice speaks)
  setInterval(() => { if (ctx && V.size) bus(); }, 1000);

  /* ---------------------------------------------------------------- Customize -> Wanderer: the Voice section */
  const SAMPLE = 'Hello? Is anyone else down here...';
  let ui = null, pv = null;
  const mk = (tag, cls, text, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (attrs) for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k]); return e; };
  function mount() {
    const opts = document.querySelector('#czWanderer .cz-opts'); if (!opts || ui) return;
    const f = mk('div', 'cz-field vx', null, { id: 'czVoice', role: 'group', 'aria-labelledby': 'czVoiceL' });
    const lab = mk('span', 'cz-label', 'Voice', { id: 'czVoiceL' });
    const chips = mk('div', 'cz-chips vx-presets', null, { role: 'radiogroup', 'aria-label': 'Voice', id: 'vxPresets' });
    for (const [id, name, about] of PRESETS) chips.append(mk('button', 'cz-chip', name, { type: 'button', role: 'radio', 'data-voice': id, title: about }));
    const about = mk('p', 'vx-about', '', { id: 'vxAbout' });
    const row = (id, name, min, max, step) => { const l = mk('label', 'vx-row'); const i = mk('input', null, null, { type: 'range', id, min: String(min), max: String(max), step: String(step), 'aria-label': 'Voice ' + name.toLowerCase() });
      l.append(mk('span', null, name), i, mk('output', null, '', { 'aria-hidden': 'true', id: id + 'V' })); return [l, i]; };
    const [pl, pitch] = row('vxPitch', 'Pitch', PITCH[0], PITCH[1], 1), [sl, speed] = row('vxSpeed', 'Speed', SPEED[0], SPEED[1], 10);
    const acts = mk('div', 'vx-actions');
    const play = mk('button', 'u-btn vx-play', 'Preview', { type: 'button', id: 'vxPreview' }), reset = mk('button', 'u-btn ghost vx-reset', 'Reset voice', { type: 'button', id: 'vxReset' });
    acts.append(play, reset);
    const sample = mk('p', 'vx-sample', null, { 'aria-hidden': 'true', id: 'vxSample' }), said = mk('span', 'vx-said'), yet = mk('span', 'vx-yet', SAMPLE); sample.append(said, yet);
    f.append(lab, chips, about, pl, sl, acts, sample);
    opts.append(f);
    ui = { f, chips, about, pitch, speed, play, reset, said, yet };
    chips.addEventListener('click', e => { const b = e.target.closest('[data-voice]'); if (!b) return; S.preset = b.dataset.voice; changed(); paint(); preview(); });
    chips.addEventListener('keydown', e => {                             // arrows move the choice (roving focus, as the other chips)
      const d = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0; if (!d) return;
      const l = [...chips.querySelectorAll('[data-voice]')], i = l.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault(); const n = l[(i + d + l.length) % l.length]; n.focus(); n.click();
    });
    pitch.addEventListener('input', () => { S.pitch = int(+pitch.value, PITCH[0], PITCH[1], 0); changed(); paint(); });
    speed.addEventListener('input', () => { S.speed = int(+speed.value, SPEED[0], SPEED[1], 100); changed(); paint(); });
    for (const i of [pitch, speed]) i.addEventListener('change', () => preview());
    play.addEventListener('click', () => preview());
    reset.addEventListener('click', () => { S.preset = DEF.preset; S.pitch = DEF.pitch; S.speed = DEF.speed; changed(); paint(); });
    paint();
  }
  function paint() {
    if (!ui) return;
    for (const b of ui.chips.querySelectorAll('[data-voice]')) { const on = b.dataset.voice === S.preset; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
    ui.about.textContent = (PRESETS.find(p => p[0] === S.preset) || PRESETS[0])[2];
    ui.pitch.value = String(S.pitch); ui.speed.value = String(S.speed);
    document.getElementById('vxPitchV').textContent = (S.pitch > 0 ? '+' : '') + S.pitch;
    document.getElementById('vxSpeedV').textContent = S.speed + '%';
    ui.reset.disabled = S.preset === DEF.preset && S.pitch === DEF.pitch && S.speed === DEF.speed;
  }
  // Preview: the sample line written out in the chosen voice (heard even with voices off: it was asked for)
  function preview() {
    const T = window.__chat && window.__chat.typeSchedule; if (!T || !ui) return;
    const sch = T(SAMPLE, S.speed), was = S.on; S.on = true; const ok = say('preview', mine(), sch, performance.now()); S.on = was; st.previews++;
    const t0 = performance.now(); cancelAnimationFrame(pv);
    const step = () => { const e = performance.now() - t0; let k = 0; while (k < sch.n && sch.at[k] <= e) k++;
      const cut = k ? sch.off[k - 1] : 0; ui.said.textContent = SAMPLE.slice(0, cut); ui.yet.textContent = SAMPLE.slice(cut);
      if (k < sch.n && ui.f.isConnected) pv = requestAnimationFrame(step); };
    step(); return ok;
  }
  const mine = () => ({ p: S.preset, h: S.pitch, s: S.speed });

  window.__voice = {
    presets: () => PRESETS.map(p => p.slice()), prefs: () => Object.assign({}, S),
    set(o) { if (!o) return; if (typeof o.on === 'boolean') { S.on = o.on; if (!S.on) stopAll(); } if (o.vol !== undefined) S.vol = int(Math.round(+o.vol), 0, 100, S.vol);
      if (IDS.includes(o.preset)) S.preset = o.preset; if (o.pitch !== undefined) S.pitch = int(+o.pitch, PITCH[0], PITCH[1], S.pitch); if (o.speed !== undefined) S.speed = int(+o.speed, SPEED[0], SPEED[1], S.speed);
      changed(); paint(); },
    reset() { S.preset = DEF.preset; S.pitch = DEF.pitch; S.speed = DEF.speed; changed(); paint(); },
    on: f => { subs.add(f); return () => subs.delete(f); },
    mine, meta, say, stop, stopAll, ids, place, preview,
    stats: () => Object.assign({ ctx: ctx ? ctx.state : 'none', level: out ? +out.gain.value.toFixed(3) : null, speaking: [...V].map(([id, u]) => ({ id, p: u.m.p, h: u.m.h, s: u.m.s, chirps: u.n })) }, st),
    chirp,
  };
  const start = () => { mount(); if (window.__settings && window.__settings.on) try { window.__settings.on(() => { if (ctx) bus(); }); } catch (e) { } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
