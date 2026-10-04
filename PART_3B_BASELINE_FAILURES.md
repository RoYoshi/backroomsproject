# Part 3B failures and inherited limitations

Raw failures are retained under numbered evidence attempts and are never overwritten by repairs.

- P3B0 shell `git push` could not read HTTPS credentials. No remote ref was changed by that failed transport. Publication succeeded using the authenticated GitHub Git-data API and exact local tree, followed by independent remote ref/commit/tree reads.
- P3B1 browser-foundation-01 and browser-production-01 could not launch because the current workspace lacked Playwright's Chromium executable. Their logs and failure JSON remain. This is an environment failure before any page or runtime test executed; it is not a browser PASS.
- Chromium installer received an invalid/truncated archive from its CDN. `browser-install-01.log` is retained. Restoring the official Chrome-for-Testing headless archive succeeded with the exact accepted Part 3A browser SHA-256 `3cfc2bd00d1bafcf8a68dc74c9c92bb7150ddc8d26ade948a776316e1cec4f14`. Both browser suites passed as attempt 02 without test or runtime changes for the environment repair.
- Accepted Part 3A/Stage I inherited aggregate 151/162, shared F22, P08 UNKNOWN, external font failures and accepted aftermath/performance limits remain inherited. They must be compared explicitly during P3B4/P3B5, not relabeled as passing.

Objective acceptance is pending until all required validation completes.
