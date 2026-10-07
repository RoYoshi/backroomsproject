/* level0_visuals.js - Stage 3B: the Level 0 presentation authority (visual metadata only).
 * Browser: a classic script (window.L0_VISUALS), loaded before the remaster module.  Dev tools: require().
 *
 * OWNS     how existing things LOOK: reusable archetype parts (carpet variants, wall finishes, fixture profiles, damage,
 *          decor, prop and structure sets) combined into room archetypes, material palettes, authored decor and visual-only
 *          fixture records, BR-RoLE caster notes, the canon class of every dressing kind (STAGE_3B_PROP_CANON_AUDIT.md),
 *          quality hints, the presentation revision and the layout seed.
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
    schemaVersion: 3,
    assetId: 'visuals:level0',
    revision: '3b-final-f2-special-rooms',
    contentHash: '2ebce35edce0a806f540ad58bdf6bfe00d00e35804c03f4fa915d3dd2ea40c26',
    layoutSeed: 'tfb:level0:visuals:1',
    /* the zones the remaster draws (rooms by stable id, plus the corridor network): since 3B-F2 the whole of Level 0.  A zone
     * left out keeps the v23.3.6 / BR-RoLE 1.0 look.  Order is build order (and the order zones bake into a shared chunk). */
    slice: ['room:01', 'room:02', 'room:03', 'room:04', 'room:05', 'room:06', 'room:07', 'room:08', 'room:09', 'room:10', 'room:11', 'room:12', 'zone:corridors'],
    /* the game's room table, by stable id.  surface = the gameplay surface world.js gives the room (never contradicted).
     * archetype = which reusable room archetype dresses it (null: legacy look).  A future seeded Level 0 generator picks
     * archetypes for rooms it lays out; nothing below is tied to a room's position. */
    rooms: [
      { id: 'room:01', code: '01', name: 'YELLOW HALL', surface: 'carpet', archetype: 'archetype:yellow-hall' },
      { id: 'room:02', code: '02', name: 'REPEATING ROOMS', surface: 'carpet', archetype: 'archetype:repeating-rooms' },
      { id: 'room:03', code: '03', name: 'SEGMENTED ROOMS', surface: 'carpet', archetype: 'archetype:segmented-rooms' },
      { id: 'room:04', code: '04', name: 'HUMMING ROOMS', surface: 'carpet', archetype: 'archetype:humming-rooms' },
      { id: 'room:05', code: '05', name: 'NORTH ROOMS', surface: 'carpet', archetype: 'archetype:north-rooms' },
      { id: 'room:06', code: '06', name: 'LONG ROOM', surface: 'concrete', archetype: 'archetype:long-room' },
      { id: 'room:07', code: '07', name: 'BLACKOUT ZONE', surface: 'carpet', archetype: 'archetype:blackout-zone' },
      { id: 'room:08', code: '08', name: 'DAMP ROOMS', surface: 'wet', archetype: 'archetype:damp-rooms' },
      { id: 'room:09', code: '09', name: 'RED ROOMS', surface: 'carpet', archetype: 'archetype:red-rooms' },
      { id: 'room:10', code: '10', name: 'ARCH GALLERY', surface: 'carpet', archetype: 'archetype:arch-gallery' },
      { id: 'room:11', code: '11', name: 'PILLAR HALL', surface: 'carpet', archetype: 'archetype:pillar-hall' },
      { id: 'room:12', code: '12', name: 'DEEP CARPET', surface: 'deep', archetype: 'archetype:deep-carpet' },
    ],
    /* zones that are not rooms of the game's table: the corridor network (every floor cell outside a room) */
    zones: [
      { id: 'zone:corridors', name: 'CORRIDORS', surface: 'carpet', archetype: 'archetype:corridor', note: 'the hallways between rooms ("hallways": canon); no lamps, as in the game' },
    ],
    lampCount: 90,                       // lamp:001 .. lamp:090 in the game's lamp order (read live; the count is cross-checked)
    /* shared material palettes (sRGB hex) */
    materials: [
      { id: 'material:baseboard', family: 'trim', base: '#8d7a45', top: '#a8935a', scuff: '#5d5030' },
      { id: 'material:carpet', family: 'carpet', base: '#967f3c', fiber: '#705c29', light: '#b29a52', seam: '#5e5129', worn: '#7a7150', damp: '#5b5636', tide: '#463c22', stain: '#5a4223', mildew: '#3c3f24', sticky: '#4a1d14' },
      { id: 'material:concrete', family: 'concrete', base: '#90876f', light: '#a79e84', dark: '#706956', aggregate: '#605a4b', damp: '#635c4b', joint: '#4b463b', adhesive: '#5e4c2f', lip: '#7c7560' },
      { id: 'material:fixture', family: 'fixture', base: '#c9c4b0', frameDark: '#7f7b6c', lens: '#efe8c8', lensYellow: '#e2d39a', tube: '#fffbe6', tubeAged: '#bdb38c', dead: '#5f5b4f' },
      { id: 'material:steel', family: 'metal', base: '#9a9f9c', galv: '#9a9f9c', dark: '#5c615f', paint: '#7c8781', paintDark: '#59625d', rust: '#7b4b2a', dust: '#a59b7c', enamel: '#aba58e', enamelDark: '#7a7562' },
      { id: 'material:tile', family: 'tile', base: '#a99d7b', alt: '#9e9270', speck: '#6a6252', grout: '#71684f', mastic: '#1f1c17', water: '#4c5244', yellow: '#978855' },
      { id: 'material:wallcap', family: 'wall', base: '#6d6235', edge: '#857844', dark: '#4f4625' },
      { id: 'material:wallpaper', family: 'wallpaper', base: '#cbb96a', stripe: '#bba95c', motif: '#a99449', seam: '#9c8a45', grime: '#6e6133', damp: '#8a7d4a', torn: '#e0d7b2', backing: '#b9ac86', mildew: '#4a4a2c' },
      { id: 'material:wallpaper-crimson', family: 'wallpaper', base: '#c6a964', stripe: '#b89a58', motif: '#a3814a', seam: '#9a7c44', grime: '#6a4a30', damp: '#86664a', torn: '#d9c7a4', backing: '#6b2018', mildew: '#4a3a2a' },
      { id: 'material:wallpaper-pale', family: 'wallpaper', base: '#d8cf9f', stripe: '#cdc392', motif: '#beb17e', seam: '#b2a677', grime: '#7b7149', damp: '#9a9165', torn: '#ebe5ca', backing: '#c9c09d', mildew: '#585a3c' },
    ],
    /* ---- reusable archetype parts (procedural-ready: a room archetype is a combination of these) ---- */
    /* floors.  kind = what the material is (carpet / concrete / tile); surface = the gameplay surface it may dress (a visual
     * floor never promises a surface the game does not have).  Carpets share one world-anchored texture, so the carpet is one
     * continuous piece through every doorway (canon); deep / coarse variants add an overlay and a tint on top of it. */
    floorVariants: [
      { id: 'floor:concrete-slab', material: 'material:concrete', kind: 'concrete', surface: 'concrete', note: 'bare slab: trowel marks, saw-cut joints, damp (LONG ROOM: the game\'s concrete; canon: "almost" every floor is carpet)' },
      { id: 'floor:deep-pile', material: 'material:carpet', kind: 'carpet', surface: 'deep', overlay: 'deep', tint: [.84, .78, .7], note: 'the same carpet, deeper and shaggier ("carpet depth is notably extensive": canon)' },
      { id: 'floor:mustard-loop', material: 'material:carpet', kind: 'carpet', surface: 'carpet', overlay: null, tint: [1, 1, 1], note: 'brownish-beige loop pile that photographs yellow under the tubes; one seamless piece (canon)' },
      { id: 'floor:red-coarse', material: 'material:carpet', kind: 'carpet', surface: 'carpet', overlay: 'coarse', tint: [1, .44, .5], note: 'the colour shift to red; thick, sticky, very coarse (canon: red rooms)' },
      { id: 'floor:vinyl-tile', material: 'material:tile', kind: 'tile', surface: 'wet', note: 'old vinyl floor tile under standing water (DAMP ROOMS: the game\'s wet tile)' },
    ],
    wallFinishes: [
      { id: 'wall:chevron-paper', paper: 'material:wallpaper', trim: 'material:baseboard', cap: 'material:wallcap', motif: 'chevron', note: 'the sickly yellow paper, faint chevrons, a scuffed baseboard' },
      { id: 'wall:crimson-peel', paper: 'material:wallpaper-crimson', trim: 'material:baseboard', cap: 'material:wallcap', motif: 'chevron', note: 'the paper peeling to reveal a crimson color underneath (canon: red rooms)' },
      { id: 'wall:pale-paper', paper: 'material:wallpaper-pale', trim: 'material:baseboard', cap: 'material:wallcap', motif: 'chevron', note: 'pale walls (canon: archway rooms)' },
    ],
    fixtureProfiles: [
      { id: 'fixtures:failed', diffuser: 'dead', note: 'no lamp works here; the grid keeps dead housings (presentation only, no light)' },
      { id: 'fixtures:standard', diffuser: 'clean', note: 'prismatic troffers; every 13th tube is old (blackened ends), as the game always drew it' },
      { id: 'fixtures:yellowed', diffuser: 'yellowed', note: 'the same troffers with lenses gone yellow' },
    ],
    damageProfiles: [
      { id: 'damage:arch-stable', wear: .42, damp: .14, grime: .38, stains: .3, mildew: .06, wallCondition: .92, wallDamp: .16, peel: .2 },
      { id: 'damage:concrete-damp', wear: .45, damp: .36, grime: .55, stains: .55, mildew: .14, wallCondition: .78, wallDamp: .36, peel: .4 },
      { id: 'damage:corridor-trodden', wear: .72, damp: .16, grime: .55, stains: .42, mildew: .08, wallCondition: .82, wallDamp: .22, peel: .35 },
      { id: 'damage:deep-damp', wear: .5, damp: .4, grime: .5, stains: .5, mildew: .3, wallCondition: .78, wallDamp: .32, peel: .4 },
      { id: 'damage:failed-wet', wear: .6, damp: .42, grime: .75, stains: .8, mildew: .55, wallCondition: .6, wallDamp: .55, peel: .75 },
      { id: 'damage:maintained', wear: .5, damp: .18, grime: .45, stains: .45, mildew: .1, wallCondition: .88, wallDamp: .25, peel: .3 },
      { id: 'damage:office-worn', wear: .78, damp: .12, grime: .55, stains: .7, mildew: .08, wallCondition: .8, wallDamp: .2, peel: .45 },
      { id: 'damage:pillared-damp', wear: .62, damp: .3, grime: .6, stains: .55, mildew: .45, wallCondition: .75, wallDamp: .45, peel: .5 },
      { id: 'damage:red-sticky', wear: .5, damp: .3, grime: .62, stains: .72, mildew: .2, wallCondition: .55, wallDamp: .3, peel: .95 },
      { id: 'damage:segmented', wear: .58, damp: .2, grime: .5, stains: .5, mildew: .12, wallCondition: .82, wallDamp: .26, peel: .4 },
      { id: 'damage:soaked', wear: .4, damp: .78, grime: .6, stains: .62, mildew: .7, wallCondition: .62, wallDamp: .82, peel: .6 },
      { id: 'damage:stale', wear: .22, damp: .3, grime: .62, stains: .35, mildew: .3, wallCondition: .78, wallDamp: .38, peel: .45 },
    ],
    decorSets: [                         // floor dressing densities: grit (plaster crumbs), indent (furniture once stood here), scuff (matted pile)
      { id: 'dressing:abandoned', grit: .75, indent: .5, scuff: .5 },
      { id: 'dressing:sparse', grit: .25, indent: .35, scuff: .5 },
      { id: 'dressing:stale', grit: .45, indent: .6, scuff: .15 },
      { id: 'dressing:trodden', grit: .3, indent: .08, scuff: .95 },
      { id: 'dressing:worn', grit: .35, indent: .8, scuff: .8 },
    ],
    propSets: [                          // what sits ON existing physical props (never a new physical object).  QA2 audit: nothing.
      { id: 'props:bare', counter: [], table: [], note: 'no loose objects (phones, papers, bells, binders were AVOID in the canon audit)' },
    ],
    structureSets: [                     // how the game's own structural elements are dressed (their footprints stay the game's)
      { id: 'structure:archways', archway: { pilaster: 'material:wallpaper-pale', soffit: .2, note: 'the openings in the room\'s partitions read as archways ("archway holes": canon); nothing drawn overhead' } },
      { id: 'structure:papered-columns', pillar: { finish: 'wall:chevron-paper', faces: { S: 14, N: 7, E: 9, W: 9 }, corner: 'trim' } },
      { id: 'structure:pits', pit: { lip: 'material:concrete', note: 'pits deep into the floor, in a grid (canon); the game carves them: no walking, sight passes over' } },
    ],
    /* room archetypes: combinations of the parts above, never tied to a position.  approach: what a zone does to the corridor
     * floor and walls near its doorways (canon: you "gauge distance to the red rooms" by the colour shift, the coarse carpet
     * and the peeling paper): reach in cells, coarse = the coarse pile's strength at the doorway, peel = crimson peel odds. */
    archetypes: [
      { id: 'archetype:arch-gallery', note: 'pale walls with archway holes (canon); the most stable rooms: little wear, little damp; normal pile (its gameplay surface)',
        floor: 'floor:mustard-loop', floorTone: .99, seams: 'none', wall: 'wall:pale-paper', wallTone: 1, fixtures: 'fixtures:standard', damage: 'damage:arch-stable',
        decor: 'dressing:sparse', props: 'props:bare', structure: 'structure:archways', accent: 'archways' },
      { id: 'archetype:blackout-zone', note: 'failed power: the darkness is the game\'s lighting; told by dead fixtures, glass, a fallen tile, a burnt outlet, damp and mildew',
        floor: 'floor:mustard-loop', floorTone: .76, seams: 'none', wall: 'wall:chevron-paper', wallTone: .9, fixtures: 'fixtures:failed', damage: 'damage:failed-wet',
        decor: 'dressing:abandoned', props: 'props:bare', structure: null, accent: 'failed-power' },
      { id: 'archetype:corridor', note: 'the hallways: the same carpet and paper, trodden lanes along their length, no lamps (as in the game)',
        floor: 'floor:mustard-loop', floorTone: 1, seams: 'none', wall: 'wall:chevron-paper', wallTone: 1, fixtures: 'fixtures:standard', damage: 'damage:corridor-trodden',
        decor: 'dressing:trodden', props: 'props:bare', structure: null, accent: 'corridor' },
      { id: 'archetype:damp-rooms', note: 'the wettest rooms: old vinyl tile under standing water (the game\'s wet tile), mildew, walls wicking water',
        floor: 'floor:vinyl-tile', floorTone: 1, seams: 'none', wall: 'wall:chevron-paper', wallTone: .93, fixtures: 'fixtures:standard', damage: 'damage:soaked',
        decor: 'dressing:abandoned', props: 'props:bare', structure: null, accent: 'wet' },
      { id: 'archetype:deep-carpet', note: 'the carpet grows deep and shaggy (canon: "carpet depth is notably extensive"); damp held in the pile',
        floor: 'floor:deep-pile', floorTone: .92, seams: 'none', wall: 'wall:chevron-paper', wallTone: .94, fixtures: 'fixtures:standard', damage: 'damage:deep-damp',
        decor: 'dressing:sparse', props: 'props:bare', structure: null, accent: 'deep' },
      { id: 'archetype:humming-rooms', note: 'where the hum is loudest: yellowed lenses, aged tubes, outlets and junction boxes on the walls, worn carpet; no loose equipment',
        floor: 'floor:mustard-loop', floorTone: .97, seams: 'none', wall: 'wall:chevron-paper', wallTone: .98, fixtures: 'fixtures:yellowed', damage: 'damage:office-worn',
        decor: 'dressing:worn', props: 'props:bare', structure: null, accent: 'electrical' },
      { id: 'archetype:long-room', note: 'the long room: a bare concrete slab (the game\'s concrete) and two rows of pitch-black pits (canon: pits in a grid)',
        floor: 'floor:concrete-slab', floorTone: 1, seams: 'none', wall: 'wall:chevron-paper', wallTone: .96, fixtures: 'fixtures:standard', damage: 'damage:concrete-damp',
        decor: 'dressing:sparse', props: 'props:bare', structure: 'structure:pits', accent: 'pits' },
      { id: 'archetype:north-rooms', note: 'stale, unused rooms: faded paper, dust, damp in the corners, almost no traffic',
        floor: 'floor:mustard-loop', floorTone: .95, seams: 'none', wall: 'wall:chevron-paper', wallTone: .95, fixtures: 'fixtures:standard', damage: 'damage:stale',
        decor: 'dressing:stale', props: 'props:bare', structure: null, accent: null },
      { id: 'archetype:pillar-hall', note: 'the columned hall: papered columns, wear and damp gathering at their bases',
        floor: 'floor:mustard-loop', floorTone: .94, seams: 'none', wall: 'wall:chevron-paper', wallTone: .95, fixtures: 'fixtures:standard', damage: 'damage:pillared-damp',
        decor: 'dressing:sparse', props: 'props:bare', structure: 'structure:papered-columns', accent: 'structural' },
      { id: 'archetype:red-rooms', note: 'the colour shift to red; thick, sticky, very coarse carpet; paper peeling to crimson (canon); the shift reaches into the corridors that lead here',
        floor: 'floor:red-coarse', floorTone: .87, seams: 'none', wall: 'wall:crimson-peel', wallTone: .95, fixtures: 'fixtures:standard', damage: 'damage:red-sticky',
        decor: 'dressing:sparse', props: 'props:bare', structure: null, accent: 'red', approach: { reach: 7, coarse: .5, peel: .55 } },
      { id: 'archetype:repeating-rooms', note: 'the purest Level 0: identical bays, maintained, uniform; its one anomaly a fallen length of ductwork',
        floor: 'floor:mustard-loop', floorTone: 1, seams: 'none', wall: 'wall:chevron-paper', wallTone: 1, fixtures: 'fixtures:standard', damage: 'damage:maintained',
        decor: 'dressing:sparse', props: 'props:bare', structure: null, accent: 'repetition' },
      { id: 'archetype:segmented-rooms', note: 'randomly segmented rooms (canon): partitions and a knee wall, moderate wear, a bare built-in bench',
        floor: 'floor:mustard-loop', floorTone: .97, seams: 'none', wall: 'wall:chevron-paper', wallTone: .97, fixtures: 'fixtures:standard', damage: 'damage:segmented',
        decor: 'dressing:sparse', props: 'props:bare', structure: null, accent: 'segments' },
      { id: 'archetype:yellow-hall', note: 'the iconic baseline: uncanny, maintained enough to be wrong',
        floor: 'floor:mustard-loop', floorTone: 1.0, seams: 'none', wall: 'wall:chevron-paper', wallTone: 1.0, fixtures: 'fixtures:standard', damage: 'damage:maintained',
        decor: 'dressing:sparse', props: 'props:bare', structure: null, accent: null },
    ],
    /* how each remastered element relates to BR-RoLE: physical elements keep the game's footprint, which BR-RoLE already
     * casts from; everything Stage 3B adds is flat presentation and casts nothing */
    casters: [
      { id: 'caster:decor', element: 'stains, damp, mildew, grit, indents, glass, tiles, wall marks (static and future dynamic surface decals)', source: 'level0_visuals.js / seeded scatter / the surface receiver', brRole: 'none: flat, never a blocker' },
      { id: 'caster:fixtures', element: 'fixture housings', source: 'the game lamp list (Fc)', brRole: 'the lamps stay BR-RoLE light sources, unchanged; housings are presentation in the ceiling layer' },
      { id: 'caster:pillars', element: 'pillars', source: 'the game pillar list (Pc), 56 x 56', brRole: 'pillar blockers, unchanged; the art is exactly the footprint' },
      { id: 'caster:pits', element: 'pits (LONG ROOM)', source: 'the game pit list (Mc)', brRole: 'none: the game lets sight pass over pits (Hc) and BR-RoLE casts nothing from them; the art stays inside the pit cells' },
      { id: 'caster:props', element: 'all 18 world.js props: counters, the shelf (drawn as fallen ductwork), low walls, railing, machine (drawn as a dead cabinet), table, bench, crawl holes, windows', source: 'world.js PROPS rect / cell', brRole: 'prop casters as before, by the game\'s kind and height; railing and holes cast nothing; the art is exactly the footprint plus a flat contact margin' },
      { id: 'caster:walls', element: 'walls', source: 'the game floor mask (Hc)', brRole: 'wall shadow edges, unchanged; papered faces lie inside wall cells' },
    ],
    /* the canon class of every dressing kind the renderer knows (STAGE_3B_PROP_CANON_AUDIT.md).  confirmed / supported /
     * inference may be drawn (inference: sparse); avoid is never drawn; dev only by the DEV receiver proof.  A future
     * generator may only pick from the drawable kinds. */
    kinds: [
      { id: 'kind:adhesive', class: 'inference', surface: 'floor', note: 'faint old carpet-glue tracks on the LONG ROOM slab; sparse' },
      { id: 'kind:bell', class: 'avoid', surface: 'prop', note: 'retail/reception prop; implies a staffed desk' },
      { id: 'kind:binder', class: 'avoid', surface: 'prop', note: 'office storytelling object' },
      { id: 'kind:cable', class: 'avoid', surface: 'floor', note: 'a plugged-in device taped down: recent occupation' },
      { id: 'kind:condensate', class: 'inference', surface: 'floor', note: 'water soaked into the pile under the dead DEEP CARPET cabinet' },
      { id: 'kind:crack', class: 'supported', surface: 'floor', note: 'a hairline crack in the concrete slab' },
      { id: 'kind:crimsonpeel', class: 'confirmed', surface: 'wall', note: '"wallpaper peeling to reveal a crimson color underneath" (canon: red rooms)' },
      { id: 'kind:damp', class: 'confirmed', surface: 'floor', note: '"persistent moisture", "soggy carpet"' },
      { id: 'kind:dampwall', class: 'supported', surface: 'wall', note: 'moisture wicking up from the carpet' },
      { id: 'kind:debris', class: 'supported', surface: 'floor', note: 'grit and plaster crumbs: material decay' },
      { id: 'kind:indent', class: 'supported', surface: 'floor', note: 'furniture once stood here (secondary wiki); rare, never under a prop' },
      { id: 'kind:insects', class: 'avoid', surface: 'ceiling', note: '"devoid of all life" (secondary)' },
      { id: 'kind:jbox', class: 'inference', surface: 'wall', note: 'electrical infrastructure (HUMMING ROOMS identity); sparse' },
      { id: 'kind:mildew', class: 'confirmed', surface: 'floor', note: '"mildew-ridden carpets"' },
      { id: 'kind:mildewwall', class: 'supported', surface: 'wall', note: 'mildew climbing from the carpet' },
      { id: 'kind:outlet', class: 'supported', surface: 'wall', note: '"scattered electrical outlets" (secondary)' },
      { id: 'kind:paper', class: 'avoid', surface: 'floor', note: 'office clutter; the level is "barren"' },
      { id: 'kind:peel', class: 'supported', surface: 'wall', note: 'ageing wallpaper (peeling is canon in red rooms)' },
      { id: 'kind:phone', class: 'avoid', surface: 'prop', note: 'office equipment; implies occupation' },
      { id: 'kind:pilaster', class: 'confirmed', surface: 'wall', note: 'the jambs of an archway hole (canon: archway rooms)' },
      { id: 'kind:proof', class: 'dev', surface: 'any', note: 'the DEV surface-receiver proof mark (?dev3b=1 only)' },
      { id: 'kind:puddle', class: 'confirmed', surface: 'floor', note: 'standing water ("persistent moisture")' },
      { id: 'kind:ring', class: 'avoid', surface: 'floor', note: 'cup rings imply people' },
      { id: 'kind:scorch', class: 'inference', surface: 'wall', note: 'a burnt outlet: restrained blackout story; rare' },
      { id: 'kind:scuff', class: 'supported', surface: 'floor', note: 'matted pile on worn paths ("worn, moist carpeting", secondary)' },
      { id: 'kind:shards', class: 'supported', surface: 'floor', note: 'broken tube glass under failed fixtures only' },
      { id: 'kind:soffit', class: 'confirmed', surface: 'floor', note: 'the shade of an archway on the floor beneath it (canon: archway rooms)' },
      { id: 'kind:stain', class: 'confirmed', surface: 'floor', note: 'liquids soaked into the carpet' },
      { id: 'kind:sticky', class: 'confirmed', surface: 'floor', note: 'sticky patches in the red-room carpet (canon)' },
      { id: 'kind:tape', class: 'avoid', surface: 'floor', note: 'implies people taping things down' },
      { id: 'kind:tile', class: 'supported', surface: 'floor', note: 'a fallen drop-ceiling tile (secondary); rare, authored' },
      { id: 'kind:tilegap', class: 'supported', surface: 'floor', note: 'a lifted or missing vinyl tile showing black adhesive (DAMP ROOMS)' },
    ],
    /* authored, gameplay-neutral storytelling (flat, low-profile); positions are world px on the room's floor */
    decor: [
      { id: 'decor:01:indent', room: 'room:01', kind: 'indent', v: 0, x: 1300, y: 3750, r: .04 },
      { id: 'decor:04:stain-counter', room: 'room:04', kind: 'stain', v: 2, x: 3330, y: 1080, r: 1.1, s: .55, a: .8 },
      { id: 'decor:07:shards-dead', room: 'room:07', kind: 'shards', v: 0, x: 1600, y: 5068, r: .3 },
      { id: 'decor:07:shards-hanging', room: 'room:07', kind: 'shards', v: 1, x: 1080, y: 5070, r: 2.2, s: .8 },
      { id: 'decor:07:tile-missing', room: 'room:07', kind: 'tile', v: 0, x: 650, y: 5560, r: .4 },
      { id: 'decor:11:indent', room: 'room:11', kind: 'indent', v: 1, x: 8700, y: 1300, r: 1.6 },
      { id: 'decor:11:tile-fallen', room: 'room:11', kind: 'tile', v: 0, x: 8400, y: 1640, r: -.7, s: .9 },
      { id: 'decor:12:condensate', room: 'room:12', kind: 'condensate', v: 0, x: 7964, y: 5492, r: .08, s: 1.2, a: .95 },
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
    /* quality hints (the BR-RoLE tier the player picked); LOW stays cheap.
     * bake: each remastered room's static art is baked into cached chunk textures (one layer per room on screen).
     *   texel density = the screen's own (camera scale x renderer resolution), clamped to [min, max] texels per world px;
     *   cache = how many chunk textures stay resident (chunks in view are never dropped); prefetch = chunks baked ahead per
     *   frame as you approach (chunks entering the view are baked at once). */
    quality: {
      low: { carpetTex: 512, macroCell: 16, decals: .45, wallDetail: 1, artScale: 1.5, bake: { min: .6, max: 1, cache: 12, prefetch: 1 } },
      medium: { carpetTex: 1024, macroCell: 12, decals: 1, wallDetail: 2, artScale: 2, bake: { min: .75, max: 1.5, cache: 20, prefetch: 1 } },
      high: { carpetTex: 1024, macroCell: 8, decals: 1, wallDetail: 2, artScale: 2.5, bake: { min: .9, max: 2, cache: 20, prefetch: 2 } },
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
  function resolve(zoneId) {
    const r = DEF.rooms.find(q => q.id === zoneId) || DEF.zones.find(q => q.id === zoneId), A = r && r.archetype && DEF.archetypes.find(q => q.id === r.archetype); if (!A) return null;
    const get = (c, id) => id ? DEF[c].find(q => q.id === id) || null : null;
    const dmg = get('damageProfiles', A.damage), dec = get('decorSets', A.decor), fx = get('fixtureProfiles', A.fixtures), wf = get('wallFinishes', A.wall), ps = get('propSets', A.props), st = get('structureSets', A.structure), fv = get('floorVariants', A.floor);
    if (!dmg || !dec || !fx || !wf || !ps || !fv) throw Error('incomplete archetype ' + A.id);
    return {
      id: A.id, archetype: A.id, accent: A.accent || null, approach: A.approach ? JSON.parse(JSON.stringify(A.approach)) : null,
      floor: { variant: fv.id, kind: fv.kind, material: fv.material, overlay: fv.overlay || null, tint: (fv.tint || [1, 1, 1]).slice(), tone: A.floorTone, seams: A.seams, wear: dmg.wear, damp: dmg.damp, grime: dmg.grime, stains: dmg.stains, mildew: dmg.mildew },
      wallpaper: { finish: wf.id, paper: wf.paper, tone: A.wallTone, condition: dmg.wallCondition, damp: dmg.wallDamp, peel: dmg.peel, mildew: dmg.mildew, motif: wf.motif },
      fixtures: { profile: fx.id, diffuser: fx.diffuser }, decor: { grit: dec.grit, indent: dec.indent, scuff: dec.scuff },
      props: { counter: ps.counter.slice(), table: ps.table.slice() }, structure: st ? JSON.parse(JSON.stringify(st)) : null,
    };
  }
  function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
  const D = freeze(JSON.parse(JSON.stringify(DEF)));
  const byId = (list, id) => list.find(o => o.id === id) || null;
  return Object.freeze(Object.assign({}, D, {
    definition: D,
    hash32, prng, rng, unit,
    room: id => byId(D.rooms, id) || byId(D.zones, id),
    roomByCode: code => D.rooms.find(r => r.code === code) || null,
    archetype: id => byId(D.archetypes, id),
    part: (collection, id) => byId(D[collection] || [], id),
    resolve,
    material: id => byId(D.materials, id),
    kind: name => byId(D.kinds, 'kind:' + name),
    drawable: name => { const k = byId(D.kinds, 'kind:' + name); return !!k && (k.class === 'confirmed' || k.class === 'supported' || k.class === 'inference'); },
    inSlice: id => D.slice.includes(id),
    lampId: index => 'lamp:' + String(index + 1).padStart(3, '0'),
  }));
});
