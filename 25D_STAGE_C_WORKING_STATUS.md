# Stage C working recovery checkpoint

Core implementation complete; long regression/network/performance/browser/portable validation and final reports are pending. Recovery artifact, not final acceptance.

Parent Stage B SHA-256: 3068a745634e713b09b5ec08bbfd68db3f0d6540abda3b1fb5833f99446b0faf.
Stage B human QA passed per supplied authorization; Stage C human QA pending.

Implemented: spatial validation/index/clearance/support/sweeps/rays; world_motion physical support, ramp, finite steps, drops/falls/landings; opt-in actual move.js integration; isolated CAMERA-P01 1.25; runtime serving/loading.

Verified: 21 spatial groups; 10 real-motor spatial scenarios across eight render schedules; 315 camera context cases; all 46 frozen flat traces (35,098 records) identical; map/nav/placements/query/seed export byte-identical; syntax and fresh-process identity. Source-hash metadata changes documented in dev/stage_c/results/parity.json. No gameplay records changed.

Exact next step: run the retained 18-command regression runner, actual served HTTP Stage C check, bounded browser availability/runtime probe, clean path-with-spaces build/core portability. Investigate any new divergence without blessing it. Then finalize reports and create final ZIP once.

Six modified originals: world_geometry.js, move.js, camera_policy.js, dev/tests/s_camera_fairness.js, index.html, server.js. New core module: world_motion.js. New tests/evidence: dev/stage_c/. No deleted originals.

Known inherited reds: P01/P07/P08/H07/SM01/NV09/C1/C4/C5/C18/F22. P08 unknown; F22 obsolete exact-source guard; L5c historically timing-sensitive. No failing Stage C core test remains. Long suites have not yet run on this tree.

No Stage D/E/F/G/H/I implementation. redirect.js present. No browser or subjective gameplay pass claimed.

STAGE C WORKING RECOVERY CHECKPOINT — FINAL VALIDATION PENDING
