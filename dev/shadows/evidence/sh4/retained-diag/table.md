| run | suite | verdict | passed / total | seconds | failing assertions |
|---|---|---|---|---|---|
| SH0 baseline: parent, before the restart | browser-ir | PASS | 1 / 1 | 218 | — |
| SH0 baseline: parent, before the restart | browser-admin | FAIL | 54 / 56 | 228 | exactly the baseline's: T8, T10 |
| SH4 main run: final tree, default deadlines | browser-ir | BLOCKED | — / — | 400 | runner safety deadline 400s reached |
| SH4 main run: final tree, default deadlines | browser-admin | FAIL | 52 / 56 | 287 | the baseline's T8, T10 + 2 more (T5 ×2), the first: “T5 hound A: the death starts on the victim's screen with the variant asked for” |
| same machine, run 1: parent (`parent-1`), deadlines ×3 | browser-ir | PASS | 1 / 1 | 361 | — |
| same machine, run 1: parent (`parent-1`), deadlines ×3 | browser-admin | FAIL | 37 / 56 | 496 | the baseline's T8, T10 + 17 more (T5 ×16, T6 ×1), the first: “T5 hound C: the death starts on the victim's screen with the variant asked for” |
| same machine, run 2: final tree (`final-1`), deadlines ×3 | browser-ir | PASS | 1 / 1 | 384 | — |
| same machine, run 2: final tree (`final-1`), deadlines ×3 | browser-admin | FAIL | 54 / 56 | 298 | exactly the baseline's: T8, T10 |
| same machine, run 3: parent (`parent-2`), deadlines ×3 | browser-admin | FAIL | 50 / 56 | 337 | the baseline's T8, T10 + 4 more (T5 ×4), the first: “T5 smiler A: the death starts on the victim's screen with the variant asked for” |
| same machine, run 4: final tree (`final-2`), deadlines ×3 | browser-admin | FAIL | 40 / 56 | 430 | the baseline's T8, T10 + 14 more (T5 ×13, T6 ×1), the first: “T5 hound C: the death starts on the victim's screen with the variant asked for” |
