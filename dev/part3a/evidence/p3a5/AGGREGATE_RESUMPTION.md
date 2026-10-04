# Aggregate resumption evidence

The first `npm test` output ended at K03; the first retry ended after P02. Both exited 1 without the final suite summary. Neither attempt is accepted. The legacy parser found an inner 60/60 route count in the first log; the exact-baseline comparison rejected it. Their underlying interruption cause remains unestablished.

Both incomplete logs and all seventeen completed retained command outputs were committed, pushed without force, and remotely verified at `6d3387dc3a524c1c3df857f8979c690834c06886`, tree `5d2291510f69096c92288a859275739fc6188aab`, before the next execution.

The unchanged `npm test` command then ran from the same complete exact-source extracted package under direct Python subprocess supervision. Stdout/stderr were written to a new file, the parent polled termination every ten seconds, and no process-group cleanup was applied. This completed 162 cases in 160.027 seconds, below the retained 300-second safety deadline. An anchored final summary is 151/162 passed. All eleven failure names, counts and exit status match accepted Stage I. No production, AI, movement, test, reference or threshold was modified.

`aggregate-resolution.json` binds the accepted and rejected logs. `portable-01/baseline-comparison.json` records every accepted legacy outcome and its raw-log hash. The resumption runner verifies all extracted source blobs and modes against the original source tree and all validated code/content against the working source before executing the remaining original parity, browser, server and redirect gates. `resumption_orchestration.py.txt` preserves that execution procedure as provenance. The first `failure.json` and `progress.json` remain intact; resumed progress and the final result use separate files.
