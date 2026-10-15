/* dev/tools/gate/golden/bundle_scenes.js - the scenes bundle_diff.js plays on both builds of the compiled client (development only).
 * Each step: ['frames', n, { careful, until }] steps n frames (records compared; careful: one at a time, the page quiet before each);
 * ['key', code, 'down'|'up'|'press']; ['mouse', x, y]; ['click', selector]; ['fill', selector, text]; ['eval', code] (its result must be
 * the same on both sides); ['shot', name] (PNG and every element's computed style); ['ws', 'open'|'close'|'msg'|'mode', arg].
 * The page runs offline (no server: the bundle's own Hound and Smilers move). A scene may move the game on with window.__api (as the
 * page's scripts do): a teleport (tp), the Hound's grace, the next blackout; both sides get the same. */
'use strict';
const toMenu = [['frames', 400, { careful: true, until: "window.__boot && __boot.state() === 'menu'" }], ['eval', 'window.__boot && __boot.state()'], ['frames', 30, { careful: true }]];
const toRun = name => [['eval', "window.__ui && __ui.go('play'), 'go'"], ['frames', 20, { careful: true }], ['fill', '#name', name], ['click', '#enter'],
  ['frames', 600, { careful: true, until: "window.__boot && __boot.state() === 'playing' && __api.fall() < 0" }], ['frames', 10, { careful: true }], ['eval', '__api.started() + " " + __boot.state() + " " + __api.fall()']];
