/* timing_policy.js - frame-rate independent gameplay scheduling.
 *
 * Rendering may run at any refresh rate. Gameplay advances only in fixed 60 Hz
 * simulation steps. A slow rendered frame may execute multiple fixed steps to
 * catch up, but one rendered frame may never advance more than 250 ms of game
 * time (15 fixed steps). This mirrors the authoritative server catch-up guard.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TFB_TIMING = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FIXED_HZ = 60;
  const FIXED_DT = 1 / FIXED_HZ;
  const MAX_CATCHUP_STEPS = 15;
  const MAX_FRAME_DT = FIXED_DT * MAX_CATCHUP_STEPS; // 0.25 s
  const EPS = 1e-12;

  function frameDelta(nowMs, previousMs) {
    if (!Number.isFinite(nowMs) || !Number.isFinite(previousMs)) return 0;
    return Math.min(MAX_FRAME_DT, Math.max(0, (nowMs - previousMs) / 1000));
  }

  /* Pure helper used by regression tests and available to future client code. */
  function consume(accumulator, frameDt, step) {
    let acc = Math.max(0, Number(accumulator) || 0);
    acc += Math.min(MAX_FRAME_DT, Math.max(0, Number(frameDt) || 0));
    let steps = 0;
    while (acc + EPS >= FIXED_DT && steps < MAX_CATCHUP_STEPS) {
      step(FIXED_DT);
      acc -= FIXED_DT;
      steps++;
    }
    if (acc < 0 && acc > -1e-9) acc = 0;
    return { accumulator: acc, steps };
  }

  return Object.freeze({ FIXED_HZ, FIXED_DT, MAX_CATCHUP_STEPS, MAX_FRAME_DT, EPS, frameDelta, consume });
});
