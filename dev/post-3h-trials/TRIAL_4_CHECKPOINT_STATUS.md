# Trial 4 — Engineering checkpoint (not final acceptance)

Branch: `trial-4-rgb-chat-accessibility`
Base: `58fcf5b9ab8a115ea266f0e39d16bed49c0cdfa5` (last T2-D 1/2 integration checkpoint)
Date: 2026-10-16

## Implemented and pushed

- Visible `[ENTER] Nearby Chat` hint, gated by the same `canSpeak()` eligibility as the composer; coarse-pointer devices keep the `SAY` control.
- Pause-menu `#reset` visible button text is `Spontaneously Combust?`; unchanged handler, server decision and runtime state.
- Accepted `say` packets carry the locally selected HUD hex color as bounded metadata. The room-scoped speech server accepts only `#RRGGBB` or falls back to neutral, and emits it on the authenticated speaker's `heard` packet. Client draws sender-colored borders and edge-hint arrows against dark high-contrast backgrounds. An older client with no color continues to work. Color updates take effect on the **next accepted message**, not proactively on an old active bubble.
- Independent accessible 0–255 RGB channel sliders are added beside existing body, hands, beam and HUD color inputs, forwarding changes through the existing color-pickers' input/change events. No new saved color identity.
- Captured `#dread` white-to-red full-screen pulse is overridden with a static low-luminance vignette, regardless of Reduced Motion setting.
- Gate change declarations updated.

## Not verified / still required before claiming engineering PASS

The current ChatGPT environment cannot access the user's Codespaces process. **No browser/playwright, full gate, or in-game QA was executed** for these commits. The separate Trial 2 23/23 `contact_lab` pass belongs to the user's earlier checkout and is not Trial 4 validation.

1. Run `node dev/tools/build/build.js --check` and correct generated/source asset manifest drift (including the added RGB script).
2. Run focused Trial 2 `chat` and `chat_browser` checks, inspect newly expanded `heard.c` message shape against existing test expectations. If tests require updating, maintain negative tests and do not weaken coverage.
3. Run the modernization fast gate and the final full gate when ready. Source and output manifests might require an explicit script registration.
4. Exercise two simultaneous game clients: different speaker HUD colors, same-room nearby reception, different-room isolation, invalid color spoofing, reconnect, dead or menu players, no moving while composing, bubble muting and offline mode.
5. Validate RGB save/reload and values after swatch clicks, settings reset, keyboard and touch. Verify color event propagation actually updates peer/avatar appearance and HUD without stale values.
6. Audit all other flashing visual effects (blackout, glitch, camcorder, etc.) and remove high-risk rapid/high-luminance effects; only the capture flash was changed in this checkpoint.
7. Compare perf/captures, clean checkout, secret scan and record all PASS/FAIL outcomes.
8. Finish the **separate** Trial 2 publication/evidence checkpoint from the user's original Codespaces artifacts if available; the upstream Trial 2 branch is unchanged here.
9. Finalize `T4_REPORT.md`, `HUMAN_QA_T4.md`, verified receipts and package, then stop for owner QA.

## Safety / authority

This checkpoint is **IN PROGRESS**, not final Trial 4 engineering acceptance or Human QA. Do not merge `main`, deploy to Bloom.Host, start Trial 3, or rewrite other branches. Preserve this branch and continue only with evidence-driven corrections.
