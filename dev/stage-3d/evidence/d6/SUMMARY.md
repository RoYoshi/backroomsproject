# D6: the final regression and performance

`summary.json` (from `dev/stage-3d/summarize_d6.py`) is the result: every line next to what it is compared with.
- "ok" / "FAIL": gated lines (correctness, and D0's performance thresholds); `ok` is true only when all hold.
- "OVER": D6's own stricter A/B line where it is exceeded (the Hound A death, `STAGE_3D_PERFORMANCE.md`), listed under `over`.
- "note": context.

`steps.txt` lists every step with its exit status and time, in order:
1. the first D6 run;
2. the two performance corrections and what was re-run after them (`corrections.md` §1–2);
3. the independent review's corrections and the whole D6 again (`corrections.md` §3);
4. the measurements added after that run: the server's per-tick cost, the server soak without forced GC, the A/B pairs 4–10 and the GC-traced browser soak.

Results that were superseded are kept: `perf_death_d6_attempt1.json`, `perf_ab/attempt1/`, `perf_ab/run2_before_review/`. The non-zero exits in `steps.txt` are the five superseded checks of the older suites (`live`, `audit_net`, `audit_net2`), `npm test` and `test_shadows` (the same failures as the parent), and 3H0's own contract file used unchanged (32 new optional fields); `summary.json` checks each by name.

| Folder or file | What |
|---|---|
| `existing/`, `qa2/` | the suites of earlier stages; the QA2 probes' pictures in `qa2/shots_b1…3` (stage-3c-qa2's own evidence untouched: `qa2/stage3c_qa2_untouched.txt` is empty) |
| `golden3d_*.json`, `cli_golden3d.json`, `contract*.json`, `static_check.json` | equivalence |
| `phys_matrix_d6.json`, `gore_geo_d6.json`, `parity_d6.json`, `death_net_d6.json`, `sound_d6.json`, `corpse_hound{A,C}/` | the death itself |
| `film/`, `film_xray/` | the eight deaths, parent and 3D block by block (victim row over spectator row, every frame labelled), and the x-ray sheets |
| `perf_death_srv_*.json`, `server_soak*.json` | the server's cost and memory |
| `perf_death_d6.json`, `perf_death_parent3.json`, `perf_high/`, `perf_ab/`, `soak_*.json`, `soak_gc/` | the browser's cost and memory (SwiftShader); `soak_gc/` holds its runs' logs, and the server logs without the scavenge lines |
| `perf_attrib/` | two quick experiments looking for the Hound A cost (not isolated) |
| `corrections.md` | every correction made during D6 |
