/** @part public/glitch.js - L.O.S.T.: the glitched walls on the page: their canvas; a module: glitchWalls
 * A module (continuation C3b, M-024): M8's part inside its factory, glitchWalls, after the opening of the script's wrapper, which this
 * part keeps. Its parameter is what it takes from the modules made before it, by giver; its return is what later modules take from it.
 * glitch.compose.js makes it. Every line is M8's.
 * imports: -
 * exports: cv, cx, fx, NEAR, rnd
 * provides: glitchWalls
 * uses: -
 * writes: -
 */
/* Glitched walls: the way out of Level 0.
   Draws each glitched wall on its own canvas ABOVE the darkness (so it glows through the dark, but only while it is
   in line of sight), adds a static-y audio cue that swells as you approach, and a screen tear when you get close.
   Positions come from mp.js (window.__glitches = [[x, y, nx, ny], ...] where (nx, ny) points into the wall). */
(() => {
  function glitchWalls() {
  const cv = Object.assign(document.createElement('canvas'), { id: 'glitchFx' }), cx = cv.getContext('2d');
  document.body.appendChild(cv);
  const fx = Object.assign(document.createElement('div'), { id: 'glitchTear' }); document.body.appendChild(fx);
  const rnd = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const NEAR = 620, TOUCH = 54;


  return { cv, cx, fx, NEAR, rnd };
  }
