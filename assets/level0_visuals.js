/* level0_visuals.js - Stage 3B: the Level 0 presentation authority (visual metadata only).
 * Browser: a classic script (window.L0_VISUALS), loaded before the remaster module.  Dev tools: require().
 *
 * OWNS     how existing things LOOK: reusable archetype parts (carpet variants, wall finishes, fixture profiles, damage,
 *          decor, prop and structure sets) combined into room archetypes, material palettes, authored decor and visual-only
 *          fixture records, BR-RoLE caster notes, quality hints, the presentation revision and the layout seed.
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
    schemaVersion: 2,
    assetId: 'visuals:level0',
    revision: '3b1-qa2-archetypes-1',
    contentHash: 'bdcef2b76dd502152221bcd7005369504ba86e90dd8400000887fea25a1bd860',
    layoutSeed: 'tfb:level0:visuals:1',
    /* rooms the remaster draws now; every other room keeps the v23.3.6 / BR-RoLE 1.0 look until it gets an archetype */
    slice: ['room:01', 'room:04', 'room:07', 'room:11'],
    /* the game's room table, by stable id.  surface = the gameplay surface world.js gives the room (never contradicted).
     * archetype = which reusable room archetype dresses it (null: legacy look).  A future seeded Level 0 generator picks
     * archetypes for rooms it lays out; nothing below is tied to a room's position. */
    rooms: [
      { id: 'room:01', code: '01', name: 'YELLOW HALL', surface: 'carpet', archetype: 'archetype:yellow-hall' },
      { id: 'room:02', code: '02', name: 'REPEATING ROOMS', surface: 'carpet', archetype: null },
      { id: 'room:03', code: '03', name: 'SEGMENTED ROOMS', surface: 'carpet', archetype: null },
      { id: 'room:04', code: '04', name: 'HUMMING ROOMS', surface: 'carpet', archetype: 'archetype:humming-rooms' },
      { id: 'room:05', code: '05', name: 'NORTH ROOMS', surface: 'carpet', archetype: null },
      { id: 'room:06', code: '06', name: 'LONG ROOM', surface: 'concrete', archetype: null },
      { id: 'room:07', code: '07', name: 'BLACKOUT ZONE', surface: 'carpet', archetype: 'archetype:blackout-zone' },
      { id: 'room:08', code: '08', name: 'DAMP ROOMS', surface: 'wet', archetype: null },
      { id: 'room:09', code: '09', name: 'RED ROOMS', surface: 'carpet', archetype: null },
      { id: 'room:10', code: '10', name: 'ARCH GALLERY', surface: 'carpet', archetype: null },
      { id: 'room:11', code: '11', name: 'PILLAR HALL', surface: 'carpet', archetype: 'archetype:pillar-hall' },
      { id: 'room:12', code: '12', name: 'DEEP CARPET', surface: 'deep', archetype: null },
    ],
    lampCount: 90,                       // lamp:001 .. lamp:090 in the game's lamp order (read live; the count is cross-checked)
    /* shared material palettes (sRGB hex) */
    materials: [
      { id: 'material:baseboard', family: 'trim', base: '#8d7a45', top: '#a8935a', scuff: '#5d5030' },
      { id: 'material:carpet', family: 'carpet', base: '#967f3c', fiber: '#705c29', light: '#b29a52', seam: '#5e5129', worn: '#7a7150', damp: '#5b5636', tide: '#463c22', stain: '#5a4223', mildew: '#3c3f24' },
      { id: 'material:fixture', family: 'fixture', base: '#c9c4b0', frameDark: '#7f7b6c', lens: '#efe8c8', lensYellow: '#e2d39a', tube: '#fffbe6', tubeAged: '#bdb38c', dead: '#5f5b4f' },
      { id: 'material:wallcap', family: 'wall', base: '#6d6235', edge: '#857844', dark: '#4f4625' },
      { id: 'material:wallpaper', family: 'wallpaper', base: '#cbb96a', stripe: '#bba95c', motif: '#a99449', seam: '#9c8a45', grime: '#6e6133', damp: '#8a7d4a', torn: '#e0d7b2', backing: '#b9ac86', mildew: '#4a4a2c' },
    ],
    /* ---- reusable archetype parts (procedural-ready: a room archetype is a combination of these) ---- */
    carpetVariants: [
      { id: 'carpet:mustard-loop', material: 'material:carpet', note: 'brownish-beige loop pile that photographs yellow under the tubes' },
    ],
    wallFinishes: [
      { id: 'wall:chevron-paper', paper: 'material:wallpaper', trim: 'material:baseboard', cap: 'material:wallcap', motif: 'chevron', note: 'the sickly yellow paper, faint chevrons, a scuffed baseboard' },
    ],
    fixtureProfiles: [
      { id: 'fixtures:failed', diffuser: 'dead', note: 'no lamp works here; the grid keeps dead housings (presentation only, no light)' },
      { id: 'fixtures:standard', diffuser: 'clean', note: 'prismatic troffers; every 13th tube is old (blackened ends), as the game always drew it' },
      { id: 'fixtures:yellowed', diffuser: 'yellowed', note: 'the same troffers with lenses gone yellow' },
    ],
    damageProfiles: [
      { id: 'damage:failed-wet', wear: .6, damp: .42, grime: .75, stains: .8, mildew: .55, wallCondition: .6, wallDamp: .55, peel: .75 },
      { id: 'damage:maintained', wear: .5, damp: .18, grime: .45, stains: .45, mildew: .1, wallCondition: .88, wallDamp: .25, peel: .3 },
      { id: 'damage:office-worn', wear: .78, damp: .12, grime: .55, stains: .7, mildew: .08, wallCondition: .8, wallDamp: .2, peel: .45 },
      { id: 'damage:pillared-damp', wear: .62, damp: .3, grime: .6, stains: .55, mildew: .45, wallCondition: .75, wallDamp: .45, peel: .5 },
    ],
    decorSets: [
      { id: 'dressing:abandoned', paper: .5, scuff: .6, debris: .75, tape: .3 },
      { id: 'dressing:office', paper: .8, scuff: .8, debris: .35, tape: .7 },
      { id: 'dressing:sparse', paper: .5, scuff: .5, debris: .25, tape: .2 },
    ],
    propSets: [                          // what sits ON existing physical props (never a new physical object)
      { id: 'props:abandoned', counter: ['paper'], table: ['paper', 'binder'] },
      { id: 'props:none', counter: [], table: [] },
      { id: 'props:reception-busy', counter: ['phone', 'paper', 'paper', 'bell'], table: ['paper'] },
      { id: 'props:reception-quiet', counter: ['paper'], table: [] },
    ],
    structureSets: [                     // how the game's own structural elements are dressed (their footprints stay the game's)
      { id: 'structure:papered-columns', pillar: { finish: 'wall:chevron-paper', faces: { S: 14, N: 7, E: 9, W: 9 }, corner: 'trim' } },
    ],
    archetypes: [
      { id: 'archetype:blackout-zone', note: 'failed power: the darkness is the game\'s lighting; the room is only dirtier, wetter, abandoned',
        carpet: 'carpet:mustard-loop', carpetTone: .76, seams: 'y', wall: 'wall:chevron-paper', wallTone: .9, fixtures: 'fixtures:failed', damage: 'damage:failed-wet',
        decor: 'dressing:abandoned', props: 'props:abandoned', structure: null, accent: 'failed-power' },
      { id: 'archetype:humming-rooms', note: 'an office that kept running too long: worn paths, cables, yellowed lenses',
        carpet: 'carpet:mustard-loop', carpetTone: .97, seams: 'x', wall: 'wall:chevron-paper', wallTone: .98, fixtures: 'fixtures:yellowed', damage: 'damage:office-worn',
        decor: 'dressing:office', props: 'props:reception-busy', structure: null, accent: 'electrical' },
      { id: 'archetype:pillar-hall', note: 'the columned hall: papered columns, wear and damp gathering at their bases',
        carpet: 'carpet:mustard-loop', carpetTone: .94, seams: 'x', wall: 'wall:chevron-paper', wallTone: .95, fixtures: 'fixtures:standard', damage: 'damage:pillared-damp',
        decor: 'dressing:sparse', props: 'props:none', structure: 'structure:papered-columns', accent: 'structural' },
      { id: 'archetype:yellow-hall', note: 'the iconic baseline: uncanny, maintained enough to be wrong',
        carpet: 'carpet:mustard-loop', carpetTone: 1.0, seams: 'y', wall: 'wall:chevron-paper', wallTone: 1.0, fixtures: 'fixtures:standard', damage: 'damage:maintained',
        decor: 'dressing:sparse', props: 'props:reception-quiet', structure: null, accent: null },
    ],
    /* how each remastered element relates to BR-RoLE: physical elements keep the game's footprint, which BR-RoLE already
     * casts from; everything Stage 3B adds is flat presentation and casts nothing */
    casters: [
      { id: 'caster:decor', element: 'decals, papers, debris, cables, wall marks', source: 'level0_visuals.js / seeded scatter', brRole: 'none: flat, never a blocker' },
      { id: 'caster:fixtures', element: 'fixture housings', source: 'the game lamp list (Fc)', brRole: 'the lamps stay BR-RoLE light sources, unchanged; housings are presentation in the ceiling layer' },
      { id: 'caster:pillars', element: 'pillars', source: 'the game pillar list (Pc), 56 x 56', brRole: 'pillar blockers, unchanged; the art is exactly the footprint' },
      { id: 'caster:props', element: 'counter, table, crawl holes', source: 'world.js PROPS rect / cell', brRole: 'prop casters as before (counters, table); holes cast nothing; the art is exactly the footprint plus a flat contact shade' },
      { id: 'caster:walls', element: 'walls', source: 'the game floor mask (Hc)', brRole: 'wall shadow edges, unchanged; papered faces lie inside wall cells' },
    ],
    /* authored, gameplay-neutral storytelling (flat, low-profile); positions are world px on the room's floor */
    decor: [
      { id: 'decor:01:paper-counter', room: 'room:01', kind: 'paper', v: 1, x: 1700, y: 3400, r: .5 },
      { id: 'decor:01:tape-door', room: 'room:01', kind: 'tape', v: 0, x: 1430, y: 2640, r: 1.62 },
      { id: 'decor:04:paper-behind-1', room: 'room:04', kind: 'paper', v: 0, x: 3420, y: 935, r: -.4 },
      { id: 'decor:04:paper-behind-2', room: 'room:04', kind: 'paper', v: 2, x: 3445, y: 948, r: .9 },
      { id: 'decor:04:stain-counter', room: 'room:04', kind: 'stain', v: 2, x: 3330, y: 1080, r: 1.1, s: .55, a: .8 },
      { id: 'decor:07:shards-dead', room: 'room:07', kind: 'shards', v: 0, x: 1600, y: 5068, r: .3 },
      { id: 'decor:07:shards-hanging', room: 'room:07', kind: 'shards', v: 1, x: 1080, y: 5070, r: 2.2, s: .8 },
      { id: 'decor:07:tile-missing', room: 'room:07', kind: 'tile', v: 0, x: 650, y: 5560, r: .4 },
      { id: 'decor:11:tile-fallen', room: 'room:11', kind: 'tile', v: 0, x: 8400, y: 1640, r: -.7, s: .9 },
    ],
    /* visual-only fixture records (no light: BR-RoLE and gameplay light never see these) */
    fixtures: [
      { id: 'fixture:07:01', room: 'room:07', kind: 'dead', x: 624, y: 5040 },
      { id: 'fixture:07:02', room: 'room:07', kind: 'hanging', x: 1104, y: 5040 },
      { id: 'fixture:07:03', room: 'room:07', kind: 'dead', x: 1584, y: 5040 },
      { id: 'fixture:07:04', room: 'room:07', kind: 'missing', x: 624, y: 5520 },
      { id: 'fixture:07:05', room: 'room:07', kind: 'dead', x: 1104, y: 5520 },
      { id: 'fixture:07:06', room: 'room:07', kind: 'dead', x: 1584, y: 5520 },
    ],
    /* quality hints (the BR-RoLE tier the player picked); LOW stays cheap */
    quality: {
      low: { carpetTex: 512, macroCell: 16, macro: false, decals: .45, wallDetail: 1, artScale: 1.5 },
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

  /* a room's look, resolved from its archetype's parts into the flat shape the renderer draws (null: legacy look) */
  function resolve(roomId) {
    const r = DEF.rooms.find(q => q.id === roomId), A = r && r.archetype && DEF.archetypes.find(q => q.id === r.archetype); if (!A) return null;
    const get = (c, id) => id ? DEF[c].find(q => q.id === id) || null : null;
    const dmg = get('damageProfiles', A.damage), dec = get('decorSets', A.decor), fx = get('fixtureProfiles', A.fixtures), wf = get('wallFinishes', A.wall), ps = get('propSets', A.props), st = get('structureSets', A.structure);
    if (!dmg || !dec || !fx || !wf || !ps || !get('carpetVariants', A.carpet)) throw Error('incomplete archetype ' + A.id);
    return {
      id: A.id, archetype: A.id, accent: A.accent || null,
      carpet: { variant: A.carpet, tone: A.carpetTone, seams: A.seams, wear: dmg.wear, damp: dmg.damp, grime: dmg.grime, stains: dmg.stains, mildew: dmg.mildew },
      wallpaper: { finish: wf.id, tone: A.wallTone, condition: dmg.wallCondition, damp: dmg.wallDamp, peel: dmg.peel, mildew: dmg.mildew, motif: wf.motif },
      fixtures: { profile: fx.id, diffuser: fx.diffuser }, decor: { paper: dec.paper, scuff: dec.scuff, debris: dec.debris, tape: dec.tape },
      props: { counter: ps.counter.slice(), table: ps.table.slice() }, structure: st ? JSON.parse(JSON.stringify(st)) : null,
    };
  }
  function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
  const D = freeze(JSON.parse(JSON.stringify(DEF)));
  const byId = (list, id) => list.find(o => o.id === id) || null;
  return Object.freeze(Object.assign({}, D, {
    definition: D,
    hash32, prng, rng, unit,
    room: id => byId(D.rooms, id),
    roomByCode: code => D.rooms.find(r => r.code === code) || null,
    archetype: id => byId(D.archetypes, id),
    part: (collection, id) => byId(D[collection] || [], id),
    resolve,
    material: id => byId(D.materials, id),
    inSlice: id => D.slice.includes(id),
    lampId: index => 'lamp:' + String(index + 1).padStart(3, '0'),
  }));
});
