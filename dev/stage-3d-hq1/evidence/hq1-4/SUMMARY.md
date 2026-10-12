# HQ1-4: report, documents, visual evidence, package

HQ1-4 changes no source file. It adds the stage documents at the repository root:
- `STAGE_3D_HQ1_REPORT.md`: the change, the checkpoints, every test and exception, resource impact, the reproducer, limitations, security;
- `STAGE_3D_HQ1_CHANGED_FILES.txt`: every file changed since D7, by group (`dev/stage-3d-hq1/changed_files_hq1.py`);
- `STAGE_3D_HQ1_PERFORMANCE.md`: the performance and resource figures against D7 in the same session;
- `STAGE_3D_HQ1_VISUAL_EVIDENCE.md`: the pictures and the clip, with what each shows;
- `STAGE_3D_HQ1_HUMAN_QA.md`: the checks for you, A1–A10 and B1–B14.

`STAGE_3D_HQ1_AUDIT.md` (HQ1-0) and `STAGE_3D_HQ1_DEATH_LIGHT_PROTOCOL.md` (HQ1-2) are unchanged.

## Corrections after an independent review

A separate agent checked every claim in the documents against the evidence before this commit. It changed nothing; its findings were applied:
- **A world reset during a death** had been reported as leaving no dead light (HQ1-2's summary, and the first drafts here). That was wrong.
  - Bob and Carol had been teleported away by the reset, and the victim's busy page had not yet shown the death.
  - Check 4b counted only the other wanderers' lights on the victim's screen.
  - The light lifecycle was run twice more in HQ1-4: first with check 4b counting her own light (kept: `hq1-3/attempts/light_lifecycle_world_reset_light_plays_on/`), then with a new check 4c as well (the final `hq1-3/hq1/light_lifecycle.json`).
  - Result: the reset does not cut the death short on any screen, and its light fails on its normal schedule (4c holds). The audit's L6 asked for no light after a reset, so check 4 fails, and the summary now has 4 gated lines not met.
  - The HQ1-3 run whose check 4b counted only other lights is kept in `hq1-3/attempts/light_lifecycle_4b_counted_other_lights_only/`.
- **The wall stain after a world reset during a death** is not measured; by the code it stays on the other screens while the replay lingers, then goes. The report says so (W3).
- **The third RSS line.** D7 meets it, so the line is no longer described as missed by D7 too.
- **Wording and numbers in the report, the performance document and the visual evidence.** These were made exact: the step sizes, the plateau gap, the observer margins, the name-prompt extra stamp (not in the capture on `a1d9cb9`), the "older tests" claim, the secret-scan record (none for HQ1-0's push), the strip pictures, the corner counts, the HIGH figures (medians against worst rounds), the 3H0 contract fields.
- **The human-QA guide.**
  - The loadout path, and its lock once a run has started.
  - The Display page's "Lighting and shadows".
  - A check B14 for the world reset.

## Here

- **`../visual/`.** The composed pictures and the 10 fps clip, made by `dev/stage-3d-hq1/visual_evidence.py` from the real captures of HQ1-0 (D7, RED), HQ1-1, HQ1-2 and HQ1-3.
- **`CHECKPOINTS.md`.** Every HQ1 commit with its full hash, tree, parent and GitHub verification.
- **`remote_hq1-3.json`.** The remote verification of HQ1-3, run after its push.
- **`secret_scan.json`.** Every file changed since the Stage 3H0 parent, scanned before this commit.

## The package (made after this commit is pushed and verified)

`dev/stage-3d-hq1/package_hq1.py` makes it:
- the ZIP of this commit, by `git archive`, with its SHA-256;
- split parts of at most 28 MiB, with `PARTS.sha256` and `JOIN_INSTRUCTIONS.txt`, joined back and checked;
- `STAGE_3D_HQ1_PACKAGE_RECEIPT.txt`, which verifies, from the extracted ZIP:
  - every file equals the committed blob;
  - the checkpoint chain from D7;
  - what GitHub reports;
  - every other branch untouched;
  - the scope against D7;
  - the bundle rebuilt from its source;
  - the final regression's gated lines, the four not met listed.

A commit cannot hold a file that names its own hash. So the receipt is delivered beside the ZIP and is not in it.
