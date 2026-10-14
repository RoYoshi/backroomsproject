# Stage 3H1 report: audit and B++ baseline

**BASELINE/AUDIT COMPLETE — FUTURE REFACTOR NOT AUTHORIZED.**

**STAGE 3H1 AUDIT CANDIDATE — awaiting the user's authorization for the first surgical runtime checkpoint.**

Stage 3H is not complete. H2 has not started.

## 1. Parent and branch

| | |
|---|---|
| Accepted B++ | `stage-3e-0-bplusplus` `143b63ff42b88c6780c5043e0f61d64100f81f40`, tree `b25c26ec3eedab406a6b93f80a59ba6a1cb7c128`, checked on GitHub first |
| Branch | `stage-3h`, made from exactly that commit; it did not exist before (`evidence/h1/remote_heads_before_3h1.json`, 29 branches) |
| Other branches | none touched; every push was checked against all 29 (`tools/verify_remote_h1.py`) |

## 2. The game did not change

- **Production files.** All 189 files outside `dev/` (70,285,930 bytes, `favicon.ico`, the WAVs, PNGs and bundle included) are byte-identical to B++. They were compared by SHA-256 of their content, with manifest `fe2f6115027eab8b…`, at every 3H1 commit (`evidence/h1/scope/`).
- **Earlier stages.** All 7,267 files under `dev/` outside 3H1's two folders are unchanged.
- **What 3H1 added.** Files only, all under `dev/stage-3h/` and `dev/devlog4dev/`, with no deletion or rename. `3H1_CHANGED_FILES.txt` lists them.
- **The generated files.** `ai.js`, `ents.js` and `sim.js` still rebuild byte for byte from their sources.

**To run it.** `ADMIN_PASSCODE=<your passcode> node server.js 8000` runs the accepted B++ game unchanged.

## 3. What was done (master prompt steps A–F)

| Step | Result | Where |
|---|---|---|
| A. Parent, 3H0 modules, entry points | Verified. All five 3H0 extractions present and used. Load order, module graphs, 60 globals, server `require` closure, 45 served files inventoried | `3H1_ARCHITECTURE_AUDIT.md`, `evidence/h1/inventory_bpp.json` |
| B. Ownership map, GO / NO-GO, the nine seams | Every runtime file and global mapped. `server.js` and `mp.js` mapped section by section. **None of the nine 3H0 NO-GO seams became safe**; six became more coupled | `3H1_DEPENDENCY_OWNERSHIP_MAP.md`, `3H1_FRAMEWORK_REGISTRY.md`, `3H1_DEFERRED_SEAMS.md` |
| C. Behaviour frozen on B++ | 25 golden traces locked by SHA-256, identical A/A and on repeat: 3H0's 11 server and 9 client traces re-recorded, plus 5 new B++ scenarios (`caps` / `q`, the placement guard, its two caveats, NEW RUN), with 9 of 9 mutants caught. Browser, BR-RoLE, collision and gameplay checks; suites; performance A/A | `3H1_SOURCE_PARITY_BASELINE.md`, `../devlog4dev/3H_PERFORMANCE_BASELINE.md` |
| D. Candidates | Ranked, with risk, dependencies, rollback, guardrails, and the NO-GO areas | `3H1_EXTRACTION_CANDIDATES.md` |
| E. Documents, registry, backlog, evidence, findings | Written. An independent review checked them against the code; its corrections are applied | this folder, `../devlog4dev/` |
| F. Push, verify, prove no change | Pushed normally. Remote commit and tree verified after each push (`evidence/h1/remote/`) | §2 |

## 4. What the audit found

The full list is in `../devlog4dev/3H_FINDINGS.md` (30 findings). None was fixed. The ones that matter most:

