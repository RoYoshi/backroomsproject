# Nearby chat UX and character voices — changed files (against `1a89863`)

`git diff --stat 1a89863 <final>` lists every file. The evidence under `evidence/` is not listed one by one.

## What the game serves or runs

| File | Checkpoint | Why |
|---|---|---|
| `src/frameworks/front/client/chat.js` → `public/assets/chat.js` | C1–C4 | C1: the chat icon (`#chatIcon`) replaces Trial 4's Enter hint and the touch SAY button. C2: the composer opens on the player's Nearby chat binding (trusted presses only), not a fixed Enter. C3: typed-out bubbles (schedule, written and unwritten parts, the instant option). C4: each heard line spoken in its speaker's voice through `voice.js`; my voice sent with my lines; Voices in the composer's Options |
| `src/frameworks/front/client/voice.js` → `public/assets/voice.js` | C4 | new: the seven synthesized voices, the speaker's saved voice (`tfb.voice.v1`), chirp scheduling, the listener's switch and volume, Customize's Voice section with Preview |
| `src/frameworks/front/client/ui.js` → `public/assets/ui.js` | C2–C4 | C2: Nearby chat in Settings → Controls (the action, `PAGE`, old-save migration, the pause list, Help). C3: Settings → Display's Typed-out speech switch. C4: Settings → Sound's Wanderer voices and Voice volume |
| `public/assets/ui.css` | C1, C3, C4 | the chat icon (desktop, touch, phone on its side; passing hints keep clear); the unwritten part of a typed-out line; Customize's Voice section. The unused SAY and Enter-hint rules removed |
| `public/index.html` | C4 | one script tag, `assets/voice.js`, after the chats' script |
| `src/frameworks/bpp/server/speech.js` | C4 | each accepted line carries `v` (the speaker's voice), checked: `{p, h, s}` or `null`; who hears it and every limit unchanged |
| `src/frameworks/bpp/client/mp.session.js` → `public/mp.js` | C4 | the session's send of `{t:'say'}` carries `v` |
| `src/build-recipes.json`, `generated/BUILD_MANIFEST.json` | C4 (and each rebuild) | the `voice.js` output; the manifest rebuilt (`npm run build:check` PASS, 42 outputs) |

Not changed: the game bundle, movement, monsters, NEW RUN, the lounge's server, rooms, rates, the network's other messages, admin
authentication, secrets, deployment.

## Checks and gate

| File | Checkpoint | Why |
|---|---|---|
| `dev/tools/checks/chat_voice_browser.js` | C1–C4 | new: the icon, keys, type and voice sections (69 cases, 22 mutants) |
| `dev/tools/checks/chat_browser.js` | C1, C3, C4, C5 | the icon instead of the hint and SAY; the "bubble as HTML" and "mutes ignored" mutants follow the code they test. C5: the mute case reads each bubble's whole line (typed-out text had let the "mutes ignored" mutant escape); the Trial 4 colour case reads the speaker's own bubble when it first appears (it could read too late on a slow page) |
| `dev/tools/checks/chat_server.js` | C4 | the voice cases (valid, rejected, the same hearers, the page's presets, over real sockets), the event shape with `v`, a 14th mutant |
| `dev/tools/checks/menu_drift.js` | C4 | index.html compared less the voices' script tag too |
| `dev/tools/gate/gate.js`, `dev/tools/gate/README.md`, `dev/tools/README.md` | C4, C5 | the chat step expects 14 mutants; the new full-tier `chat_voice` step. C5: chat_browser's description names the icon, not SAY |
| `dev/tools/gate/declared_changes.json` | C1–C4 | every runtime change above declared |
| `dev/post-trial4-chat-voice/tools/verify_remote_v.py`, `tools/voice_perf.js` | C1, C4 | the push receipts; the voices' cost |

## Documents

| File | Why |
|---|---|
| `docs/architecture/CHAT.md` | the icon, the Nearby chat key, typed-out speech, voices, the protocol's `v`, the new check |
| `src/core/client/bundle/api_contract.json`, `API_CONTRACT.md` | C5: regenerated (`api_contract.js`, `lineage_doc.js`) to record `voice.js` reading `__api.audio`; the gate's lineage step had failed on C4 without it |
| `README.md` | C5: this branch's paragraph |
| `docs/architecture/CONTRACTS.md`, `FRAMEWORKS.md`, `BUILD_PIPELINE.md`, `src/frameworks/front/README.md` | generated blocks (`node dev/tools/docs/docs.js`): `voice.js`, `window.__voice`, who reads `window.__keys` and `window.__chat` |
| `dev/post-trial4-chat-voice/` | `REPORT.md`, `HUMAN_QA.md`, this file, `CHECKPOINTS.md`, `inventory/`, `evidence/` |