const toRunBare = name => [['frames', 60, { careful: true }], ['fill', '#name', name], ['click', '#enter'], ['frames', 600, { careful: true, until: '__api.fall() < 0' }], ['frames', 10, { careful: true }], ['eval', '__api.started() + " " + __api.fall()']];
/* a floor point next to (x, y): the first clear one of four, d px off (clearPoint: __api.sl) */
const beside = (who, d = 40) => `(() => { const s = ${who}; for (const [dx, dy] of [[${d},0],[-${d},0],[0,${d}],[0,-${d}]]) if (__api.sl(s.x + dx, s.y + dy)) return __api.tp(s.x + dx, s.y + dy), (s.x + dx) + ',' + (s.y + dy); return 'none'; })()`;
const lightKind = k => `(() => { const e = document.getElementById('lightKind'); e.value = '${k}'; e.dispatchEvent(new Event('change')); return e.value + ' ' + __api.lightOn(); })()`;
module.exports = {
  bare_walk: { strip: '\\.\\/world\\.js', steps: [...toRunBare('BARE'), ['shot', 'run'],
    ['key', 'KeyW', 'down'], ['frames', 90], ['key', 'KeyW', 'up'],
    ['key', 'KeyD', 'down'], ['key', 'ShiftLeft', 'down'], ['frames', 200], ['key', 'ShiftLeft', 'up'], ['key', 'KeyD', 'up'], ['frames', 60], ['shot', 'end']] },
  menu: { steps: [...toMenu, ['shot', 'menu'], ['frames', 120]] },
  solo_walk: { steps: [...toMenu, ...toRun('HARNESS'), ['shot', 'run'],
    ['key', 'KeyW', 'down'], ['frames', 90], ['key', 'KeyW', 'up'],
    ['key', 'KeyD', 'down'], ['key', 'ShiftLeft', 'down'], ['frames', 150], ['key', 'ShiftLeft', 'up'], ['key', 'KeyD', 'up'],
    ['mouse', 900, 220], ['frames', 20], ['key', 'KeyF', 'press'], ['frames', 20], ['key', 'KeyF', 'press'], ['frames', 20],
    ['key', 'KeyM', 'press'], ['frames', 20], ['shot', 'map'], ['key', 'KeyM', 'press'], ['frames', 20],
    ['key', 'KeyS', 'down'], ['key', 'KeyA', 'down'], ['frames', 120], ['key', 'KeyS', 'up'], ['key', 'KeyA', 'up'], ['frames', 60], ['shot', 'end']] },
  /* the Hound's capture: the death sequence, the body, RETRY (a fall to a safe point), then a second capture ended by the world's
     reset (worldEnd) */
  death_hound: { steps: [...toMenu, ...toRun('HOUND'),
    ['eval', `__api.G.grace = 0, ${beside('__api.G', 30)}`], ['frames', 60, { until: '__api.G.caught' }], ['eval', '__api.G.caught + " " + __api.G.caughtBy'],
    ['frames', 90], ['shot', 'struggle'],
    ['frames', 400, { until: "!document.getElementById('caught').hidden" }], ['frames', 20], ['shot', 'caught'], ['eval', '__api.bodyCount()'],
    ['click', '#retry'], ['frames', 120], ['shot', 'respawn'], ['eval', '__api.G.caught + " " + __api.bodyCount()'],
    ['eval', `__api.G.grace = 0, ${beside('__api.G', 30)}`], ['frames', 60, { until: '__api.G.caught' }], ['frames', 60],
    ['eval', '__api.worldEnd(__api.Ic.x, __api.Ic.y) + " " + __api.bodyCount()'], ['frames', 60], ['shot', 'world_end']] },
  /* a Smiler's capture: it sees the wanderer close, pursues, kills */
  death_smiler: { steps: [...toMenu, ...toRun('SMILER'),
    ['eval', `__api.G.grace = 0, ${beside('__api.q[0]', 60)}`], ['frames', 240, { until: '__api.G.caught' }], ['eval', '__api.G.caught + " " + __api.G.caughtBy'],
    ['frames', 90], ['shot', 'struggle'],
    ['frames', 400, { until: "!document.getElementById('caught').hidden" }], ['frames', 20], ['shot', 'caught'], ['click', '#retry'], ['frames', 90], ['shot', 'respawn']] },
  /* NEW RUN in play: the vanish (its light left on the floor), the run menu, a new run's fall */
  newrun: { steps: [...toMenu, ...toRun('LEAVER'), ['frames', 30],
    ['click', '#reset'], ['frames', 60], ['shot', 'vanishing'],
    ['frames', 300, { until: "!document.getElementById('runMenu').hidden" }], ['frames', 10], ['shot', 'run_menu'],
    ['click', '#runSpawn'], ['frames', 40], ['shot', 'falling'], ['frames', 80], ['shot', 'landed'], ['eval', '__api.fall() + " " + __api.bodyCount()']] },
  /* the map panel, the four lights (the camcorder raised, night vision on) */
  gear: { steps: [...toMenu, ...toRun('GEAR'),
    ['eval', '__api.map(), __api.mapOpen()'], ['frames', 30], ['shot', 'map'], ['eval', '__api.map(), __api.mapOpen()'], ['frames', 10],
    ['mouse', 820, 300], ['eval', lightKind('lantern')], ['frames', 60], ['shot', 'lantern'],
    ['eval', lightKind('headlamp')], ['key', 'KeyW', 'down'], ['frames', 60], ['key', 'KeyW', 'up'], ['shot', 'headlamp'],
    ['eval', lightKind('camcorder')], ['frames', 30], ['key', 'KeyF', 'press'], ['frames', 60], ['shot', 'camcorder'],
    ['key', 'KeyN', 'press'], ['frames', 60], ['shot', 'night_vision'], ['key', 'KeyN', 'press'], ['key', 'KeyF', 'press'], ['frames', 20],
    ['eval', lightKind('flashlight')], ['frames', 20]] },
  /* a blackout, the win panel */
  blackout_win: { steps: [...toMenu, ...toRun('LIGHTS'),
    ['eval', '__api.V.next = __api.V.elapsed + .3, __api.V.next'], ['frames', 60], ['eval', '__api.V.blackout'], ['shot', 'blackout'],
    ['frames', 330], ['eval', '__api.V.blackout'], ['eval', '__api.win(), "won"'], ['frames', 30], ['shot', 'won'], ['eval', '__api.unwin(), "on"'], ['frames', 20]] },
  /* the customize panel from the title: hat, texture, colours, backpack in the preview */
  customize: { steps: [...toMenu, ['click', '#customize'], ['frames', 20],
    ['fill', '#avatarHat', 'hardhat'], ['fill', '#avatarTexture', 'stripes'], ['fill', '#avatarBackpack', 'utility'], ['fill', '#avatarMain', '#3366cc'], ['fill', '#avatarHands', '#c08060'],
    ['frames', 30], ['shot', 'customize'], ['click', '#doneAppearance'], ['frames', 20], ['shot', 'closed']] },
};
