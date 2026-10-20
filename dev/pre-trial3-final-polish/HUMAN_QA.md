# Pre-Trial 3 final polish — owner Human QA (about 25 minutes)

**What to run:** branch `pre-trial3-final-polish` at its head, **P9** — not `main`, not C5. (A commit cannot name its own hash: P9's is
in the handoff message and its push receipt. Its game code is P8's, `7f91ffd`.)

```
git fetch origin pre-trial3-final-polish
git checkout --detach origin/pre-trial3-final-polish
git log -1 --format=%H       # the P9 hash from the handoff
npm run build:check          # should say PASS (43 outputs)
ADMIN_PASSCODE=<any passcode of your own> node server.js
```

Open `http://localhost:8000` (the address it prints) in a normal browser. Use real speakers or headphones for Part D, a second
tab or a second browser for the two-player items, and a phone or the browser's touch emulation where it says so. **Mark what you
saw, not what the automated checks say** — they cannot judge how anything looks, feels or sounds.

## Part A — danger, death, spawn (5–7 min)

- [ ] Walk up to the Hound or a Smiler. The heartbeat, the red edge vignette, the shake and the drone / stings are all still there.
      The screen does **not** flash bright as a whole, and you can no longer glimpse what lies behind walls during the flicker.
- [ ] Get caught. **One** red impact (not white, not a strobe), then the dim red death screen as before. With reduced motion on
      (Settings → Display → Reduced motion: On), the red comes in and fades slowly, with no flash.
- [ ] Start a run (and NEW RUN). As you fall in and land, the dark oval is **under** the wanderer on the floor, not over her body
      and hands. Walk under a lamp and away. Try Settings → Display → Lighting and shadows: Low, Medium, High, briefly.
- [ ] With a second player: their landing shadow sits under them too.

## Part B — main menu and customizing (6–8 min)

- [ ] The Settings gear in the right-hand rail looks round, centred and as crisp as the other icons; it opens Settings.
- [ ] The person icon (second) opens a small **“Accounts Coming Soon...”** panel — never Customize. Close, Escape and a click
      elsewhere close it; after Close or Escape the focus is back on the icon. (Customize is still under PLAY.)
- [ ] Customize → Body, Hands; Loadout → Beam; Settings → HUD → Colour: each Red / Green / Blue has a number you can **type**
      (0–255) beside its slider. Type a number and press Enter (or click away): the colour and the slider follow. Try 300 (→ 255),
      -5 (→ 0), letters (put back), and Escape while typing (puts the number back, the panel stays open).
- [ ] "Custom" (Customize) and the rainbow swatch (HUD) go to the Red number — no browser colour pop-up anywhere.
- [ ] Swatches and Reset HUD update the numbers. Reload: the colours and numbers are what you left. A second player sees your
      typed body colour.
- [ ] On a phone (or touch emulation): the number fields are easy to tap and nothing is clipped.

## Part C — version and credits (3–4 min)

- [ ] The main menu's bottom-right corner reads **v23.3.6**. It now comes from `package.json` (its `version`, built into
      `public/assets/version.js`); there is no other copy. **Decision for you:** is 23.3.6 still the number you want players to see?
      To change it, edit `package.json`'s `version` and run `npm run build` — say the number and it will be done in its own step.
- [ ] The menu's corner no longer carries the small wiki / licence paragraph.
- [ ] Credits: **RoYoshi** (Lead Developer, Programmer, Graphic Designer) in neon green and **Mariikyu** (Lead Developer, Creative
      Director, Head of QA, Sound Designer) in neon purple. Are the spellings, roles and the two colours right? **Decision:** plain
      “Mariikyu” is used; say if you want the stylized form (ₘₐᵣᵢᵢₖᵧᵤ) instead.
- [ ] Credits → Source material: the wiki attribution with CC BY-SA 3.0 and the links (The Backrooms Wiki: Level 0, Hound,
      Smilers, CC BY-SA 3.0) — click each; they open in a new tab. Software and Typefaces are still listed. The page ends with the
      version. It scrolls on a phone. (The pause screen keeps its own one-line wiki credit, unchanged.)

## Part D — sound (4–6 min; speakers or headphones)

- [ ] Hover, click, open (Settings / Credits / PLAY), back / Close / Escape, a switch on and off, the Account icon: each makes one
      short, quiet sound — none doubled, nothing loud or harsh; the hover tick is very faint. Do they suit the game as **temporary**
      sounds? (Mariikyu can replace any of them: `dev/pre-trial3-final-polish/SOUND_ASSETS.md`.)
- [ ] Settings → Sound: **Music volume** at 0 % silences only the menu music — clicks still sound. **UI volume** at 0 % silences
      the clicks — the music plays on. Moving either while the music plays changes it smoothly (no restart, no pop).
- [ ] The menu's sound icon (SOUND off) silences the music, the clicks, the game's sounds and the wanderers' voices. Voice volume
      still works on its own when sound is on.
- [ ] Reload: Master, Music, UI and Voice volume are all as you left them.

## Part E — nothing else broke (3–5 min)

- [ ] C5's chat: the chat icon low on the right, its key (Settings → Controls), no walking while typing, typed-out bubbles, voice
      preview in Customize, the mute switches.
- [ ] Two players: speech colour and voice reach the other player; chat only nearby; no errors in the console (F12).
- [ ] The title's slow drift on the main menu; “Spontaneously Combust?” on the pause screen; no new stutter while playing.

## Decision

- [ ] **ACCEPT** — the polish is accepted. (This allows Trial 3, Skin-Stealer, to begin. It is **not** a merge or a deployment.)
- [ ] **NEEDS CHANGES** — say what, with steps and a screenshot or a short recording.
- [ ] **ROLL BACK** — keep C5 (`63805e9`); nothing protected was changed, so nothing needs undoing there.

Red Rooms are not part of this QA: their lighting / material correction waits until after Trial 3 (Skin-Stealer).
