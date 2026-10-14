/** @part public/mp.js - P.O.C.K.E.T.: the cartograph, one rare item per world
 * provides: giveItem, itemsFrame, soloItem
 * uses: N, tx
 * writes: -
 */
/* ---------- the cartograph: one rare item per world, lying on the floor until somebody walks over it ---------- */
let lastPick = 0;
function giveItem(id) { if (window.__inv) window.__inv.give(id, true); }
function itemsFrame(p) {
  const list = window.__items || [], A = window.__api;
  if (!list.length || !A) return;
  const now = performance.now();
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (Math.hypot(p.x - it[0], p.y - it[1]) > 46) continue;
    if (window.__inv && window.__inv.has(it[2])) continue;               // you already carry one
    if (N.on) { if (now - lastPick > 700) { lastPick = now; tx({ t: 'pick' }); } }
    else { list.splice(i, 1); giveItem(it[2]); }
    return;
  }
}
function soloItem() {                                                    // offline: drop one somewhere far from the start
  const A = window.__api; if (!A || !A.zc || window.__itemSolo === true) return; window.__itemSolo = true;
  for (let t = 0; t < 8000; t++) {
    const tx0 = Math.random() * 96 | 0, ty0 = Math.random() * 72 | 0; if (!A.zc(tx0, ty0)) continue;
    const x = (tx0 + .5) * 96, y = (ty0 + .5) * 96; if (!A.sl(x, y) || Math.hypot(x - A.Ic.x, y - A.Ic.y) < 1800) continue;
    window.__items = [[Math.round(x), Math.round(y), 'cartograph']]; return;
  }
}

