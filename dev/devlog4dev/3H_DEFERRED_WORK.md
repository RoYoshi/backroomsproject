# Stage 3H deferred work

**What this is.** Work that Stage 3H found or was asked about, and that belongs to another stage. Stage 3H does not do it, because 3H must leave the game exactly as it was at B++.

Each item names its owning stage and what must happen first.

## 1. Other stages' work

| Item | Owning stage | Why not in 3H | First |
|---|---|---|---|
| Hound and Smiler artwork (`ents.js`, from `dev/ents_src/`) | Stage 3E | new visuals; pack file 11: no redesign in 3H | the user's authorization of 3E |
| The dread drone, thumps and burst under the master volume (R-005) | Stage 3F | changes what players hear (F-008) | 3F's authorization |
| Hum and dread code ownership (`mp.js` 363–401, 887–992) | Stage 3F | audio is locked; a NO-GO seam (`3H1_DEFERRED_SEAMS.md`). **3H2 C-4 moved the hum (887–984) verbatim to `assets/mp-hum.js`** under the authorization's rule for NO-GO seams (documented proof first: `evidence/h2/c4_prep/`, `evidence/h2/c4/`); nothing in it was retuned. The dread audio (363–401) stays in `mp.js` (§6) | 3F: any change to how either sounds |
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
| H2-0, the development gate (R-001 to R-003) | **done in 3H2** (`3559e65`) |
| C-1, the NEW RUN decision → `server/newrun.js` | **done in 3H2** (`91a785f`); Human QA pending |
| C-2, the death aftermath → `server/aftermath.js` | **done in 3H2** (`eb782fd`); Human QA pending |
| C-3, NEW RUN's button and words | **done in 3H2** (`3e140ef`), after the client NEW RUN golden (`d24b64e`); Human QA pending |
| C-4, the fluorescent hum → `assets/mp-hum.js` | **done in 3H2** (`859cf07`), after the hum golden (`d66b891`); Human QA pending (listen) |
| The nine NO-GO seams (`3H1_DEFERRED_SEAMS.md`) | each to its owning stage; several only after the private security decisions |
| Old root reports into `dev/devlog4dev/` (R-017) | a path-consumer and hash audit |
| Test expectations that lag accepted designs (R-016) | the user's decision per test |
| A 3H copy of B++'s `place_replay.js` that cannot fail by chance (F-036): a case whose mover was sent `exit` voided and run again, or a walk no glitched wall can reach | the next change to the gate; B++'s own tool stays as it is |

## 6. Stage 3H2: seams left where they are, and why

Stage 3H2 moved what could be moved verbatim and proven (H2-0, C-1 to C-4). These stay, each for a concrete reason. "Locked" means
the user's 3H authorization names it as locked, or the 3H1 audit found it NO-GO and no preparatory work made it provable.

| Seam | Where (B++ lines) | Why it stays | What would make it movable |
|---|---|---|---|
| NEW RUN's client state and decisions (`__net.nr`, `nrAnswer`, `nrSent`, `nrBusy`, `nrQ`, `worldW`) | `mp.js` 38–72, 81–97 | `worldW` is the world epoch the `q` handler, `oldWorld` and `worldNew` read; `nrBusy` is read by `solidNow` (solidity, locked); `nrLast` by the admin panel. Moving them means rewriting their readers (accessors or a shared object), not moving lines | an authorized change to the solidity code, or a shared NEW RUN state object designed with B++ |
| Dread audio (`initAudio`, `thump`, `burst`, the drone) | `mp.js` 363–391 | it registers two listeners and a MutationObserver when `mp.js` loads; from a helper loaded earlier they would register earlier, which changes the page's listener order (recorded by the client goldens, and which handler runs first). F-008 lives here | Stage 3F (Spacious Audio), with R-005 |
| Movement validation and the placement guard | `server.js` 30–113, 186–203 | locked by the authorization (B++-0's guard, 60 Hz authority, solidity); and the wider B++ QA is still pending, so a B++ fix may land there - a moved copy would make that fix harder to carry | the wider B++ QA closed; an authorized S.P.A.C.E. step |
| Sessions, snapshot and the tick | `server.js` 321–468 | locked (pose freshness, B+'s `q`, timing); `s_ir` I1 reads `server.js`'s text (`me.ir =`, `ir: c.ir`) | a test-hygiene decision on text-reading tests (R-016), then a dedicated golden of the tick's order |
| Admin commands and authentication | `server.js` 256–320 | security; the private items (R-018) come first; `s_humanqa_hotfix` X02 reads `server.js`'s text | the user's security decisions |
| Client transport, peers, B+ | `mp.js` 1–76, 108–244, 584–637, 993–1044 | locked (pose freshness, smoothing, solidity, message order) | — (B++'s own stage) |
| Client replays, dying lights, wall stains | `mp.js` 411–583 | coupled to the transport's state (`fxs`, `NET`, `pendSt`, the epoch); Stage 3D accepted surface (G.I.B.) | a G.I.B. stage with its own goldens of the light timings |
| Admin panel | `mp.js` 638–886 | security; `s_humanqa_hotfix` X02 reads `mp.js`'s text (`data-n="10"`) | R-018 and R-016 |
| The cartograph, glitched walls | `mp.js` 307–358 | items are locked for 3H (P.O.C.K.E.T.); small and tied to the run state | an item stage |
| `worldReset` | `server.js` 164–181 | it is the admin's world epoch, built on the movement functions (`placeFree`, `mvReset`) above | with movement |

**Framework boundaries actually extracted in 3H2** (each a file with one owner): `server/newrun.js` (B++ networking: NEW RUN's
decision), `server/aftermath.js` (G.I.B.: the server's death aftermath and the NEW RUN blast), `assets/net-newrun.js` (F.R.O.N.T.:
NEW RUN's words), `assets/mp-hum.js` (Spacious Audio: the fluorescent hum). Every other framework name stays a label over code that
is still shared (`3H1_FRAMEWORK_REGISTRY.md`).
