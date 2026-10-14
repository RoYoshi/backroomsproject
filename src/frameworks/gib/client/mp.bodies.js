/** @part public/mp.js - G.I.B.: everyone's bodies, one per player
 * provides: applyBodies, hasBody
 * uses: bodiesList, myId, toRec
 * writes: -
 */
/* ---------- everyone's bodies (one per player) ---------- */
const hasBody = id => bodiesList.some(b => b.k === id);
function applyBodies() { const A = window.__api; if (A && myId) A.H.id = myId; if (A && A.bodies) A.bodies(bodiesList.map(toRec)); }

