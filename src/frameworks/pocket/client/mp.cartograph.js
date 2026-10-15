/** @part public/mp.js - P.O.C.K.E.T.: the cartograph, one rare item per world; a module: pocketCartograph
 * A module (continuation C3c, M-024): M8's part in its factory, with every write of the items' globals made its own (window.__items,
 * window.__itemSolo): the session (join, a closed connection) and N.A.N.I.'s mirror of the server's state wrote window.__items
 * themselves at M8 and now ask for it (noItems, itemsFrom); the per-frame hook's offline test - drop one when there is none - is
 * soloItems() here. It uses the session's N and tx.
 * imports: session { N tx }
 * exports: giveItem, itemsFrame, itemsFrom, noItems, soloItems
 * provides: pocketCartograph
 * uses: -
 * writes: -
 */
function pocketCartograph({ session: { N, tx } }) {
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
/* (C3c) the items' state is this module's: the others ask for its changes */
function soloItems() { if (!(window.__items && window.__items.length) && window.__itemSolo !== true) soloItem(); }   // offline, when there is none (the per-frame hook's test at M8)
const noItems = () => { window.__items = []; };
const itemsFrom = it => { window.__items = it || []; };              // the server's items, from each snapshot (N.A.N.I.'s mirror)
return { giveItem, itemsFrame, itemsFrom, noItems, soloItems };
}
