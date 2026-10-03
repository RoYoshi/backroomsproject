# E5 recovery continuation

Recovered `stage-e` at `bca4bb1ca183e7c2cb83a676d4f3c3e3167f954f`.
The clean checkout and complete E0–E5 ancestry from Stage D were verified before editing.
All new gameplay validation uses Node v25.9.0.

The first long regression exposed a candidate bug: `coarseMove` referenced an
undefined `geo` in its flat branch, although spatial movement already returns
through `follow` above it. Restoring the exact original flat XY distance fixes
the ReferenceError without changing spatial physics or species decisions.
The maintained source was changed and `ai.js` regenerated. The retained Hound
suite now passes 18/18, including the previously crashing H13.

The initial aggregate was 140/162. It is retained under
`evidence/final/candidate-failures/`; its failures are not accepted as a new
baseline. That run was deliberately stopped during the live suite after the
crash was identified. Network failures from that attempt remain diagnostic
evidence, not a product or environment classification. Full reruns follow.

The two named Stage E entry points were still historical placeholders. They now
invoke the implemented core/motion/sensor/real-entity suites through a shared
acceptance adapter. The frozen Stage A matrix and all existing assertions remain
unchanged. Z14 and Z17 claim only their Stage E portions.

The first browser installer failed because its CDN returned an invalid archive.
The official headless archive recorded in Stage D was downloaded and its SHA-256
matches the retained provenance exactly. Browser acceptance has not yet run.

This is a recovery checkpoint, not final completion. Long regressions, full trace
comparison, browser checks, bounded performance, package verification, final
reports and human-QA handoff remain. Stage F has not begun; main is untouched.
