# G5 — complete validation and publication protocol

Runtime remains the verified G4 source. Final acceptance, frozen parity, retained
C–F spatial/network gates, serial legacy performance and clean extraction pass.
Aggregate/shared retain exactly the accepted eleven/F22 failures. The initial
NZ1 timing observation is retained; a complete isolated audit-net2 run passes
11/11 without changing source or thresholds. Browser and font limitations are
explicit in the final reports. G5_PROGRESS.md is the historical recovery status,
superseded by this status and the final publication receipt.

The completed source/report/evidence tree is committed and pushed to stage-g,
then its ref and fetched tree are verified. `package_final.py` uses that exact
commit to create a source archive and publication reports carrying the final
SHA. It checks every source Git blob and file mode, ZIP CRC and a fresh final
extraction, then writes external verification and ZIP SHA-256. The external
receipt avoids embedding a commit's or ZIP's own hash in itself. The source
folder inside the ZIP equals the final Git tree; STAGE_G_PUBLICATION contains
finalized reports with publication identity. All G0–G5 checkpoints and recovery
checkpoints are retained. Stop after delivery; no main mutation or Stage H.
