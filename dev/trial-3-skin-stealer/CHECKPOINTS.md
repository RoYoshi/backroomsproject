# Trial 3 — Skin-Stealer: checkpoints

Branch `trial-3-skin-stealer`, from P9 `1ff9374babc034eafed4c7c26dc941f46fc55908` (tree `d6b71b88e2baaec0cce1eb8a222ccc66ad1a1aef`).
Each row is filled after its push has been verified on GitHub (`tools/verify_remote_t3.py`); the verification record is in
`evidence/remote/`.

| Checkpoint | Commit | Tree | Parent | Verified |
|---|---|---|---|---|
| T0 recon, plan, matrix, decisions, baseline | (this commit; recorded at T1) | | `1ff9374` | |

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
