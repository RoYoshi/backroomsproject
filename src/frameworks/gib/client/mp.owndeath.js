/** @part public/mp.js - G.I.B.: our own death, from the server's kill record (window.__dvic)
 * provides: mkAt, ownDeath
 * uses: -
 * writes: -
 */
/* where the kill animation left the attacker (its world position and heading), so the server's hound carries on from there instead of popping back */
/* Stage 3D: our own death starts from the server's kill record (the bundle's death class asks for it): the position, facing, speed and
 * exhaustion the server decided the death with, as it sent them - so our death, every spectator's replay and the server's corpse are one
 * physical run.  Only a record that came with a death id; anything else (offline play) uses the player as before. */
let ownDeath = null, mkAt = null;                    // Stage 3D HQ1: our own latest death (its id, when it began here - when its kill record arrived; offline: a local key; the light's profile) - wall stains, its light
window.__dvic = K => { const A = window.__api; ownDeath = { de: K && K.de != null ? K.de : 'L' + Math.round(performance.now()), t0: K && K.de != null && mkAt && mkAt.de === K.de ? mkAt.t : performance.now() / 1000, lf: K && Array.isArray(K.lf) ? K.lf : null, srv: !!(K && K.de != null), rel: null };
  if (!K || K.de == null || !A || !Number.isFinite(K.x) || !Number.isFinite(K.y)) return null;
  return { x: K.x, y: K.y, angle: +K.a || 0, vx: K.vx || 0, vy: K.vy || 0, exhausted: !!K.ex, stamina: undefined, equipment: A.H.equipment }; };
