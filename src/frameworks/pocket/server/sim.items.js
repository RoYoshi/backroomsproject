/* src/frameworks/pocket/server/sim.items.js - P.O.C.K.E.T. on the server: the cartograph, one rare find per world - where it lies and who
 * picks it up; a module of the sim (src/core/server/sim.js).
 * Stage 3H continuation C3 (M-024, dev/stage-3h-modernization/tools/c3_sim_modules.py): a module.  Its lines are sim.js's
 * at M8, as they were, except what that tool lists: the placement sat among L.O.S.T.'s glitched walls, the pick-up (takeItem) in
 * core's glue.
 *   simItems({ ai, walls })   returns the current items (items(): the list changes at every world reset), placeItems(), which
 *     places a new cartograph away from the glitched walls (the world reset and the admin call it where they used to assign the list
 *     themselves), and takeItem(p), the pick-up within 110 px. */
'use strict';
module.exports = function simItems({ ai: { eng, randomSpot }, walls: { glitches } }) {
/* one rare find per world: a paranormal cartograph lying somewhere in the halls (first to reach it keeps it) */
let items=[];
function makeItems(){const p=randomSpot(1800,glitches(),700,true);return p?[{id:`cartograph`,x:Math.round(p.x),y:Math.round(p.y)}]:[]}
/* (C3) a new cartograph */
const placeItems=()=>{items=makeItems()};
function takeItem(p){const i=items.findIndex(t=>Math.hypot(t.x-p.x,t.y-p.y)<110);if(i<0)return null;eng.sound({x:p.x,y:p.y,r:200,I:.4,type:`pick`,src:p.id});return items.splice(i,1)[0].id}
return { items: () => items, placeItems, takeItem };
};
