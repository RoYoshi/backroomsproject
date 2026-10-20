# Trial 3 — Skin-Stealer: checkpoints

Branch `trial-3-skin-stealer`, from P9 `1ff9374babc034eafed4c7c26dc941f46fc55908` (tree `d6b71b88e2baaec0cce1eb8a222ccc66ad1a1aef`).
Each row is filled after its push has been verified on GitHub (`tools/verify_remote_t3.py`); the verification record is in
`evidence/remote/`.

| Checkpoint | Commit | Tree | Parent | Verified |
|---|---|---|---|---|
| T0 recon, plan, matrix, decisions, baseline | `98d28196d25a1cea6167323548571a99e399a44e` | `40b2191329b2c504c8801462ed30c08bd0cef755` | `1ff9374` | yes: `evidence/remote/t0.json` (ls-remote and the GitHub API agree; every protected branch at its frozen SHA; no other branch moved) |
| T1 third species, admin-only spawn, bounded snapshot, first view | (this commit; recorded at T2) | | `98d2819` | |

## T0 baseline (P9 `1ff9374`, this machine, before any game change)

| Run | Result |
|---|---|
| `npm test` (seeded suites) | 149 / 162 pass; the 13 failures are the ones P9 already records (P01, P08, H07, NV09, C1, C3, C4, C5, C9/C10, C18, L9, 2F F13, 2F F22): `evidence/t0/npm_test_p9_baseline.txt` |
| `npm run test:humanqa` | 5 / 6; X03 fails on P9 too (it looks for a minified string the current bundle no longer has): `evidence/t0/humanqa_p9_baseline.txt` |
| `npm run build:check` | PASS (43 outputs and the manifest) |
| `dev/tools/checks/parts.js` | PASS (8 outputs, 55 parts) |
| `dev/tools/checks/modules.js` | PASS (29 server files, 23 factories; the sim 10 modules; the page 6 scripts, 32 modules) |
| `dev/tools/docs/docs.js --check` | PASS (23 generated blocks) |
| `dev/tools/checks/facts.js` | PASS (41 facts, 169 copies) |
| `dev/tools/checks/chat_server.js` | PASS (88 of 88): `evidence/t0/chat_server_p9_baseline.txt` |
| Fast / full gate | not run at T0 (no code changed; P9's accepted record stands); the fast gate runs at T1 and T7 |

## T1 — the third species (results on the T1 tree)

What T1 adds: N.A.N.I.'s third server species (`ai.skinstealer.js`: its own name, act table, collider, senses, traits and hooks; at T1
it only roams), admin-only spawning (OVERSEER: add / near / remove, capped at 4, in the dark, away from every living player; never by the
world reset, the director or RESPAWN ALL), the bounded `ss` snapshot list (sent only while one exists, so P9's snapshot is byte-identical
without one), the client mirror and a first, provisional body in a new page script (`public/assets/skinstealer.js`, built from four
parts under `src/`), drawn in the bundle's sight-masked creatures layer and shaded by the light where it stands.  No TypeScript change.

| Run | Result |
|---|---|
| `npm test` | 157 / 170: the 8 new SK01–SK08 cases pass; the 13 failures are exactly P9's (`evidence/t1/npm_test_t1.txt`) |
| `npm run test:humanqa` | 5 / 6, X03 as on P9 (`evidence/t1/humanqa_t1.txt`) |
| `dev/tools/checks/chat_server.js` | 88 / 88 (`evidence/t1/chat_server_t1.txt`) |
| fast modernization gate (all 21 steps) | PASS 21 / 21 (`evidence/t1/gate_fast_t1.txt`): B++'s server, session, sim, page, client and bundle traces unchanged; `cli_golden` runs 232 of `mp.js`'s 234 functions (the two in UNRUN: P9's one and `bodySkin`) |
| `tools/skin_browser.js` (real server, headless Chromium) | 10 / 10 (`evidence/t1/browser_t1.json`, screenshots `evidence/t1/*.png`) |

Two gate findings shaped T1 (both kept the gate's guarantees rather than weakening a check):
- the client golden (`cli_golden`) records the admin panel's tab bar and the page body; a sixth tab always present changed B++'s trace.
  The SKIN tab is therefore shown only after **K** is pressed with the panel open, while a Skin-Stealer exists, or while it is the open
  tab; otherwise the panel is P9's.  Its body (`bodySkin`) is the one new `mp.js` function and is listed in `cli_golden_c3c.js`'s UNRUN
  with this trial's browser tool as its runner.
- the `__api` contract and its pages are regenerated because the new page script reads `__api.layer()` and `__api.death()`.
