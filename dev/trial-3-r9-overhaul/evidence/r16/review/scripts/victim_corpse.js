// What the D victim's own page stores as its corpse (render.ts completeDeath spreads dphys.remains(d) into addCorpse),
// versus what the server's corpse record carries (death_srv.js corpse(): gs/gb/gh from m.gibs).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), ROOT = process.argv[2];
const win = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'generated', 'server', 'dphys.js'), 'utf8'), { window: win, Math, console });
const DP = win.__dphys;
const R = DP.simulate({ kind: 'SkinStealer', v: 'D', victim: { x: 500, y: 500, angle: .3 }, src: { x: 456, y: 500 }, eqKind: 'flashlight', hat: 'cap', walls: () => [], clear: () => true });
const localRec = JSON.parse(JSON.stringify(Object.assign({ x: R.body.x, y: R.body.y, cause: 'SkinStealer' }, R.remains)));
console.log('local corpse keys:', Object.keys(localRec).join(','));
console.log('local corpse has gb (what gore.js corpse() tests to draw halves and hide the whole body):', 'gb' in localRec);
console.log('local corpse whole body drawn at', Math.round(localRec.x), Math.round(localRec.y), '; halves rest at', JSON.stringify(R.remains.gibs.gb));
const D = require(path.join(ROOT, 'src', 'frameworks', 'gib', 'server', 'death_srv.js'));
const srv = D.bodyFor(1, { k: 'SkinStealer', v: 'D', x: 500, y: 500, a: .3, ax: 456, ay: 500 }, { name: 'v', look: 'cap|plain|#c99a76|#4a6b8a', ek: 'flashlight', ec: '#ffe7b2', ep: '', vx: 0, vy: 0, light: true }, { blockersAt: () => [], clearAt: () => true }).body;
console.log('server corpse has gb:', 'gb' in srv, JSON.stringify(srv.gb));
