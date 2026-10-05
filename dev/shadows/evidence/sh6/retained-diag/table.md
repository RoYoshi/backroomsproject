| run | suite | verdict | passed / total | seconds | failing assertions |
|---|---|---|---|---|---|
| SH0 baseline: parent, before the restart | browser-ir | PASS | 1 / 1 | 218 | — |
| SH0 baseline: parent, before the restart | browser-admin | FAIL | 54 / 56 | 228 | exactly the baseline's: T8, T10 |
| SH6 main run: final tree, deadlines ×3 | browser-ir | FAIL | — / — | 268 | no verdict printed: ZeroDivisionError: float division by zero |
| SH6 main run: final tree, deadlines ×3 | browser-admin | FAIL | 38 / 56 | 453 | the baseline's T8, T10 + 16 more (T5 ×15, T6 ×1), the first: “T5 hound A: the death starts on the victim's screen with the variant asked for” |
| same machine, run 1: parent (`parent-1`), deadlines ×3 | browser-ir | PASS | 1 / 1 | 356 | — |
| same machine, run 1: parent (`parent-1`), deadlines ×3 | browser-admin | FAIL | 40 / 56 | 407 | the baseline's T8, T10 + 14 more (T5 ×13, T6 ×1), the first: “T5 hound A: the death starts on the victim's screen with the variant asked for” |
| same machine, run 2: final tree (`final-1`), deadlines ×3 | browser-ir | FAIL | 0 / 1 | 422 | 2 more (R5 ×1, R7 ×1), the first: “R5” |
| same machine, run 2: final tree (`final-1`), deadlines ×3 | browser-admin | FAIL | 42 / 56 | 413 | the baseline's T8, T10 + 12 more (T5 ×11, T6 ×1), the first: “T5 smiler A: the death starts on the victim's screen with the variant asked for” |
| same machine, run 3: parent (`parent-2`), deadlines ×3 | browser-ir | PASS | 1 / 1 | 342 | — |
| same machine, run 3: parent (`parent-2`), deadlines ×3 | browser-admin | FAIL | 54 / 56 | 290 | exactly the baseline's: T8, T10 |
| same machine, run 4: final tree (`final-2`), deadlines ×3 | browser-ir | PASS | 1 / 1 | 406 | — |
| same machine, run 4: final tree (`final-2`), deadlines ×3 | browser-admin | FAIL | 43 / 56 | 418 | the baseline's T8, T10 + 11 more (T5 ×10, T6 ×1), the first: “T5 smiler A: the death starts on the victim's screen with the variant asked for” |
| parent slowed by a calibrated background load (`parent-load-1`), deadlines ×3 | browser-ir | FAIL | 0 / 1 | 443 | 1 more (R7 ×1), the first: “R7” |
| parent slowed by a calibrated background load (`parent-load-2`), deadlines ×3 | browser-ir | FAIL | 0 / 1 | 440 | 1 more (R7 ×1), the first: “R7” |
| parent slowed by a calibrated background load (`parent-load-3`), deadlines ×3 | browser-ir | FAIL | 0 / 1 | 495 | 2 more (R5 ×1, R7 ×1), the first: “R5” |
