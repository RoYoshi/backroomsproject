# Stage I final certification entry points

Run all commands from the extracted package root. Node >=18 remains the product declaration; final automated wire/browser evidence uses Node v24.19.0 (built-in WebSocket). Python 3 and Bash are test/build dependencies. Browser gates require Playwright and a compatible Chromium with WebGL2. Install Playwright/Chromium in the test environment, or provide NODE_PATH (or CODEX_PRIMARY_RUNTIME_NODE_MODULES) and TFB_BROWSER_EXECUTABLE explicitly. These are test environment dependencies, not paths embedded in product code.

- npm run test:world25d
- npm run test:nav25d
- npm run test:perception25d
- npm run test:network25d
- npm run test:physics25d
- npm run test:view25d
- npm run test:perf25d

Run timing suites serially. Set TFB_EVIDENCE_DIR to a fresh output directory to retain raw logs. The new named gates create unique attempt subdirectories. No inherited threshold is lowered. s_world25d executes real B/C/E geometry and movement tests, eight render schedules, extended real-motor exhaustion/recovery/material checks, and the flat motor control. perf_world25d executes real geometry, navigation/perception, eight-client authority, 1/3/24 aftermath, production browser, and fresh ZIP extraction/build/HTTP/redirect workloads. I2 and I4 add the full stress/certification matrix; this entry point alone is not a final release approval.

The ordinary server is node server.js. The existing Render redirect launcher is node redirect.js. Default Level 0 remains flat; synthetic spatial fixtures are QA content only. Production Level 0 conversion and Part 3 remain outside Stage I.
