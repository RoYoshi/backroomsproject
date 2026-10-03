# Stage G human-QA handoff

**2.5D STAGE G ENGINEERING COMPLETE — HUMAN QA PENDING**

Accepted Stage F human QA is PASS. This handoff asks only for Stage G gameplay/
design review. Automated acceptance and human approval remain separate. Stage H
has not begun and this handoff does not authorize it. Main was not modified or
merged.

The final released report and external `25D_STAGE_G_PACKAGE_VERIFICATION.json`
name the exact verified `stage-g` commit/tree and ZIP SHA-256. The source folder
inside the ZIP reproduces that tree. Start there with Node v24.19.0 (the tested
runtime); the existing product declaration remains Node >=18, while wire harnesses
need built-in WebSocket. No claim is made for untested Node versions.

Run `node server.js 3000`, then open `http://localhost:3000/?room=stage-g-qa`.
Use the existing admin DEATHS controls and the accepted admin credential. Compare
Hound A/B/C/D and Smiler A/B/C/D against the accepted Stage F experience.

- [ ] Existing death timing, resistance, impacts and recoil still feel accepted.
- [ ] One rounded body and two separate circular hands; no visible limbs or new anatomy.
- [ ] Light/hat releases and final corpse pose look plausible and continuous.
- [ ] Corpse persistence is understandable across disconnect/reconnect; no duplicate replay/corpse.
- [ ] Record any variant, equipment, browser, seed/room and exact steps for a discrepancy.

Stage G's spatial work is a physical/network implementation. It does not expose
a new polished spatial visual diagnostic or claim complete production corpse,
cutaway, gore, audio or HUD integration. Those are Stage H. Do not require that
polish to review this stage. The retained Stage D diagnostic is not a Stage G
production presentation surface.

For objective spatial review, run `node dev/tests/physics25d.js`. It exercises
real body/hands/gear XYZ across stairs, ramps, ledges, walls, undersides and stacked
slabs; actual WebSocket deaths; disconnects and active/settled joins; duplicate/
stale messages; and no-live-player continuation. The detailed raw matrix is in
`dev/stage_g/evidence/g4/physics25d-raw`. `node dev/stage_g/test_g2.js` prints the
upper-body/lower-light support and contact/beam records. The real-browser harness
is `dev/stage_g/browser_runtime.js` and requires Playwright plus Chromium, supplied
through normal installation or `TFB_BROWSER_EXECUTABLE`.

Known limits to retain during review: the 24-active bounded workload exceeds the
60Hz CPU budget on this host and reaches about 8.793 MB/client/s at nominal 20Hz;
this is not Stage I capacity certification. Some unsupported constrained hands
on ramps/ledges remain awake, and bounded safe contact diagnostics are recorded.
External Google Fonts TLS failed in this environment; local game modules booted
without resource or script errors. Hardware-GPU certification is not claimed.
Inherited aggregate 11 failures and shared F22 remain documented separately.

Reviewer: ____________________   Date: ____________________

Stage G decision: PASS / FAIL / NEEDS FOLLOW-UP

Notes: ___________________________________________________

Stop after this handoff. No merge to main and no Stage H work is included.

Final verified Stage G source: `7fb4dafef92040571209403358e536ccb1105509`; tree `eee7f43a74aeb4d0e7ef38effdfc7516eee5e8cf`.
