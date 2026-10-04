# Part 3A test summary

P3A4 L0-01–L0-23 PASS. P3A5 fresh-extraction commands PASS; final archive identity is recorded by the publication finalizer. Human QA remains PENDING.

P3A5 executing source tree at extraction: `eee9853d46ba8c1d3b5998b62e2aa40a023ed46b`. Complete source files at extraction: 3173. The finalizer verifies unchanged validated code/content against the final source commit while allowing the subsequently completed reports and raw evidence to be included.

| Named suite | Result | Time |
|---|---|---:|
| `s_world25d` | PASS | 5.09 s |
| `s_nav25d` | PASS | 8.04 s |
| `s_perception25d` | PASS | 6.84 s |
| `network25d` | PASS | 108.79 s |
| `physics25d` | PASS | 37.99 s |
| `view25d` | PASS | 277.75 s |
| `perf_world25d` | PASS | 59.25 s |

## Production gates

Eight unchanged production test entry points were executed from the extracted package: base, vertical, navigation, gameplay, perception, picking, render coverage and aftermath. Current content hash `4c1cc53d032780befe3c03f0f5e218d9d0e8fd67bcd5bf3e189a3311e061723a`. Two complete rebuilds reproduce `ai.js`, `sim.js`, `ents.js` and `levels/level0_spatial.json` byte for byte.

P3A4 refreshed eight affected/additional LONG ROOM views. The preserved twelve-room/seven-feature captures, full/reduced truth, physical mask and performance evidence remain intact. P3A5 additionally launches the normal production browser at spawn and a dense multi-page location from the extracted package. All local HTTP/GL/runtime checks pass; external font failures remain separated in raw evidence.

## Full retained control

| Command family | Disposition against accepted Stage I | Reported checks |
|---|---|---:|
| `npm-test` | INHERITED FAILURE | 151/162 |
| `hound` | PASS | 18/18 |
| `shared` | INHERITED FAILURE | 22/23 |
| `humanqa` | PASS | 6/6 |
| `fps` | PASS | 10/10 |
| `camera` | PASS | 12/12 |
| `entity-look` | PASS | 4/4 |
| `physics` | PASS | 53/53 |
| `interpolation` | PASS | 3/3 |
| `navigation` | PASS | Descriptive benchmark; exit 0 |
| `audit-net` | PASS | 17/17 |
| `audit-net2` | PASS | 11/11 |
| `live` | PASS | 17/17 |
| `ir-net` | PASS | 4/4 |
| `perf-hound` | PASS | 15/15 |
| `perf-shared` | PASS | 27/27 |
| `perf-smiler` | PASS | 3/3 |
| `perf-light` | PASS | 1/1 |

The aggregate and shared failures remain failures, with exact names matching the accepted parent.

The initial aggregate attempt and first retry ended before the full summary (at K03 and after P02). Both raw failures remain in the package. Their cause was not established, and neither was accepted. The unchanged `npm test` command completed under direct process supervision; its anchored 151/162 final summary and all eleven exact failure names match Stage I. The retained summary parser's incomplete 60/60 reading was explicitly rejected. No source, test assertion, timeout threshold or expected result was changed to obtain acceptance. They do not weaken the seven named spatial gates. Descriptive navigation benchmark counts are not assertion counts. P08 remains UNKNOWN in the historical interpretation.

Frozen parity: 46 traces / 35,098 records, tolerance zero. Frozen files unchanged, flat map byte-identical. Real served flat menu/gameplay image hashes, input schedule, pose and RNG match the immutable accepted Stage I package. The production and flat/fixture servers return exact runtime bytes; private source routes remain rejected. Actual redirect execution returns the expected 302 and preserved path/query.

All P3A5 commands, durations, return codes and raw output are in `dev/part3a/evidence/p3a5/`. The complete accepted aggregate output is in `aggregate-direct-01/`; the two incomplete attempts and strict comparison failure remain alongside it. Existing P3A0–P3A4 failures and slow samples remain preserved. No assertions, retained thresholds, reference traces or production runtime were changed in recovery.
