/*
 * The Far Backrooms — fair gameplay camera policy
 *
 * Rendering resolution/window size must not increase gameplay awareness.
 * The 1920x1080 / 1.18 camera from the Stage 2F/HQA baseline is the
 * canonical maximum world view. Other viewports scale the world so neither
 * horizontal nor vertical world-space visibility can exceed that reference.
 *
 * Unusual aspect ratios therefore crop one axis rather than granting extra
 * world FOV. devicePixelRatio remains a rendering-quality concern only.
 */
(function (root) {
  'use strict';

  const REF_WIDTH = 1920;
  const REF_HEIGHT = 1080;
  const REF_SCALE = 1.18;
  const MAX_WORLD_WIDTH = REF_WIDTH / REF_SCALE;
  const MAX_WORLD_HEIGHT = REF_HEIGHT / REF_SCALE;
  const MOBILE_MIN_SCALE = 0.85;

  function baseScale(width, height) {
    const w = Math.max(1, Number(width) || 1);
    const h = Math.max(1, Number(height) || 1);

    // `max`, not `min`: both visible world axes stay at or below the
    // canonical 1920x1080 world-space envelope. Ultrawide/tall screens crop
    // the opposite axis rather than gaining tactical vision.
    let scale = Math.max(w / MAX_WORLD_WIDTH, h / MAX_WORLD_HEIGHT);

    // Preserve the old small-screen usability floor. This can only zoom in;
    // it can never reveal more world than the canonical envelope.
    if (w < 700) scale = Math.max(scale, MOBILE_MIN_SCALE);

    return scale;
  }

  function visibleWorld(width, height) {
    const scale = baseScale(width, height);
    return {
      width: Math.max(1, Number(width) || 1) / scale,
      height: Math.max(1, Number(height) || 1) / scale,
      scale
    };
  }

  const api = Object.freeze({
    REF_WIDTH,
    REF_HEIGHT,
    REF_SCALE,
    MAX_WORLD_WIDTH,
    MAX_WORLD_HEIGHT,
    MOBILE_MIN_SCALE,
    baseScale,
    visibleWorld
  });

  root.__cameraPolicy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
