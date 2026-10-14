/** @part public/world.js,generated/server/world.js - L.O.S.T.: the floor surfaces (carpet, concrete, wet tile)
 * provides: -
 * uses: T, W
 * writes: -
 */
  /* floor surfaces: carpet (short slides), concrete (medium), wet tile (long).  rooms = the game's room table. */
  const SURF = {
    carpet: { slide: 2.5, step: 1, label: 'carpet' },
    deep: { slide: 3.2, step: 1.1, label: 'deep carpet' },
    concrete: { slide: 1.45, step: 1.25, label: 'concrete' },
    wet: { slide: .72, step: 1.3, label: 'wet tile' },
  };
  W.SURF = SURF;
  W.surfaceAt = function (x, y, rooms) {
    if (rooms) for (const r of rooms) if (x >= r.x * T && x < (r.x + r.w) * T && y >= r.y * T && y < (r.y + r.h) * T) {
      if (r.name === 'DAMP ROOMS') return 'wet';
      if (r.name === 'LONG ROOM') return 'concrete';
      if (r.name === 'DEEP CARPET') return 'deep';
      return 'carpet';
    }
    return 'carpet';
  };

