/* R20 checkpoint A: a minimal, test-only trace hook.  Installs a require hook that inserts read-only callbacks into the built
 * generated/server/ai.js of whatever tree is loaded (the source on disk is not changed).  Callbacks only read state.
 * Usage: require('./trhook.js')(TR) before requiring the tree's dev/tests/lib.js; TR = { steer(e,info), wd(e,info), tick(e,dt), lad(e,k) } */
'use strict';
const Module = require('module'), fs = require('fs');
module.exports = function install(TR) {
  globalThis.__TR = TR;
  const orig = Module._extensions['.js'];
  Module._extensions['.js'] = function (m, file) {
    if (!/generated[\/\\]server[\/\\]ai\.js$/.test(file)) return orig(m, file);
    let s = fs.readFileSync(file, 'utf8'); const n0 = s.length; let hits = 0;
    const rep = (a, b) => { const i = s.indexOf(a); if (i < 0 || s.indexOf(a, i + 1) >= 0) throw new Error('hook point not unique/absent: ' + a.slice(0, 60)); s = s.replace(a, b); hits++; };
    rep('  if (intent > .5 && e.moved < intent * .3) e.stuck += dt; else e.stuck = Math.max(0, e.stuck - dt * 1.5);',
        '  const __s0 = e.stuck; if (intent > .5 && e.moved < intent * .3) e.stuck += dt; else e.stuck = Math.max(0, e.stuck - dt * 1.5); if (globalThis.__TR) globalThis.__TR.steer(e, { intent, step, moved: e.moved, vmax, target, err, hold: !!o.hold, vcap: o.vcap, s0: __s0, eng });');
    rep('  function watchdog(e, dt) {\n    const w = e.wd;', '  function watchdog(e, dt) {\n    const w = e.wd; if (globalThis.__TR) globalThis.__TR.tick(e, dt, eng);');
    rep('    if (stuck || embedded) {', '    if (globalThis.__TR) globalThis.__TR.wd(e, { stuck, embedded, idle, eng }); if (stuck || embedded) {');
    // (R20 D3: the ladder's first line moved - a tree with W4 starts it with "const U = e.unstAt;"; the callbacks are the same)
    const L0 = s.includes('  const U = e.unstAt;\n') ? '  const U = e.unstAt;\n' : '  if (e.stuck > .35 && !e.unst) {';
    rep(L0, '  if (globalThis.__TR && e.stuck > .35 && !e.unst) globalThis.__TR.lad(e, "sidestep"); if (globalThis.__TR && e.stuck > .9) globalThis.__TR.lad(e, "replan");\n' + L0);
    m._compile(s, file); TR.patched = { hits, grow: s.length - n0 };
  };
};
