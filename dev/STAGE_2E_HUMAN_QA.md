# Stage 2E human gameplay QA

Implementation is complete; this checklist has **not** been signed off by a human. Automated bot results do not establish good game feel or fairness. See `STAGE_2E_REPORT.md` for the three unmet legacy benchmark thresholds and blocked browser checks.

## Start and prepare

1. Extract the package, run `node server.js`, and open the local address printed by the server. Node 22+ is needed for the supplied WebSocket test tools; this pass used Node 24.19.0.
2. Join a private room. For the two-player case, join the same room from a second browser/device.
3. Open the admin panel with backtick. The default development passcode is `smoor` unless `ADMIN_PASSCODE` was set. Use MONSTERS to remove distractions and spawn one Hound nearby. Use DEBUG → NAVIGATION to select nearest/next, GO TO IT, or the existing doorway/corner/open-room placement tools.
4. Enable the entity, EVIDENCE + LEADS and SEARCH + MEMORY overlays. Select the Hound. Its label shows WHY, commitment time remaining, sight, last visual observation and age, search branch, listening reason, traits and last behavior transition. Turn compact labels off to read the details.
5. Turn god mode **off** and allow spawn protection to expire before measuring natural reactions. Freeze, FOLLOW ME, COME HERE and HUNT ME alter the setup; clear those commands before an unscripted perception test. HUNT ME is useful only when deliberately testing an already-started chase.
6. Repeat each situation several times and with more than one Hound. Record the scenario, location, light, movement, entity ID, WHY/debug screenshot, and what felt wrong. Then repeat without the overlay to judge readability.

| Case | Setup and action | Observe / judge |
|---|---|---|
| A — Hound sees flashlight | In open floor, approach within roughly 300–450 px in front of an unaware Hound with a visible flashlight on. Face along the corridor first so eye-contact intimidation does not confound the initial response. | It identifies a human and pursues decisively. Does it feel attentive rather than artificially delayed? |
| B — Flash the Hound | Start behind or beside an unaware Hound, within the flashlight's actual reach. Sweep the beam over its body, then away. | It notices/orients; pursuit follows actual identification. Compare facing it directly: the brief eye-contact hesitation is intentional, not a flashlight stun. |
| C — Light around corner | Stay fully behind a corner. Sweep light onto a floor/wall patch the Hound can see. Keep your body hidden and remain quiet. | An anonymous lead and approximate investigation, without an identified player target from the beam alone. If it rounds the corner and genuinely sees you, identification is then valid. |
| D — Run around corner | Let it see you running toward an opening, turn out of sight, and continue. | It follows observed heading/last sight/fresh footsteps through plausible geometry. Do not mistake legitimate running noise for wall vision; check HEARD and its age. |
| E — Fake out | Repeat D, then quietly choose another branch after breaking sight. Avoid exposing a beam or new loud movement. | It can choose the wrong branch. Its goal should remain an evidence-based hypothesis until it sees/hears something new. |
| F — Bad hide | Break sight and stop just around the corner; separately try the same spot while moving noisily. | Nearby predictable/noisy hiding can fail naturally. Crouching is not invisibility. Compare the reason for rediscovery in each attempt. |
| G — Good escape | Break sight, change route, move quietly, create distance, and conceal visible light. Try multiple layouts and stamina states. | Intelligent play must plausibly escape. **Prioritize this case:** old C5 and C9/C10 percentage gates are unmet; do not treat bot outcomes as human fairness. |
| H — Two players | Let player A establish pursuit. Have B move closer, then run or expose light. Next have A truly disappear while B remains visible. | No frame-to-frame flicker; stable commitment, then a meaningful switch after loss. Compare weak unrelated sound versus current visible prey. The existing player-specific sound attribution has not been redesigned. |
| I — Light off after discovery | Once clearly seen, turn the flashlight off, then break sight. | New visible-light evidence stops, while legitimate sight/hearing/memory remains. It should not instantly forget you or secretly follow your hidden current position. |
| J — Listening | Lead it into a failed branch or let it investigate anonymous light, then stay hidden and quiet. | Pauses have an intelligible purpose; sniff/listen, reconsider, and eventually give up. It should not look permanently frozen or trip the stuck watchdog while deliberately idle. |

## Canon counterplay and preserved-system spot checks

- Look directly at the Hound during an ordinary pursuit. It should hesitate briefly, then overcome intimidation; looking away ends the hold. Repeated toggling must not refill the same encounter's budget. An already committed lunge is not canceled. Is the brief window readable/useful without becoming permanent immunity?
- Repeat a quiet camcorder setup with IR OFF and HIGH. Visibility for the player may change; the Hound must not react to IR. Have an observer check the same situation online.
- Play the approved Smiler eye-contact/slow-retreat and close-approach situations unchanged. Report any apparent regression with circumstances; mixed-entity random outcomes need not match the old seed exactly.
- Check ordinary online walking, sprinting, crouching, crawling, slide, vault, death replay, dropped equipment and persistent corpse from both victim and observer views. Browser automation was blocked in the implementation environment, so visual smoke checks remain outstanding.
- The pre-existing admin T8 harness issue was not rewritten. If navigation/debug controls misbehave, record the exact control and error separately from Hound behavior.

Stop after recording QA. Do not begin Stage 2F or 2.5D as part of this checklist.
