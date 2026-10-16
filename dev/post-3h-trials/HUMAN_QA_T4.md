# THE FAR BACKROOMS — Trial 4 Human QA (PENDING)

The owner must test the new `trial-4-rgb-chat-accessibility` branch after the build and targeted gates succeed. Existing Trial 2 owner's approval does **not** automatically approve Trial 4.

## Manual acceptance script

1. **Discovery** — Join Level 0 online on desktop. An unobtrusive `ENTER Nearby Chat` hint is visible in a live run but disappears when the composer opens, paused/dead, offline/solo, or blocking menus are displayed. On touch, use `SAY`. Movement stops when typing; Esc doesn't pause the world while closing the composer.
2. **RGB** — Open Customize > Wanderer and Loadout. Each body/hands/beam color picker has three labeled 0–255 sliders. Choose a unique `#RRGGBB`; verify preview/skin/beam, swatch selection, keyboard/touch operation, and preservation after reload. Settings > HUD should have equivalent RGB sliders. The four color controls must remain independent.
3. **Colored speech** — Two clients online in the same room choose **different HUD colors**. Speaker A sends Nearby. Listener B sees the speaker's chosen accent, not B's; text is readable on extremely dark/light colors. Test within 576 px, beyond 576 px, separate room, mute, hide bubbles, off-screen edge hint, death/leaving/reconnect. Change speaker color and send another line; its new bubble should use the new color.
4. **Spontaneously Combust?** — Pause and check exact label, click online. Assert server-authoritative cooldown/denial, explosion, persistent bodies/gibs, spawn flow and reset epoch match pre-Trial-4 behavior. Offline still uses previous local flow.
5. **Visual comfort** — Test capture and glitch/exit effects, title entrance and stamina low, on desktop and phone, Reduced Motion On/Off/System. No abrupt large-area bright white/red flash or fast strobe; atmospheric tension is retained. No medical safety certification is claimed.
6. **Regression** — Trial 1 main-menu title drift and Trial 2 lounge/nearby chat should still behave the same.

## Verdict

- [ ] PASS / ACCEPT
- [ ] NEEDS CHANGES
- [ ] ROLL BACK

Record machine/browser, screenshots, exact reproduction steps and any regressions.
**Status: NOT YET RUN.**
