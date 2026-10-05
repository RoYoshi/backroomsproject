# THE FAR BACKROOMS — 2D Lighting & Shadows: git checkpoints

**Repository:** `RoYoshi/backroomsproject`. **Branch:** `lighting-shadows-2d`. It was created from exactly the immutable
parent; there was no earlier branch of that name to preserve.

**Immutable gameplay parent (v23.3.6):**
- commit `f2805bb904c158df17c5c75c3d0d4681049bc246`
- tree `8cc77595fe6e88c425e2f8abd243f3463af44a18`

**`main`:** `7781e1ac34aa09970df57fae3fc107a873fa2731` before this stage, and still there at every check from SH2 on.
The SH0 and SH1 records did not include it. Nothing in this stage pushed to `main`; every push went to
`lighting-shadows-2d`.

Every checkpoint was committed, pushed, and verified on GitHub before the next stage started. SH5 and SH6 continue
from SH4 final after human QA; SH0–SH4 and their evidence were not redone or rewritten. The branch head's commit,
tree and parents were checked both with `git ls-remote` and with the GitHub REST API. Each stage's evidence folder
holds the previous checkpoint's verification record.

| checkpoint | commit | tree | parent | what | verified on GitHub (UTC) |
|---|---|---|---|---|---|
| SH0 | `8e3c06b0bd2351ffc75f0c8d8ec5cbd5f2407362` | `be8709529fa91df99663bc0757a8759da5a3c9af` | `f2805bb9…` (the parent) | freeze: parent manifest of every tracked file, retained v23.3.6 suites on a pristine export, baseline captures, stage tooling; no implementation | 2026-10-05T04:04:33Z |
| SH1 | `3151062a30e3b824e209ebb8e244c24691d118d9` | `3cab46b92db1025b4f1a7833f3dae73491d825f9` | `8e3c06b0…` | static grounding (wall AO) and light-directional entity shadows, quality tiers, settings row, admin debug view | 2026-10-05T05:35:11Z |
| SH2 | `fb65693c75c7630c6f6257ebe9123d82094ad246` | `af5ccc21642ed585808bdcfc07e0b20b41349ba3` | `3151062a…` | flashlight and lamp cast shadows: prop shadows, lit-side penumbrae, light-true strength, flicker / blackout, peers | 2026-10-05T07:27:52Z |
| SH3 | `afd71455f5795cf6f6d287584d6b8a42c3718b95` | `98a8f9ab91b32ac9d35f3e179ce0baf5f5984bc9` | `fb65693c…` | quality tiers reviewed against measurements, layout-read fix, bench rebuilt (hi-DPR, mobile-like), bounded-work test, performance evidence | 2026-10-05T11:18:22Z |
| SH4 | `0787e1ffd21923f523897730607d74bbc39dd276` | `b46d968f7fc7c1546595208f68a890339be3b7fb` | `afd71455…` | full retained regression, final reports, human-QA handoff, package | 2026-10-05T13:03:03Z |
| SH4 review fixes | `a90b51c4dc023c6d7cccae2e74cee880959ea348` | `5e1ef4624a5c8a3814ae2225eaf7661a9a07d40e` | `0787e1ff…` | an independent review checked the reports against the evidence; wording corrected where it claimed more than the evidence shows, with evidence added (which export each retained run used; SH1 / SH2 log identity). No runtime file and no result changed | 2026-10-05T13:24:25Z |
| SH4 final | `3f12c4795531ca68404db7a86a8bf0ad5163098c` | `5893186598e07f16de24408b6ce5da52587a0475` | `a90b51c4…` | the package receipt names the parent commit by its subject; the review-fix commit's verification record. Human QA of this build: *"It feels like the same game"* (PASS), *"The Shadows are VERY Faint"*, *"The shadows aren't noticable"* (FAIL) | 2026-10-05T13:25:17Z (its package receipt); re-checked 2026-10-05T15:00:11Z before SH5 |
| SH5 | `5471ac85e14680c7cab678a988f245bf685e4471` | `72ec3c0e9f21942a9f118017046dcc868279b5c2` | `3f12c479…` | human-QA visibility correction: shadow strengths retuned by class in `assets/shadows-2d.js` (1.1), new bounded-strength tests V01–V08, before / after captures, the repeated LOW phone-sized measurement | 2026-10-05T16:50:14Z |
| SH6 | (this commit: see the package receipt) | | `5471ac85…` | final correction regression (retained suites and their diagnosis, performance matrix; the follow-up runs stopped by instruction are listed as limitations), corrected reports, human-QA handoff, package | in the package receipt |

The verification records are:
- `dev/shadows/evidence/sh1/sh0_remote_verify.json`
- `dev/shadows/evidence/sh2/sh1_remote_verify.json`
- `dev/shadows/evidence/sh3/sh2_remote_verify.json`
- `dev/shadows/evidence/sh4/sh3_remote_verify.json`
- `dev/shadows/evidence/sh4/sh4_remote_verify.json` (the reviewed SH4 commit `0787e1f`)
- `dev/shadows/evidence/sh4/sh4b_remote_verify.json` (the review-fix commit `a90b51c`)
- `dev/shadows/evidence/sh5/sh4_final_remote_verify.json` (SH4 final `3f12c47`, re-checked before SH5 began)
- `dev/shadows/evidence/sh6/sh5_remote_verify.json`

A commit cannot contain its own hash, so the final commit's verification is in the package receipt
`2D_SHADOWS_PACKAGE_RECEIPT.txt`, which ships beside the ZIP.
