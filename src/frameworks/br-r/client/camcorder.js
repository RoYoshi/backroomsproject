/** @part public/camcorder.js - BR-R: the night-vision camcorder (the IIFE opens here): its rules and its state
 * provides: CFG, FX, S, clamp
 * uses: -
 * writes: -
 */
/* Night Vision Camcorder + light-source runtime (client only).
   The bundle owns the lighting / line-of-sight maths; this file owns the *camera side* of the game:
   raise state feedback, night-vision overheating, zoom, grain / tint overlay, HUD, audio and the
   per-entity night-vision effect registry.

   NV is NOT x-ray. It only brightens the part of the current, valid line-of-sight polygon that is
   already being rendered (the bundle punches the NV hole inside the LOS clip). Nothing here ever
   touches visibility of things behind walls, and zoom never extends line of sight.

   v23 (Part 2, stage 2C-IR) - ACTIVE INFRARED.  Night vision is two parts:
     the SENSOR (N)        sees what is lit: it amplifies visible light (lamps) and shows infrared.
     the IR ILLUMINATOR    (B: OFF / LOW / HIGH) a real directional light in the infrared - a strong core and a weaker
                           outer field, finite range with a smooth fall-off, stopped by walls (the same wall-clipped fan as
                           the torches), plus a little spill at the lens.  Without the sensor nobody sees it: not this
                           player with NV off, not another player without NV, and never the monsters (it is not sent to the
                           AI at all - server.js keeps it on the connection, not on the player the simulation sees).
     HEAT comes from the emitter: HIGH ~18 s to overheat, LOW ~75 s, emitter OFF none (the sensor alone does not heat).
                           An overheated emitter shuts down (the sensor stays on) until it has cooled to half.
     OVEREXPOSURE          HIGH (and LOW, less) pointed at a surface close to the lens floods the picture: the near
                           image blooms and distant detail washes out, easing in and out.

   Stage 3B-L QA2 - THE INFRARED IS DRAWN BY BR-RoLE.  The illuminator's picture is no longer a stack of wall-clipped fans
   (a stepped cone with a hard rim and a flat disc at the lens): while this sensor is on, BR-RoLE lights every emitter it
   sees (yours, and other camcorders') as a carried light of its own - its field, the shadows walls, pillars and props cast
   from the lens, and the wall / pillar faces it reaches - added to the picture inside the line of sight (irLights below).
   Its field (irProfile) is v23's own picture made smooth: the six stacked fans' coverage - the core under all six, the
   outer field under fewer, each fan out to its own range - with every step eased into the next and the edge and the end of
   the range faded (no stepped cone, no rim); the same range, power, core and arc.  What the sensor reads (irFrom: an
   entity's readability) keeps v23's own profile, with its two hard places eased: the step at the core's edge (over
   +-.075 rad) and the straight ramp over the last 30 % of the range (a smooth tail).  Still a sensor channel only: never
   sent to the AI, never counted as visible light, nothing without this player's sensor on.  (If BR-RoLE is off the old
   fans draw it.)

   ---------------------------------------------------------------------------------------------
   BALANCE  – every number is in CFG below (also live-editable from the console: __cam.CFG.X = …)
   ---------------------------------------------------------------------------------------------
   NV_MAX_HEAT              heat at which the NV sensor shuts down
   NV_HEAT_RATE             (v23: unused - heat now comes from the IR emitter, IR[n].heat below)
   NV_COOL_RATE             heat lost per second while NV is off / locked  (100/5  =  20 s full cool)
   NV_REENABLE_THRESHOLD    heat that must be reached before NV comes back (after the lockout)
   NV_OVERHEAT_LOCKOUT      minimum seconds NV stays dead after a shutdown
   ZOOM_LEVELS              camera zoom stops (1x / 2x / 4x)
   ZOOM_HEAT_MULT           optional heat multiplier per zoom stop (1 = zoom does not heat faster)
   There are no batteries. Heat is the only resource.                                             */
(() => {
  'use strict';
  const CFG = {
    NV_MAX_HEAT: 100,
    NV_HEAT_RATE: 100 / 35,
    NV_COOL_RATE: 5,
    NV_REENABLE_THRESHOLD: 50,
    NV_OVERHEAT_LOCKOUT: 9,
    ZOOM_LEVELS: [1, 2, 4],
    ZOOM_HEAT_MULT: [1, 1, 1],
    ZOOM_EASE: 7,
    STAGE_SLIGHT: .5,          // fractions of NV_MAX_HEAT where the picture starts to degrade
    STAGE_NOISY: .75,
    STAGE_UNSTABLE: .9,
    GRAIN_CLEAN: .05, GRAIN_SLIGHT: .12, GRAIN_NOISY: .22, GRAIN_UNSTABLE: .34,
    NV_BRIGHTNESS: .95,       // overall night-vision picture gain (CSS brightness)
    // the IR illuminator (v23): range px, core / outer field (rad), strength, heat per second, distance at which a surface starts to flood the sensor
    IR: { 1: { name: 'LOW', range: 340, core: .5, arc: 1.05, power: .72, heat: 100 / 75, bloomR: 80, bloom: .65 },
          2: { name: 'HIGH', range: 560, core: .5, arc: 1.05, power: .86, heat: 100 / 18, bloomR: 115, bloom: 1 } },
    IR_DEFAULT: 1,
    SENSOR_GAIN: 1.45,        // how much the sensor amplifies visible light (lamps) on screen
    SHAKE_BASE: .5, SHAKE_ZOOM: 1.6,
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const S = {
    kind: 'flashlight', active: false, nvOn: true, ir: 1, bloom: 0, heat: 0, locked: false, lockT: 0,
    zoomIdx: 0, zoomCur: 1, rec: 0, dt: 0, t: 0,
    shakeAmp: 0, interfere: 0, stat: 0, glitchT: 0, hint: 0, hints: 0,
    msg: '', msgT: 0, wasActive: false, lastWheel: 0, whine: null,
  };
  const FX = Object.create(null);

