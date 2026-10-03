# Stage E Git checkpoints

Status: E0 parent/preflight evidence recorded; E1–E5 NOT STARTED.

Working branch: `stage-e`. Do not merge into `main` without the user's separate authorization. Stage F has not begun.

The accepted Stage D starting commit and E0 base are both:

`478ada6cf534d40810e28709755e88f0b53b6ee5`

The recovery request explicitly permits E0 to reference this existing base when implementation files do not change. This documentation commit adds the supplied authority documents and generated preflight evidence only. Its identity is available from Git history; the current commit does not embed its own SHA.

| Checkpoint | Commit / status |
| --- | --- |
| E0 — parent/preflight | `478ada6cf534d40810e28709755e88f0b53b6ee5`; evidence in `dev/stage_e/E0_PREFLIGHT.md` |
| E1 — navigation graph | NOT STARTED |
| E2 — physical routes | NOT STARTED |
| E3 — sensor boundaries and recovery ZIP | NOT STARTED |
| E4 — real brains and hidden-elevation proof | NOT STARTED |
| E5 — regression candidate | NOT STARTED |
| Final Stage E | NOT STARTED |

See `dev/stage_e/reference/RECOVERY_REQUEST.md` for the user-supplied E0–E5 definitions, Node 25.9.0 runtime, startup-banner request, final package name, and commit/push policy. The input pack's technical specification is retained beside it. The archive checksum and complete immutable-parent manifest are under `dev/stage_e/evidence/e0/`.

## Current limitation

The environment-onboarding session that prepared E0 has a higher-priority instruction prohibiting intentional application-source and test edits. Its branch and evidence preparation can proceed; implementation requires a regular coding session. The user has already authorized the Stage E source/test work, E0–E5 commits and pushes, and the presentation-only startup banner. No additional user approval is needed for that scope once the session restriction is absent.

The original strict trace verifier remains nonzero on historical Node 24.19.0 versus current Node 25.9.0 metadata. The unmodified record comparator reports all 46 traces / 35,098 records identical at tolerance zero. These are separate results; historical reference files and assertions remain frozen.
