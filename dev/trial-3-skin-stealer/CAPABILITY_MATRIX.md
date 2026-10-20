# Trial 3 — Skin-Stealer: capability matrix (T0)

Written at T0 from the real P9 source (`pre-trial3-final-polish` = `1ff9374`, tree `d6b71b8`), before any game code changed.
Every row says what P9 actually has, what the Skin-Stealer needs from it, and the verdict:

- **READY** — usable as it is.
- **EXTEND** — a deliberate, bounded change to an owner's module; Hound and Smiler paths stay byte-for-byte as they are.
- **NEW** — a new file, registered through the build recipe and the `@part` / module contracts.
- **GATED** — not possible under the current contracts. Reported, not faked.

## 1. Server: N.A.N.I. (the AI engine, `generated/server/ai.js` from `src/frameworks/nani/server/ai.*.js`)

| Capability | P9 reality | Skin-Stealer need | Verdict |
|---|---|---|---|
| Species registry | `SPECIES = { hound, smiler }` (ai.engine.js); `mkEntity` reads `SPECIES[kind]` | a third species object | EXTEND: `SPECIES.skinstealer`; new part `ai.skinstealer.js` placed after `ai.smiler.js` in the `ai.js` recipe |
| Seeded streams | `entityStreams(seed, kind, id)` per entity: personality / behavior / search / perception / schedule | deterministic decisions | READY (kind `skinstealer` gives its own streams) |
| Vision | `visualObservation`: range × light × posture × motion, FOV, `geo.sees` LOS, crawl-zone reveal | sight-only identity | READY (species `vision` data; `dark: false`, so darkness genuinely hides a lightless player) |
| Hearing | `hearEvent` from the sound bus: radius × traits, muffled behind walls, fuzzed position, identity only from a current sighting | footsteps, breathing, struggle | READY |
| Light evidence | `lightSense` → anonymous leads (source / beam / litwall) | notice torches as leads | READY; `observeBeam`'s `hitHound` branch is Hound-only and stays so |
| Attributed memory | `e.mem.p` records (lkx/lky/lvx/lvy/seenAt/conf), `estimate()` (pushed along heading, stopped at walls), decay by `memHalfLife` | prediction input | READY |
| Evidence arbitration | `evidenceWeights(e)`: `hound ? … : {Smiler weights}` | its own weights | EXTEND: a species may carry `sp.evidence`; the two existing branches unchanged |
| Navigation | A* on the 48 px grid (`Geo.path`), string-pulling, carrots, corner braking, stuck ladder, swept collision | walk / run / creep, alternate routes | READY; `follow`'s corner radius `hound ? 115 : 80` gives a non-Hound 80 (fine) |
| Route cost hook | `plan(…, {cost})` and `sp.pathCost` | an intercept route that keeps off the prey's trail | READY |
| Tiers (LOD) | `tierOf` near < 1900 < mid < 3800 < far | sleep when far | EXTEND: `onTier` sends every non-Hound to the Smiler's `beginHidden`; a species hook `sp.onFar` is added and used first |
| Far step | `farStep` moves Hounds only | still when far (no organic population to drift) | READY (a non-Hound stands still) |
| Watchdog | Hound / Smiler branches; Smiler → `beginHidden` | own recovery | EXTEND: `kind === 'smiler'` guard is already explicit; a species hook `sp.onStuck` for the third |
| Separation | pair loop, `both hounds` crowd closer | ordinary | READY |
| Capture | `beginCapture` → `chooseMode` (`eng.forceCapture` admin override) → `killNow` | quick kill only; never the playful loop | EXTEND: `chooseMode` ignores a forced `play` for a species with `capture.noPlay` |
| Kill commitment | `killNow`: `kind === 'hound'` → `beginCommit` with Hound `KILL_DUR` | stay on the kill for its own death length | EXTEND: a species `capture.commitDur` table, a separate branch after the Hound's |
| Kill record | `{t:'kill', pid, eid, kind: sp.name, variant, why, geo, victim}` | killer identity | READY (`sp.name = 'SkinStealer'`) |
| Admin preview kill | `previewKill`: offsets/radii `hound ? … : …`, Smiler C light failure | preview A–C | EXTEND: species-neutral fallback already exists; the SS uses the non-Hound radii |
| Admin nav commands | `navCmd` follow/come use `hound ? chase : sp.speeds.follow`; hunt → Hound/Smiler beginners | debug nav | EXTEND: `sp.speeds.follow` defined; `hunt` uses a species hook `sp.debugHunt` |
| Admin summon | `summon` → `hound ? beginSearch : beginDrawn` (a Smiler function) | admin-only lead | EXTEND: species hook `sp.summon` first |
| Snapshot | `e.kind === 'hound' ? h : m` (everything else is drawn as a Smiler) | own list | EXTEND: `ss` list, sent ONLY when it is non-empty (a world without one is byte-identical to P9) |
| Debug info | `sm` / `hm` fields | own debug block | EXTEND: `sk` field |
| Intelligence debug | `intelligenceDebug` Hound vs else-Smiler scoring | correct labels | EXTEND: species hook `sp.targetScore` / `sp.debugWhy` |
| Act codes | `HACT`, `SACT` (facts.json keeps the client tables equal) | `KACT` | NEW (with a facts.json entry against `ents.js`'s `tab.k`) |
| Hunger / stamina | none in the engine (the Hound has trait `HUNGER`, a fixed number) | continuous hunger, finite stamina | NEW (species state on the entity, never reset by a state change) |
| Item theft | P.O.C.K.E.T. holds only the cartograph; no item id transfer, no carried monster light | steal a flashlight | **GATED** (see §6) |
| Crawlspaces | `world.crawl.js` zones; caps `CAN_CRAWL` / `CAN_USE_TIGHT_GAPS` with the entity's own clearance | pass while disguised | **GATED**: same clearance in both forms, so `CAN_CRAWL: false`; no LogicZ, no shrinking |

## 2. Server: the sim, the director and OVERSEER

| Capability | P9 reality | Need | Verdict |
|---|---|---|---|
| Organic spawning | `resetWorld` 1–2 Hounds + 2–5 Smilers; director tops up Hounds only (`DIRECTOR_MAX_HOUNDS = 3`) | none (forbidden) | READY — nothing is added there; a test proves no Skin-Stealer is ever spawned by `resetWorld` or the director |
| Admin spawn | `adminSpawn(kind)`, `adminCap(kind)`, `adminStressSpot(kind)` (Hound vs Smiler numbers) | admin-only spawn with its own cap | EXTEND: `ADMIN_MAX_SKINSTEALERS` (proposed 4), a placement rule (dark, far from players) |
| Admin panel commands | `admin.js`: hounds / smilers / near / summon / preview / entdel / entgoto / nav | spawn / remove / near / preview | EXTEND: `skinstealers` command; `near` and `preview` learn the kind; preview variants per species |
| Admin entity list | `info().es` maps `hound → 0, else 1` | own code | EXTEND: `2` for a Skin-Stealer (others unchanged) |
| Kill events | `sim.feed.processEvents`: `p.dead = ev.kind`, `p.kill = {…, k: ev.kind}` | — | READY |
| Snapshot assembly | `sim.step.entities()` returns `{st,h,m,b,p,gw,it,lf,sn}` | `ss` | EXTEND (only when present) |

## 3. Server: G.I.B. (death, aftermath, corpses)

| Capability | P9 reality | Need | Verdict |
|---|---|---|---|
| Physical death | `dphys.js` (`src/frameworks/gib/shared/dphys.js`, built to `public/` and `generated/server/`): `CFG` Hound A–D, Smiler A–D, Boom; `create` takes `hound = kind === 'Hound'`, everything else is Smiler | its own grapple deaths | EXTEND: `CFG.SkinStealer` (A neck break, B pounce into neck break, C neck bite), `DURS.SkinStealer`, `PLAN` branch, `prepare`/`begin` accept the kind. New branches only; the Hound and Smiler steps run the same code in the same order (same RNG draws) |
| Server fallback | `death_srv.js`: warms Hound/Smiler; `fxFor` maps every non-Smiler to Hound; `durOf` Hound/Smiler/Boom | correct killer in the fallback | EXTEND: warm the third kind; `fxFor` passes `SkinStealer`; variant check per kind; `durOf` |
| Aftermath | `aftTick`: corpse from the server's run; `killerEnd` only for a Hound | place the Skin-Stealer where its death left it | EXTEND: also for `SkinStealer` |
| One corpse per player | bodies keyed by player id (`sim.bodies.js`), `MAX_BODIES = 24` | exactly one | READY (unchanged) |
| Dropped light | part of the corpse record (`dr`, `lo`, `lf`) | stays with the body | READY (the monster never takes it) |
| Corpse dragging / hiding | none on the server | carry a kill out of sight | **GATED** (see §6): it may only choose where to kill and where it then stands |

## 4. Server: B++, W.A.R.D. and speech

| Capability | P9 reality | Need | Verdict |
|---|---|---|---|
| Nearby speech | `speech.js`: same room, living speaker and hearers, 576 px, token bucket 3 / 5 s, repeat block, `cleanText`, slow-socket skip, voice `{p,h,s}` checked | the input of the mimic | READY |
| Entity hearing hook | `ON_HEARD = null`, never assigned (the unit check asserts it); CHAT.md's inert `onLocallyHeardSpeech` contract | receive accepted, local lines only | EXTEND: an injected `onHeard` callback (given by server.js), called only after a line was accepted and delivered, with the server's own speaker position; the sim keeps it only for Skin-Stealers within 576 px in that room; bounded memory; never logged |
| Entity speech out | none | a server-owned line from an entity | NEW: `speech.entitySay(room, …)`: a distinct `{t:'eheard', e, text, seq, v, o}` packet; same room, living hearers within 576 px of the entity; per-entity token bucket; `cleanText` again; slow-socket skip; never a session id |
| Validated looks | `fields.cleanLook`: `hat|texture|hands|main|backpack`, allow-listed | disguise appearance | READY: the victim's look is re-validated, backpack forced to `none` |
| Lounge | `/social`, global, menu-only | must never reach an entity | READY (the hook is only in `speech.js`, the lounge never calls it) |

## 5. Clients

| Capability | P9 reality | Need | Verdict |
|---|---|---|---|
| Snapshot mirror | `mp.monsters.js`: `s.h` → Hound slots, `s.m` → Smiler slots; `announceKill`/`markKiller` Hound vs slot | third list, killer slot | EXTEND |
| Interpolation | `net-interp.js` keys `h<i>` and `m<i>` | `k<i>` | EXTEND |
| Entity art (BR-R `ents.js`) | `ents.hound.js`, `ents.smiler.js`, `E.slotH` / `E.slotS`, act tables `tab.h` / `tab.m` | lanky silhouette, poses, attack pose | NEW `ents.skinstealer.js` part; `E.slotK`; `tab.k` |
| TS renderer | `EntityView` (Hound), `SmilerView`; `Renderer.hv` (64 Hound slots); `CaptureKind = 'Hound' \| 'Smiler'` | a third view, slots, a death attacker | EXTEND `entity-view.ts`, `render.ts`, `death.ts`, `corpse-view.ts`, `main.ts`, `shared/entity.ts`, `contracts.d.ts` (TypeScript source; the compiled client is rebuilt, never edited) |
| Disguise drawing | other players are `PlayerView`s from `__api.mkAvatar(look, gear)` in `__api.layer()` (the creatures layer: sight-masked, under the darkness) | a human silhouette with tells | EXTEND: the same avatar class, its gear hidden (no light is drawn or emitted), no name, no hover |
| Deaths on screen | `DeathSequence` (TS) + `dphys.frame`; spectators `mp.deaths.js` `startFx` (`m.c === 'Smiler' ? Gl : Wl`) | correct attacker for victim and spectators | EXTEND |
| BR-RoLE actors | `actorShadows` lists `__hound` views and any view with `deathPose` (a wanderer); never a Smiler | its body casts like a body | EXTEND: a `__stealer` actor with its own silhouette; a disguise is a wanderer avatar and casts as one; both only when the local player can see the spot (the existing `seen()` rule) |
| Entity audio | `ents.audio.js`: procedural Web Audio (`houndVoice`, `smilerVoice`, `deathVoice`, `deathEvent`) | restrained clicks, breath, the finisher | EXTEND (procedural; no new sound files) |
| Nearby chat | `chat.js`: `heard` → bubble over a peer, edge hint, mute per session id, screen-reader line; `voice.js`: seven presets | an entity-origin bubble | EXTEND: `eheard` handled apart from `heard`; mute by entity and by the line's origin; an entity-only voice preset that no player can choose or send |
| Admin panel | MONSTERS tab: Hounds / Smilers counts, near, preview | Skin-Stealer row | EXTEND (`mp.admin.js`) |
| Debug overlay | `ents.debug.js` reads `dbg` entries | Skin-Stealer state, hunger, stamina, plan | EXTEND |

## 6. Gated features (reported, not implemented)

| Feature | Why it is gated | What Trial 3 does instead |
|---|---|---|
| Stealing the victim's flashlight / carrying a light | H.A.N.D.S. is input bindings only; P.O.C.K.E.T. has no item-id transfer; a monster light would be a second, fake emitter while the real one lies by the corpse | the disguise carries no light at all (its hands are empty: that is one of its tells); the dropped light stays with the body, as G.I.B. records it |
| Dragging / hiding a corpse | no server-authoritative body interaction; corpses are server records made at the death's end | it chooses ambush spots out of sight, stays on its kill for the death's length, then feeds where it stands only while unobserved, otherwise leaves |
| Disguised crawlspace passage | LogicZ does not exist; crawl zones are 2D areas tested against the entity's own clearance | the disguise keeps the same collider; `CAN_CRAWL: false` in both forms |
| Real voice imitation | forbidden (no recording, no cloning, no cloud) | the mimic repeats locally heard accepted text in its own synthesized voice preset |
| Organic population | forbidden until the owner approves ecology and balance | admin-only spawn |

## 7. Two-species assumptions found (the audit list for T1)

Each is either extended for the third species or proven harmless by a test at T1/T7:

1. `ai.engine.js`: `SPECIES`; `onTier`; `farStep`; `watchdog`; `separate`; `navCmd` (follow/come/hunt/clear); `summon`; `snapshot`; `debugInfo` (`sm`/`hm`); exports.
2. `ai.intelligence.js`: `evidenceWeights`; `intelligenceDebug`.
3. `ai.light.js`: `observeBeam`'s `hitHound` (stays Hound-only).
4. `ai.capture.js`: `killNow` commit; `previewKill` offsets and Smiler C; `chooseMode` forced play; `capStep`'s `others && e.kind === 'hound'`.
5. `ai.entity.js`: `follow` corner radius.
6. `sim.ai.js`: `adminCap`; `adminStressSpot`; `spawnMonsters`; caps.
7. `sim.step.js`: `resetWorld`; director; `entities()`.
8. `sim.admin.js` / `admin.js`: `placeNear`; `previewKill`; add/remove; summon; `info().es`; near; preview.
9. `death_srv.js`: warm-up; `fxFor`; `durOf`.
10. `aftermath.js`: `killerEnd`.
11. `dphys.js`: `create`; `PLAN`; `DURS`; `begin`; `prepare`; `frame` (Smiler alpha); `stepAttacker`.
12. Clients: `mp.monsters.js`; `net-interp.js`; `mp.deaths.js` (`m.c === 'Smiler' ? … : Hound`); `ents.death.js` (`deathPlan`, `localKill`); `ents.head.js` tables; TS `death.ts`, `render.ts`, `main.ts`, `entity.ts`, `corpse-view.ts`; `br-role.js` actors; `ents.audio.js`.
