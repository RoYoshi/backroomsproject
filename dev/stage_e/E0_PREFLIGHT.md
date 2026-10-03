# E0 — immutable parent and Node 25 preflight

Scope: bounded parent verification only. No Stage E application code or tests have been implemented. No long post-implementation regression or browser suite has begun. No working or final Stage E ZIP exists yet.

## Parent and branch

- Branch: `stage-e`; fetched and fast-forward synchronization confirmed at `478ada6cf534d40810e28709755e88f0b53b6ee5` before these evidence files were added.
- Initial `git status --short`: empty.
- Supplied Stage D ZIP SHA-256: `b52a40ca1d10216d113f5105c4f1e537dce2270b786f9b293e9d59467629c5de`.
- Parent checksum, ZIP CRC, clean extraction and entire-tree inventory: PASS.
- All 585 original parent files are byte-identical in the connected repository; no parent file is missing.
- Three pre-existing repository additions are preserved: `.github/workflows/deploy-bloom.yml`, `sounds/sting.mp3`, `sounds/sting copy.mp3`.
- The re-uploaded Stage E input pack is byte-identical to the earlier upload. The pasted recovery request supplies the previously missing E0–E5 definitions.

## Runtime and results

Every new validation command used Node `v25.9.0`, as required by the recovery request. Historical references still record Node `v24.19.0`; they were not regenerated or overwritten. Fresh diagnostic captures were written outside the checkout.

| Check | Current result |
| --- | --- |
| Stage D focused view | 10/10 groups PASS |
| Stage C spatial core | 21/21 groups PASS |
| Stage C adversarial | 54/54 checks PASS |
| CAMERA-P01 | 315/315 combinations PASS |
| Retained Hound | 18/18 PASS |
| Retained Smiler | 16/17; inherited SM01 remains red |
| Retained shared | 22/23; inherited F22 remains red |
| Combined retained AI command | 56/58; exit 1, only SM01 and F22 |
| AI/simulation/entity build scripts | PASS; generated outputs byte-identical |
| Stage D prototype generation | PASS; generated assets and provenance byte-identical |
| Canonical flat map/nav/query/seed export | Byte-identical to frozen compressed export |
| Original strict Stage C parity verifier | Exit 1: unexpected `.runtime.node` metadata, v24.19.0 vs v25.9.0 |
| Original trace-record comparator, tolerance 0 | 46/46 traces, 35,098 records identical; metadata differences reported separately |
| Served Stage C package | PASS: public file contents, protected paths, malformed-request handling, policy bindings |
| Additional served Stage D modules/assets | 6/6 HTTP 200 and byte-identical contents |
| Actual browser rendering | NOT RUN in this E0 preflight |

Build scripts were run in a disposable copy of the checkout. Their generated outputs were compared with the connected repository. They did not rewrite source or generated application files in the working tree.

## Frozen-parity interpretation

The strict historical verifier rejects runtime metadata and remains failed. The supplemental comparison uses the repository's unmodified `dev/stage_a/diff_traces.js` with its default tolerance of zero. Every record matches; runtime/source metadata is retained in `evidence/e0/retained-trace-diff.json`. This establishes exact record equality for the sampled fixtures, not byte-identical whole trace artifacts across Node versions. No assertion was weakened and no historical trace was replaced.

P08 remains UNKNOWN / NEEDS INVESTIGATION. F22 remains the historical exact-source guard. SM01 remains inherited. L5b/L5c randomized sensitivity remains an inherited limitation. This E0 run does not rerun or supersede the previously recorded 151/162 aggregate suite; it runs the bounded preflight only.

## Evidence and continuation

Raw test logs, complete trace-comparator results, parent manifest, archive identity, HTTP results, and build reproduction results are in `evidence/e0/`. Supplied authority documents are in `reference/`.

Continue on `stage-e` in a regular coding session, following `reference/RECOVERY_REQUEST.md` and the technical master prompt. Commit and push each E1–E5 checkpoint before proceeding. Create and verify the external working recovery ZIP by E3; do not run the longest final suites until E5 is pushed. Do not start Stage F.
