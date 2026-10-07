# Stage 3B-N checkpoints

Branch `stage-3b-n`, created from the accepted Stage 3B parent `69602e7c9e755fcc65402b1563d4d060f5a10066`
(tree `8a011aa80cba0dd08be9902f3180499ecae3b531`). Each checkpoint is pushed and verified with
`dev/stage-3b-n/verify_remote_3bn.py` (remote tip, commit, tree and parent equal the local ones; `main`, `br-role` and
`stage-3b-remaster` untouched; the parent an ancestor; no Stage 3B-W / 3C branch).

## N0: parent verification (recorded with N1)

- Parent ZIP `THE_FAR_BACKROOMS_STAGE_3B_LEVEL0_FULLMAP_HUMAN_QA.zip`: SHA-256 `9a915300...a7499f9` matches; ZIP integrity OK
  (1 054 entries); its 960 files equal commit `69602e7` blob for blob.
- Remote `stage-3b-remaster` = `69602e7`; `main` = `7781e1a`; `br-role` = `b86966b`; no remote `stage-3b-n` existed.
- `sim.js`, `ai.js` and `ents.js` rebuild byte for byte from `dev/` (`build_sim.sh`, `build_ai.sh`, `build_ents.sh`).
- Baselines on the untouched parent (`evidence/n0/`): camera fairness math 12/12; FPS equality 9/9; `s_hound2e` 18/18;
  `s_evidence` 10/10; `s_hound` 13/14 (H07 state coverage, failing before 3B-N); `s_humanqa_hotfix` 5/6 (X03, failing
  before 3B-N). Stage 3B unit 26/26.

## Checkpoints

| checkpoint | commit | tree | checks |
|---|---|---|---|
| N1 camera / timing policy serving | `63a492d` | `cb0afe3` | `camera_3bn.js` 4/4 (parent 1/4); `test_3bn.js` N1 5/5; Stage 3B unit 26/26 |
