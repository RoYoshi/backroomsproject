# Stage F human-QA handoff

**Engineering protocol gates pass; final public checkpoint is blocked pending
explicit upload approval. Human QA is pending. Do not approve or begin Stage G.**

Extract the package; from its `thefarbackrooms-level0` directory run
`node server.js 8000`, then open `http://localhost:8000/` in two tabs/devices using
the same `?room=qa` value. Default play is retained flat Level 0. The Stage D view
prototype is at `/stage_d.html`; it is a diagnostic, not complete spatial gameplay.

| Check | What to observe | Result |
|---|---|---|
| Normal movement | Walk/run, crouch/crawl, slide/vault and stamina feel like accepted Stage E | PENDING |
| Local/online stability | No unexplained rubber-banding, teleport or support snap | PENDING |
| Encounters | Hound/Smiler behavior, search and look remain familiar | PENDING |
| Reconnect | No stale position, peer trail, clock or old-life visual reappears | PENDING |
| Lifecycle | Capture/death/one-use authorized revive/new run behave as before | PENDING |
| Admin teleport | Authorized move snaps; no visible glide through walls | PENDING |
| Presentation | Sparse stair/drop history holds are acceptable; assess smoothness | PENDING |
| Browser environment | Check fonts, controls and visuals on the user's actual browser/GPU | PENDING |

Automated spatial checks can be rerun with Node v24 and localhost networking:
`node dev/tests/network25d.js`. Browser tests additionally need Playwright and a
working Chromium selected via `TFB_BROWSER_EXECUTABLE`; run
`node dev/stage_f/browser_wire.js` for two live protocol clients on Z0/Z180.
This adapter renders actual poses through the retained Stage D compositor; it
adds no Stage H production player experience. Do not interpret the flat homepage
as the completed 2.5D world.

Automated checks cover malicious packets; manual QA is not expected to prove that
resistance. Known inherited ledger: 151/162, same eleven failures; P08 remains
UNKNOWN, with F22/SM01 and historical L5 timing disclosures. External Google Fonts
TLS fails in the test environment. Hardware-GPU performance remains unmeasured.

Record browser/GPU, number of clients, latency conditions, action, observed versus
expected behavior and reproducible steps. The user is final design/gameplay QA
authority. After this handoff, STOP.
