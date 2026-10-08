/* br-role.js - BR-RoLE 1.1, the Backrooms Rendering of Lighting Engine (presentation only, client only).
 *
 * THE 2D GAME IS THE GAME.  BR-RoLE is the one visual owner of the light in the world: the darkness, the ceiling lamps,
 * your carried light and the other wanderers' lights, and the shadows walls, pillars, props and actors cast in them.
 *
 * BR-RoLE 1.1 (Stage 3B final polish): natural fluorescent propagation.
 *   - LIGHT HAS NO VISIBLE HARD RADIUS: a lamp's field falls off smoothly, f(d) = exp(-(d / S)^P), into a faint tail that
 *     fades to nothing (a smoothstep to zero at its technical bound, far past where it can be seen).  The old radial stops
 *     (1 / .35 / 0 at 380 px) ended in a visible circle;
 *   - a fluorescent fixture is a broad source: d is the distance to the TUBE (a line the fixture's length), not to a point,
 *     so the light is broad around the fixture and rounds out with distance;
 *   - BOUNCE LIGHT (first order only): every wall / pillar side and floor patch a lamp lights DIRECTLY sends a small part of
 *     that light (its albedo: pale paper more, red paper and deep or red carpet less) back into the space in front of it,
 *     decaying fast, and casts its own shadows: it reaches round a corner only along an open path (lamp -> surface ->
 *     point), never through a wall or a pillar.  Static, so it is cached with the lamp (built over a few frames, faded in);
 *   - NO SURVIVING LIGHT = NO VISIBILITY: the sourceless glow v23.3.6 drew around the viewer (through walls) is gone.  Where
 *     no lamp, carried light or bounce of a lamp reaches, the overlay stays fully dark.
 *   - the line of sight's reach (700 px, drawLight's clip, unchanged) no longer cuts lit floor in a sharp arc: all light
 *     fades out over its last 80 px (only ever less light, never more visibility).
 *   Light truth is still not touched: the server's lamp field (reach 380), light.js and the bundle's Ul() are unchanged.
 *
 * 1.1-qa1 (Stage 3B-L QA1, lighting reality correction): THE PLAYER IS NOT A LIGHT SOURCE. THEIR EQUIPMENT IS.
 *   - a working fixture is a real light: the direct field at its full legitimate level (no longer scaled down for bounce),
 *     broader, its visible output LAMP.vis x the game's strength, a longer smooth tail.  No ambient floor, no viewer glow:
 *     where no fixture, carried light or bounce of a fixture reaches, the overlay stays fully dark;
 *   - SURFACE RECEIVERS: a wall's or pillar's visible face (a band inside it) receives the light that reaches the floor at
 *     its foot from that same light, scaled by how squarely it faces the light (source-dependent, occlusion-aware: the same
 *     shadows; nothing for a face turned away, nothing through the blocker).  Cached with each lamp; drawn per carried
 *     light (a flashlight lights the wall it hits, sweeping away darkens it);
 *   - carried lights at CARRY.vis x the game's own power (light truth unchanged);
 *   - Level 0 has about twice the fixtures (world.js W.lamps: the client's and the server's one list), so: lamp caps that
 *     hold every fixture lighting the view at every tier; the lamps' core fields drawn into a half-resolution buffer and
 *     their far fields into an eighth-resolution one (each cache's own density: the same picture, a quarter of the fill);
 *     only the box the lamps drew into composited; the far cache's face pass a build step of its own; a prefetch never
 *     evicts.
 *
 * 1.1-qa2 (Stage 3B-L QA2, final visual polish):
 *   - CORNERS: a wall's or pillar's face bands meet at a corner on the mitre the remaster's art draws (buildBands, bandPoly,
 *     extrude): a convex corner's square is split on its diagonal between the two faces (QA1 gave it whole to the front /
 *     back face), an inner corner's block is lit from both faces (QA1 left it dark), and a light close to a wall steps along
 *     it in pieces of at most FACE.da (QA1: 32 px steps).  (The line of sight's clip shows the same bands: the bundle's Hl);
 *   - NIGHT VISION: the camcorder's infrared is a BR-RoLE light while this player's sensor is on (irLight): each emitter
 *     the sensor sees (window.__cam.irLights) - a field of the camcorder's own picture (__cam.irProfile: v23's stacked fans
 *     made smooth - its range, core and outer field, a soft rim and tail; no stepped cone, no hard rim), the shadows walls,
 *     pillars and props cast into it from the lens, the wall / pillar faces it reaches, a small spill at the lens - added to
 *     the picture.  A sensor channel: never a visible light (no colour, nothing in it without the sensor), never light
 *     truth (the server never has it); nothing is computed while the sensor is off.  The bundle's old infrared fans stand down while BR-RoLE draws it.
 *
 * One model, every light on its own:   visible light = Σ fieldᵢ · (1 − shadowᵢ) + Σ bounceᵢ
 *   LIGHT FIELD -> BLOCKER -> CAST SHADOW -> ADD SURVIVING LIGHTS.  Never "light = visibility polygon".
 *   - an offscreen LIGHT BUFFER (a fraction of the CSS viewport per tier; never scaled by devicePixelRatio);
 *   - each light first lays down its natural, unobstructed illumination field: a lamp's radial falloff; a beam's radial
 *     falloff times its smooth angular profile; the hand glow.  Nothing clips it;
 *   - then the blockers cast shadows into THAT field, each from the light's own source points: every wall / pillar side
 *     facing the point (its two corners projected away from it), every selected prop (the hull of its base and its top
 *     projected away; its own top stays lit) and the actors this light is dominant for (BR2B).  A shadow is the absence of
 *     that one light behind the blocker, nothing else;
 *   - a fluorescent fixture is a tube, not a point: its shadows are cast from many points over the fixture and averaged,
 *     so they have an umbra (no point of the tube sees it) and a penumbra that widens away from the blocker.  Static, so
 *     each lamp's shadowed field (walls, pillars, props) is built once (per tier) and reused every frame at the lamp's
 *     current strength;
 *   - a carried light is a small source: one to six points across the hand (per tier) inside its beam;
 *   - the lights are ADDED (`lighter`).  One light's shadow removes only that light, so any other light that reaches the
 *     spot lights it; the same prop blocks every light that is really behind it.  Mixed light is just the sum;
 *   - the darkness overlay (#light, the game's own canvas) then loses exactly the accumulated light (destination-out),
 *     inside the game's own line-of-sight clip, and carried lights lay their colour tint on top (summed: crossing colours
 *     average).
 * The game's drawLight() keeps everything else it draws: the line-of-sight blackout, the camcorder's infrared (QA2: only
 * while BR-RoLE is off - BR-RoLE draws it), the vignette, the death presentation and the Smilers' faces.  It hands the light cut-outs to BR-RoLE through one guarded hook
 * (window.__brRole.on() / draw()).  If anything here throws, BR-RoLE switches itself off and drawLight draws v23.3.6.
 *
 * Light truth is not touched: the server AI (ai.js), light.js (__light, the Smiler's readability) and the bundle's Ul()
 * never read the overlay.  This module only reads game state; it never writes it, never sends anything.  Shadows are not a
 * sensor and not concealment; an actor you cannot see casts no shadow (no information leaks through one).
 *
 * BR2.1: an actor's dominant light also self-shades its body (a soft gradient on the body and hands, a Hound's torso,
 * darker away from that light) while its cast shadow stays on the floor, cut around the silhouette; prop shadows fade from
 * the footprint toward their far end.  Both still remove only their own light.
 *
 * BR3 (1.0): a beam works only in its sector's box and every shadow fill stays inside its light's own pixel box (culling,
 * no visual change); resetStats() no longer resets the frame counter that lamp fades and actor easing count.
 *
 * Also carried over from the SH7 donor (ADAPT): the static wall grounding band, and the prop caster table, hull projection
 * and caster ranking ideas (BR2A).  Never anything for a Smiler: no body, contact or silhouette shadow.
 *
 * Quality: LOW / MEDIUM / HIGH (SETTINGS > CUSTOMIZE > LIGHTING, or ?lighting=low|medium|high; remembered per device).
 * DEV only: ?lighting=legacy draws the v23.3.6 lighting for comparison (not offered in the settings).
 * window.__brRole = { version, on(), draw(ctx, frame), quality(), setQuality(q), stats(), resetStats(), probe(x, y), actors(), dev } */
