/* level0_visuals.js - Stage 3B: the Level 0 presentation authority (visual metadata only).
 * Browser: a classic script (window.L0_VISUALS), loaded before the remaster module.  Dev tools: require().
 *
 * OWNS     how existing things LOOK: room visual profiles, material palettes, authored decor and visual-only fixture
 *          records, quality hints, the presentation revision and the layout seed.
 * NEVER    geometry or gameplay truth.  Rooms, walls, lamps, props, floor surfaces and collision are read from the running
 *          game (the bundle's room table / floor mask / lamp list, world.js PROPS and SURF).  Every record here is keyed by a
 *          stable ID (room:NN as in the Part 3A donor, lamp:NNN in lamp order, the world.js prop ids) and is cross-checked
 *          against the live game by dev/stage-3b/test_3b.js.  Nothing here can block, hide or reveal anything in play.
 * RANDOM   none at runtime.  All variation is hash(layoutSeed, stable ids, ...) through its own small PRNG (rng / unit
 *          below): never Math.random, never the game's RNG, the same on every client and every load.
 *
 * Edit here, then deliberately revise `revision`, and refresh `contentHash` (node dev/stage-3b/visuals_hash.js --write).
 * Changing `layoutSeed` reshuffles every procedural placement; palettes and densities can be tuned without it. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.L0_VISUALS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DEF = {
    schemaVersion: 1,
    assetId: 'visuals:level0',
    revision: '3b0-foundation-1',
    contentHash: '84d47acd92d8ac8930499fb210d9e292c3a96aea75b0daf114ff565cf91388d1',
    layoutSeed: 'tfb:level0:visuals:1',
    /* 3B1: only these rooms are remastered; every other room keeps the v23.3.6 / BR-RoLE 1.0 look until 3B2 is approved */
    slice: ['room:01', 'room:04', 'room:07'],
    /* the game's room table, by stable id.  surface = the gameplay surface world.js gives the room (never contradicted) */
    rooms: [
      { id: 'room:01', code: '01', name: 'YELLOW HALL', surface: 'carpet', profile: 'profile:yellow-hall' },
      { id: 'room:02', code: '02', name: 'REPEATING ROOMS', surface: 'carpet', profile: null },
      { id: 'room:03', code: '03', name: 'SEGMENTED ROOMS', surface: 'carpet', profile: null },
      { id: 'room:04', code: '04', name: 'HUMMING ROOMS', surface: 'carpet', profile: 'profile:humming-rooms' },
      { id: 'room:05', code: '05', name: 'NORTH ROOMS', surface: 'carpet', profile: null },
      { id: 'room:06', code: '06', name: 'LONG ROOM', surface: 'concrete', profile: null },
      { id: 'room:07', code: '07', name: 'BLACKOUT ZONE', surface: 'carpet', profile: 'profile:blackout-zone' },
      { id: 'room:08', code: '08', name: 'DAMP ROOMS', surface: 'wet', profile: null },
      { id: 'room:09', code: '09', name: 'RED ROOMS', surface: 'carpet', profile: null },
      { id: 'room:10', code: '10', name: 'ARCH GALLERY', surface: 'carpet', profile: null },
      { id: 'room:11', code: '11', name: 'PILLAR HALL', surface: 'carpet', profile: null },
      { id: 'room:12', code: '12', name: 'DEEP CARPET', surface: 'deep', profile: null },
    ],
    lampCount: 90,                       // lamp:001 .. lamp:090 in the game's lamp order (read live; the count is cross-checked)
    /* shared material palettes (sRGB hex).  A room profile scales / shifts them; it never swaps the material family */
    materials: [
      { id: 'material:baseboard', family: 'trim', base: '#8d7a45', top: '#a8935a', scuff: '#5d5030' },
      { id: 'material:carpet', family: 'carpet', base: '#8e7c47', fiber: '#6f6034', light: '#a8955a', seam: '#5e5129', worn: '#7d7556', damp: '#5f5a3a', tide: '#4b4126', stain: '#5a4223' },
      { id: 'material:fixture', family: 'fixture', base: '#c9c4b0', frameDark: '#7f7b6c', lens: '#efe8c8', lensYellow: '#e2d39a', tube: '#fffbe6', tubeAged: '#bdb38c', dead: '#5f5b4f' },
      { id: 'material:wallcap', family: 'wall', base: '#6d6235', edge: '#857844', dark: '#4f4625' },
      { id: 'material:wallpaper', family: 'wallpaper', base: '#cbb96a', stripe: '#bba95c', motif: '#a99449', seam: '#9c8a45', grime: '#6e6133', damp: '#8a7d4a', torn: '#e0d7b2', backing: '#b9ac86' },
    ],
    /* room visual profiles (3B1: the three slice rooms).  Values are 0..1 amounts unless noted */
    profiles: [
      { id: 'profile:blackout-zone', note: 'failed power: the darkness is the game\'s lighting; the room is only dirtier and wetter',
        carpet: { tone: .84, wear: .6, damp: .42, grime: .75, stains: .8, seams: 'y' },
        wallpaper: { tone: .9, condition: .6, damp: .55, peel: .75, motif: 'chevron' },
        fixtures: { diffuser: 'dead' }, accent: 'failed-power', decor: { paper: .5, scuff: .6, debris: .75, tape: .3 } },
      { id: 'profile:humming-rooms', note: 'fixtures, props and material interaction: an office that kept running too long',
        carpet: { tone: .97, wear: .78, damp: .12, grime: .55, stains: .7, seams: 'x' },
        wallpaper: { tone: .98, condition: .8, damp: .2, peel: .45, motif: 'chevron' },
        fixtures: { diffuser: 'yellowed' }, accent: 'electrical', decor: { paper: .8, scuff: .8, debris: .35, tape: .7 } },
      { id: 'profile:yellow-hall', note: 'the iconic baseline: uncanny, maintained enough to be wrong',
        carpet: { tone: 1.0, wear: .5, damp: .18, grime: .45, stains: .45, seams: 'y' },
        wallpaper: { tone: 1.0, condition: .88, damp: .25, peel: .3, motif: 'chevron' },
        fixtures: { diffuser: 'clean' }, accent: null, decor: { paper: .5, scuff: .5, debris: .25, tape: .2 } },
    ],
    /* authored, gameplay-neutral storytelling (flat, low-profile).  Filled in 3B1; positions are world px on the room's floor */
    decor: [],
    /* visual-only fixture records (no light: BR-RoLE and gameplay light never see these) */
    fixtures: [],
    /* quality hints (the BR-RoLE tier the player picked); LOW stays cheap */
    quality: {
      low: { carpetTex: 512, macroCell: 16, decals: .45, wallDetail: 1, artScale: 1.5 },
      medium: { carpetTex: 1024, macroCell: 12, decals: 1, wallDetail: 2, artScale: 2 },
      high: { carpetTex: 1024, macroCell: 8, decals: 1, wallDetail: 2, artScale: 2.5 },
    },
  };

  /* ---------- deterministic presentation randomness (isolated) ---------- */
  function hash32(s) {                                   // FNV-1a with a final avalanche
    let h = 2166136261 >>> 0; s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return h >>> 0;
  }
  function prng(seed) {                                  // mulberry32
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const key = keys => DEF.layoutSeed + '|' + keys.join('|');
  const rng = (...keys) => prng(hash32(key(keys)));     // a fresh stream for a stable key
  const unit = (...keys) => hash32(key(keys)) / 4294967296;   // one stateless value in [0, 1)

  function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
  const D = freeze(JSON.parse(JSON.stringify(DEF)));
  const byId = (list, id) => list.find(o => o.id === id) || null;
  return Object.freeze(Object.assign({}, D, {
    definition: D,
    hash32, prng, rng, unit,
    room: id => byId(D.rooms, id),
    roomByCode: code => D.rooms.find(r => r.code === code) || null,
    profile: id => byId(D.profiles, id),
    material: id => byId(D.materials, id),
    inSlice: id => D.slice.includes(id),
    lampId: index => 'lamp:' + String(index + 1).padStart(3, '0'),
  }));
});
