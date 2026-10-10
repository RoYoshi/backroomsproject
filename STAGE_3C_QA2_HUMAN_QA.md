# Stage 3C QA2: what to check by hand

**Status: `STAGE 3C UI QA2 HUMAN-QA CANDIDATE — WAITING FOR USER`**

QA2 corrects the QA1 menu from your review:
- your supplied logo is the main-menu title;
- the menu stands on pure black, with no Level 0 behind it;
- the page is black from its first frame until everything the menu needs (your theme included) is ready;
- the menu and its theme then start as one event: your logo powers on first with the Intro, and the rest of the menu follows;
- returning from a run fades the game's sound and the world down to black before the menu (logo first again) comes back.

Nothing else changes: the receipt proves file by file that the world, lighting (BR-RoLE), camera, monsters, movement, network, HUD, keybinds, touch layout, Customize and the installable app are QA1's.

- **Branch:** `stage-3c-qa2`, from QA1's final `5f30e28`. `stage-3c-qa1`, `stage-3c` and `main` are untouched. Commits and trees are in `STAGE_3C_QA2_PACKAGE_RECEIPT.txt`.
- **To start:** run `run_linux.sh` or `run_windows.bat`, or `node server.js 8000`, then open <http://localhost:8000>.
- **First visit vs later visits:** to see a true first visit again, use a new private window, or clear the site's data (DevTools > Application > Clear site data).
- **Fonts:** the evidence screenshots use fallback fonts, because the machine that took them cannot reach Google Fonts. Your browser shows IBM Plex Mono and Barlow Condensed.

Each scene lists what to do, then what should happen. Tick it, or note what looks wrong and where.

## A. Cold load (a first visit)
Open the game in a new private window. If you can, also try DevTools > Network > a slow profile.
- **First frame:** black, with no white flash from the page.
- **While it loads:** black, apart from a small LOADING after about a second.
  - On a slow first visit, a second small line appears under it: "Downloading the menu music (first visit only): x of 22.6 MB", with the real figure rising.
- **Check:** at no moment do you see:
  - the old title, or a half-drawn logo;
  - buttons or rails before they are laid out;
  - any of Level 0.
- **Expect a wait on a slow first visit.** The theme is 22.6 MB of WAV, and the menu now waits for it. That is about 4 s at 50 Mbit/s and about 18 s at 10 Mbit/s; at 4 Mbit/s it took about 52 s in testing.

## B. The ready gate
Most browsers want a click, key or tap before a page may play sound, at least on a first visit.
- **When everything is ready:** the screen stays black with one small line:
  - **PRESS ANY KEY OR CLICK TO ENTER** on a computer;
  - **TAP TO ENTER** on a phone.
- **Escape, Tab, Shift, Ctrl, Alt or a browser shortcut:** nothing happens. These are left to the browser.
- **Any other key, a click anywhere, or a tap anywhere:** all three should work. There is no small target to hit.
- **Some browsers let the page play sound straight away** (often on a later visit to a site you use). Then there is no gate: the menu and the music simply arrive together (scene C).

## C. The menu starts
The key, click or tap from B.
- **The start:** the line vanishes and the screen stays black for an instant. Then:
  1. **Your logo powers on first,** stuttering on for about half a second like a fluorescent tube striking. The first notes of your theme's Intro start at the same moment.
  2. **The rest follows, in order:** `LEVEL 0  THRESHOLD` and PLAY rise into place, then CUSTOMIZE / SETTINGS / CREDITS, then the left rail, the right rail, and last the credit and version.
  3. **It is settled** about 1.2 s after the logo lit, and nothing moves after that.
