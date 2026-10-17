# THE FAR BACKROOMS — Trial 4 closeout report

Date: 2026-10-17
Branch: `trial-4-rgb-chat-accessibility`
Base: `58fcf5b9ab8a115ea266f0e39d16bed49c0cdfa5`
Pre-closeout source checkpoint: `68fc48d48356d228570c37f667dae0f16e662d08`

**Final project status: COMPLETE BY EXPLICIT OWNER OVERRIDE / VALIDATION WAIVER.**
**Engineering test status: PARTIALLY VERIFIED. NOT A FULL-GATE PASS OR DEPLOYMENT APPROVAL.**

The owner explicitly directed: **"just override it as complete"** on 2026-10-17. This closes Trial 4 as a development task despite outstanding validation. Do not report unrun/failed-to-start browser steps as successful.

## Features implemented on the separate Trial 4 branch

1. Contextual desktop `[ENTER] Nearby Chat` hint; touch retains `SAY`; overlay permissions follow existing `canSpeak()`.
2. Sender-colored nearby speech bubbles (border and hint arrow) with accessible light-on-dark text; per-message color sanitized to `#RRGGBB` by the speaker's room-scoped speech server, which continues to enforce the existing life, room, radius and rate rules.
3. Additive 0–255 R/G/B sliders beside body, hands, beam, and HUD color inputs; existing picker handlers, original save keys and swatches preserved.
4. Pause-menu `#reset` label changed to `Spontaneously Combust?` without altering NEW RUN authority, denial/cooldown or state.
5. Low-luminance static capture vignette replacing large white/red pulse; fast tearing/inverted exit effects and several strobed UI pulse animations disabled.
6. Canonical `src/build-recipes.json` includes the new `assets/rgb.js` output. Gate change declarations and targeted assertions updated.

## Verified results

- GitHub branch separation and fast-forward checkpoints verified; original branches unchanged at time of checks.
- JavaScript syntax parsing passed for edited chat, RGB, multiplayer speech, session and check source.
- Source/output file equality verified for `assets/chat.js` and `assets/rgb.js`.
- Isolated speech module exercise passed for same-room 576px delivery, ignoring spoofed identity, canonical hex and invalid-color fallback.
- **Codespaces: `npm run build` built 41 outputs and changed local `generated/BUILD_MANIFEST.json`; `npm run build:check` PASS (41 outputs).**
- **Codespaces: `chat` fast gate PASS (83 of 83 cases; 13 of 13 mutants caught; 96 total comparisons).**

## Outstanding validation deliberately waived

- The real Chromium `chat_browser` suite has **no completed retained passing report**. Initial attempts exited immediately: Node Playwright module could not resolve; subsequent runs were affected by Codespaces inactivity interruptions. A verbal recollection of 30-something checks is not usable evidence.
- No recorded successful complete Trial 4 modernization full gate, pixel/contact regression, performance acceptance, final clean-clone comparison, full gameplay walkthrough, accessibility certification, or owner-executed Human QA.
- Trial 2's earlier 30/31 full gate and subsequent standalone 23/23 contact-lab PASS remain distinct; neither constitutes Trial 4 browser approval.
- **Artifact publication gap:** GitHub's branch does not include the locally rebuilt `generated/BUILD_MANIFEST.json` from Codespaces. The user reported this file as modified locally. This closeout deliberately does not claim a complete committed release manifest or source ZIP.

## Acceptance interpretation

**Owner decision: COMPLETE / STOP, with known test gaps**. This ends requested Trial 4 engineering effort and future test requests for this task. It does **not** imply all QA passed, that the branch is release-ready, or that photosensitivity is medically certified.

## Boundaries

Keep `main`, accepted Stage 3H, the original Trials 1–2 branch, repository security settings, secrets, and deployment untouched. No merge, no Bloom.Host deployment, no Trial 3. Changes can be revisited only by a new explicit owner request.