(() => {
  'use strict';
  if (window.__brRole) return;
  const VERSION = 'br-role 1.1-qa2';
  const T = 96, CHUNK = 16, VB = 384;                                       // level cell; grounding chunk (cells); edge bucket (px)
  const QUALITIES = ['low', 'medium', 'high'];
  /* per tier: light-buffer scale of the CSS viewport; lamps / other wanderers drawn (nearest that reach the screen); a lamp's
   * shadowed field: cache resolution (px per world px), tube points its shadows are cast from, caches kept, builds per frame;
   * points across a carried light's source; prop casters per light (nearest first) and per frame (all carried lights).
   * BR-RoLE 1.1, a lamp's outer field and bounce light (one low-resolution cache per lamp): its resolution (px per world px),
   * the tube points its shadows are cast from, the spacing of the bounce points on walls and on the floor (world px; each
   * point stands for its share of the surface, so every tier adds the same light), the time a frame may spend building
   * them (ms).  Tiers change sampling and resolution only: the same light reaches the same places.
   * QA1: Level 0 has about twice the fixtures (world.js W.lamps), so the lamp caps hold every fixture whose light can reach
   * what you see in the densest rooms (measured: 21-23 at most; the light a cap of 20 drops there is <= 3 / 255), LOW and
   * MEDIUM alike (the same fixtures at every tier), and the caches hold the cap plus the lamps about to come into view (a
   * prefetch never evicts) */
  const TIERS = {
    low: { scale: .5, lamps: 24, peers: 1, lampRes: .3, tube: 16, lampCache: 40, builds: 2, src: 1, props: 4, propFrame: 16, ents: 6, secondary: false, farRes: .08, farTube: 6, wallStep: 56, floorStep: 120, farMs: 2 },
    medium: { scale: .75, lamps: 24, peers: 3, lampRes: .45, tube: 16, lampCache: 44, builds: 3, src: 4, props: 8, propFrame: 48, ents: 12, secondary: false, farRes: .11, farTube: 8, wallStep: 44, floorStep: 96, farMs: 3 },
    high: { scale: 1, lamps: 28, peers: 6, lampRes: .6, tube: 32, lampCache: 52, builds: 4, src: 6, props: 12, propFrame: 96, ents: 20, secondary: true, farRes: .14, farTube: 12, wallStep: 36, floorStep: 80, farMs: 4 },
  };
  /* a lamp: the fixture it shines from (the 86 x 24 panel the game draws: tube points over ±tubeX, two rows at ±tubeY), the
   * strength its cache is built at (P0: the game's cap), a light blur of its shadow mask (world px; only where the browser
   * has canvas filters), the fade of a lamp built late (frames: steady under a frozen clock); the height it hangs at for prop
   * shadows (h, SH7's tuned 180 px) and the longest prop shadow it casts (kmax x the prop's distance from it).
   * BR-RoLE 1.1, its field: f(d) = exp(-(d / S)^P), d = the distance to the tube (half-length a), faded smoothly to zero
   * between tail0 and far (a technical bound: f is under 1 % there, invisible).  Two caches: the CORE (fine, d < x1) holds
   * f · wc, the FAR one (low resolution, with the bounce light) f · (1 - wc); wc crossfades from 1 to 0 over x0 .. x1, so the
   * split never shows.  The far light is faint, so its cache and the low-resolution buffer (QA1: an eighth) it is drawn into hold it x fg
   * (8-bit precision kept until the full-resolution composite: smooth, not stepped).  R (380) is the gameplay lamp reach (the server's, light.js's),
   * kept for reference only: nothing here draws by it.
   * Stage 3B-L QA1 (lighting reality): a working fluorescent fixture is a real light.  Its visible output is `vis` x the game's
   * own strength (.43: the light truth the server and light.js keep using, unchanged), its field broader (S, P), its tail
   * longer (tail0, far: still smooth to an exact zero), so the room between fixtures reads as lit, then dims, then goes black
   * where the light really runs out.  No ambient floor: every bit of it comes from a fixture.  (vis 1.5 with the parent's 90
   * fixtures; 1.4 with world.js's 170: overlapping fixtures add, so the room keeps its pools and is not washed flat) */
  const LAMP = { R: 380, S: 185, P: 1.42, a: 30, tail0: 580, far: 720, x0: 300, x1: 400, fg: 2, vis: 1.4, tubeX: 40, tubeY: 8, P0: .9, blur: 3, fadeFrames: 12, buildMs: 6, prefetch: 360, h: 180, kmax: 1 };
  /* BR-RoLE 1.1 bounce light.  A wall / pillar side or a floor patch the lamp lights directly (irradiance f · cos x the share
   * of the tube that sees it) re-emits `wall` / `floor` x its albedo of it, from a point just in front of it, into the space
   * it faces (a wall's lobe leans out along its normal by `lean` x its scale; a floor patch's is round), falling off as
   * exp(-(r / l)^pw) to nothing at `range`; every bounce point casts its own wall and pillar shadows (a point source).
   * Bounce points farther than `reach` from the tube, or adding under `min`, are skipped.  `direct`: the share of the lamp's
   * own field kept, so a lit room with its bounce light is as bright as before (the darkness the user likes is kept) */
  /* the line of sight's reach (drawLight's, 700 px: never changed here) and the fade of every light before it */
  const SIGHT = { r: 700, fade: 80 };
  const SPILL = { wall: .08, floor: .04, lw: 130, lf: 110, pw: 1.2, lean: .35, wallRange: 330, floorRange: 300, reach: 470, floorReach: 400, min: .0012, direct: 1 };
  /* restrained material response (relative albedo; the yellow chevron paper = 1): pale arch paper returns more, paper peeled
   * to crimson and red / deep carpet less; wet tile and bare concrete a little more than carpet.  No surface emits */
  const ALBEDO = { wall: { '': 1, 'ARCH GALLERY': 1.12, 'RED ROOMS': .55 }, floor: { '': .6, 'DEEP CARPET': .42, 'RED ROOMS': .36, 'LONG ROOM': .72, 'DAMP ROOMS': .8 } };
  /* Stage 3B-L QA1 SURFACE RECEIVERS.  A wall's (or pillar's) visible face is a band inside it along its edge (the remaster
   * papers it: S 46, N 23, E / W 27 px; a pillar's faces are shallower, inside its 56 px).  A light's shadows start at the edge,
   * so that band was always dark.  Now each light's own shadowed field just in front of a face that turns towards the light
   * (`s0` .. `s0 + sw` px out, past the mask's blur) is carried onto the face band: the face is lit exactly where the floor at
   * its foot is lit by that light - the same walls, pillars and props block it - scaled by how squarely the face turns to the
   * light (base + k cos, in `seg` px pieces).  Faces turned away get nothing; nothing reaches past a face into the blocker.
   * At a corner the bands meet on the mitre the art draws (QA2; QA1 gave a convex corner's square to the front / back face) */
  const FACE = { S: 46, N: 23, E: 27, W: 27, pS: 18, pN: 12, pE: 14, pW: 14, s0: 5, sw: 3, seg: 32, farSeg: 96, base: .45, k: .55, gain: 1, da: .04 };   // farSeg: the far cache's pieces (its light varies slowly along a face; a third of the draws)
  const SRC = { beam: 3, omni: 4 };                                          // a carried light's half-size (world px)
  /* carried lights: the height each is held at (for prop shadows; SH7's) and the longest prop shadow (kmax x distance) */
  const CARRY = { h: { flashlight: 105, headlamp: 160, lantern: 85 }, kmax: 2.2, vis: 1.35 };   // vis (QA1): a carried light's visible output x the game's own power (light truth unchanged)
  /* selected prop casters (world.js PROPS, adapted from the SH7 donor's table): presentation height above the floor (px).
   * The game's ray query passes over props (only walls and pillars stop light), so their shadows are new.  A prop is a box:
   * from a source point at height h its floor shadow is the hull of its base and its projected top (top corner + (corner -
   * source) x hp / (h - hp)); its own top stays lit.  Not casters: the see-through railing and the wall holes (openings).
   * The art's baked drop shadow (a few px, drawProp) needs no thinning here: BR-RoLE removes light instead of painting
   * dark, so under a cast shadow it reads as the prop's contact shadow, not a second shadow */
  const PROP = { counter: { h: 70 }, shelf: { h: 46 }, lowwall: { h: 84 }, machine: { h: 96 }, table: { h: 76 }, bench: { h: 46 }, window: { h: 40 } };
  /* (BR-RoLE 1.1: no ambient glow.  v23.3.6's sourceless glow around the viewer, through walls, is removed: no surviving
   * light = no visibility) */
  /* carried-light colour tint over the lit area (v23.3.6's .25 / .2 of the light).  BR2C: the tints are summed (`lighter`,
   * premultiplied: overlapping colours average instead of the later one painting over the earlier) at k of their strength
   * and laid on at 1 / k: one light looks exactly as before, crossing lights cannot stack into a saturated film */
  const TINT = { beam: .25, omni: .2, k: .5 };
  const AO = { width: 50, alpha: .56, steps: 64, power: 1.35 };              // SH7 grounding (ADAPT)
  const LS_KEY = 'tfb.lighting.quality';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const now = () => performance.now();
  const S = { quality: 'medium', legacy: false, disabled: '', attached: false, attachTries: 0, buf: null, bx: null, scr: null, sx: null, tb: null, tx: null, msk: null, mx: null,
    lampCache: new Map(), lampKey: '', lmask: null, pending: new Set(), edges: null, egrid: new Map(), stamp: null, q: 0, blur: false, props: [],
    layers: {}, chunks: [], person: null, last: null, dbgEl: null, act: new WeakMap(), actorsOn: true, actorsLast: [], castCv: null, discCv: null, shadeCv: null, atmp: null, ax: null, propLeft: 0,
    tpl: null, sightFade: true, skip: {}, farJob: null, fb: null, fx: null, etmp: null, ex: null, fmask: null, spillOn: true, facesOn: true, solo: null, cbOn: true, cb: null, cbx: null, cbUsed: false, fbDiv: 8, rooms: null, irOn: true };
  const ST = { frames: 0, ms: new Float32Array(240), n: 0, max: 0, lamps: 0, lampsMax: 0, carried: 0, peers: 0, shadows: 0, shadowsMax: 0, props: 0, propsMax: 0, lampBuilds: 0, lampBuildMs: 0, lampBuildMax: 0, lampEvictions: 0, propDraws: 0, ents: 0, shaded: 0, casts: 0, shadeDraws: 0, buf: [0, 0], legacyFrames: 0, errors: 0,
    faceDraws: 0, farBuilds: 0, farMs: 0, farStepMax: 0, farPh: [0, 0, 0, 0], emitters: 0, emittersMax: 0, fars: 0, ir: 0 };

  /* ---------- quality: URL > remembered > device default (touch / small screen -> LOW); ?lighting=legacy is DEV only ---------- */
  function initialQuality() {
    let u = null; try { u = new URLSearchParams(location.search).get('lighting'); } catch (e) { }
    if (u === 'legacy') { S.legacy = true; return 'medium'; }
    if (QUALITIES.includes(u)) return u;
    try { const v = localStorage.getItem(LS_KEY); if (QUALITIES.includes(v)) return v; } catch (e) { }
    const coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches), small = Math.min(screen.width || 9999, screen.height || 9999) < 700;
    return coarse || small ? 'low' : 'medium';
  }
  S.quality = initialQuality();
  function disable(why, e) { if (S.disabled) return; S.disabled = why; ST.errors++; try { console.warn('[br-role] disabled - the game draws its own (v23.3.6) lighting:', why, e && (e.stack || e)); } catch (x) { } }

  /* ---------- the blockers: every wall side (the wall / floor boundary, merged into straight runs; the level's border
   * counts as wall, as in the game) and the four sides of every pillar, each with its outward normal (into the open) ---------- */
  function buildEdges() {
    const A = window.__api, W = S.FBW, H = S.FBH, wall = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? true : !!A.Hc(x, y), E = [];
    for (let y = 0; y <= H; y++) for (let x = 0; x < W;) {                  // horizontal sides, between cell rows y - 1 and y
      const up = wall(x, y - 1), dn = wall(x, y); if (up === dn) { x++; continue; }
      let e = x; while (e + 1 < W && wall(e + 1, y - 1) === up && wall(e + 1, y) === dn) e++;
      E.push(x * T, y * T, (e + 1) * T, y * T, 0, up ? 1 : -1); x = e + 1;
    }
    for (let x = 0; x <= W; x++) for (let y = 0; y < H;) {                  // vertical sides, between cell columns x - 1 and x
      const lf = wall(x - 1, y), rt = wall(x, y); if (lf === rt) { y++; continue; }
      let e = y; while (e + 1 < H && wall(x - 1, e + 1) === lf && wall(x, e + 1) === rt) e++;
      E.push(x * T, y * T, x * T, (e + 1) * T, lf ? 1 : -1, 0); y = e + 1;
    }
    const seen = new Set(); let pillars = 0; S.nWall = E.length / 6;
    if (typeof A.Bc === 'function') for (let y = 96; y < H * T; y += 192) for (let x = 96; x < W * T; x += 192) {
      let l = null; try { l = A.Bc(x, y); } catch (e) { l = null; }
      if (l) for (const r of l) if (r && r.w === 56 && r.h === 56) { const k = r.x + ',' + r.y; if (seen.has(k)) continue; seen.add(k); pillars++;
        const x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h; E.push(x0, y0, x1, y0, 0, -1, x0, y1, x1, y1, 0, 1, x0, y0, x0, y1, -1, 0, x1, y0, x1, y1, 1, 0); }
    }
    S.edges = Float64Array.from(E); S.nEdges = E.length / 6; S.pillars = pillars; S.stamp = new Int32Array(S.nEdges); S.egrid.clear();
    for (let j = 0; j < S.nEdges; j++) {
      const o = j * 6, bx0 = Math.floor(Math.min(E[o], E[o + 2]) / VB), bx1 = Math.floor(Math.max(E[o], E[o + 2]) / VB), by0 = Math.floor(Math.min(E[o + 1], E[o + 3]) / VB), by1 = Math.floor(Math.max(E[o + 1], E[o + 3]) / VB);
      for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) { const k = by * 4096 + bx; let l = S.egrid.get(k); if (!l) S.egrid.set(k, l = []); l.push(j); }
    }
    buildBands(wall);
  }
  /* QA1: every side's visible face band (inside its wall / pillar) and the strip of open floor in front of it (world px):
   * S.bands[j * 8 ..] = band x0, y0, x1, y1, strip x0, y0, x1, y1 (an empty band: x1 <= x0).
   * QA2: the bands meet at corners the way the remaster's art draws the faces - MITRED.  Every band runs the whole side (a
   * side face is no longer cut short where a front / back face turns the corner) and S.bandM[j * 2 ..] gives the mitre at its
   * start and end: the shift along the face at the band's full depth.  + (a convex corner): the band ends on the diagonal from
   * the corner to where the two faces' bands meet inside the block (the side's share of the corner square, the rest is the
   * other face's);  - (an inner corner): it goes on past the end of the side into the corner block, to the same diagonal
   * (the art fills the inner corner from both faces, split the same way).  The strips (the floor in front) are unchanged */
  function buildBands(wall) {
    const E = S.edges, B = S.bands = new Float32Array(S.nEdges * 8), M = S.bandM = new Float32Array(S.nEdges * 2), s0 = FACE.s0, s1 = FACE.s0 + FACE.sw;
    for (let j = 0; j < S.nEdges; j++) {
      const o = j * 6, ax = E[o], ay = E[o + 1], bx = E[o + 2], by = E[o + 3], nx = E[o + 4], ny = E[o + 5], pil = j >= S.nWall, q = j * 8;
      if (ay === by) {                                                      // a front (S, wall above the floor) or back (N) face: the whole run
        const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), d = ny > 0 ? (pil ? FACE.pS : FACE.S) : (pil ? FACE.pN : FACE.N);
        B.set(ny > 0 ? [x0, ay - d, x1, ay, x0, ay + s0, x1, ay + s1] : [x0, ay, x1, ay + d, x0, ay - s1, x1, ay - s0], q);
        if (pil) { M[j * 2] = FACE.pW; M[j * 2 + 1] = FACE.pE; }
        else { const wr = ny > 0 ? ay / T - 1 : ay / T, fr = ny > 0 ? ay / T : ay / T - 1, c0 = x0 / T - 1, c1 = x1 / T;
          M[j * 2] = wall(c0, wr) && wall(c0, fr) ? -FACE.E : FACE.W; M[j * 2 + 1] = wall(c1, wr) && wall(c1, fr) ? -FACE.W : FACE.E; }
      } else {                                                              // a side face (E: wall on the left, W: on the right): the whole run
        const y0 = Math.min(ay, by), y1 = Math.max(ay, by), d = pil ? (nx > 0 ? FACE.pE : FACE.pW) : (nx > 0 ? FACE.E : FACE.W);
        B.set(nx > 0 ? [ax - d, y0, ax, y1, ax + s0, y0, ax + s1, y1] : [ax, y0, ax + d, y1, ax - s1, y0, ax - s0, y1], q);
        if (pil) { M[j * 2] = FACE.pN; M[j * 2 + 1] = FACE.pS; }
        else { const wc = nx > 0 ? ax / T - 1 : ax / T, fc = nx > 0 ? ax / T : ax / T - 1, r0 = y0 / T - 1, r1 = y1 / T;
          M[j * 2] = wall(wc, r0) && wall(fc, r0) ? -FACE.S : FACE.N; M[j * 2 + 1] = wall(wc, r1) && wall(fc, r1) ? -FACE.N : FACE.S; }
      }
    }
  }
  /* QA2: band j as its mitred outline (world px): the face's run at depth 0, the mitred ends at the band's full depth */
  function bandPoly(j) {
    const E = S.edges, B = S.bands, M = S.bandM, o = j * 6, g = j * 8, nx = E[o + 4], ny = E[o + 5], hor = ny !== 0;
    const f0 = hor ? B[g] : B[g + 1], f1 = hor ? B[g + 2] : B[g + 3], d = hor ? B[g + 3] - B[g + 1] : B[g + 2] - B[g], line = hor ? E[o + 1] : E[o];
    let i0 = f0 + M[j * 2], i1 = f1 - M[j * 2 + 1]; if (i0 > i1) i0 = i1 = (i0 + i1) / 2;
    const P = (u, t) => hor ? [u, line - ny * t] : [line - nx * t, u];
    return [...P(f0, 0), ...P(f1, 0), ...P(i1, d), ...P(i0, d)];
  }
  /* QA1: carry a light's field (already drawn and shadowed in canvas c: world -> c px is x * k + ox) from the strip in front of
   * every face turned towards (lx, ly) within reach onto that face's band, in pieces scaled base + k cos.  `tmp`: a pooled canvas
   * at least c's size (the field is read from a copy of c's pixel box bb = [x0, y0, x1, y1]).
   * QA2: the pieces at a band's ends are drawn inside its mitred outline (bandPoly: the remaster's corner joints); at an inner
   * corner the end piece reaches on into the corner block (the strip's last piece, stretched over it).  And the pieces are as
   * short as it takes for base + k cos to step by at most FACE.da between neighbours (a light close to a wall turns quickly
   * along it: 32 px steps showed), at most 4 x as many */
  function extrude(c, tmp, k, ox, oy, lx, ly, reach, bb, push = 0, seg = FACE.seg) {   // push: the strip moved that much farther out (a low-resolution cache's blur); seg: piece length (world px)
    const E = S.edges, B = S.bands, M = S.bandM; if (!B || !S.facesOn) return 0;
    const bw = bb[2] - bb[0], bh = bb[3] - bb[1]; if (!(bw > 0 && bh > 0)) return 0;
    const wx0 = (bb[0] - ox) / k, wy0 = (bb[1] - oy) / k, wx1 = (bb[2] - ox) / k, wy1 = (bb[3] - oy) / k;   // the box in world px
    /* first the pieces (strip -> band, c px) of every face turned to the light, then one copy of just the field they read */
    const st = S.stamp, q = ++S.q, P = S.xseg || (S.xseg = []); let np = 0, ux0 = Infinity, uy0 = Infinity, ux1 = -Infinity, uy1 = -Infinity;
    const x0 = Math.max(wx0, lx - reach), x1 = Math.min(wx1, lx + reach), y0 = Math.max(wy0, ly - reach), y1 = Math.min(wy1, ly + reach);
    for (let by = Math.floor(y0 / VB); by <= Math.floor(y1 / VB); by++) for (let bx = Math.floor(x0 / VB); bx <= Math.floor(x1 / VB); bx++) {
      const l = S.egrid.get(by * 4096 + bx); if (!l) continue;
      for (const j of l) {
        if (st[j] === q) continue; st[j] = q; const o = j * 6, nx = E[o + 4], ny = E[o + 5];
        if ((lx - E[o]) * nx + (ly - E[o + 1]) * ny <= .5) continue;      // turned away (or edge-on): no light on this face
        const g = j * 8; if (!(B[g + 2] > B[g])) continue;
        const hor = ny !== 0, a0 = hor ? B[g] : B[g + 1], a1 = hor ? B[g + 2] : B[g + 3], m0 = M ? M[j * 2] : 0, m1 = M ? M[j * 2 + 1] : 0;   // along the face
        const lo = Math.max(a0, hor ? x0 - 2 : y0 - 2), hi = Math.min(a1, hor ? x1 + 2 : y1 + 2); if (!(hi > lo)) continue;
        const aAt = u => { const mx = hor ? u : E[o], my = hor ? E[o + 1] : u, dx = lx - mx, dy = ly - my, d = Math.hypot(dx, dy) || 1, cs = (dx * nx + dy * ny) / d; return cs > 0 ? Math.min(1, FACE.gain * (FACE.base + FACE.k * cs)) : 0; };
        let tv = 0; for (let s = 0, pa = aAt(lo); s < 8; s++) { const na = aAt(lo + (hi - lo) * (s + 1) / 8); tv += Math.abs(na - pa); pa = na; }
        const mb = Math.max(1, Math.ceil((hi - lo) / seg)), m = Math.min(mb * 4, Math.max(mb, Math.ceil(tv / FACE.da))), step = (hi - lo) / m;
        for (let s = 0; s < m; s++) {
          const u0 = lo + s * step, u1 = u0 + step, a = aAt((u0 + u1) / 2); if (!(a > 0)) continue;
          const e0 = u0 <= a0 + 1e-6 && m0 !== 0, e1 = u1 >= a1 - 1e-6 && m1 !== 0, du0 = e0 && m0 < 0 ? u0 + m0 : u0, du1 = e1 && m1 < 0 ? u1 - m1 : u1;   // an inner corner: on into the corner block
          let sx, sy, sw_, sh_, dx_, dy_, dw, dh;                           // strip (source) and band (destination), c px
          if (hor) { sx = u0 * k + ox; sw_ = step * k; sy = (B[g + 5] + ny * push) * k + oy; sh_ = (B[g + 7] - B[g + 5]) * k; dx_ = du0 * k + ox; dw = (du1 - du0) * k; dy_ = B[g + 1] * k + oy; dh = (B[g + 3] - B[g + 1]) * k; }
          else { sy = u0 * k + oy; sh_ = step * k; sx = (B[g + 4] + nx * push) * k + ox; sw_ = (B[g + 6] - B[g + 4]) * k; dy_ = du0 * k + oy; dh = (du1 - du0) * k; dx_ = B[g] * k + ox; dw = (B[g + 2] - B[g]) * k; }
          if (sx < bb[0] || sy < bb[1] || sx + sw_ > bb[2] || sy + sh_ > bb[3]) continue;   // the strip outside the light's box: nothing known there
          P[np++] = a; P[np++] = sx; P[np++] = sy; P[np++] = sw_; P[np++] = sh_; P[np++] = dx_; P[np++] = dy_; P[np++] = dw; P[np++] = dh; P[np++] = e0 || e1 ? j : -1;
          if (sx < ux0) ux0 = sx; if (sy < uy0) uy0 = sy; if (sx + sw_ > ux1) ux1 = sx + sw_; if (sy + sh_ > uy1) uy1 = sy + sh_;
        }
      }
    }
    if (!np) return 0;                                                       // no face turned to it in reach: nothing to copy or draw
    /* the strips are open floor and the bands inside blockers (never the same pixels), so one copy of the strips' box before
     * any band is drawn reads exactly what a copy of the whole box would (1 px margin: the sampler's reach) */
    const cx0 = Math.max(bb[0], Math.floor(ux0) - 1), cy0 = Math.max(bb[1], Math.floor(uy0) - 1), cx1 = Math.min(bb[2], Math.ceil(ux1) + 1), cy1 = Math.min(bb[3], Math.ceil(uy1) + 1);
    const t = tmp.getContext('2d'); t.save(); t.setTransform(1, 0, 0, 1, 0, 0); t.globalAlpha = 1; t.globalCompositeOperation = 'copy'; t.drawImage(c.canvas, cx0, cy0, cx1 - cx0, cy1 - cy0, cx0, cy0, cx1 - cx0, cy1 - cy0); t.restore();
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.imageSmoothingEnabled = true;
    for (let i = 0; i < np; i += 10) {
      c.globalAlpha = P[i];
      if (P[i + 9] >= 0) {                                                   // an end piece: inside the band's mitred outline
        const w = bandPoly(P[i + 9]); c.save(); c.beginPath(); c.moveTo(w[0] * k + ox, w[1] * k + oy); for (let v = 2; v < 8; v += 2) c.lineTo(w[v] * k + ox, w[v + 1] * k + oy); c.closePath(); c.clip();
        c.drawImage(tmp, P[i + 1], P[i + 2], P[i + 3], P[i + 4], P[i + 5], P[i + 6], P[i + 7], P[i + 8]); c.restore();
      } else c.drawImage(tmp, P[i + 1], P[i + 2], P[i + 3], P[i + 4], P[i + 5], P[i + 6], P[i + 7], P[i + 8]);
    }
    c.restore(); ST.faceDraws += np / 10; return np / 10;
  }
  /* the selected prop casters (world.js PROPS), static */
  function buildProps() {
    const W = window.WORLD; S.props = [];
    if (W && Array.isArray(W.PROPS)) for (const p of W.PROPS) {
      const d = PROP[p.kind]; if (!d || !p.rect || p.type === 'gap') continue; const r = p.rect;
      if (![r.x, r.y, r.w, r.h].every(Number.isFinite) || !(r.w > 0 && r.h > 0)) continue;
      S.props.push({ n: S.props.length, id: p.id, kind: p.kind, x: r.x, y: r.y, w: r.w, h: r.h, cx: r.x + r.w / 2, cy: r.y + r.h / 2, hd: Math.hypot(r.w, r.h) / 2, hp: d.h });
    }
  }
  /* the props a light at (x, y) can shadow within `reach` (inside the beam when `cone`), nearest first, at most `cap`
   * (stable order: distance, then index - no caster-sort flicker) */
  const tmpPC = [];
  function propsFor(x, y, reach, cone, cap) {
    tmpPC.length = 0; if (!(cap > 0)) return [];
    for (const p of S.props) {
      const d = Math.hypot(clamp(x, p.x, p.x + p.w) - x, clamp(y, p.y, p.y + p.h) - y); if (d >= reach) continue;
      if (cone && d > 0) { const dc = Math.hypot(p.cx - x, p.cy - y), hs = dc > p.hd ? Math.asin(p.hd / dc) : Math.PI, a = Math.atan2(p.cy - y, p.cx - x) - cone[0];
        if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) - hs > cone[1]) continue; }
      tmpPC.push([d, p.n, p]);
    }
    tmpPC.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const out = []; for (let k = 0; k < tmpPC.length && k < cap; k++) out.push(tmpPC[k][2]); return out;
  }
  function hull(pts) {                                                      // monotone chain (SH7 donor), flat [x, y, ...] -> counter-clockwise
    const P = []; for (let i = 0; i < pts.length; i += 2) P.push([pts[i], pts[i + 1]]);
    P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop(); const out = []; for (const p of lo.concat(up)) out.push(p[0], p[1]); return out;
  }
  /* a prop's floor shadow from a source point (sx, sy) at height sh: the hull of its base and its projected top, or null
   * (a source inside the box below its top lights nothing outside it: no shadow to draw) */
  const tmpH = [];
  function propHull(p, sx, sy, sh, kmax) {
    if (sx >= p.x && sx <= p.x + p.w && sy >= p.y && sy <= p.y + p.h && sh <= p.hp + 1) return null;
    const kk = sh > p.hp + 1 ? Math.min(kmax, p.hp / (sh - p.hp)) : kmax; tmpH.length = 0;
    for (let k = 0; k < 4; k++) { const cx = k === 1 || k === 2 ? p.x + p.w : p.x, cy = k >= 2 ? p.y + p.h : p.y; tmpH.push(cx, cy, cx + (cx - sx) * kk, cy + (cy - sy) * kk); }
    return hull(tmpH);
  }
  /* BR2.1C: a prop's shadow is solid at its footprint and fades toward its projected top (the far end of a box's shadow:
   * height impression, no uniform slab): a gradient along the projection, 1 up to `hold`, down to `tip` at the far end */
  const PFADE = { hold: .35, lamp: .3, carried: .2 };
  function propGrad(p, sx, sy, sh, kmax) {
    const kk = sh > p.hp + 1 ? Math.min(kmax, p.hp / (sh - p.hp)) : kmax, dx = p.cx - sx, dy = p.cy - sy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const ext = (Math.abs(ux) * p.w + Math.abs(uy) * p.h) / 2 * (1 + kk), ex = p.cx + dx * kk + ux * ext, ey = p.cy + dy * kk + uy * ext;
    return [p.cx, p.cy, ex, ey];
  }
  /* how much of a source point's light a prop takes away at (x, y): 0 outside its floor shadow and on its own top */
  function propShadowAlpha(p, sx, sy, sh, kmax, x, y, tip) {
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return 0;
    const h = propHull(p, sx, sy, sh, kmax); if (!h || h.length < 6) return 0;
    for (let i = 0; i < h.length; i += 2) { const ax = h[i], ay = h[i + 1], bx = h[(i + 2) % h.length], by = h[(i + 3) % h.length]; if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return 0; }
    const [x0, y0, x1, y1] = propGrad(p, sx, sy, sh, kmax), L2 = (x1 - x0) ** 2 + (y1 - y0) ** 2, t = L2 > 0 ? clamp(((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / L2, 0, 1) : 0;
    return t <= PFADE.hold ? 1 : 1 + (tip - 1) * (t - PFADE.hold) / (1 - PFADE.hold);
  }
  const inPropShadow = (p, sx, sy, sh, kmax, x, y) => propShadowAlpha(p, sx, sy, sh, kmax, x, y, 1) > 0;
  /* fill each prop's shadow from one source point with its graded alpha (white; the caller picks the composite operation) */
  function propFills(c, props, sx, sy, sh, kmax, tip) {
    let n = 0;
    for (const p of props) {
      const h = propHull(p, sx, sy, sh, kmax); if (!h || h.length < 6) continue;
      c.beginPath(); c.moveTo(h[h.length - 2], h[h.length - 1]); for (let k = h.length - 4; k >= 0; k -= 2) c.lineTo(h[k], h[k + 1]); c.closePath();
      c.moveTo(p.x, p.y); c.lineTo(p.x + p.w, p.y); c.lineTo(p.x + p.w, p.y + p.h); c.lineTo(p.x, p.y + p.h); c.closePath();   // its own top: the opposite winding (lit)
      const [x0, y0, x1, y1] = propGrad(p, sx, sy, sh, kmax), g = c.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, rgba(1)); g.addColorStop(PFADE.hold, rgba(1)); g.addColorStop(1, rgba(tip)); c.fillStyle = g; c.fill(); n++;
    }
    ST.propDraws += n; return n;
  }
  /* the shadow one point source at (lx, ly) casts within `reach`: for every blocker side that faces it, the polygon from the
   * side's two corners projected away from the source (through a middle point, so the far side always lies beyond the
   * reach); then each selected prop's floor shadow from that point (at height sh), with the prop's own top cut back out.
   * All of them go into ONE path (one winding for every shadow, the opposite for a prop's top; filled once, nonzero: their
   * union, no seams).  `cone` = [aim, half width] keeps only the sides inside a beam.  Returns how many sides / props cast. */
  function shadowPath(c, lx, ly, reach, cone, props, sh, kmax) {
    const E = S.edges, st = S.stamp, q = ++S.q, x0 = lx - reach, x1 = lx + reach, y0 = ly - reach, y1 = ly + reach, D = reach * 1.5 + 4;
    let n = 0; c.beginPath();
    if (props) for (const p of props) {
      const h = propHull(p, lx, ly, sh, kmax); if (!h || h.length < 6) continue;
      c.moveTo(h[h.length - 2], h[h.length - 1]); for (let k = h.length - 4; k >= 0; k -= 2) c.lineTo(h[k], h[k + 1]); c.closePath();   // reversed: winds like the wall shadows
      c.moveTo(p.x, p.y); c.lineTo(p.x + p.w, p.y); c.lineTo(p.x + p.w, p.y + p.h); c.lineTo(p.x, p.y + p.h); c.closePath();   // its own top: the opposite winding (lit)
      n++;
    }
    for (let by = Math.floor(y0 / VB); by <= Math.floor(y1 / VB); by++) for (let bx = Math.floor(x0 / VB); bx <= Math.floor(x1 / VB); bx++) {
      const l = S.egrid.get(by * 4096 + bx); if (!l) continue;
      for (const j of l) {
        if (st[j] === q) continue; st[j] = q; const o = j * 6;
        let ax = E[o], ay = E[o + 1], bx_ = E[o + 2], by_ = E[o + 3];
        if ((lx - ax) * E[o + 4] + (ly - ay) * E[o + 5] <= .01) continue;  // faces away (or edge-on): its far side casts nothing new
        if (ax === bx_) { if (ax < x0 || ax > x1) continue; const s0 = Math.max(Math.min(ay, by_), y0), s1 = Math.min(Math.max(ay, by_), y1); if (s0 >= s1) continue; ay = s0; by_ = s1; }
        else { if (ay < y0 || ay > y1) continue; const s0 = Math.max(Math.min(ax, bx_), x0), s1 = Math.min(Math.max(ax, bx_), x1); if (s0 >= s1) continue; ax = s0; bx_ = s1; }   // only the part in reach
        let ux = ax - lx, uy = ay - ly, vx = bx_ - lx, vy = by_ - ly;
        if (ux * vy - uy * vx < 0) { let t = ux; ux = vx; vx = t; t = uy; uy = vy; vy = t; }   // one winding for all
        const da = Math.hypot(ux, uy), db = Math.hypot(vx, vy); if (!(da > 1e-6 && db > 1e-6)) continue;
        if (cone) {                                                         // inside the beam?  (the side's angular span meets the cone)
          const d1 = Math.atan2(Math.sin(Math.atan2(uy, ux) - cone[0]), Math.cos(Math.atan2(uy, ux) - cone[0])), span = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
          if (!((d1 <= cone[1] && d1 + span >= -cone[1]) || d1 + span - Math.PI * 2 >= -cone[1])) continue;
        }
        const mx = ux / da + vx / db, my = uy / da + vy / db, ml = Math.hypot(mx, my) || 1;
        c.moveTo(lx + ux, ly + uy); c.lineTo(lx + vx, ly + vy); c.lineTo(lx + vx / db * D, ly + vy / db * D); c.lineTo(lx + mx / ml * D, ly + my / ml * D); c.lineTo(lx + ux / da * D, ly + uy / da * D); c.closePath();
        n++;
      }
    }
    return n;
  }
  /* a source point offset from a light's centre, pulled back if a wall or pillar stands between them (the game's ray query) */
  function reachable(cx, cy, x, y) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d < 1e-6) return [cx, cy];
    const u = window.__api.Uc(cx, cy, Math.atan2(dy, dx), d); if (u >= d) return [x, y];
    const s = Math.max(0, u - 1) / d; return [cx + dx * s, cy + dy * s];
  }
  /* the points a fluorescent fixture shines from: n over the tube, in two staggered rows when n >= 8 (flat [x, y, ...]) */
  function tubePoints(L, n) {
    const rows = n >= 8 ? 2 : 1, per = Math.ceil(n / rows), out = [];
    for (let k = 0; k < n; k++) { const row = k % rows, j = Math.floor(k / rows), u = rows === 2 ? (j + (row ? .75 : .25)) / per : (j + .5) / per;
      const p = reachable(L.x, L.y, L.x + LAMP.tubeX * (2 * u - 1), L.y + (rows === 2 ? (row ? 1 : -1) * LAMP.tubeY : 0)); out.push(p[0], p[1]); }
    return out;
  }
  /* the points a carried light shines from: n across the hand (perpendicular to the aim; around the flame for a lantern) */
  function sourcePoints(x, y, ang, omni, n) {
    if (n <= 1) return [x, y];
    const out = [], s = omni ? SRC.omni : SRC.beam;
    for (let k = 0; k < n; k++) { let px, py;
      if (omni) { const a = Math.PI / 4 + Math.PI * 2 * k / n; px = x + Math.cos(a) * s; py = y + Math.sin(a) * s; }   // a lantern's flame: fixed ring (no wobble as you turn)
      else { const u = (2 * k / (n - 1) - 1) * s; px = x - Math.sin(ang) * u; py = y + Math.cos(ang) * u; }
      const p = reachable(x, y, px, py); out.push(p[0], p[1]); }
    return out;
  }
  /* the canvases' filter support (a light blur of a lamp's shadow mask; skipped where the browser has none) */
  function blurSupported() { try { const c = mkCanvas(2, 2).getContext('2d'); if (!c || !('filter' in c)) return false; c.filter = 'blur(1px)'; return c.filter === 'blur(1px)'; } catch (e) { return false; } }
  /* BR-RoLE 1.1: a lamp's field.  fall(d): the smooth falloff of the distance d to the tube, no edge anywhere (a smoothstep
   * takes its last < 1 % to zero at the technical bound); tubeDist: that distance, from a point's offset to the lamp centre */
  const sm = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };
  const fall = d => !(d < LAMP.far) ? 0 : Math.exp(-Math.pow(d / LAMP.S, LAMP.P)) * (d <= LAMP.tail0 ? 1 : 1 - sm(LAMP.tail0, LAMP.far, d));
  const tubeDist = (dx, dy) => Math.hypot(Math.max(0, Math.abs(dx) - LAMP.a), dy);
  const wcore = d => 1 - sm(LAMP.x0, LAMP.x1, d);
  /* the unobstructed fields, once per tier (the same for every lamp: drawn 1:1 into each lamp's cache, then shadowed): the
   * core f · wc over ±(x1 + a) x ±x1 and the far f · (1 - wc) over ±(far + a) x ±far, at strength P0, exact per pixel */
  function fieldCanvas(hx, hy, res, fn, gain = 1) {
    const w = Math.max(4, Math.ceil(2 * hx * res)), h = Math.max(4, Math.ceil(2 * hy * res)), HX = w / res / 2, HY = h / res / 2, cv = mkCanvas(w, h), x = cv.getContext('2d'), img = x.createImageData(w, h), D = img.data;
    for (let j = 0; j < h; j++) { const dy = (j + .5) / res - HY; for (let i = 0; i < w; i++) { const o = (j * w + i) * 4; D[o] = D[o + 1] = D[o + 2] = 255; D[o + 3] = Math.round(255 * clamp(gain * LAMP.P0 * fn(tubeDist((i + .5) / res - HX, dy)), 0, 1)); } }
    x.putImageData(img, 0, 0); return { cv, w, h, hx: HX, hy: HY, res };
  }
  function templates(cfg) {
    if (S.tpl && S.tpl.q === S.quality) return S.tpl;
    if (S.tpl) { S.tpl.core.cv.width = 0; S.tpl.far.cv.width = 0; }
    S.tpl = { q: S.quality, core: fieldCanvas(LAMP.x1 + LAMP.a + 4, LAMP.x1 + 4, cfg.lampRes, d => SPILL.direct * fall(d) * wcore(d)), far: fieldCanvas(LAMP.far + LAMP.a + 4, LAMP.far + 4, cfg.farRes, d => SPILL.direct * fall(d) * (1 - wcore(d)), LAMP.fg) };
    return S.tpl;
  }
  /* the shadows a fixture's tube points cast, averaged into `m` (white = all of this light gone; umbra where no point sees,
   * penumbra where some do), props graded; `tmp` a pooled canvas the same size (per point, when there are props) */
  function tubeShadows(m, tmp, w, h, tf, smp, reach, props) {
    const n = smp.length / 2, a = (Math.ceil(255 / n) + .4) / 255; let edges = 0;
    m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1; m.clearRect(0, 0, w, h);
    m.setTransform(...tf); m.globalCompositeOperation = 'lighter'; m.fillStyle = rgba(a);   // n of them saturate: umbra = all of this light gone
    if (!props.length) for (let s = 0; s < smp.length; s += 2) { const e = shadowPath(m, smp[s], smp[s + 1], reach, null, null, 0, 0); if (e) m.fill(); edges += e; }
    else {                                                                  // per tube point: walls (solid) and props (graded) united, then averaged in
      const t = tmp.getContext('2d');
      for (let s = 0; s < smp.length; s += 2) {
        t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1; t.clearRect(0, 0, w, h);
        t.setTransform(...tf); t.fillStyle = '#fff';
        const e = shadowPath(t, smp[s], smp[s + 1], reach, null, null, 0, 0); if (e) t.fill(); edges += e + propFills(t, props, smp[s], smp[s + 1], LAMP.h, LAMP.kmax, PFADE.lamp);
        m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.globalAlpha = a; m.drawImage(tmp, 0, 0); m.restore();
      }
    }
    m.globalCompositeOperation = 'source-over'; m.setTransform(1, 0, 0, 1, 0, 0);
    return edges;
  }
  /* a lamp's CORE shadowed field, built once per tier: the core field at strength P0, then the shadows its whole tube casts
   * (each tube point's shadow, averaged) taken out of it.  Its far field and bounce light follow over the next frames */
  function buildLamp(i, L, cfg) {
    const t0 = now(), tp = templates(cfg).core, res = tp.res, w = tp.w, h = tp.h, cv = mkCanvas(w, h), c = cv.getContext('2d');
    c.drawImage(tp.cv, 0, 0);
    if (!S.lmask || S.lmask.width !== w || S.lmask.height !== h) { S.lmask = mkCanvas(w, h); S.ltmp = mkCanvas(w, h); }
    const smp = tubePoints(L, cfg.tube), reach = tp.hx + LAMP.tubeX + 4, props = propsFor(L.x, L.y, LAMP.x1 + LAMP.a + LAMP.tubeX, null, cfg.props);
    const edges = tubeShadows(S.lmask.getContext('2d'), S.ltmp, w, h, [res, 0, 0, res, (tp.hx - L.x) * res, (tp.hy - L.y) * res], smp, reach, props);
    c.globalCompositeOperation = 'destination-out';
    if (S.blur) c.filter = `blur(${(LAMP.blur * res).toFixed(2)}px)`;
    c.drawImage(S.lmask, 0, 0); if (S.blur) c.filter = 'none';
    c.globalCompositeOperation = 'source-over';
    extrude(c, S.ltmp, res, (tp.hx - L.x) * res, (tp.hy - L.y) * res, L.x, L.y, reach, [0, 0, w, h]);   // QA1: the faces turned to it receive its light
    const bms = now() - t0; ST.lampBuilds++; ST.lampBuildMs += bms; if (bms > ST.lampBuildMax) ST.lampBuildMax = bms;
    return { cv, hx: tp.hx, hy: tp.hy, smp, edges, props, born: -1e9, used: ST.frames, far: null, farBorn: -1e9, emit: 0 };
  }

  /* ---------- BR-RoLE 1.1: a lamp's FAR field and its bounce light (one low-resolution cache, built in steps) ---------- */
  /* the room a point is in (the game's room table) -> its name, for the albedo; '' outside every room (the corridors) */
  function roomName(x, y) {
    const R = S.rooms || (S.rooms = (window.__api && Array.isArray(window.__api.Oc) ? window.__api.Oc : []).filter(r => r && Number.isFinite(r.x + r.y + r.w + r.h)));
    const cx = x / T, cy = y / T; for (const r of R) if (cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h) return r.name || ''; return '';
  }
  const albedo = (kind, x, y) => { const t = ALBEDO[kind], v = t[roomName(x, y)]; return v === undefined ? t[''] : v; };
  /* the bounce points of a lamp: every wall / pillar side facing it within reach, sampled every wallStep (2 px in front of
   * the side), and the floor on a world grid every floorStep; each with the light it re-emits (P0 scale): irradiance (the
   * lamp's field x the cosine on a wall) x the share of 3 tube points that see it (the game's ray query: walls and pillars
   * stop it) x its albedo x the bounce share x the surface it stands for.  Deterministic: geometry only */
  function bouncePoints(L, cfg) {
    const A = window.__api, out = [], E = S.edges, st = S.stamp, q = ++S.q, R = SPILL.reach + LAMP.a, ws = cfg.wallStep, fs = cfg.floorStep;
    const tp = tubePoints(L, 3);
    const vis = (x, y) => { let v = 0; for (let s = 0; s < tp.length; s += 2) { const dx = x - tp[s], dy = y - tp[s + 1], d = Math.hypot(dx, dy); if (d < .5 || A.Uc(tp[s], tp[s + 1], Math.atan2(dy, dx), d) >= d - .5) v++; } return v / (tp.length / 2); };
    for (let by = Math.floor((L.y - R) / VB); by <= Math.floor((L.y + R) / VB); by++) for (let bx = Math.floor((L.x - R) / VB); bx <= Math.floor((L.x + R) / VB); bx++) {
      const l = S.egrid.get(by * 4096 + bx); if (!l) continue;
      for (const j of l) {
        if (st[j] === q) continue; st[j] = q; const o = j * 6, nx = E[o + 4], ny = E[o + 5];
        let ax = E[o], ay = E[o + 1], bx_ = E[o + 2], by_ = E[o + 3];
        if ((L.x - ax) * nx + (L.y - ay) * ny <= .01) continue;            // faces away: the lamp cannot light it
        if (ax === bx_) { const s0 = Math.max(Math.min(ay, by_), L.y - R), s1 = Math.min(Math.max(ay, by_), L.y + R); if (s0 >= s1 || Math.abs(ax - L.x) > R) continue; ay = s0; by_ = s1; }
        else { const s0 = Math.max(Math.min(ax, bx_), L.x - R), s1 = Math.min(Math.max(ax, bx_), L.x + R); if (s0 >= s1 || Math.abs(ay - L.y) > R) continue; ax = s0; bx_ = s1; }
        const len = Math.hypot(bx_ - ax, by_ - ay), k = Math.max(1, Math.round(len / ws)), seg = len / k;
        for (let s = 0; s < k; s++) {
          const u = (s + .5) / k, x = ax + (bx_ - ax) * u + nx * 2, y = ay + (by_ - ay) * u + ny * 2, d = tubeDist(x - L.x, y - L.y); if (!(d < SPILL.reach)) continue;
          const r = Math.hypot(L.x - x, L.y - y) || 1, cos = ((L.x - x) * nx + (L.y - y) * ny) / r, g = SPILL.direct * fall(d) * cos; if (!(g > 1e-4)) continue;
          const I0 = SPILL.wall * LAMP.P0 * g * albedo('wall', x + nx * 24, y + ny * 24) * seg / 48; if (I0 < SPILL.min) continue;
          const v = vis(x, y); if (!v) continue; const I = I0 * v; if (I < SPILL.min) continue;
          out.push({ x, y, nx, ny, I, range: SPILL.wallRange, l: SPILL.lw });
        }
      }
    }
    const FR = SPILL.floorReach + LAMP.a;
    for (let gy = Math.floor((L.y - FR) / fs); gy <= Math.floor((L.y + FR) / fs); gy++) for (let gx = Math.floor((L.x - FR) / fs); gx <= Math.floor((L.x + FR) / fs); gx++) {
      const x = (gx + .5) * fs, y = (gy + .5) * fs, d = tubeDist(x - L.x, y - L.y); if (!(d < SPILL.floorReach)) continue;
      if (A.Hc(Math.floor(x / T), Math.floor(y / T))) continue;            // inside a wall: no floor
      const I0 = SPILL.floor * LAMP.P0 * SPILL.direct * fall(d) * albedo('floor', x, y) * fs * fs / (120 * 120); if (I0 < SPILL.min) continue;
      const v = vis(x, y); if (!v) continue; const I = I0 * v; if (I < SPILL.min) continue;
      out.push({ x, y, nx: 0, ny: 0, I, range: SPILL.floorRange, l: SPILL.lf });
    }
    return out;
  }
  /* one bounce point's light, added into the far cache: its lobe (leaning out of its wall) in a pooled scratch, its own
   * shadows (walls and pillars, from the point) cut out of it, then added.  The lobe reaches zero inside `range` */
  function drawBounce(fc, job, e) {
    const res = job.res, H = e.range + 2, size = Math.ceil(2 * H * res) + 2;
    if (!S.etmp || S.etmp.width < size) { S.etmp = mkCanvas(Math.max(size, 64), Math.max(size, 64)); S.ex = S.etmp.getContext('2d'); }
    const t = S.ex, ox = Math.floor((e.x - H - (job.L.x - job.hx)) * res), oy = Math.floor((e.y - H - (job.L.y - job.hy)) * res);   // the scratch's corner in far-cache pixels
    t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1; t.clearRect(0, 0, size, size);
    t.setTransform(res, 0, 0, res, -(job.L.x - job.hx) * res - ox, -(job.L.y - job.hy) * res - oy);   // world -> scratch
    const lean = e.nx || e.ny ? e.l * SPILL.lean : 0, cx = e.x + e.nx * lean, cy = e.y + e.ny * lean, rg = e.range - lean - 1;
    const g = t.createRadialGradient(cx, cy, 0, cx, cy, rg);
    for (let s = 0; s <= 10; s++) { const r = rg * s / 10, w = s === 10 ? 0 : Math.exp(-Math.pow(r / e.l, SPILL.pw)) * (1 - sm(rg * .6, rg, r)); g.addColorStop(s / 10, rgba(e.I * w * LAMP.fg)); }
    t.fillStyle = g; t.fillRect(e.x - H, e.y - H, 2 * H, 2 * H);
    t.globalCompositeOperation = 'destination-out'; t.fillStyle = '#fff';
    if (shadowPath(t, e.x, e.y, H, null, null, 0, 0)) t.fill();
    t.globalCompositeOperation = 'source-over'; t.setTransform(1, 0, 0, 1, 0, 0);
    fc.globalCompositeOperation = 'lighter'; fc.drawImage(S.etmp, 0, 0, size, size, ox, oy, size, size); fc.globalCompositeOperation = 'source-over';
  }
  /* the far cache of lamp i, built in steps within a time budget: (0) the far field and the shadows the tube casts into it,
   * (1) the bounce points, (2) their light, a few at a time.  Returns true when done */
  function farStep(job, cfg, until) {
    const L = job.L;
    if (job.phase === 0) {
      const tp = templates(cfg).far, w = tp.w, h = tp.h; job.res = tp.res; job.hx = tp.hx; job.hy = tp.hy;
      job.cv = mkCanvas(w, h); const c = job.cv.getContext('2d'); c.drawImage(tp.cv, 0, 0);
      if (!S.fmask || S.fmask.width !== w || S.fmask.height !== h) { S.fmask = mkCanvas(w, h); S.ftmp = mkCanvas(w, h); }
      const res = tp.res, props = propsFor(L.x, L.y, LAMP.far + LAMP.a + LAMP.tubeX, null, cfg.props);
      tubeShadows(S.fmask.getContext('2d'), S.ftmp, w, h, [res, 0, 0, res, (tp.hx - L.x) * res, (tp.hy - L.y) * res], tubePoints(L, cfg.farTube), tp.hx + LAMP.tubeX + 4, props);
      c.globalCompositeOperation = 'destination-out'; if (S.blur) c.filter = 'blur(1.2px)';   // a texel's softening: the few tube points' penumbra steps blend
      c.drawImage(S.fmask, 0, 0); if (S.blur) c.filter = 'none'; c.globalCompositeOperation = 'source-over';
      job.phase = 3; return false;
    }
    if (job.phase === 3) {                                                // QA1: the faces receive its far light too (a step of its own: no hitch)
      const res = job.res, w = job.cv.width, h = job.cv.height;
      if (!S.ftmp || S.ftmp.width !== w || S.ftmp.height !== h) { S.ftmp = mkCanvas(w, h); }
      extrude(job.cv.getContext('2d'), S.ftmp, res, (job.hx - L.x) * res, (job.hy - L.y) * res, L.x, L.y, job.hx + LAMP.tubeX + 4, [0, 0, w, h], 1.5 / res, FACE.farSeg);
      job.phase = 1; return false;
    }
    if (job.phase === 1) { job.emit = S.spillOn ? bouncePoints(L, cfg) : []; job.k = 0; job.phase = 2; return false; }
    const c = job.cv.getContext('2d');
    while (job.k < job.emit.length) { drawBounce(c, job, job.emit[job.k++]); if (now() >= until) break; }
    return job.k >= job.emit.length;
  }
  /* spend this frame's far budget: the lamps drawn now first (nearest first), then the other cached ones (most recent first) */
  function farWork(lampRecs, cfg) {
    const t0 = now(), until = t0 + cfg.farMs, lamps = window.__api.lamps || [];
    let steps = 0;
    while (steps++ < 64) {
      if (S.farJob && S.lampCache.get(S.farJob.i) !== S.farJob.C) S.farJob = null;   // evicted meanwhile
      if (!S.farJob) {
        let pick = null; for (const r of lampRecs) if (!r.C.far) { pick = [r.i, r.C]; break; }
        if (!pick) { const all = [...S.lampCache]; for (let m = all.length - 1; m >= 0; m--) if (!all[m][1].far) { pick = all[m]; break; } }
        if (!pick) break;
        S.farJob = { i: pick[0], C: pick[1], L: lamps[pick[0]], phase: 0, t: 0 };
      }
      const J = S.farJob, ph = J.phase, ts = now(), done = farStep(J, cfg, until), dt = now() - ts; J.t += dt; if (!(ST.farPh[ph] >= dt)) ST.farPh[ph] = +dt.toFixed(2);   // (QA1: the longest step of each phase, DEV stats)
      if (done) { J.C.far = { cv: J.cv, hx: J.hx, hy: J.hy }; J.C.farBorn = ST.frames; J.C.emit = J.emit.length; ST.farBuilds++; ST.farMs += J.t; ST.emitters = J.emit.length; if (J.emit.length > ST.emittersMax) ST.emittersMax = J.emit.length; S.farJob = null; }
      if (now() >= until) break;
    }
    const ms = now() - t0; if (ms > ST.farStepMax) ST.farStepMax = ms;
  }

  /* ---------- the game's own light strengths (drawLight in the bundle), so BR-RoLE lights what v23.3.6 lit ---------- */
  function lampPower(i, L, t) {                                             // a lamp's strength at its centre: dim fixtures (index % 13), failures, NV gain
    const E = window.__ents, C = window.__cam;
    return Math.min(.9, (i % 13 === 0 ? .13 + .06 * Math.max(0, Math.sin(t * 11 + i)) : .43) * (E && E.lamp ? E.lamp(L.x, L.y, t) : 1) * (C && C.lampGain ? C.lampGain() : 1));
  }
  const lampFall = (dx, dy) => SPILL.direct * fall(tubeDist(dx, dy));     // BR-RoLE 1.1: the smooth field of the tube (no radial stops, no edge), its direct share
  const beamGrad = (d, r) => { const s = clamp((d - 6) / (r - 6), 0, 1); return s <= .25 ? 1 - .17 * s / .25 : s <= .7 ? .83 - .55 * (s - .25) / .45 : .28 * (1 - (s - .7) / .3); };
  /* a beam's angular profile: v23.3.6 nests 12 arcs of widths arc·(1 − .063 t); the fraction of them covering an angle φ off
   * the axis, made smooth (no stepped cone) */
  const beamProfile = (ph, arc) => { const lo = arc * (1 - 11 * .063) / 2, hi = arc / 2; if (ph >= hi) return 0; if (ph <= lo) return 1; const u = (hi - ph) / (hi - lo); return u * u * (3 - 2 * u); };
  const rgba = a => `rgba(255,255,255,${clamp(a, 0, 1).toFixed(4)})`;

  /* ---------- canvases ---------- */
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function ensureBuffers(w, h, cfg) {
    const bw = Math.max(1, Math.ceil(w * cfg.scale)), bh = Math.max(1, Math.ceil(h * cfg.scale));
    if (!S.buf || S.buf.width !== bw || S.buf.height !== bh) {
      S.buf = mkCanvas(bw, bh); S.bx = S.buf.getContext('2d');
      S.scr = mkCanvas(bw, bh); S.sx = S.scr.getContext('2d');
      S.tb = mkCanvas(bw, bh); S.tx = S.tb.getContext('2d');
      S.msk = mkCanvas(bw, bh); S.mx = S.msk.getContext('2d');             // a carried light's averaged shadow (several source points)
    }
    ST.buf = [bw, bh];
  }

  /* ---------- one frame: every light into the buffer, the buffer out of the overlay ---------- */
  function draw(n, F) {
    if (!on()) return false;
    const t0 = now();
    try {
      const cfg = TIERS[S.quality], A = window.__api, sc = cfg.scale, k = F.r * sc;
      ensureBuffers(F.w, F.h, cfg);
      const bx = S.bx, tx = S.tx, bw = S.buf.width, bh = S.buf.height;
      ST.shadows = 0; ST.casts = 0; ST.shadeDraws = 0; ST.propDraws = 0;
      for (const c of [bx, tx]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, bw, bh); }
      bx.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc); bx.globalCompositeOperation = 'lighter';
      const view = { x0: -F.ox / F.r, y0: -F.oy / F.r, x1: (F.w - F.ox) / F.r, y1: (F.h - F.oy) / F.r };
      const meet = (x, y, R) => x + R > view.x0 && x - R < view.x1 && y + R > view.y0 && y - R < view.y1;
      const V = F.viewer, rec = S.last = { lamps: [], carried: [] }; S.lastV = V; S.lastF = { r: F.r, ox: F.ox, oy: F.oy, w: F.w, h: F.h, t: F.t, sc, bw, bh };
      /* BR-RoLE 1.1: no ambient glow (no light without a source).  The lamps' far fields and bounce light go into a low- (QA1: eighth-)
       * resolution buffer (low-frequency light), added to the light buffer once at the end */
      const FD = S.fbDiv, fbw = Math.max(1, Math.ceil(bw / FD)), fbh = Math.max(1, Math.ceil(bh / FD));   // QA1: an eighth (the far caches' own density at every tier; was a quarter)
      if (!S.fb || S.fb.width !== fbw || S.fb.height !== fbh) { S.fb = mkCanvas(fbw, fbh); S.fx = S.fb.getContext('2d'); }
      /* QA1: only the box the lamps drew into is cleared next frame and added now (a fixture at the screen's edge, or behind a
       * wall with its light box on screen, no longer costs a full-screen pass) */
      { const fx = S.fx; fx.setTransform(1, 0, 0, 1, 0, 0); fx.globalCompositeOperation = 'source-over'; fx.globalAlpha = 1; clearDirty(fx, S.fbD, fbw, fbh); fx.setTransform(k / FD, 0, 0, k / FD, F.ox * sc / FD, F.oy * sc / FD); fx.globalCompositeOperation = 'lighter'; }
      S.fbUsed = false; ST.fars = 0; S.fbT = [k / FD, F.ox * sc / FD, F.oy * sc / FD]; S.fbD = dirty(S.fbD);
      /* QA1: the lamps' core fields go into a half-resolution buffer, added once.  A core cache holds lampRes px per world px,
       * about half the light buffer's density at every tier, so nothing is lost; the fill each fixture costs drops to a
       * quarter (Level 0 now draws twice the fixtures).  A lamp an actor shadows still goes through the full-resolution scratch */
      const cbw = Math.max(1, Math.ceil(bw / 2)), cbh = Math.max(1, Math.ceil(bh / 2));
      if (S.cbOn) {
        if (!S.cb || S.cb.width !== cbw || S.cb.height !== cbh) { S.cb = mkCanvas(cbw, cbh); S.cbx = S.cb.getContext('2d'); }
        const cx = S.cbx; cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1; if (S.cbLive) clearDirty(cx, S.cbD, cbw, cbh); else cx.clearRect(0, 0, cbw, cbh);
        cx.setTransform(k / 2, 0, 0, k / 2, F.ox * sc / 2, F.oy * sc / 2); cx.globalCompositeOperation = 'lighter'; cx.imageSmoothingEnabled = true;
      }
      S.cbUsed = false; S.cbLive = !!S.cbOn; S.cbT = [k / 2, F.ox * sc / 2, F.oy * sc / 2]; S.cbD = dirty(S.cbD);

      /* ceiling lamps: the ones whose light reaches the screen, nearest the viewer first; the one at the cap fades out.  Each
       * is its cached shadowed field, added at the lamp's strength this frame (flicker, failures, NV gain) */
      let nl = 0; const lampRecs = [];
      if (S.lampKey !== S.quality) { for (const C of S.lampCache.values()) { C.cv.width = 0; if (C.far) C.far.cv.width = 0; } S.lampCache.clear(); S.pending.clear(); S.farJob = null; S.lampKey = S.quality; }
      if (!(A.V && A.V.blackout)) {
        const lamps = A.lamps || [], list = [], tb0 = now(), pend = new Set(); let built = 0, RF = LAMP.far + LAMP.a;
        const canBuild = () => built < cfg.builds && (built === 0 || now() - tb0 < LAMP.buildMs);
        /* a lamp counts if its light reaches the screen AND the line of sight's reach (SIGHT.r around the viewer: nothing past it
         * is ever shown), so the tier's cap goes to the lamps that can light what you see */
        for (let i = 0; i < lamps.length; i++) { if (S.solo && !S.solo.has(i)) continue; const L = lamps[i], d = Math.hypot(L.x - V.x, L.y - V.y); if (d < SIGHT.r + RF && meet(L.x, L.y, RF)) list.push([d, i]); }
        list.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        const cut = list.length > cfg.lamps ? list[cfg.lamps][0] : Infinity;
        for (let m = 0; m < list.length && m < cfg.lamps; m++) {
          const i = list[m][1], L = lamps[i];
          let C = S.lampCache.get(i);
          if (!C) {
            if (!canBuild()) { pend.add(i); continue; }                     // built over the next frames (then faded in, no hitch)
            C = buildLamp(i, L, cfg); built++; if (S.pending.has(i)) C.born = ST.frames; S.lampCache.set(i, C);
          } else { S.lampCache.delete(i); S.lampCache.set(i, C); }          // most recently used last
          C.used = ST.frames;
          const p = lampPower(i, L, F.t) * LAMP.vis * (m === cfg.lamps - 1 ? clamp((cut - list[m][0]) / 140, 0, 1) : 1) * clamp((ST.frames - C.born) / LAMP.fadeFrames, 0, 1);   // only the last admitted fades (no pop at the cap)
          if (!(p > .002)) continue;
          lampRecs.push({ i, L, p, C, smp: C.smp, props: C.props, acts: [] });
        }
        if (canBuild() && S.lampCache.size < cfg.lampCache) {               // spare budget AND room in the cache (QA1: never evict to prefetch, no build / evict churn): the nearest lamp about to come into view
          let best = -1, bd = Infinity;
          for (let i = 0; i < lamps.length; i++) { const L = lamps[i]; if (S.lampCache.has(i) || !meet(L.x, L.y, RF + LAMP.prefetch)) continue; const d = Math.hypot(L.x - V.x, L.y - V.y); if (d < bd) { bd = d; best = i; } }
          if (best >= 0) { const C = buildLamp(best, lamps[best], cfg); C.used = ST.frames; S.lampCache.set(best, C); }
        }
        for (const [i, C] of S.lampCache) { if (S.lampCache.size <= cfg.lampCache) break; if (C.used !== ST.frames) { C.cv.width = 0; if (C.far) C.far.cv.width = 0; S.lampCache.delete(i); ST.lampEvictions++; } }
        S.pending = pend;
        farWork(lampRecs, cfg);                                             // BR-RoLE 1.1: far fields and bounce light, within this frame's budget
      }

      /* carried lights: yours (the hand that holds it, or the death torch), then the nearest other wanderers' */
      const Gc = A.Gc || {}, lights = [];
      const own = Gc[F.kind];
      if (F.on && own && !own.nv && own.range > 1 && F.src) lights.push({ x: F.src.x, y: F.src.y, ang: F.src.angle ?? (A.H && A.H.angle) ?? 0, f: own, color: F.color, glowR: F.death ? 150 : 52, glowA: F.death ? .73 : .35, fl: own.omni ? .93 + Math.sin(F.t * 17) * .035 + Math.sin(F.t * 31) * .025 : 1, own: true, kind: F.kind });
      let np = 0;
      if (cfg.peers > 0 && Array.isArray(window.__peerLights)) {
        const ps = window.__peerLights.filter(p => p && p.on && !p.dead && p.kind !== 'camcorder' && Gc[p.kind || 'flashlight'] && !Gc[p.kind || 'flashlight'].nv && Number.isFinite(p.x + p.y))
          .map(p => [Math.hypot(p.x - V.x, p.y - V.y), p]).sort((a, b) => a[0] - b[0]);
        const cut = ps.length > cfg.peers ? ps[cfg.peers][0] : Infinity;
        for (let m = 0; m < ps.length && m < cfg.peers; m++) { const p = ps[m][1], f = Gc[p.kind || 'flashlight'], w = m === cfg.peers - 1 ? clamp((cut - ps[m][0]) / 80, 0, 1) : 1; if (w > .01) { lights.push({ x: p.x, y: p.y, ang: p.angle || 0, f, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#ffe7b2', glowR: 52, glowA: .35, fl: f.omni ? .93 + Math.sin(F.t * 17 + p.x) * .035 + Math.sin(F.t * 31 + p.y) * .025 : 1, w, kind: p.kind || 'flashlight' }); np++; } }
      }
      S.propLeft = cfg.propFrame; ST.props = 0;                            // prop casters for all carried lights this frame (yours first)
      const carRecs = [];
      for (const Lc of lights) if (meet(Lc.x, Lc.y, Lc.f.range)) { const r = prepCarried(Lc, cfg); if (r) carRecs.push(r); }
      /* QA2: the camcorder's infrared, only while this player's night-vision sensor is on: yours, then the nearest other
       * camcorders' (the tier's peer cap), each a light of its own */
      const irRecs = [], CAM = window.__cam;
      if (S.irOn && CAM && CAM.nv && typeof CAM.irLights === 'function' && CAM.irProfile) {
        const src = F.death || !F.src ? null : { x: F.src.x, y: F.src.y, angle: F.src.angle ?? (A.H && A.H.angle) ?? 0 };
        const es = CAM.irLights(src).map(e => [e.own ? -1 : Math.hypot(e.x - V.x, e.y - V.y), e]).sort((a, b) => a[0] - b[0]);
        let npi = 0; for (const [, e] of es) { if (!e.own && npi++ >= cfg.peers) break; if (!meet(e.x, e.y, e.P.range)) continue; const r = prepIR(e, cfg); if (r) irRecs.push(r); }
      }

      /* actors (BR2B): each blocks its dominant light only - known before any light is drawn */
      actorShadows(F, cfg, lampRecs, carRecs);

      /* the lamps: each its cached shadowed field at this frame's strength; one that an actor shadows goes through the scratch */
      for (const r of lampRecs) { drawLamp(r, F, k, sc); nl++; rec.lamps.push({ i: r.i, p: r.p, smp: r.smp, props: r.props, far: !!r.C.far }); }
      { const d = S.cbUsed && boxOf(S.cbD, cbw, cbh); if (d) { bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'lighter'; bx.globalAlpha = 1; bx.imageSmoothingEnabled = true; bx.drawImage(S.cb, d[0], d[1], d[2] - d[0], d[3] - d[1], d[0] * 2, d[1] * 2, (d[2] - d[0]) * 2, (d[3] - d[1]) * 2); bx.restore(); } }
      { const d = S.fbUsed && !S.skip.fb && boxOf(S.fbD, fbw, fbh); if (d) { bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'lighter'; bx.globalAlpha = 1 / LAMP.fg; bx.imageSmoothingEnabled = true; bx.drawImage(S.fb, d[0], d[1], d[2] - d[0], d[3] - d[1], d[0] * FD, d[1] * FD, (d[2] - d[0]) * FD, (d[3] - d[1]) * FD); bx.restore(); } }
      /* the carried lights */
      for (const r of carRecs) carried(r, F, cfg, k, rec);
      /* QA2: the infrared (the sensor's picture) */
      rec.ir = []; for (const r of irRecs) irLight(r, F, cfg, k, rec); ST.ir = irRecs.length;

      /* BR-RoLE 1.1: the sight limit is not a hard circle of light.  drawLight's line of sight (its clip, unchanged) ends
       * SIGHT.r from the viewer; every light fades out over the last SIGHT.fade before it, so lit floor never ends in a sharp
       * arc.  This only ever removes light: nothing is shown that was not shown before.  Only the ring is filled: the clip never
       * reaches past SIGHT.r */
      if (S.sightFade && Math.max(Math.abs(view.x0 - V.x), Math.abs(view.x1 - V.x), Math.abs(view.y0 - V.y), Math.abs(view.y1 - V.y)) * Math.SQRT2 > SIGHT.r - SIGHT.fade) {
        const r1 = SIGHT.r, r0 = r1 - SIGHT.fade;
        for (const c of rec.carried.some(c => c.tint) ? [bx, tx] : [bx]) {
          c.save(); c.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc); c.globalCompositeOperation = 'destination-out'; c.globalAlpha = 1;
          const g = c.createRadialGradient(V.x, V.y, r0, V.x, V.y, r1); for (let s = 0; s <= 8; s++) g.addColorStop(s / 8, rgba(sm(0, 1, s / 8)));
          c.fillStyle = g; c.beginPath(); c.arc(V.x, V.y, r1 + 2, 0, Math.PI * 2); c.arc(V.x, V.y, r0, 0, Math.PI * 2, true); c.fill('evenodd'); c.restore();   // the ring only: past it the clip shows nothing
        }
      }

      /* into the overlay: it loses exactly the light that reached each pixel (inside drawLight's line-of-sight clip), then
       * the carried lights' colour */
      n.save(); n.setTransform(1, 0, 0, 1, 0, 0); n.globalAlpha = 1; n.imageSmoothingEnabled = true;
      n.globalCompositeOperation = 'destination-out'; n.drawImage(S.buf, 0, 0, bw, bh, 0, 0, F.w, F.h);
      if (rec.carried.some(c => c.tint)) { n.globalCompositeOperation = 'source-over'; n.globalAlpha = TINT.k; n.drawImage(S.tb, 0, 0, bw, bh, 0, 0, F.w, F.h); n.globalAlpha = 1; }
      n.restore();

      cullAO(view);
      ST.lamps = nl; if (nl > ST.lampsMax) ST.lampsMax = nl; ST.carried = rec.carried.length; ST.peers = np; if (ST.shadows > ST.shadowsMax) ST.shadowsMax = ST.shadows; if (ST.props > ST.propsMax) ST.propsMax = ST.props;
      const ms = now() - t0; ST.ms[ST.n % ST.ms.length] = ms; ST.n++; if (ms > ST.max) ST.max = ms; ST.frames++;
      if (ST.frames % 15 === 0) debugPanel();
      return true;
    } catch (e) { disable('frame error', e); return false; }
  }
  /* the shadows a light casts into the field drawn in `c` (the scratch, buffer pixels; bb its box): from one source point
   * straight out of the field; from several, their average (umbra where no point sees, penumbra where some do).  `cast`:
   * the light's prop casters, its height and longest prop shadow */
  function castInto(c, smp, reach, cone, F, k, sc, bb, cast) {
    const props = cast && cast.props.length ? cast.props : null, sh = cast ? cast.sh : 0, kmax = cast ? cast.kmax : 0;
    const n = smp.length / 2; let e = 0;
    if (n === 1) {                                                          // one point: walls cut out, then each prop's graded shadow (destination-out multiplies: a union)
      boxClip(c, bb);
      c.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#fff';
      e = shadowPath(c, smp[0], smp[1], reach, cone, null, 0, 0); if (e) c.fill();
      if (props) e += propFills(c, props, smp[0], smp[1], sh, kmax, PFADE.carried);
      c.restore();
    } else {
      const m = S.mx, bw = bb[2] - bb[0], bh = bb[3] - bb[1], a = (Math.ceil(255 / n) + .4) / 255;
      m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1; m.clearRect(bb[0], bb[1], bw, bh); boxClip(m, bb);
      if (!props) {
        m.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc); m.globalCompositeOperation = 'lighter'; m.fillStyle = rgba(a);   // n of them saturate: umbra = all of this light gone
        for (let s = 0; s < smp.length; s += 2) { const q = shadowPath(m, smp[s], smp[s + 1], reach, cone, null, 0, 0); if (q) m.fill(); e += q; }
      } else {                                                              // with props: each point's walls + graded props united in a pooled canvas, then averaged in
        if (!S.ctmp || S.ctmp.width !== S.msk.width || S.ctmp.height !== S.msk.height) { S.ctmp = mkCanvas(S.msk.width, S.msk.height); S.cx = S.ctmp.getContext('2d'); }
        const t = S.cx;
        for (let s = 0; s < smp.length; s += 2) {
          t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1; t.clearRect(bb[0], bb[1], bw, bh);
          boxClip(t, bb); t.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc); t.fillStyle = '#fff';
          const q = shadowPath(t, smp[s], smp[s + 1], reach, cone, null, 0, 0); if (q) t.fill(); e += q + propFills(t, props, smp[s], smp[s + 1], sh, kmax, PFADE.carried); t.restore();
          m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'lighter'; m.globalAlpha = a; m.drawImage(S.ctmp, bb[0], bb[1], bw, bh, bb[0], bb[1], bw, bh); m.globalAlpha = 1;
        }
      }
      m.restore(); m.globalCompositeOperation = 'source-over';
      if (e) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-out'; c.drawImage(S.msk, bb[0], bb[1], bw, bh, bb[0], bb[1], bw, bh); }
    }
    c.globalCompositeOperation = 'source-over'; ST.shadows += e; return e;
  }
  /* a box (buffer pixels) around a world point and radius, clamped to the buffer; null when off it */
  function boxAt(x, y, R, F, sc) {
    const bxp = (x * F.r + F.ox) * sc, byp = (y * F.r + F.oy) * sc, rp = R * F.r * sc + 2;
    const bb = [Math.max(0, Math.floor(bxp - rp)), Math.max(0, Math.floor(byp - rp)), Math.min(S.scr.width, Math.ceil(bxp + rp)), Math.min(S.scr.height, Math.ceil(byp + rp))];
    return bb[2] > bb[0] && bb[3] > bb[1] ? bb : null;
  }
  /* BR3: a beam's box is its sector's (the field is zero outside its cone), not its whole circle */
  function sectorBox(x, y, R, ang, half, F, sc) {
    if (half >= Math.PI) return boxAt(x, y, R, F, sc);
    let x0 = x - 8, x1 = x + 8, y0 = y - 8, y1 = y + 8;
    const add = a => { const px = x + Math.cos(a) * R, py = y + Math.sin(a) * R; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); };
    add(ang - half); add(ang + half);
    for (let q = -4; q <= 4; q++) { const a = q * Math.PI / 2, d = Math.atan2(Math.sin(a - ang), Math.cos(a - ang)); if (Math.abs(d) <= half) add(ang + d); }
    const k = F.r * sc, bb = [Math.max(0, Math.floor((x0 * F.r + F.ox) * sc - 2)), Math.max(0, Math.floor((y0 * F.r + F.oy) * sc - 2)), Math.min(S.scr.width, Math.ceil((x1 * F.r + F.ox) * sc + 2)), Math.min(S.scr.height, Math.ceil((y1 * F.r + F.oy) * sc + 2))];
    void k; return bb[2] > bb[0] && bb[3] > bb[1] ? bb : null;
  }
  /* BR3: shadow fills stay inside the light's own box (an axis-aligned pixel box - never a visibility shape) */
  const boxClip = (c, bb) => { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.beginPath(); c.rect(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]); c.clip(); };
  /* one lamp: its cached shadowed field at this frame's strength, added.  When an actor's shadow belongs to it, the field
   * goes through the scratch first and loses that shadow there (only this lamp's light: every other light still fills it) */
  /* QA1: the boxes (buffer px) the lamps drew into the low-resolution buffers this frame: [x0, y0, x1, y1, prev x0, y0, x1, y1] */
  const dirty = d => { d = d || new Float64Array(8); d[4] = d[0]; d[5] = d[1]; d[6] = d[2]; d[7] = d[3]; d[0] = d[1] = Infinity; d[2] = d[3] = -Infinity; return d; };
  const grow = (d, t, x0, y0, x1, y1) => { const a = x0 * t[0] + t[1], b = y0 * t[0] + t[2], c = x1 * t[0] + t[1], e = y1 * t[0] + t[2]; if (a < d[0]) d[0] = a; if (b < d[1]) d[1] = b; if (c > d[2]) d[2] = c; if (e > d[3]) d[3] = e; };
  const boxOf = (d, w, h, o = 0) => { const x0 = Math.max(0, Math.floor(d[o]) - 1), y0 = Math.max(0, Math.floor(d[o + 1]) - 1), x1 = Math.min(w, Math.ceil(d[o + 2]) + 1), y1 = Math.min(h, Math.ceil(d[o + 3]) + 1); return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : null; };
  const clearDirty = (c, d, w, h) => { if (!d) { c.clearRect(0, 0, w, h); return; } const b = boxOf(d, w, h); if (b) c.clearRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); };   // (last frame's box: everything else is still clear)
  function drawLamp(r, F, k, sc) {
    const bx = S.bx, L = r.L, C = r.C, a = Math.min(1, r.p / LAMP.P0);
    /* BR-RoLE 1.1: its far field and bounce light into the low-resolution buffer (faded in once built).  An actor's
     * shadow takes this lamp's core light (the actors stand where a lamp's light is strong; its faint far light is left) */
    if (C.far && !S.skip.far) { const fa = a * clamp((ST.frames - C.farBorn) / LAMP.fadeFrames, 0, 1); if (fa > .001) { const f = C.far, fx = S.fx; fx.globalAlpha = fa; fx.drawImage(f.cv, L.x - f.hx, L.y - f.hy, f.hx * 2, f.hy * 2); fx.globalAlpha = 1; S.fbUsed = true; ST.fars++; grow(S.fbD, S.fbT, L.x - f.hx, L.y - f.hy, L.x + f.hx, L.y + f.hy); } }
    if (S.skip.core || Math.hypot(L.x - S.lastV.x, L.y - S.lastV.y) - Math.hypot(C.hx, C.hy) > SIGHT.r) return;   // its core cannot reach the line of sight's reach
    if (!r.acts.length) { const tx = S.cbOn && S.cbx ? S.cbx : bx; tx.globalAlpha = a; tx.drawImage(C.cv, L.x - C.hx, L.y - C.hy, C.hx * 2, C.hy * 2); tx.globalAlpha = 1; if (tx !== bx) { S.cbUsed = true; grow(S.cbD, S.cbT, L.x - C.hx, L.y - C.hy, L.x + C.hx, L.y + C.hy); } return; }
    const bb = boxAt(L.x, L.y, Math.max(C.hx, C.hy), F, sc); if (!bb) return;
    const sx = S.sx, bw = bb[2] - bb[0], bh = bb[3] - bb[1];
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-over'; sx.globalAlpha = 1; sx.clearRect(bb[0], bb[1], bw, bh);
    sx.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc); sx.globalAlpha = a; sx.drawImage(C.cv, L.x - C.hx, L.y - C.hy, C.hx * 2, C.hy * 2); sx.globalAlpha = 1;
    castActors(sx, r.acts, F, k, sc);
    sx.setTransform(1, 0, 0, 1, 0, 0);
    bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'lighter'; bx.drawImage(S.scr, bb[0], bb[1], bw, bh, bb[0], bb[1], bw, bh); bx.restore();
  }
  /* a carried light, before anything is drawn: its strength, source points, beam cone, height and prop casters (yours
   * first, then the other wanderers', within the frame's prop budget) */
  function prepCarried(Lc, cfg) {
    const A = window.__api, f = Lc.f, w = Lc.w ?? 1;
    if (A.Hc(Math.floor(Lc.x / T), Math.floor(Lc.y / T))) return null;   // a hand inside a wall lights nothing (v23.3.6: its ray query stops at once)
    const R = f.range, cone = f.omni ? null : [Lc.ang, f.arc / 2 + .2], sh = CARRY.h[Lc.kind] || CARRY.h.flashlight;
    const props = propsFor(Lc.x, Lc.y, R + 8, cone, Math.min(cfg.props, S.propLeft)); S.propLeft -= props.length; ST.props += props.length;
    const gprops = propsFor(Lc.x, Lc.y, Lc.glowR + 4, null, Math.min(cfg.props, S.propLeft)); S.propLeft -= gprops.length; ST.props += gprops.length;
    return { Lc, x: Lc.x, y: Lc.y, ang: Lc.ang, f, R, arc: f.arc, omni: !!f.omni, power: f.power * CARRY.vis * (f.omni ? Lc.fl : 1) * w, w, cone, sh, props, gprops,
      smp: sourcePoints(Lc.x, Lc.y, Lc.ang, !!f.omni, cfg.src), own: !!Lc.own, acts: [] };
  }
  /* one carried light: its natural field (radial falloff x the beam's smooth angular profile), then the shadows walls,
   * pillars and the nearest props cast into it from the hand, then the shadows of the actors it is dominant for; added to
   * the buffer; its colour tint; then its hand glow, the same way */
  function carried(r, F, cfg, k, rec) {
    const sx = S.sx, Lc = r.Lc, f = r.f, R = r.R, sc = cfg.scale, w = r.w, power = r.power;
    const bb = f.omni ? boxAt(Lc.x, Lc.y, R, F, sc) : sectorBox(Lc.x, Lc.y, R, Lc.ang, f.arc / 2 + .05, F, sc); if (!bb) return;
    const bbw = bb[2] - bb[0], bbh = bb[3] - bb[1];
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-over'; sx.globalAlpha = 1; sx.clearRect(bb[0], bb[1], bbw, bbh);
    boxClip(sx, bb);                                                        // BR3: every fill (and the unbounded `in` operations) stays in this light's box
    sx.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc);
    const g = sx.createRadialGradient(Lc.x, Lc.y, 6, Lc.x, Lc.y, R); g.addColorStop(0, rgba(power)); g.addColorStop(.25, rgba(power * .83)); g.addColorStop(.7, rgba(power * .28)); g.addColorStop(1, rgba(0));
    sx.fillStyle = g; sx.fillRect(Lc.x - R, Lc.y - R, R * 2, R * 2);
    if (!f.omni) {                                                          // the beam's soft angular profile (a smooth cone, not a flat one)
      sx.globalCompositeOperation = 'destination-in';
      if (typeof sx.createConicGradient === 'function') {
        const cg = sx.createConicGradient(Lc.ang - Math.PI, Lc.x, Lc.y), TAU = Math.PI * 2;
        for (const u of [0, .3, .45, .55, .65, .75, .85, .93, 1]) { const ph = u * f.arc / 2; cg.addColorStop(clamp(.5 - ph / TAU, 0, 1), rgba(beamProfile(ph, f.arc))); cg.addColorStop(clamp(.5 + ph / TAU, 0, 1), rgba(beamProfile(ph, f.arc))); }
        cg.addColorStop(0, rgba(0)); cg.addColorStop(1, rgba(0)); sx.fillStyle = cg; sx.fillRect(Lc.x - R, Lc.y - R, R * 2, R * 2);
      } else {                                                              // no conic gradients (old browsers): the plain sector
        sx.beginPath(); sx.moveTo(Lc.x, Lc.y); sx.arc(Lc.x, Lc.y, R, Lc.ang - f.arc / 2, Lc.ang + f.arc / 2); sx.closePath(); sx.fillStyle = rgba(1); sx.fill();
      }
      sx.globalCompositeOperation = 'source-over';
    }
    /* the shadows walls, pillars and props cast into that field, from the hand (inside the beam only); then the actors' */
    castInto(sx, r.smp, R + 8, r.cone, F, k, sc, bb, { props: r.props, sh: r.sh, kmax: CARRY.kmax });
    if (r.acts.length) castActors(sx, r.acts, F, k, sc);
    if (!S.ctmp || S.ctmp.width !== S.scr.width || S.ctmp.height !== S.scr.height) { S.ctmp = mkCanvas(S.scr.width, S.scr.height); S.cx = S.ctmp.getContext('2d'); }
    sx.restore(); sx.save(); extrude(sx, S.ctmp, k, F.ox * sc, F.oy * sc, Lc.x, Lc.y, R + 8, bb); sx.restore(); boxClip(sx, bb);   // QA1: the walls and pillars it hits light up (outside the box clip: a face just past the box edge still belongs to this light's box copy)
    /* the light it adds */
    const bx = S.bx; bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'lighter'; bx.drawImage(S.scr, bb[0], bb[1], bbw, bbh, bb[0], bb[1], bbw, bbh); bx.restore();
    /* its colour over the lit area (v23.3.6 tints a carried beam with its colour) */
    let tint = false;
    if (Lc.color && /^#[0-9a-f]{6}$/i.test(Lc.color)) {
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = Lc.color; sx.fillRect(bb[0], bb[1], bbw, bbh); sx.globalCompositeOperation = 'source-over';
      const tx = S.tx; tx.save(); tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = 'lighter'; tx.globalAlpha = (f.omni ? TINT.omni : TINT.beam) / TINT.k; tx.drawImage(S.scr, bb[0], bb[1], bbw, bbh, bb[0], bb[1], bbw, bbh); tx.restore(); tint = true;
    }
    sx.restore();
    /* the hand glow: a small omni field at the hand, with the shadows walls and props cast into it from the hand */
    const gb = boxAt(Lc.x, Lc.y, Lc.glowR, F, sc);
    if (gb) {
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-over'; sx.clearRect(gb[0], gb[1], gb[2] - gb[0], gb[3] - gb[1]);
      sx.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc);
      const gg = sx.createRadialGradient(Lc.x, Lc.y, 6, Lc.x, Lc.y, Lc.glowR); gg.addColorStop(0, rgba(Lc.glowA * w)); gg.addColorStop(.25, rgba(Lc.glowA * .83 * w)); gg.addColorStop(.7, rgba(Lc.glowA * .28 * w)); gg.addColorStop(1, rgba(0));
      sx.fillStyle = gg; sx.fillRect(Lc.x - Lc.glowR, Lc.y - Lc.glowR, Lc.glowR * 2, Lc.glowR * 2);
      castInto(sx, [Lc.x, Lc.y], Lc.glowR + 4, null, F, k, sc, gb, { props: r.gprops, sh: r.sh, kmax: CARRY.kmax });
      bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'lighter'; bx.drawImage(S.scr, gb[0], gb[1], gb[2] - gb[0], gb[3] - gb[1], gb[0], gb[1], gb[2] - gb[0], gb[3] - gb[1]); bx.restore();
    }
    sx.setTransform(1, 0, 0, 1, 0, 0);
    rec.carried.push({ x: Lc.x, y: Lc.y, ang: Lc.ang, R, arc: f.arc, omni: !!f.omni, power, smp: r.smp, props: r.props, gprops: r.gprops, sh: r.sh, glowR: Lc.glowR, glowA: Lc.glowA * w, own: r.own, tint });
  }

  /* QA2: an infrared emitter (window.__cam.irLights: { x, y, angle, P: the camcorder's IR level, own }) before anything is
   * drawn: its source points across the lens, its cone, the prop casters (the frame's prop budget, after the visible lights) */
  function prepIR(e, cfg) {
    const A = window.__api; if (A.Hc(Math.floor(e.x / T), Math.floor(e.y / T))) return null;
    const P = e.P, R = P.range, cone = [e.angle, P.arc / 2 + .2], sh = CARRY.h.flashlight, prof = window.__cam.irProfile;
    const props = propsFor(e.x, e.y, R + 8, cone, Math.min(cfg.props, S.propLeft)); S.propLeft -= props.length; ST.props += props.length;
    const gprops = propsFor(e.x, e.y, prof.spillR + 4, null, Math.min(cfg.props, S.propLeft)); S.propLeft -= gprops.length; ST.props += gprops.length;
    return { e, x: e.x, y: e.y, ang: e.angle, P, R, cone, sh, props, gprops, prof, smp: sourcePoints(e.x, e.y, e.angle, false, cfg.src), own: !!e.own };
  }
  /* QA2: one infrared emitter, BR-RoLE-style: its field (the camcorder's own picture: power x radial(d / range) x angular),
   * the shadows walls, pillars and props cast into it from the lens, the wall / pillar faces it reaches (extrude), added to
   * the buffer (no colour: the sensor's picture is tinted by the camcorder's own overlay); then the spill at the lens, with
   * the shadows cast from the lens.  Exactly like a carried light, so no wall is lit through and nothing lit past a corner */
  function irLight(r, F, cfg, k, rec) {
    const sx = S.sx, P = r.P, R = r.R, sc = cfg.scale, prof = r.prof, TAU = Math.PI * 2;
    const hw = prof.halfWidth ? prof.halfWidth(P) : P.arc / 2, bb = sectorBox(r.x, r.y, R, r.ang, hw + .05, F, sc);   // (the cone out to where its soft rim ends)
    if (bb) {
      const bbw = bb[2] - bb[0], bbh = bb[3] - bb[1];
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-over'; sx.globalAlpha = 1; sx.clearRect(bb[0], bb[1], bbw, bbh);
      boxClip(sx, bb); sx.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc);
      const g = sx.createRadialGradient(r.x, r.y, 6, r.x, r.y, R);         // the radial profile, finely sampled (its tail smooth to the range)
      for (let i = 0; i <= 24; i++) { const u = i / 24; g.addColorStop(u, rgba(P.power * prof.radial((6 + u * (R - 6)) / R, P))); }
      sx.fillStyle = g; sx.fillRect(r.x - R, r.y - R, R * 2, R * 2);
      sx.globalCompositeOperation = 'destination-in';
      if (typeof sx.createConicGradient === 'function') {                  // the angular profile: core, outer field, no edge
        const cg = sx.createConicGradient(r.ang - Math.PI, r.x, r.y);
        for (let i = 0; i <= 32; i++) { const ph = hw * i / 32, v = rgba(prof.angular(ph, P)); cg.addColorStop(clamp(.5 - ph / TAU, 0, 1), v); cg.addColorStop(clamp(.5 + ph / TAU, 0, 1), v); }
        cg.addColorStop(clamp(.5 - (hw + .002) / TAU, 0, 1), rgba(0)); cg.addColorStop(clamp(.5 + (hw + .002) / TAU, 0, 1), rgba(0));   // (nothing past the rim)
        cg.addColorStop(0, rgba(0)); cg.addColorStop(1, rgba(0)); sx.fillStyle = cg; sx.fillRect(r.x - R, r.y - R, R * 2, R * 2);
      } else { sx.beginPath(); sx.moveTo(r.x, r.y); sx.arc(r.x, r.y, R, r.ang - hw, r.ang + hw); sx.closePath(); sx.fillStyle = rgba(1); sx.fill(); }
      sx.globalCompositeOperation = 'source-over';
      castInto(sx, r.smp, R + 8, r.cone, F, k, sc, bb, { props: r.props, sh: r.sh, kmax: CARRY.kmax });
      if (!S.ctmp || S.ctmp.width !== S.scr.width || S.ctmp.height !== S.scr.height) { S.ctmp = mkCanvas(S.scr.width, S.scr.height); S.cx = S.ctmp.getContext('2d'); }
      sx.restore(); sx.save(); extrude(sx, S.ctmp, k, F.ox * sc, F.oy * sc, r.x, r.y, R + 8, bb); sx.restore();
      const bx = S.bx; bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'lighter'; bx.drawImage(S.scr, bb[0], bb[1], bbw, bbh, bb[0], bb[1], bbw, bbh); bx.restore();
    }
    /* the spill at the lens (the camcorder's: .3 inside 20 px, gone by 70), shadowed from the lens */
    const gR = prof.spillR, gb = boxAt(r.x, r.y, gR, F, sc);
    if (gb) {
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = 'source-over'; sx.globalAlpha = 1; sx.clearRect(gb[0], gb[1], gb[2] - gb[0], gb[3] - gb[1]);
      sx.setTransform(k, 0, 0, k, F.ox * sc, F.oy * sc);
      const gg = sx.createRadialGradient(r.x, r.y, 0, r.x, r.y, gR); for (let i = 0; i <= 10; i++) gg.addColorStop(i / 10, rgba(prof.spill(i / 10 * gR)));
      sx.fillStyle = gg; sx.fillRect(r.x - gR, r.y - gR, gR * 2, gR * 2);
      castInto(sx, [r.x, r.y], gR + 4, null, F, k, sc, gb, { props: r.gprops, sh: r.sh, kmax: CARRY.kmax });
      const bx = S.bx; bx.save(); bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'lighter'; bx.drawImage(S.scr, gb[0], gb[1], gb[2] - gb[0], gb[3] - gb[1], gb[0], gb[1], gb[2] - gb[0], gb[3] - gb[1]); bx.restore();
    }
    sx.setTransform(1, 0, 0, 1, 0, 0);
    rec.ir.push({ x: r.x, y: r.y, ang: r.ang, R, arc: P.arc, core: P.core, power: P.power, lvl: r.e.lvl, own: r.own, smp: r.smp });
  }

  /* ---------- the static wall grounding (SH7 donor, ADAPT) ---------- */
  function canvasTex(w, h, alphaAt) {
    const c = mkCanvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) img.data[(j * w + i) * 4 + 3] = Math.round(255 * clamp(alphaAt(i, j), 0, 1));
    x.putImageData(img, 0, 0); return S.Tex.from(c);
  }
  function attach() {
    if (++S.attachTries > 900) { disable('renderer never became available'); return false; }
    const A = window.__api; if (!A || typeof A.floor !== 'function' || typeof A.Hc !== 'function' || typeof A.Uc !== 'function') return false;
    const floor = A.floor(), world = floor && floor.parent; if (!world || !world.children) return false;
    const kids = world.children, ci = kids.findIndex(c => c && c.tileScale && c.texture), level = kids[ci + 1];
    if (ci < 0 || !level || typeof level.texture !== 'function') { disable('renderer layout not recognised'); return false; }
    S.world = world; S.G = level.constructor; S.C = floor.constructor; S.Tex = kids[ci].texture.constructor;
    S.FBW = Math.round(kids[ci].width / T); S.FBH = Math.round(kids[ci].height / T);
    if (!(S.FBW > 0 && S.FBH > 0) || typeof S.Tex.from !== 'function') { disable('level size unavailable'); return false; }
    S.person = kids.find(c => c && c !== floor && typeof c.deathPose === 'function') || null;
    buildEdges(); buildProps(); S.blur = blurSupported();
    const fall = u => Math.pow(1 - clamp(u, 0, 1), AO.power), n = AO.steps, q = 48;
    S.tex = { down: canvasTex(2, n, (i, j) => fall((j + .5) / n)), up: canvasTex(2, n, (i, j) => fall((n - j - .5) / n)), right: canvasTex(n, 2, i => fall((i + .5) / n)), left: canvasTex(n, 2, i => fall((n - i - .5) / n)),
      se: canvasTex(q, q, (i, j) => fall(Math.hypot(i + .5, j + .5) / q)), sw: canvasTex(q, q, (i, j) => fall(Math.hypot(q - i - .5, j + .5) / q)), ne: canvasTex(q, q, (i, j) => fall(Math.hypot(i + .5, q - j - .5) / q)), nw: canvasTex(q, q, (i, j) => fall(Math.hypot(q - i - .5, q - j - .5) / q)) };
    S.castCv = castTexture(); S.discCv = discTexture(); S.shadeCv = shadeTexture();
    const root = new S.C(); root.label = 'br-role';
    { const c = new S.C(); c.label = 'br-role-ao'; root.addChild(c); S.layers.ao = c; }   // BR2B: actor shadows are light removal in the compositor, no Pixi layer
    world.addChildAt(root, ci + 1);                                       // right above the carpet: under walls, props, entities
    S.root = root; buildAO(); S.attached = true;
    return true;
  }
  function buildAO() {
    const A = window.__api, W = S.FBW, H = S.FBH, w = AO.width, wall = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? true : !!A.Hc(x, y);
    const nx = Math.ceil(W / CHUNK), ny = Math.ceil(H / CHUNK), chunks = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const g = new S.G(); g.alpha = AO.alpha; chunks.push({ g, q: 0, x0: i * CHUNK * T - w, y0: j * CHUNK * T - w, x1: (i + 1) * CHUNK * T + w, y1: (j + 1) * CHUNK * T + w }); }
    const chunkOf = (cx, cy) => chunks[Math.min(ny - 1, Math.floor(cy / CHUNK)) * nx + Math.min(nx - 1, Math.floor(cx / CHUNK))];
    const put = (cx, cy, tex, x, y, ww, hh) => { const c = chunkOf(cx, cy); c.g.texture(tex, 0xffffff, x, y, ww, hh); c.q++; };
    const brk = v => v % CHUNK === CHUNK - 1, X = S.tex;
    for (let y = 0; y < H; y++) for (let x = 0; x < W;) { if (wall(x, y) && !wall(x, y + 1)) { let e = x; while (!brk(e) && e + 1 < W && wall(e + 1, y) && !wall(e + 1, y + 1)) e++; put(x, y + 1, X.down, x * T, (y + 1) * T, (e - x + 1) * T, w); x = e + 1; } else x++; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W;) { if (wall(x, y) && !wall(x, y - 1)) { let e = x; while (!brk(e) && e + 1 < W && wall(e + 1, y) && !wall(e + 1, y - 1)) e++; put(x, y - 1, X.up, x * T, y * T - w, (e - x + 1) * T, w); x = e + 1; } else x++; }
    for (let x = 0; x < W; x++) for (let y = 0; y < H;) { if (wall(x, y) && !wall(x + 1, y)) { let e = y; while (!brk(e) && e + 1 < H && wall(x, e + 1) && !wall(x + 1, e + 1)) e++; put(x + 1, y, X.right, (x + 1) * T, y * T, w, (e - y + 1) * T); y = e + 1; } else y++; }
    for (let x = 0; x < W; x++) for (let y = 0; y < H;) { if (wall(x, y) && !wall(x - 1, y)) { let e = y; while (!brk(e) && e + 1 < H && wall(x, e + 1) && !wall(x - 1, e + 1)) e++; put(x - 1, y, X.left, x * T - w, y * T, w, (e - y + 1) * T); y = e + 1; } else y++; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!wall(x, y)) continue; const cx = x * T, cy = y * T;
      if (!wall(x + 1, y) && !wall(x, y + 1) && !wall(x + 1, y + 1)) put(x + 1, y + 1, X.se, cx + T, cy + T, w, w);
      if (!wall(x - 1, y) && !wall(x, y + 1) && !wall(x - 1, y + 1)) put(x - 1, y + 1, X.sw, cx - w, cy + T, w, w);
      if (!wall(x + 1, y) && !wall(x, y - 1) && !wall(x + 1, y - 1)) put(x + 1, y - 1, X.ne, cx + T, cy - w, w, w);
      if (!wall(x - 1, y) && !wall(x, y - 1) && !wall(x - 1, y - 1)) put(x - 1, y - 1, X.nw, cx - w, cy - w, w, w);
    }
    S.layers.ao.removeChildren(); S.chunks = chunks.filter(c => c.q > 0); for (const c of S.chunks) S.layers.ao.addChild(c.g);
  }
  function cullAO(r) { for (const c of S.chunks) { const v = c.x1 > r.x0 && c.x0 < r.x1 && c.y1 > r.y0 && c.y0 < r.y1; if (c.g.visible !== v) c.g.visible = v; } }
  /* ---------- BR2B / BR2.1 actors: a cast shadow on the floor and self-shading on the body ----------
   * The local player, other wanderers and Hounds the local player can actually see.  An actor is a blocker of its DOMINANT
   * light only: the light that really reaches it most (its unblocked contribution at the actor: falloff, beam, walls,
   * pillars, props), kept with hysteresis so nearly equal lights never flip it; HIGH adds a faint second cast shadow when a
   * second light matters too.  Both effects are that light's own contribution taken away (destination-out in that light's
   * scratch, before it is added), so every other light still fills them - no dark paint:
   *   CAST SHADOW (on the floor): a tapered tongue from behind the silhouette, away from the light - darkest at the contact,
   *     softer and narrower toward the tip, its sides softening with distance; longer and fainter the farther the light,
   *     short and dark under a light, gone right under it.  The silhouette (body and hands; a Hound's torso) is cut out of
   *     it, so it never stains the body;
   *   SELF-SHADING (on the body): one soft gradient across the body and each hand, darker on the side away from the same
   *     light, no terminator line; a Hound's torso gets a restrained one.  One pass per actor (the dominant light only).
   * Weights ease per frame: a change of dominant light cross-fades, never pops.  Never a Smiler: no body, contact,
   * silhouette shadow or self-shading, ever. */
  const ACT = {
    /* r / la, lb: the silhouette (the art's 18 px body; a Hound's torso), hand: the hands' radius; a: cast strength at the
     * contact (share of that light removed), shade: self-shading strength on the far side, len: longest cast (px) */
    player: { a: .85, r: 18, hand: 6.5, len: 84, shade: .42 }, hound: { a: .85, la: 32, lb: 16, len: 140, shade: .3 },
    k: { lamp: .5, carried: .8 },            // cast length per px of distance from the light (a lower light: longer), up to len
    fadeLong: .35,                           // a cast at full length is this much fainter (a long shadow is a fainter one)
    near: 40, min: .04,                      // both fade out within `near` px of the light; a dominant light adds at least `min`
    swap: 1.35, swapAdd: .02,                // a new dominant light must beat the current one by 35 % (+ .02)
    second: { rel: .5, min: .06, a: .45 },   // HIGH: a second light at >= 50 % of the first: a 45 % second cast (no second shading)
    ease: .2, sight: 700,                    // weights ease 20 % a frame (frame-based: steady under a frozen clock)
    /* BR2.1B: self-shading follows the light's CONTRAST: full when one light dominates, down to `even` when lights are even
     * (two equal lamps light both sides alike); a carried light's direction is eased (hand bob never jitters a shadow) */
    even: .3, turn: .35 };
  function seen(V, x, y) { const dx = x - V.x, dy = y - V.y, d = Math.hypot(dx, dy); if (d < 30) return true; if (d > ACT.sight) return false; return window.__api.Uc(V.x, V.y, Math.atan2(dy, dx), d) >= d - 20; }
  /* a light's unblocked contribution at an actor (lamps from three points of their tube: its ends and its middle) */
  function lampAt(r, x, y) {
    const f = lampFall(x - r.L.x, y - r.L.y); if (!(f > 0)) return 0;
    const m = r.smp, n = m.length / 2, pts = n <= 3 ? m : [m[0], m[1], m[2 * Math.floor(n / 2)], m[2 * Math.floor(n / 2) + 1], m[m.length - 2], m[m.length - 1]];
    return r.p * f * seenFrom(pts, x, y, r.props, LAMP.h, LAMP.kmax);
  }
  function carriedAt(r, x, y) {
    const d = Math.hypot(x - r.x, y - r.y); if (d >= r.R) return 0;
    const da = Math.atan2(y - r.y, x - r.x) - r.ang, ph = Math.abs(Math.atan2(Math.sin(da), Math.cos(da))), prof = r.omni ? 1 : beamProfile(ph, r.arc); if (!(prof > 0)) return 0;
    return r.power * beamGrad(d, r.R) * prof * seenFrom([r.x, r.y], x, y, r.props, r.sh, CARRY.kmax);
  }
  /* an actor's silhouette as ellipses { x, y, A (semi-axis along h), B, h }: a player's round body and two hands (read from
   * the avatar's own hand positions, never written), a Hound's torso */
  function silhouette(v, kind, x, y, heading) {
    if (kind === 'hound') { const c = Math.cos(heading), s = Math.sin(heading); return [{ x: x + c * 4, y: y + s * 4, A: ACT.hound.la, B: ACT.hound.lb, h: heading }]; }
    const out = [{ x, y, A: ACT.player.r, B: ACT.player.r, h: 0 }];
    if (Array.isArray(v.hands)) {
      const r = v.rotation || 0, c = Math.cos(r), s = Math.sin(r), sx = v.scale ? v.scale.x : 1, sy = v.scale ? v.scale.y : 1;
      for (const hd of v.hands) { if (!hd || !hd.position || hd.visible === false) continue; const lx = hd.position.x * sx, ly = hd.position.y * sy, hx = x + c * lx - s * ly, hy = y + s * lx + c * ly;
        if (Number.isFinite(hx + hy) && Math.hypot(hx - x, hy - y) < 40) out.push({ x: hx, y: hy, A: ACT.player.hand, B: ACT.player.hand, h: 0 }); }
    }
    return out;
  }
  let ckey = 0;
  function actorShadows(F, cfg, lampRecs, carRecs) {
    const out = S.actorsLast = []; ST.ents = 0; ST.shaded = 0;
    if (!S.actorsOn) return out;
    const A = window.__api, V = F.viewer, list = [], P = S.person;
    if (P && P.visible && P.parent && !F.death && P.alpha > .01) list.push([P, P.x, P.y, 'player', null, true]);
    const cr = A.layer && A.layer();
    if (cr && cr.children) for (const v of cr.children) {
      if (!v || !v.visible || !(v.alpha > .01) || v.__smiler) continue;  // never a Smiler: no body may be implied
      if (v.__hound) list.push([v, v.x, v.y, 'hound', v.rotation - Math.PI / 2, false]);
      else if (typeof v.deathPose === 'function') list.push([v, v.x, v.y, 'player', null, false]);   // another wanderer's avatar
    }
    let n = 0;
    for (const [v, x, y, kind, heading, self] of list) {
      if (n >= cfg.ents) break;
      if (!Number.isFinite(x + y) || (!self && !seen(V, x, y))) { S.act.delete(v); continue; }   // only what the local player can see
      const cands = [];
      for (const r of lampRecs) { const c = lampAt(r, x, y); if (c > .004) cands.push({ r, key: 'L' + r.i, kind: 'lamp', x: r.L.x, y: r.L.y, s: c }); }
      for (const r of carRecs) { if (self ? r.own : Math.hypot(r.x - x, r.y - y) < 45) continue; const c = carriedAt(r, x, y); if (c > .004) cands.push({ r, key: null, kind: 'carried', x: r.x, y: r.y, s: c }); }   // not its own light
      let st = S.act.get(v); if (!st || st.f !== ST.frames - 1) { st = { w: new Map(), dom: null, f: 0 }; S.act.set(v, st); }
      st.f = ST.frames;
      for (const c of cands) if (c.kind === 'carried') {                  // a carried light keeps its key while it moves (nearest last position)
        let best = null, bd = 60; for (const [kk, e] of st.w) if (e.kind === 'carried' && e.seen !== ST.frames) { const d = Math.hypot(e.x - c.x, e.y - c.y); if (d < bd) { bd = d; best = kk; } }
        c.key = best || 'C' + (++ckey); if (best) st.w.get(best).seen = ST.frames;
      }
      cands.sort((a, b) => b.s - a.s || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      const cur = st.dom ? cands.find(c => c.key === st.dom) : null, top = cands[0];
      let dom = cur || null;
      if (top && top.s >= ACT.min && (!cur || (top !== cur && top.s > cur.s * ACT.swap + ACT.swapAdd))) dom = top;
      if (dom && dom.s < ACT.min / 2) dom = null;
      if ((dom ? dom.key : null) !== st.dom) st.sw = { f: ST.frames, from: st.dom, to: dom ? dom.key : null, sFrom: cur ? +cur.s.toFixed(4) : null, sTo: dom ? +dom.s.toFixed(4) : null };   // (debug: why it changed)
      st.dom = dom ? dom.key : null;
      const sec = cfg.secondary && dom ? cands.find(c => c !== dom && c.s >= ACT.second.min && c.s >= dom.s * ACT.second.rel) : null;
      let tot = 0; for (const c of cands) tot += c.s;
      const share = dom && tot > 0 ? dom.s / tot : 0, contrastT = clamp(ACT.even + (1 - ACT.even) * (share - .5) / .4, ACT.even, 1);   // .5 share (even) -> even, >= .9 -> 1
      st.contrast = st.contrast === undefined ? contrastT : st.contrast + (contrastT - st.contrast) * ACT.ease;
      const now_ = new Set();
      for (const c of cands) { let e = st.w.get(c.key); if (!e) { e = { w: 0, s: 0, kind: c.kind }; st.w.set(c.key, e); } e.x = c.x; e.y = c.y; e.c = c; now_.add(c.key); }
      const Pk = ACT[kind], sil = silhouette(v, kind, x, y, heading); let drawn = 0, shadedHere = false;
      for (const [key, e] of st.w) {
        if (!now_.has(key)) { st.w.delete(key); continue; }               // that light is gone: its shadow goes with it
        const isDom = !!(dom && key === dom.key), target = isDom ? 1 : sec && key === sec.key ? ACT.second.a : 0;
        e.w += (target - e.w) * ACT.ease; e.s += ((isDom ? 1 : 0) - e.s) * ACT.ease;   // cast weight; self-shading weight (dominant only)
        if (target === 0 && e.w < .01 && e.s < .01) { st.w.delete(key); continue; }
        const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy); if (d < 1) continue;
        let ang = Math.atan2(dy, dx);
        if (e.kind === 'carried' && e.ang !== undefined) ang = e.ang + Math.atan2(Math.sin(ang - e.ang), Math.cos(ang - e.ang)) * ACT.turn;   // eased: a hand's bob never jitters it
        e.ang = ang;
        const gx = Math.cos(ang), gy = Math.sin(ang), near = clamp((d - 8) / ACT.near, 0, 1), vis = Math.min(1, v.alpha);
        /* where the cast leaves the silhouette: the farthest point of the body, hands or torso along the light's direction */
        let start = 0, across = 0;
        for (const q of sil) { const ph = ang - q.h, cs = Math.cos(ph), sn = Math.sin(ph), sup = Math.sqrt((q.A * cs) ** 2 + (q.B * sn) ** 2), off = (q.x - x) * gx + (q.y - y) * gy;
          start = Math.max(start, off + sup); if (q === sil[0]) across = Math.sqrt((q.A * sn) ** 2 + (q.B * cs) ** 2); }
        const ext = clamp(d * ACT.k[e.kind], 6, Pk.len), a = Pk.a * e.w * near * vis * (1 - ACT.fadeLong * ext / Pk.len), shade = Pk.shade * e.s * near * vis * st.contrast;
        if (!(a > .01) && !(shade > .01)) continue;
        const job = { kind, self, x, y, ang, ext, start: Math.min(start, (kind === 'hound' ? Pk.la : Pk.r) + 10), across, a: a > .01 ? a : 0, shade: shade > .01 ? shade : 0, sil,
          light: key, lightKind: e.kind, dominant: isDom, score: +e.c.s.toFixed(4) };
        if (job.dominant && st.sw && st.sw.f === ST.frames) job.switched = st.sw;
        e.c.r.acts.push(job); out.push(job); drawn++; if (job.shade) shadedHere = true;
      }
      if (drawn) n++; if (shadedHere) ST.shaded++;
    }
    ST.ents = out.filter(j => j.a).length;
    return out;
  }
  /* take the actors' shadows and self-shading out of one light's field (c: that light's scratch, buffer pixels) */
  function castActors(c, acts, F, k, sc) {
    const ox = F.ox * sc, oy = F.oy * sc;
    for (const j of acts) {
      if (j.a) {                                                            // the cast: built in a small pooled canvas, the silhouette cut out of it
        const cs = Math.cos(j.ang), sn = Math.sin(j.ang), x0 = j.start * .62, x1 = j.start + j.ext, w = j.across * 1.15;
        let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        for (const [u, v] of [[x0, -w], [x1, -w], [x1, w], [x0, w]]) { const px = (j.x + cs * u - sn * v) * k + ox, py = (j.y + sn * u + cs * v) * k + oy; bx0 = Math.min(bx0, px); by0 = Math.min(by0, py); bx1 = Math.max(bx1, px); by1 = Math.max(by1, py); }
        bx0 = Math.floor(Math.max(0, bx0 - 2)); by0 = Math.floor(Math.max(0, by0 - 2)); bx1 = Math.ceil(Math.min(c.canvas.width, bx1 + 2)); by1 = Math.ceil(Math.min(c.canvas.height, by1 + 2));
        const bw = bx1 - bx0, bh = by1 - by0;
        if (bw > 0 && bh > 0) {
          if (!S.atmp || S.atmp.width < bw || S.atmp.height < bh) { S.atmp = mkCanvas(Math.max(bw, S.atmp ? S.atmp.width : 0, 64), Math.max(bh, S.atmp ? S.atmp.height : 0, 64)); S.ax = S.atmp.getContext('2d'); }
          const t = S.ax; t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1; t.clearRect(0, 0, bw, bh);
          t.setTransform(cs * k, sn * k, -sn * k, cs * k, j.x * k + ox - bx0, j.y * k + oy - by0); t.globalAlpha = clamp(j.a, 0, 1);
          t.drawImage(S.castCv, x0, -w, x1 - x0, w * 2);
          t.globalAlpha = 1; t.globalCompositeOperation = 'destination-out';
          for (const q of j.sil) { const ch = Math.cos(q.h) * k, shh = Math.sin(q.h) * k; t.setTransform(ch * (q.A + 1.5), shh * (q.A + 1.5), -shh * (q.B + 1.5), ch * (q.B + 1.5), q.x * k + ox - bx0, q.y * k + oy - by0); t.drawImage(S.discCv, -1, -1, 2, 2); }
          c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-out'; c.globalAlpha = 1; c.drawImage(S.atmp, 0, 0, bw, bh, bx0, by0, bw, bh); c.restore();
          ST.casts++;
        }
      }
      if (j.shade) {                                                        // self-shading: one soft gradient per body part, away from the light
        c.save(); c.globalCompositeOperation = 'destination-out'; c.globalAlpha = clamp(j.shade, 0, 1);
        for (const q of j.sil) {
          const ph = j.ang - q.h, th = Math.atan2(q.B * Math.sin(ph), q.A * Math.cos(ph)), ch = Math.cos(q.h), shh = Math.sin(q.h), ct = Math.cos(th), st_ = Math.sin(th);
          /* M = Rot(h) diag(A, B) Rot(th): the unit disc onto the part, its gradient (texture +x) along the light's direction */
          const m11 = ch * q.A * ct - shh * q.B * st_, m12 = -ch * q.A * st_ - shh * q.B * ct, m21 = shh * q.A * ct + ch * q.B * st_, m22 = -shh * q.A * st_ + ch * q.B * ct;
          c.setTransform(m11 * k, m21 * k, m12 * k, m22 * k, q.x * k + ox, q.y * k + oy); c.drawImage(S.shadeCv, -1, -1, 2, 2); ST.shadeDraws++;
        }
        c.restore();
      }
    }
  }
  /* the textures (built once): the cast tongue, a soft solid disc (the silhouette cut-out), the self-shading gradient disc */
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function alphaTex(w, h, f) {
    const c = mkCanvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = (j * w + i) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.round(255 * clamp(f((i + .5) / w, ((j + .5) / h) * 2 - 1), 0, 1)); }
    x.putImageData(img, 0, 0); return c;
  }
  function castTexture() {
    /* u along (0 = just behind the silhouette, 1 = tip), v across: tapering to 55 % width, sides softening with distance,
     * darkest at the contact, fading out toward a rounded tip */
    return alphaTex(128, 48, (u, v) => {
      const half = 1 - .45 * u, q = Math.abs(v) / half, soft = .3 + .5 * u, side = 1 - sstep(1 - soft, 1, q);
      const along = sstep(0, .06, u) * Math.pow(1 - u, 1.35) * (1 - sstep(.7, 1, u + .25 * q * q));
      return side * along;
    });
  }
  const discTexture = () => alphaTex(64, 64, (u, v) => { const r = Math.hypot(u * 2 - 1, v); return 1 - sstep(.9, 1, r); });
  const shadeTexture = () => alphaTex(64, 64, (u, v) => { const x = u * 2 - 1, r = Math.hypot(x, v); return (1 - sstep(.84, .97, r)) * Math.pow(sstep(-.3, 1, x), 1.35); });

  /* ---------- settings: a LIGHTING row in SETTINGS > CUSTOMIZE (hud.js is not modified) ---------- */
  function setQuality(q, remember = true) {
    q = String(q || '').toLowerCase(); if (!QUALITIES.includes(q)) return S.quality;
    S.quality = q; if (remember) try { localStorage.setItem(LS_KEY, q); } catch (e) { }
    syncControl(); return q;
  }
  function addSettingsControl() {
    const pane = document.querySelector('#settings section[data-pane="custom"]'); if (!pane || document.getElementById('stLighting')) return;
    const box = document.createElement('div'); box.id = 'stLighting';
    box.innerHTML = '<h3>LIGHTING</h3><p class="st-note">How finely the lights and shadows are drawn. Never changes what you or the entities can see or do. LOW suits phones and older PCs.</p>' +
      '<div style="display:flex;gap:6px">' + QUALITIES.map(q => `<button type="button" class="st-btn" data-lq="${q}" style="flex:1;margin:0;padding:9px 2px">${q.toUpperCase()}</button>`).join('') + '</div>';
    box.addEventListener('click', e => { const b = e.target.closest('[data-lq]'); if (!b) return; e.stopPropagation(); setQuality(b.dataset.lq); });
    pane.appendChild(box); syncControl();
  }
  function syncControl() { document.querySelectorAll('#stLighting [data-lq]').forEach(b => { const o = b.dataset.lq === S.quality; b.style.outline = o ? '2px solid currentColor' : ''; b.setAttribute('aria-pressed', o ? 'true' : 'false'); }); }

  /* ---------- admin-only debug counters (DEBUG MODE in the admin panel) ---------- */
  const adminDebug = () => !!(window.__ents && window.__ents.dbgCfg && window.__ents.dbgCfg.on);
  function msStats() { const k = Math.min(ST.n, ST.ms.length); let s = 0, m = 0; for (let i = 0; i < k; i++) { s += ST.ms[i]; if (ST.ms[i] > m) m = ST.ms[i]; } const srt = Array.from(ST.ms.subarray(0, k)).sort((a, b) => a - b); return { mean: k ? +(s / k).toFixed(3) : 0, p95: k ? +srt[Math.min(k - 1, Math.floor(.95 * (k - 1) + .5))].toFixed(2) : 0, max: +m.toFixed(2), frames: ST.frames, sampled: k }; }
  function debugPanel() {
    const on = adminDebug();
    if (!on) { if (S.dbgEl) { S.dbgEl.remove(); S.dbgEl = null; } return; }
    if (!S.dbgEl) { const d = document.createElement('div'); d.id = 'brRoleDebug'; d.style.cssText = 'position:fixed;left:8px;bottom:64px;z-index:9;font:11px monospace;color:#9dff9d;background:rgba(0,0,0,.72);padding:6px 9px;pointer-events:none;white-space:pre'; document.body.appendChild(d); S.dbgEl = d; }
    const m = msStats(), c = TIERS[S.quality];
    S.dbgEl.textContent = `BR-RoLE ${VERSION}  ${S.quality.toUpperCase()}  buffer ${ST.buf[0]}x${ST.buf[1]} (x${c.scale})\nlamps ${ST.lamps}/${c.lamps}  carried ${ST.carried} (peers ${ST.peers}/${c.peers})  shadow sides ${ST.shadows}  props ${ST.props}/${c.propFrame}\nlamp fields cached ${S.lampCache.size}/${c.lampCache} built ${ST.lampBuilds} (${ST.lampBuildMs.toFixed(1)} ms, tube ${c.tube} pts${S.blur ? ', blurred' : ''})  actor casts ${ST.ents} (draws ${ST.casts})  self-shaded ${ST.shaded} (draws ${ST.shadeDraws})\nfar + bounce: drawn ${ST.fars}  built ${ST.farBuilds} (${ST.farMs.toFixed(1)} ms, last ${ST.emitters} bounce pts)${S.farJob ? '  building lamp ' + S.farJob.i : ''}\nframe ${m.mean} ms avg  ${m.max} ms max`;
  }

  /* what the compositor puts at a world point this frame, light by light (tests / debug; reads nothing from the canvas) */
  /* the fraction of a light's source points (tube / hand) that see (x, y): the game's own ray query, no walls or pillars between */
  function seenFrom(smp, x, y, props, sh, kmax) {
    const Uc = window.__api.Uc; let v = 0;
    for (let s = 0; s < smp.length; s += 2) {
      const dx = x - smp[s], dy = y - smp[s + 1], d = Math.hypot(dx, dy); if (!(d < .5 || Uc(smp[s], smp[s + 1], Math.atan2(dy, dx), d) >= d - .5)) continue;
      let keep = 1; if (props) for (const p of props) keep *= 1 - propShadowAlpha(p, smp[s], smp[s + 1], sh, kmax, x, y, sh === LAMP.h ? PFADE.lamp : PFADE.carried);
      v += keep;
    }
    return v / (smp.length / 2);
  }
  function probe(x, y) {
    const L = S.last; if (!L) return null; const A = window.__api, lamps = A.lamps || [], out = { lamps: [], carried: [] };
    for (const l of L.lamps) { const lp = lamps[l.i], f = lampFall(x - lp.x, y - lp.y), v = f > 0 ? seenFrom(l.smp, x, y, l.props, LAMP.h, LAMP.kmax) : 0; out.lamps.push({ i: l.i, visible: v, light: l.p * f * v }); }
    for (const c of L.carried) {
      const d = Math.hypot(x - c.x, y - c.y), vis = d < c.R ? seenFrom(c.smp, x, y, c.props, c.sh, CARRY.kmax) : 0, da = Math.atan2(y - c.y, x - c.x) - c.ang, ph = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
      const beam = c.power * beamGrad(d, c.R) * (c.omni ? 1 : beamProfile(ph, c.arc)) * vis, glow = d < c.glowR ? c.glowA * beamGrad(d, c.glowR) * seenFrom([c.x, c.y], x, y, c.gprops, c.sh, CARRY.kmax) : 0;
      out.carried.push({ own: c.own, visible: vis, light: beam + glow });
    }
    out.total = Math.min(1, out.lamps.reduce((s, l) => s + l.light, 0) + out.carried.reduce((s, l) => s + l.light, 0));
    return out;
  }

  function on() { return !S.legacy && !S.disabled && (!!S.edges || attach()); }   // the game draws its own lighting until BR-RoLE is attached
  const ui = () => { try { addSettingsControl(); if (!S.dbgEl || !adminDebug()) debugPanel(); } catch (e) { } };
  setInterval(ui, 500); if (document.readyState !== 'loading') ui(); else addEventListener('DOMContentLoaded', ui);

  window.__brRole = {
    version: VERSION,
    on,
    draw,
    get ir() { return S.irOn; },                                       // QA2: BR-RoLE draws the camcorder's infrared (camcorder.js's own fans stand down)
    quality: () => S.quality,
    setQuality: q => setQuality(q, false),
    qualities: () => QUALITIES.slice(),
    tiers: () => JSON.parse(JSON.stringify(TIERS)),
    stats: () => ({ version: VERSION, quality: S.quality, on: on(), legacy: S.legacy, disabled: S.disabled, attached: S.attached, frames: ST.frames, frameMs: msStats(), buffer: ST.buf.slice(),
      lamps: { last: ST.lamps, max: ST.lampsMax, cap: TIERS[S.quality].lamps, cached: S.lampCache.size, cacheCap: TIERS[S.quality].lampCache, pending: S.pending.size, builds: ST.lampBuilds, buildMs: +ST.lampBuildMs.toFixed(2), buildMaxMs: +ST.lampBuildMax.toFixed(2), evictions: ST.lampEvictions, tube: TIERS[S.quality].tube, blur: S.blur },
      far: { drawn: ST.fars, cached: [...S.lampCache.values()].filter(C => C.far).length, building: S.farJob ? S.farJob.i : null, builds: ST.farBuilds, buildMs: +ST.farMs.toFixed(2), frameMaxMs: +ST.farStepMax.toFixed(2), phaseMaxMs: ST.farPh.slice(), bouncePoints: ST.emitters, bouncePointsMax: ST.emittersMax, spill: S.spillOn, res: TIERS[S.quality].farRes },
      carried: { last: ST.carried, peers: ST.peers, peerCap: TIERS[S.quality].peers, sourcePoints: TIERS[S.quality].src }, ir: { on: S.irOn, last: ST.ir }, shadows: { last: ST.shadows, max: ST.shadowsMax }, actorShadows: { last: ST.ents, cap: TIERS[S.quality].ents, secondary: TIERS[S.quality].secondary, on: S.actorsOn, castDraws: ST.casts, actorsShaded: ST.shaded, selfShadeDraws: ST.shadeDraws },
      blockers: { sides: S.nEdges || 0, pillars: S.pillars || 0, props: S.props.length, propKinds: [...new Set(S.props.map(p => p.kind))] },
      props: { last: ST.props, max: ST.propsMax, drawsThisFrame: ST.propDraws, perLight: TIERS[S.quality].props, perFrame: TIERS[S.quality].propFrame }, errors: ST.errors }),
    resetStats: () => { ST.n = 0; ST.max = 0; ST.lampsMax = 0; ST.shadowsMax = 0; ST.propsMax = 0; ST.lampBuilds = 0; ST.lampBuildMs = 0; ST.lampBuildMax = 0; ST.lampEvictions = 0; ST.farBuilds = 0; ST.farMs = 0; ST.farStepMax = 0; ST.farPh = [0, 0, 0, 0]; ST.emittersMax = 0; },
    probe,
    lastFrame: () => S.lastF ? Object.assign({}, S.lastF) : null,      // the world -> overlay mapping BR-RoLE drew with last (tests)
    /* DEV only (comparison, tests): the v23.3.6 lighting instead of BR-RoLE; never offered to players */
    /* the actor shadows drawn last frame: { kind, self, x, y, ang, ext, a, light, lightKind, dominant } (tests / debug) */
    actors: () => S.actorsLast.map(j => Object.assign({}, j)),
    dev: { legacy: v => { if (v !== undefined) { S.legacy = !!v; if (S.root) S.root.visible = !S.legacy; } return S.legacy; },
      actors: v => { if (v !== undefined) S.actorsOn = !!v; return S.actorsOn; },   // DEV only: actor shadows off (A/B in tests)
      /* BR-RoLE 1.1, DEV only (tests): the bounce light off / on (the far caches are rebuilt); the light the last frame put at
       * world points (read back from the light buffer: everything added, before the line-of-sight clip); one lamp's cached
       * field at world points (core and far caches, P0 scale); its bounce points; the field function; whether every lamp
       * drawn has its far cache */
      spill: v => { if (v !== undefined && !!v !== S.spillOn) { S.spillOn = !!v; for (const C of S.lampCache.values()) if (C.far) { C.far.cv.width = 0; C.far = null; } S.farJob = null; } return S.spillOn; },
      light: pts => { const f = S.lastF; if (!f || !S.buf) return null; const d = S.bx.getImageData(0, 0, S.buf.width, S.buf.height).data, w = S.buf.width, h = S.buf.height;
        return pts.map(([x, y]) => { const px = Math.floor((x * f.r + f.ox) * f.sc), py = Math.floor((y * f.r + f.oy) * f.sc); return px < 0 || py < 0 || px >= w || py >= h ? null : d[(py * w + px) * 4 + 3] / 255; }); },
      cache: (i, pts) => { const C = S.lampCache.get(i), L = (window.__api.lamps || [])[i]; if (!C || !L) return null;
        const rd = (cv, hx, hy, res) => { const c = cv.getContext('2d'), w = cv.width, h = cv.height, d = c.getImageData(0, 0, w, h).data; return ([x, y]) => { const px = Math.floor((x - L.x + hx) * res), py = Math.floor((y - L.y + hy) * res); return px < 0 || py < 0 || px >= w || py >= h ? 0 : d[(py * w + px) * 4 + 3] / 255; }; };
        const core = rd(C.cv, C.hx, C.hy, C.cv.width / (2 * C.hx)), far = C.far ? rd(C.far.cv, C.far.hx, C.far.hy, C.far.cv.width / (2 * C.far.hx)) : null;
        return pts.map(p => ({ core: core(p), far: far ? far(p) / LAMP.fg : null })); },
      bounce: i => { const L = (window.__api.lamps || [])[i]; return L ? bouncePoints(L, TIERS[S.quality]).map(e => ({ x: +e.x.toFixed(1), y: +e.y.toFixed(1), nx: e.nx, ny: e.ny, I: +e.I.toFixed(5), range: e.range })) : null; },
      tube: i => { const C = S.lampCache.get(i), L = (window.__api.lamps || [])[i]; return C && L ? C.smp.concat(tubePoints(L, TIERS[S.quality].farTube)) : null; },
      cacheInfo: i => { const C = S.lampCache.get(i); if (!C) return null; const g = (cv, hx, hy) => ({ hx, hy, w: cv.width, h: cv.height, res: cv.width / (2 * hx) });
        return { core: g(C.cv, C.hx, C.hy), far: C.far ? g(C.far.cv, C.far.hx, C.far.hy) : null, bounce: C.emit }; },
      /* QA1: the visible faces (bands) of walls / pillars in a world box: { j, n: [nx, ny], pillar, band: [x0, y0, x1, y1], strip: [...] }
       * (QA2: band is the run's box at depth 0..d; mitre: its end shifts; poly: its mitred outline) */
      bands: (x0, y0, x1, y1) => { const E = S.edges, B = S.bands, out = []; if (!B) return out;
        for (let j = 0; j < S.nEdges; j++) { const g = j * 8, o = j * 6; if (!(B[g + 2] > B[g]) || B[g + 2] < x0 || B[g] > x1 || B[g + 3] < y0 || B[g + 1] > y1) continue;
          out.push({ j, n: [E[o + 4], E[o + 5]], pillar: j >= S.nWall, edge: [E[o], E[o + 1], E[o + 2], E[o + 3]], band: Array.from(B.subarray(g, g + 4)), strip: Array.from(B.subarray(g + 4, g + 8)), mitre: S.bandM ? [S.bandM[j * 2], S.bandM[j * 2 + 1]] : null, poly: S.bandM ? bandPoly(j) : null }); }
        return out; },
      /* QA1, DEV only (tests): the surface receivers (face light) off / on; every lamp cache is rebuilt */
      faces: v => { if (v !== undefined && !!v !== S.facesOn) { S.facesOn = !!v; S.lampKey = null; } return S.facesOn; },
      ir: v => { if (v !== undefined) S.irOn = !!v; return S.irOn; },   // QA2, DEV only (A/B): BR-RoLE's infrared off = the camcorder's old fans
      irLast: () => S.last && S.last.ir ? S.last.ir.map(o => Object.assign({}, o, { smp: o.smp.slice() })) : [],
      vis: v => { if (v !== undefined && Number.isFinite(+v) && +v > 0) LAMP.vis = Math.min(3, +v); return LAMP.vis; },
      cb: v => { if (v !== undefined) S.cbOn = !!v; return S.cbOn; },   // QA1, DEV only (A/B): the lamps' half-resolution core buffer off / on
      fbDiv: v => { if (v === 4 || v === 8) S.fbDiv = v; return S.fbDiv; },   // QA1, DEV only (A/B): the far buffer at a quarter (1.1) or an eighth (QA1) of the light buffer
      solo: list => { if (list !== undefined) S.solo = list && list.length ? new Set(list) : null; return S.solo ? [...S.solo] : null; },   // QA1, DEV only (tests): draw only these lamps (a mechanism checked in isolation: Level 0 now has a fixture on every side of most things)   // QA1, DEV only (human QA): try another fixture output live (drawn at once, nothing rebuilt; light truth unaffected)
      field: (dx, dy) => lampFall(dx, dy),
      sightFade: v => { if (v !== undefined) S.sightFade = !!v; return S.sightFade; },
      farReady: () => !S.farJob && (!S.last || S.last.lamps.every(l => l.far)),
      skip: o => { if (o !== undefined) S.skip = Object.assign({}, o || {}); return Object.assign({}, S.skip); },   // DEV only (perf A/B): skip drawing parts
      tier: o => { if (o) Object.assign(TIERS[S.quality], o); return Object.assign({}, TIERS[S.quality]); },   // QA1, DEV only (A/B): override this tier's caps (lamps, lampCache)
      constants: () => JSON.parse(JSON.stringify({ LAMP, SPILL, ALBEDO, FACE, CARRY })) },
  };
})();
