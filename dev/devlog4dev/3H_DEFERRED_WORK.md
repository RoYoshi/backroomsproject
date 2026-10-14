# Stage 3H deferred work

**What this is.** Work that Stage 3H found or was asked about, and that belongs to another stage. Stage 3H does not do it, because 3H must leave the game exactly as it was at B++.

Each item names its owning stage and what must happen first.

## 1. Other stages' work

| Item | Owning stage | Why not in 3H | First |
|---|---|---|---|
| Hound and Smiler artwork (`ents.js`, from `dev/ents_src/`) | Stage 3E | new visuals; pack file 11: no redesign in 3H | the user's authorization of 3E |
| The dread drone, thumps and burst under the master volume (R-005) | Stage 3F | changes what players hear (F-008) | 3F's authorization |
| Hum and dread code ownership (`mp.js` 363–401, 887–992) | Stage 3F | audio is locked; a NO-GO seam (`3H1_DEFERRED_SEAMS.md`) | 3F |
| E.C.H.O., hearing occlusion | Stage 3F or later | not implemented; must never overwrite N.A.N.I.'s hearing | a design the user approves |
| Per-floor-material blood and audio (R-012) | Stage 3F, or a later G.I.B. stage | new visuals and audio (F-022) | that stage's authorization |
| Cross-system integration after 3E and 3F | Stage 3G | depends on 3E and 3F | 3E and 3F accepted |
| LogicZ (Z mechanics, an extension of S.P.A.C.E.) | Stage 4 | reserved; 3H builds no Z | Stage 4 |
| Items and inventory (P.O.C.K.E.T.; `inventory.js`, the cartograph in `mp.js` 334–358) | a later item stage | items are locked for 3H | that stage |
| More levels, a level format, one source for the Level 0 map (R-015) | a L.O.S.T. stage | no Level 0 redesign in 3H; the bundle cannot be rebuilt (F-002, F-007) | a level-format design |
| Text chat | a later B++ feature | new feature; it must give typed chat no N.A.N.I. hearing (pack file 04) | its own authorization |
| Static props, physical props, dropped equipment | L.O.S.T. + BR-R; S.P.A.C.E.; G.I.B. + BR-RoLE | new features | their own stages |
| Player frame-rate / network display (R-011) | a later feature milestone | visible change; opt-in, off by default | its own authorization |

## 2. Optimisation and delivery

| Item | Why deferred | First |
|---|---|---|
| Serve `.wav` as audio without on-request gzip (R-004) | changes bytes and headers on the wire (F-013) | the user's approval; a delivery check of the menu theme |
| Bound the admin's debug snapshot; count dropped messages (R-009) | admin behaviour (F-009) | an OVERSEER or B++ stage |
| The gzip cache (F-015) | goes with R-004 | R-004 |

## 3. B++ follow-ups

| Item | Why deferred | First |
|---|---|---|
| **The wider B++ multiplayer QA** (pack file 12) | the user's session | If it confirms a regression: record the reproduction; stop runtime 3H steps; fix B++ on its own authorized checkpoint; move the 3H parent only after independent verification and the user's word |
| An admin's own placements guarded (R-007) | B++ behaviour (F-019) | the user wants it |
| A placement acknowledgement instead of the 900 ms window (R-008) | B++ protocol (F-020) | the wider QA shows snap-backs |

## 4. Security, publication, repository

| Item | Owner | First |
|---|---|---|
| The security items reported privately (R-018) | the user | the user's decision; then a bounded security stage |
| Repository visibility, publication, deployment changes | the user | pack file 10: not authorized by 3H |
| Retire `assets/shadows-2d.js` (R-014) | the user | the user's agreement |
| The duplicate `sting copy.mp3` (R-006) | the user | the user's decision |

## 5. Stage 3H's own later steps (each needs authorization)

| Item | Precondition |
|---|---|
| H2-0, the development gate (R-001 to R-003) | the user's authorization; it changes only `dev/` |
| C-1, the NEW RUN decision → `server/newrun.js` | H2-0; the user's authorization; a playable overlay and Human QA |
| C-2, the death aftermath → `server/aftermath.js` | C-1 accepted |
| C-3, NEW RUN's button and words | a client NEW RUN golden recorded on B++ |
| The nine NO-GO seams (`3H1_DEFERRED_SEAMS.md`) | each to its owning stage; several only after the private security decisions |
| Old root reports into `dev/devlog4dev/` (R-017) | a path-consumer and hash audit |
| Test expectations that lag accepted designs (R-016) | the user's decision per test |
