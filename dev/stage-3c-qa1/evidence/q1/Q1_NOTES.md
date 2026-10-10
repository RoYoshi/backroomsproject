# Stage 3C QA1, Q1: the main menu from the rough draft, and the main-menu theme

## The menu (`index.html` `#menu`, `assets/ui.css`, `assets/ui.js`)

The rough draft's composition, finished with real systems only:

| Draft | QA1 |
|---|---|
| `THE FAR` / `BACKROOMS`, two tracked lines, glowing, top centre | the same two lines, centred, very wide tracking, lit like the fixtures (a still glow; it dips for under a second every 25 to 55 s, never while reduced motion is on) |
| black negative space | the darkened Level 0 behind a static scrim; an empty centre |
| `selected level - ???` above PLAY | `LEVEL 0  THRESHOLD` (the only level; both names are the game's own) |
| big PLAY box, lower centre | PLAY, the biggest control on the screen, lower centre, with a fluorescent tube line; it lights fully on hover and focus |
| `levels / Servers / Customize` row under PLAY | CUSTOMIZE / SETTINGS / CREDITS, one row joined to PLAY |
| tall left rail: avatar + handle, "stuff", global chat | who you are (your wanderer's colours on a small round glyph, and the name field), your light (the real loadout, drawn by the inventory's own painter, with Change light), the connection (room, ONLINE / CONNECTING / SOLO, how many *other* wanderers are inside: the game's own line minus you, because on the menu you are not in the world) |
| right utility rail: gear, person, list, info | Settings, Your wanderer (Customize), Sound (the game's own SOUND ON/OFF), Help (how to play and where the controls are) |
| `V23.4.5` bottom right | `v23.3.6` (`assets/credits_data.js` `version`, from `package.json`), with the Backrooms Wiki / CC BY-SA credit beside it |

PLAY opens the entry in its place: Level 0's brief, your name (Rename) and light (Change), **ENTER LEVEL 0** (the game's own `#enter`, the only thing that starts a run), Back. Escape and Back close it. Enter in the name field opens it rather than starting a run; a held Enter never repeats into ENTER; a double click on PLAY cannot press ENTER, which now sits under the pointer. Where the entry would cover the title (short screens) the title steps back while the entry is open.

Phones keep the draft's places: identity top left, utility rail top right (along the top on a phone on its side), the title, PLAY low. Nothing animates on an idle menu: the entrance plays once (the title's tube catching, PLAY rising, the rails coming up), and the title leans with a mouse pointer only while it moves.

## The theme (`assets/MainTheme_MenuIntro.wav`, `assets/MainTheme_MenuLoop.wav`; the source kept in `audio_source/MainTheme.wav`)

- **The files:** the user's derivatives, byte-identical (SHA-256 checked, `theme_assets_check.py` / `audio/theme_assets.json`). The source is preserved and not served. The loop-boundary audition clip is kept here as evidence (`audio/MainTheme_LoopBoundaryPreview.wav`), not shipped as the theme.
- **Playback:** the Intro once, then the Loop starts at the frame right after the Intro's last frame and loops its whole buffer, both on one 44.1 kHz Web Audio clock. No `<audio loop>`, and never the whole 117 s source.
  - An offline render through the player's own scheduling function equals Intro + Loop + Loop sample for sample across the handoff and two loop seams.
- **Its own small graph.** The game's audio graph is created only when a run starts (creating it starts the halls' ambience), so the menu cannot use it early. The theme follows the game's SOUND ON/OFF flag and the master volume (0.7 x volume).
- **Lifecycle:**
  - Nothing is created or fetched before the first press on the menu (the autoplay rule).
  - It keeps playing through PLAY's entry, Settings, Credits, Help and Customize.
  - ENTER LEVEL 0 fades it out linearly over 1 s, stops its sources and suspends its context.
  - The run menu stays silent; END brings back the true main menu and the theme starts again from the Intro.
  - A press on ENTER that starts a run immediately loads nothing.
  - A hidden tab is silent.
- **Delivery:** `server.js` serves these files uncached (22.6 MB a visit). The player keeps them in Cache Storage under their content hashes, so a second visit reads them locally. A later stage should give audio its own cache headers, or compressed delivery formats once gapless playback is verified there.

## Evidence

- **Checks:** `probe_q1.json` / `.log` (composition at five sizes, the entry flow, the whole theme lifecycle, the offline seam render, reduced motion and idle animation).
- **Captures:** `q1_<size>_menu.jpg` and `q1_<size>_entry.jpg` for 1920x1080, 1366x768, 1280x720, 1024x768, 768x1024 / 390x844 / 360x640 / 844x390 / 640x360 touch, and 1920x1080 with reduced motion.
  - The fonts are the fallback faces: this machine cannot reach Google Fonts.
- **Comparison:** `STAGE_3C_QA1_MENU_COMPARISON.jpg` (repository root) puts the rough draft, the first candidate and QA1 side by side. It will be regenerated at Q5.
- **Still open at Q1:** these captures still show the visitor's own wanderer and flashlight in the world behind the menu. That is the parent's behaviour, which Q2 removes.
