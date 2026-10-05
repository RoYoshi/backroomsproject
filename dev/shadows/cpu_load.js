/* 2D Lighting & Shadows - a calibrated background CPU load (development only; never served).
 *
 *   node dev/shadows/cpu_load.js BUSY_MS PERIOD_MS [SECONDS]
 *
 * Spins one core for BUSY_MS out of every PERIOD_MS (a fixed duty cycle), for SECONDS (default: until killed).  Used to
 * slow the PARENT's frames by about as much as the shadow module costs in a software-rendered view, to test whether a
 * time-sensitive retained suite then fails the same way (SH6 browser-ir diagnosis).  It changes nothing in any tree. */
'use strict';
const [busy, period, secs] = process.argv.slice(2).map(Number), end = secs ? Date.now() + secs * 1000 : Infinity;
const tick = () => { if (Date.now() > end) process.exit(0); const t = Date.now(); while (Date.now() - t < busy) { } setTimeout(tick, Math.max(0, period - busy)); };
tick();
