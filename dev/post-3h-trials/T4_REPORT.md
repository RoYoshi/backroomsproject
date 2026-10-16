# THE FAR BACKROOMS — Trial 4 engineering candidate report

Date: 2026-10-16
Branch: `trial-4-rgb-chat-accessibility`
Parent source checkpoint: `58fcf5b9ab8a115ea266f0e39d16bed49c0cdfa5` (Trial 2-D 1/2)
**Status: IMPLEMENTATION CHECKPOINT, ENGINEERING ACCEPTANCE PENDING.**

## Implemented on this isolated branch

1. Desktop-only contextual `[ENTER] Nearby Chat` hint; leverages existing `canSpeak()`; no sidebar, touch retains `SAY`.
2. Server-sanitized sender-owned color on accepted `say` → `heard` packets, inherited server room/radius/life/rate checks unchanged; 6-digit hex `#RRGGBB` normalized; invalid/missing color maps to neutral; client border/edge arrow uses speaker's color, text stays bright on a dark background. An already visible bubble only recolors on the next accepted message.
3. Red/Green/Blue 0–255 sliders next to existing body/hands/beam/HUD input-color selectors, no new save keys, forwards events into original picker handlers; maintain separate HUD and avatar identities.
4. Visible pause-dialog NEW RUN button reads exactly `Spontaneously Combust?`; `#reset` and authoritative intent/answer remain unchanged.
5. Static, dark capture vignette in place of inherited rapid full-screen white/red capture pulse. Rapid tear animation, saturated inverted exit-filter sweep, and strobed menu/stamina pulses disabled by default without requiring Reduced Motion to be on.
6. Canonical recipe for the new RGB script and modernization gate scope declarations updated. Speech and browser check source extended for color validation and chat hint.

## Verification actually performed

- Checked latest GitHub branch ancestry and confirmed protected `main`, accepted Stage 3H and Trials 1–2 branch unchanged after checkpoint.
- Read back modified source from GitHub; syntax parsed for chat, RGB, speech server, multiplayer session, composed public mp, server checks, browser checks.
- Verified `public/assets/chat.js` byte-for-byte matches `src/frameworks/front/client/chat.js`, and the same for RGB.
- Executed synthetic in-memory speech-module scenarios: sanitized `#AaBBcc` becomes `#aabbcc`, invalid CSS string neutralized, spoofed sender ID not used, only same-room within 576px reached. Both scenarios passed in this isolated harness.
- **NOT RUN**: repository `npm run build`, rebuilt manifest check, Node full chat suites, real-browser checks, perf suite, full modernization gate, clean checkout, screenshot diffs and owner's Human QA. Do not infer these from earlier Trial 2 success.

## Codespaces verification workflow

```bash
cd /workspaces/backroomsproject
git fetch origin
git switch --track origin/trial-4-rgb-chat-accessibility
# If it already exists locally, use: git switch trial-4-rgb-chat-accessibility
git status
npm run build
npm run build:check
node dev/tools/gate/gate.js --tier fast --only chat --out /tmp/t4-chat
node dev/tools/gate/gate.js --tier full --only chat_browser --out /tmp/t4-chat-browser
node dev/tools/gate/gate.js --tier full --only contact_lab --out /tmp/t4-contact
```

The full gate also needs the existing locked client toolchain packages (`--packages DIR` or `TFB_CLIENT_PACKAGES`); rerun once the incremental tests are green. Save logs and evidence. Do not say the final full gate passed unless actually observed. `npm run build` is expected to update `generated/BUILD_MANIFEST.json` because the recipe and output bytes changed; preserve it with the final publication commit.

## Remaining

- Fix any browser/unit regressions from the focused checks and adjust test cases only for intentional Trial 4 protocol/UI behavior, not to hide regressions.
- Validate body/hands/beam/HUD RGB sliders through the real UI, saving and reloading; include screens at phone and desktop sizes.
- Verify color replication to two clients and all nearby protections, the combat/death effects, and safe reduced-motion behavior.
- Finish full gate, screenshots, performance, build manifest publication and Human QA.
- Trial 2's earlier 30/31 full gate and owner's later 23/23 isolated contact lab result remain **separate evidence**; final T2 evidence files have not been claimed published on the pre-existing branch.

## STOP / scope

No merge, deployment, secrets modification, Trial 3, or changes to protected refs. Trial 4 is not yet accepted by the owner.
