/* light.js - the shared lighting query (v20, Part 1A).
 *
 * LIGHT DATA DESCRIBES LIGHT.  Rendering decides how an entity looks; AI decides what it perceives.  Nothing here sets an alpha.
 *
 *   __light.sample(x, y, lightOn, out?)  -> { ambient, lamp, torch, peers, direct, total, dark, dirX, dirY, flicker, blackout }
 *        ambient  the floor level of the world with no light at all (the halls are never pitch black to the eye)
 *        lamp     strongest ceiling-lamp contribution reaching the point (occluded by walls, lamp flicker applied, 0 in a blackout)
 *        torch    the local player's own light (flashlight / headlamp / lantern / camcorder), occluded by walls
 *        peers    the strongest light carried by another wanderer (from mp.js's __peerLights), occluded by walls
 *        direct   max(lamp, torch, peers)
 *        ir       infrared reaching the point (own camcorder + other camcorders) - only while THIS player's night vision is on, else 0 (v23)
 *        total    ambient + direct, clamped 0..1       dark = 1 - total
 *        dirX/Y   unit vector FROM the point TOWARD the dominant light (0,0 if unlit) - for later self-shading / cast shadows
 *        flicker  0..1 flicker factor of the dominant lamp (1 = steady)
 *   __light.readability(x, y, lightOn)  how legible a point is to the LOCAL PLAYER'S EYE (light + distance + night vision).
 *        This is a presentation value.  It is only used by species that deliberately conceal themselves (the Smiler);
 *        a physical entity never takes its opacity from it.
 *   __light.shade(total)                 material brightness multiplier for a physical body under a given light level
 *   __light.occluders(x, y)              wall blocks around a point ({x,y,w,h}, 96 px cells + props) - light-occluder data for later shadows
 *   __light.ray(x, y, angle, max)        distance a ray travels before it hits a wall
 *
 * Client-only.  The server's AI keeps its own light model (ai.js geo.lightLevel) and never reads anything from here. */
(() => {
  'use strict';
  const AMBIENT = .05;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mk = () => ({ ambient: AMBIENT, lamp: 0, torch: 0, peers: 0, ir: 0, direct: 0, total: AMBIENT, dark: 1 - AMBIENT, dirX: 0, dirY: 0, flicker: 1, blackout: false });
  const SHARED = mk();
  const TMP = { x: 0, y: 0, angle: 0, equipment: { kind: 'flashlight' } };          // reused: no per-call allocation
  const API = () => window.__api;

  /* one light source aimed at (x,y): its strength there if nothing is in the way */
  function carried(A, src, x, y, on) {
    if (!on || !A.qc) return 0;
    const v = A.qc(src, { x, y }, true); if (v <= 0) return 0;
    const d = Math.hypot(x - src.x, y - src.y);
    if (d > 2 && A.Uc(src.x, src.y, Math.atan2(y - src.y, x - src.x), d + 1) < d - .5) return 0;   // a wall between the light and the point
    return v;
  }

  function sample(x, y, lightOn, out) {
    const o = out || SHARED, A = API();
    o.ambient = AMBIENT; o.lamp = o.torch = o.peers = 0; o.dirX = o.dirY = 0; o.flicker = 1; o.blackout = false;
    if (!A || !Number.isFinite(x) || !Number.isFinite(y)) { o.direct = 0; o.total = AMBIENT; o.dark = 1 - AMBIENT; return o; }
    const black = !!(A.V && A.V.blackout); o.blackout = black;
    let bx = 0, by = 0, best = 0;
    if (!black && A.lamps) {
      const now = performance.now() / 1e3, E = window.__ents;
      for (const L of A.lamps) {
        const dx = L.x - x, dy = L.y - y; if (dx > 380 || dx < -380 || dy > 380 || dy < -380) continue;
        const r = Math.hypot(dx, dy); if (r >= 380) continue;
        if (A.Uc(L.x, L.y, Math.atan2(-dy, -dx), r + 1) < r - .5) continue;
        const f = E && E.lamp ? E.lamp(L.x, L.y, now) : 1, v = (1 - ss(40, 380, r)) * .43 * f;
        if (v > o.lamp) { o.lamp = v; if (v > best) { best = v; o.flicker = f; bx = dx; by = dy; } }
      }
    }
    const H = A.H;
    if (H && lightOn) { o.torch = carried(A, H, x, y, true); if (o.torch > best) { best = o.torch; bx = H.x - x; by = H.y - y; o.flicker = 1; } }
    const P = window.__peerLights;
    if (P && P.length) for (const p of P) {
      if (!p.on || p.dead) continue;
      TMP.x = p.x; TMP.y = p.y; TMP.angle = p.angle || 0; TMP.equipment.kind = p.kind || 'flashlight';
      const v = carried(A, TMP, x, y, true); if (v > o.peers) o.peers = v;
      if (v > best) { best = v; bx = p.x - x; by = p.y - y; o.flicker = 1; }
    }
    o.direct = Math.max(o.lamp, o.torch, o.peers);
    const C = window.__cam; o.ir = C && C.nv ? C.irAt(x, y) : 0;          // (v23) infrared counts only through this player's own night-vision sensor
    o.total = clamp(o.ambient + Math.max(o.direct, o.ir) * 1.6, 0, 1);            // (the lamp/torch scales top out around .43-.8: 1.6 maps "well lit" to about 1)
    o.dark = 1 - o.total;
    const bl = Math.hypot(bx, by); if (best > 0 && bl > 1e-6) { o.dirX = bx / bl; o.dirY = by / bl; }
    return o;
  }

  const readability = (x, y, lightOn) => { const A = API(); return A && A.Ul && A.H ? A.Ul(x, y, A.H, lightOn) : 1; };
  const shade = total => .58 + .42 * clamp(total, 0, 1);          // a physical body is never darker than 58 % of its own colour from this; the darkness overlay does the rest
  const occluders = (x, y) => { const A = API(); return A && A.Bc ? A.Bc(x, y) : []; };
  const ray = (x, y, a, max) => { const A = API(); return A && A.Uc ? A.Uc(x, y, a, max) : max; };

  window.__light = { sample, readability, shade, occluders, ray, mk, AMBIENT };
})();