| ID | Finding |
|---|---|
| **F-008** | The dread drone, thumps and capture burst ignore the volume setting; only SOUND on/off affects them. Audio, so Stage 3F |
| **F-013** | After every server start, the first menu visit makes every room pause about 0.26 s and then 0.43 s, while the WAVs are gzipped synchronously (measured), for a 2 to 3 % saving |
| **F-019, F-020** | B++'s two stated caveats, reproduced and now pinned by a golden: an admin's own GOTO flickers back for others; a pose arriving more than 900 ms late undoes a placement and the player is sent back |
| **F-009** | Messages of 64 KiB or more are dropped silently; an admin's AI-debug snapshot already reaches half of that with 21 entities |
| **F-021** | Two 3H0 live harnesses do not run on B++: `raw_live.js` passes vacuously (exit 0, no output), `live_wire.js` hangs |
| **F-017** | The historical test failures are exactly the names recorded at HQ2. `test_br_role`'s three (29/32) date from HQ4 and HQ5's accepted designs, not from B++ |

**Security.** Items were sent to the user privately, outside the repository. They are summarised publicly only as F-027.

## 5. The extraction shortlist

| Rank | Step | Runtime change | Verdict |
|---|---|---|---|
| 0 | **H2-0:** one development gate over the B++ baselines, a B++ contract, working live harnesses, the scope and build checks, the mutants, and the missing `held` NEW RUN case | none | **RECOMMENDED first** |
| 1 | **C-1:** the NEW RUN decision (`nrIntent`, `NR_GAP`) → `server/newrun.js`, unchanged | 2 server files | **RECOMMENDED** as the first runtime checkpoint |
| 2 | C-2: the death aftermath → `server/aftermath.js` | 2 server files | CANDIDATE-LATER, after C-1 |
| 3 | C-3: NEW RUN's button and words in `mp.js` | client + `index.html` | CANDIDATE-LATER, after a client NEW RUN golden |

**Everything else is NO-GO:**
- the B++ surfaces;
- the bundle;
- BR-RoLE;
- audio;
- admin and sessions;
- `world.js` and `dphys.js`;
- the generated files except through their sources.

`3H1_EXTRACTION_CANDIDATES.md` §5 gives the reasons.

## 6. Unresolved blockers

1. **The private security items** are the user's decision. They come before any move of the admin or session code.
2. **The wider B++ multiplayer QA** (pack file 12) has not been reported. If it confirms a regression, runtime 3H pauses and B++ is fixed on its own authorized checkpoint (`3H1_NEXT_GATE.md` §3).
3. **One NEW RUN refusal (`held`) has no golden yet.** H2-0 adds it before C-1.
4. **The live socket comparisons do not run on B++** (F-021). H2-0 repairs them as 3H copies.
5. **No automatic probe sees a real GPU, real audio output or a real network** (F-023). Each runtime step therefore ends in the user's Human QA.

## 7. Commits on `stage-3h`

| Commit | Tree | What |
|---|---|---|
| `4ced2e8f36b0595ff7d415f858b08639b54ecb9f` | `9e0781081b97fa7417f2e1a395f1e39ebde543ac` | development tools |
| `08fc3d166f6369ce267b0049c521622cac0ff25d` | `54f69e915abdf7a187e28a041755e59e0829a10f` | the B++ baseline evidence |
| `71aaa6eecca30640af73c0fe58016f333d35c6ba` | `68fe47c8f6b6adeea82272d0fec6c112de735d84` | the inventory reads the page's inline scripts |
| `17bfaa5635316178a3b026230797cb24ecd83015` | `355e98d25504c7793b94afbb0da67b5722657beb` | the 3H1 documents |
| `b2918a2faecdde5604690272ccc8055cc37c2f5f` | `7b6585a180ea68b3bc61eb60dd4c6d9a08e0c806` | devlog4dev |
| this commit | — | this report, the changed-files list, the scope and push receipts; its own SHA is given in the delivery message |

## 8. STOP

3H1 ends here. It made no H2 change, not even a supposedly harmless one, and touched no runtime file, entity art, audio, items, multi-level content or LogicZ.

The next step needs the user's explicit choice in `3H1_NEXT_GATE.md`.
