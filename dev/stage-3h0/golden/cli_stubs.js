/* Stage 3H0 - recording stand-ins for the scripts index.html loads around mp.js (development only; loaded by the client harness page after
 * cli_env.js and before world.js / mp.js, never by the game).  ents.js (window.__ents), move.js (__mv), camcorder.js (__cam), sfx.js (__sfx),
 * inventory.js (__inv) and glitch.js (__glitchSound, __glitchFrame) are replaced by small deterministic recorders: what mp.js asks of them is
 * traced, and they answer the same way for the old and the new mp.js.  window.__api (the game bundle) is installed later, by each scene. */
(() => {
  'use strict';
  const rec = window.__rec, H = window.__H, watch = H.watch;
  const E = {
    houndVoice: (...a) => rec('ents.houndVoice', ...a),
    smilerVoice: (...a) => rec('ents.smilerVoice', ...a),
    setFails: a => rec('ents.setFails', a),
    slotH: (o, t, dt, pose) => { rec('ents.slotH', o.slot, o.id, t, dt, pose); const q = pose || t; o.x = q.x; o.y = q.y; o.angle = q.a; o.ls = t.s === 3 ? 'hunt' : 'patrol'; o.distance = (o.distance || 0) + 1; },
    slotS: (sm, t, dt, pose) => { rec('ents.slotS', sm.__rid, t, dt, pose); const q = pose || t; sm.x = q.x; sm.y = q.y; sm.angle = q.a; },
    entAudio: (t, hs, q) => rec('ents.entAudio', t, hs.filter(Boolean).length, q.filter(s => !s.off).length),
    setDebug: d => rec('ents.setDebug', d), setDebugX: d => rec('ents.setDebugX', d), clearDebug: () => rec('ents.clearDebug'),
    drawDebug: (cx, view) => rec('ents.drawDebug', view ? { cam: view.cam, sc: view.sc, W: view.W, H: view.H } : null),
    sfxKnock: () => rec('ents.sfxKnock'), sfxGasp: () => rec('ents.sfxGasp'), sfxRelease: () => rec('ents.sfxRelease'),
    attackSmiler: (att, now, dt) => rec('ents.attackSmiler', att && att.__rid, now, dt),
    dbg: [], fps: 59.6, navSel: 0,
  };
  E.dbgCfg = watch({ on: false }, 'dbgCfg');
  E.dbgX = watch({ ping: -1, lg: [{ t: 1, x: 'first event' }, { t: 2, x: 'second event' }], pf: { ms: .2 } }, 'dbgX');
  window.__ents = watch(E, 'ents');
  window.__mv = watch({ down: 0, dragTo: null, s: 'walk', speed: 150, surf: 'carpet', net() { rec('mv.net'); return { s: 1, sp: 150, st: 92, ex: 0, ev: [[1, 30]] }; } }, 'mv');
  window.__cam = watch({ irNet: 0 }, 'cam');
  window.__sfx = { _has: {}, has(k) { rec('sfx.has', k); return !!this._has[k]; }, play(k, o) { rec('sfx.play', k, o === undefined ? '~u' : o); return !!this._has[k]; }, loop: (...a) => rec('sfx.loop', ...a) };
  window.__inv = { _have: {}, give(id, b) { rec('inv.give', id, b); this._have[id] = true; }, has(id) { return !!this._have[id]; }, reset() { rec('inv.reset'); this._have = {}; } };
  window.__glitchSound = { burst: () => rec('glitchSound.burst') };
  window.__glitchFrame = o => rec('glitchFrame', o.p && o.p.__rid, o.cam, o.sc, o.W, o.H, o.t, o.run);
})();
