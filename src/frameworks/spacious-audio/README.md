# Spacious Audio: sound presentation

`src/frameworks/spacious-audio/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

What the players hear, all synthesised in the page: the dread's drone and heartbeat (`client/mp.dread.js`), the fluorescent hum (`client/mp-hum.js`), the entities' voices and steps (`client/ents.audio.js`), footsteps, slides, vaults and breathing (`client/move.sound.js`), the camcorder's sound (`client/camcorder.audio.js`), the glitched walls' static (`client/glitch.audio.js`), and the players' own sound files (`client/sfx.js`: drop files into `public/sounds/`).

## What it must not own

What the server's entities hear: that is N.A.N.I.'s evidence, decided on the server from what S.P.A.C.E. accepted. The menu's theme music is F.R.O.N.T.'s (`assets/ui.js`, `public/assets/MainTheme_*.wav`).

## Its rule

No retuning in a refactor: a sound moves only with a listening check.

## Its files

<!-- generated: sources:spacious-audio (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`client/camcorder.audio.js`](client/camcorder.audio.js) | Spacious Audio: the camcorder's synthesised sound; a module: camcorderAudio | `public/camcorder.js` (a part) |
| [`client/ents.audio.js`](client/ents.audio.js) | Spacious Audio: the entities' sound (procedural, positional, muffled through walls); a module: entsAudio | `public/ents.js` (a part) |
| [`client/glitch.audio.js`](client/glitch.audio.js) | Spacious Audio: the glitched walls' sound, crackling digital static; a module: glitchAudio | `public/glitch.js` (a part) |
| [`client/move.sound.js`](client/move.sound.js) | Spacious Audio: footsteps by state and surface, slides, vaults, breathing; a module: moveSound | `public/move.js` (a part) |
| [`client/mp-hum.js`](client/mp-hum.js) | mp-hum.js - the fluorescent light hum of the multiplayer layer (mp.js): a synthesized magnetic ballast on the game's own audio context. | `public/assets/mp-hum.js` |
| [`client/mp.dread.js`](client/mp.dread.js) | Spacious Audio: the dread's sound (the drone and the heartbeat); a module: audioDread | `public/mp.js` (a part) |
| [`client/sfx.js`](client/sfx.js) | Drop-in custom sounds. Put audio files in ./sounds (mp3 / ogg / wav / m4a / flac) named like: | `public/sfx.js` |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header. Since continuation C3b a part of `world.js`, `move.js`, `camcorder.js`, `glitch.js` or `ents.js` is a module, and since C3c a part of `mp.js` too: one factory, given what it uses of the modules made before it; its header also lists its `imports` and `exports` (and, for `mp.js`'s session, the names it is given `late`), and the script's `*.compose.js` part makes the modules in order (`docs/architecture/CONTRACTS.md` section 4; `node dev/tools/checks/modules.js` proves the boundaries).

## How it connects

Five of its files are parts of other owners' scripts, all modules (four since continuation C3b, the dread since C3c), each given what it uses of its host's modules: the camcorder's sound in `camcorder.js` (it sets the camera's whine slot through BR-R's `setWhine`), the entities' in `ents.js`, the walls' in `glitch.js`, the movement sounds in `move.js` (it hands them to the movement module with `useSound`; `window.__mvSfx` is still registered). The dread in `mp.js` sets its drone's level and shows the online note when the per-frame hook asks (`setDrone`, `onlineNote`). Their headers list what they take of their hosts. `mp-hum.js` and `sfx.js` are whole files.

## Changing it

Edit the part, `npm run build`, run `node dev/tools/checks/parts.js`, and listen. The gate's client goldens trace every audio call (`hum_dread` and the other scenes), so a change shows there first.

## Tests

- `npm run gate`: the client goldens (the audio calls of each scene, against the accepted build), the client mutants (the hum).
- Listening: Human QA only; no automated check hears.

## Known debt

- Every sound but the dread's plays on the game's own audio context (`window.__api.audio()`); the dread makes its own. There is no shared bus.
