/* Stage 3B - the Level 0 presentation inventory from the shipped bundle (development only; never served).
 *
 *   node dev/stage-3b/map_report.js [roomIndex ...]     (no index: the per-room table; with indexes: ASCII maps too)
 *
 * Reads the live tables verbatim from assets/index-DKbV5Nv9.js (room table Oc, floor mask kc, lamps Fc, pillars Pc,
 * LONG ROOM columns Mc, spawn Ic) with the real world.js, exactly as the unit checks do.  ASCII: '.' floor, '#' wall,
 * L lamp, p/u low / under prop, g/w gap / window, M column, O pillar, S spawn. */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const B = fs.readFileSync(path.join(ROOT, 'assets/index-DKbV5Nv9.js'), 'utf8');
const cut = (a, b) => { const i = B.indexOf(a), j = B.indexOf(b, i); return B.slice(i, j); };
const W = require(path.join(ROOT, 'world.js'));
const ctx = vm.createContext({ window: { WORLD: W }, Math, Uint8Array, Set, Object, Array, Number, console });
vm.runInContext(cut('var FBW=96', 'var Wc={kind:') + ';\nthis.__x={FBW,FBH,kc,zc,Hc,Fc,Pc,Mc,Ic,Oc};', ctx);
const g = ctx.__x, T = 96;
let floor = 0, wall = 0, exposed = 0, corridor = 0;
const inRoom = (x, y) => g.Oc.findIndex(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
for (let y = 0; y < g.FBH; y++) for (let x = 0; x < g.FBW; x++) { if (g.zc(x, y)) { floor++; if (inRoom(x, y) < 0) corridor++; } else { wall++; if (g.zc(x + 1, y) || g.zc(x - 1, y) || g.zc(x, y + 1) || g.zc(x, y - 1)) exposed++; } }
console.log(`grid ${g.FBW} x ${g.FBH} cells of ${T} px; floor ${floor} (corridor ${corridor}); wall ${wall} (touching floor ${exposed}); lamps ${g.Fc.length}; props ${W.PROPS.length}; pillars ${g.Pc.length}; columns ${g.Mc.length}; spawn ${g.Ic.x},${g.Ic.y}`);
g.Oc.forEach((r, i) => {
  let f = 0, w = 0; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g.zc(x, y) ? f++ : w++;
  const lamps = g.Fc.map((l, j) => [j, l]).filter(([j, l]) => l.x >= r.x * T && l.x < (r.x + r.w) * T && l.y >= r.y * T && l.y < (r.y + r.h) * T).map(([j]) => j);
  const props = W.PROPS.filter(p => p.tx >= r.x && p.tx < r.x + r.w && p.ty >= r.y && p.ty < r.y + r.h).map(p => p.id + ':' + p.kind);
  console.log(`${r.code} ${r.name.padEnd(16)} cells ${r.x},${r.y} ${r.w}x${r.h}  floor ${f} wall ${w}  surface ${W.surfaceAt((r.x + .5) * T, (r.y + .5) * T, g.Oc).padEnd(8)} lamps ${lamps.length}${lamps.length ? ' [' + lamps[0] + '..' + lamps[lamps.length - 1] + ']' : ''}  props ${props.join(' ')}`);
});
for (const ri of process.argv.slice(2).map(Number)) {
  const r = g.Oc[ri], x0 = r.x - 3, x1 = r.x + r.w + 3, y0 = r.y - 3, y1 = r.y + r.h + 3;
  console.log(`\n== ${r.code} ${r.name}`);
  let hdr = '    '; for (let x = x0; x < x1; x++) hdr += x % 10 === 0 ? String(x / 10 % 10) : x % 5 === 0 ? '+' : ' '; console.log(hdr);
  for (let y = y0; y < y1; y++) { let row = String(y).padStart(3) + ' ';
    for (let x = x0; x < x1; x++) { let ch = g.zc(x, y) ? '.' : '#';
      if (g.Mc.some(m => m.x === x && m.y === y)) ch = 'M';
      if (g.Fc.some(l => Math.floor(l.x / T) === x && Math.floor(l.y / T) === y)) ch = 'L';
      for (const p of W.PROPS) if (x >= p.tx && x < p.tx + p.tw && y >= p.ty && y < p.ty + p.th) ch = { low: 'p', under: 'u', gap: 'g', window: 'w' }[p.type];
      if (g.Pc.some(p => x === Math.floor((p.x + 28) / T) && y === Math.floor((p.y + 28) / T))) ch = 'O';
      if (Math.floor(g.Ic.x / T) === x && Math.floor(g.Ic.y / T) === y) ch = 'S';
      row += ch; }
    console.log(row); }
}
