# H0-6c: six wording corrections from the reviewer's check of the H0-6b package

**What was checked.** The reviewer of H0-6b checked the H0-6b package (`73039aa`) independently and read-only. It used `git ls-remote` and read-only GitHub API calls.

**What passed:**
- the ZIP's SHA-256 and its parts;
- every CRC;
- the file-by-file match with the commit;
- every claim of the package receipt: the commit, tree and parent, the straight line from `edd2af9`, the remote tip, the 20 other branches, the 35 protected files, the scope classes and the shipped files;
- the report's stop line.

**Its 26 earlier findings.** 25 were handled. The 26th, a rounding figure, was handled in the performance report but not in the equivalence report (point 2 below).

**What it found.** Six points, all wording, corrected here. No production code changed.

| # | Where | Finding | Done |
|---:|---|---|---|
| 1 | REPORT caveats, README | `doc_sizes_h0.py` was said to check "every size the documents give". It checks 23 size figures in five documents | both state what it checks |
| 2 | EQUIVALENCE, H0-3 performance row | the hook's low end was still −5.6 %; the exact value is −5.545 % | −5.5 % |
| 3 | REPORT caveats; `evidence/h0-6b/review_findings.md` | "No code changed", but tooling code changed (`package_h0.py`, `changed_files_h0.py`, the new `doc_sizes_h0.py`); only production code did not | the report now says "No production code changed". `review_findings.md` is H0-6b's committed evidence and is left as it was; this line corrects it |
| 4 | REPORT introduction | "every extraction … function by function", but the static serving (H0-4c) had no function-level check | the function-level check is now named for the four pure pieces, and the static serving's checks are named |
| 5 | ARCHITECTURE MAP introduction | "Nothing … a browser … can observe" was followed by exceptions a browser does observe | "Nothing a player or a server operator would notice" |
| 6 | REPORT deliverables | the ZIP's numbered parts and how to join them were not mentioned | added |

**One more observation, not a document error.** It concerns security in files the stage did not touch, so it goes to the user privately, with the other security findings.