- **With reduced motion** (Settings, or your system's setting), the order is the same, but every part simply fades in quickly, the logo included. There is no flicker.
- **The click itself:** clicking or tapping where PLAY is does not open PLAY's entry. The press only enters.
- **Logo:** it is your supplied file, unaltered.
  - Your PNG is transparent around the lettering, and most of the "sign" behind it is almost fully transparent (alpha 1 to 31 of 255).
  - A browser therefore draws the lettering with a faint warm haze, not a bright sign plate. The plate appears only in viewers that ignore transparency (see `dev/stage-3c-qa2/evidence/q2/logo_alpha_comparison.png`).
  - If you want the plate, it has to be in the image itself.
- **Background:** pure black.

## D. Desktop menu
Open `STAGE_3C_QA2_MENU_COMPARISON.jpg` beside the game (QA1 on the left, QA2 on the right).
- **Layout:** the logo is high and centred; `LEVEL 0  THRESHOLD` sits above PLAY; PLAY is the largest control; CUSTOMIZE / SETTINGS / CREDITS form a row under it.
- **Rails:** your name, light and connection are in the left rail; Settings, Your wanderer, Sound and Help are in the right rail; the credit and the version are at the bottom.
- **Check:** no world anywhere, at any window size. Once the entrance is over, the only motion on an idle menu is the logo's rare under-a-second flicker (every 25 to 55 s).

## E. Phone, portrait (about 390 x 844)
- **Layout:** identity at the top left, the four rail buttons at the top right, then the logo, then PLAY low with the row under it.
- **Logo:** sharp. It is never drawn above its own resolution.
- **Buttons:** thumb-sized.

## F. Phone on its side (about 844 x 390)
- **Layout:** the rail buttons run along the top, and the logo sits between your name and the buttons, above PLAY.
- **Check:** nothing collides or is cut off, and nothing scrolls sideways.

## G. Menu pages
Open Settings, Credits, Help (the "i"), Customize, and PLAY's entry, closing each in turn.
- **Background:** black behind every one of them.
- **Music:** it plays on without restarting.
- **Sound:** the SOUND button silences the music and brings it back. The master volume (Settings) changes it.
- **Hidden tab:** switch to another tab; the music pauses. Come back; it carries on from where it was.

## H. ENTER LEVEL 0
PLAY, then ENTER LEVEL 0.
- **Music:** it fades out over about a second.
- **Screen:** it goes black for a moment, then fades to the world. The LEVEL 0 reveal comes in as the run begins. On a normal GPU the black lasts well under a second; the evidence machine renders in software and takes longer.
- **Check:** the logo never shows over the game. No half-made world frame shows (the world appears only once the run has started). The halls' own ambience starts here and never together with the menu music.

## I. Back to the menu
In the run: Esc, then NEW RUN, then END in the run menu.
1. **Fade down:** the run menu and the world fade to full black over about 0.8 s. The game's own sound fades out with them: the halls' hum, footsteps and any threat sounds. Clicks during the fade do nothing.
2. **The return:** on full black the run ends as before, and the menu comes back exactly as in scene C: your logo powers on first, your theme starts again from the Intro with it, then the rest arrives in the same order.
3. **On the menu:** nothing of the world is seen, and nothing of the halls is heard; only your theme plays. There is no second download, because the music was kept from the first.
4. **Your next ENTER LEVEL 0** brings the halls' sound back at its normal level.

Only what you hear changes. The monsters' hearing, the noise your movement makes for them, the server and the network behave exactly as before.

## J. Everything QA1 gave you
- **Before ENTER:** no wanderer at the spawn in a second window's world (QA1 scene C).
- **In play:** the minimal HUD, stamina only while it changes, and PAUSE.
- **Controls:** Settings > Controls still rebinds keys.
- **Phone:** the touch stick and the thumb-sized actions.
- **Customize and Credits:** as in QA1.
- **The installable app:** on the hosted HTTPS address, as in QA1.

## If something fails to load
To see it, use DevTools > Network > Block request URL with `MainTheme_MenuLoop.wav`, then reload.
- **What you see:** the page stays black with "The game could not start: the menu music did not load. Check your connection, then try again." and RETRY.
- **The other required pieces** each have their own wording: the interface, the credits, the menu artwork, the game.

## Known and expected
- **Console warning:** Chrome's console shows "The AudioContext was not allowed to start..." when the gate is needed. That is the page asking the browser, not an error.
- **The first-visit wait** is the price of starting the menu and its music together with uncompressed audio; see A.
  - A compressed playback copy of your theme (your WAVs kept as masters) would cut it about tenfold. QA2 does not do this, because the theme files were locked for QA2. It is your decision.
- **Over plain `http://` on a LAN address** (not localhost), browsers do not offer Cache Storage, so the theme downloads on every visit.
- **NEW RUN:** the server's 30 s NEW RUN cooldown is unchanged (out of scope, as in QA1).
- **Icon:** there is still no app icon (no official icon exists; the supplied logo is a menu logo, not an icon).
