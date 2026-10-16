# The Far Backrooms

A multiplayer survival game in the browser, set in Level 0 of the Backrooms. Every `?room=NAME` is its own world. The server runs the
Hounds and the Smilers, the blackouts, the glitched walls, the deaths and the bodies; each player's browser draws the world and moves
its wanderer.

**This branch (`post-3h-trials-1-2-4`):** the owner-accepted Stage 3H engine (C5d, `4beba2f`: its report and Human QA page are in
[`dev/stage-3h-modernization/`](dev/stage-3h-modernization/)) plus the post-3H integration trials the owner authorized, one at a time
([`dev/post-3h-trials/`](dev/post-3h-trials/README.md)). **Trial 1, the main menu's title drift: accepted by the owner.** **Trial 2,
chat - a lounge on the main menu and nearby speech in a run: in progress** ([`docs/architecture/CHAT.md`](docs/architecture/CHAT.md)).
Nothing else changes how the game plays. The deployed game is `main`; nothing here is merged or deployed.

## Run it

You need Node.js 18 or later (`package.json` asks for it; this branch was tested on Node 22). Nothing to install.

```text
node server.js            # then open http://localhost:8000      (or: npm start; run_linux.sh; run_windows.bat)
node server.js 9000       # another port
```

- Share `?room=NAME` to play in the same world.
- Set the admin passcode with the `ADMIN_PASSCODE` environment variable. Do this on any server others can reach.
- The server serves only `public/`. Nothing else in this repository is reachable over HTTP.

## Develop

| You want to | Do this |
|---|---|
| Get started, build, test | [`docs/development/QUICKSTART.md`](docs/development/QUICKSTART.md) |
| Know who owns what | [`docs/architecture/FRAMEWORKS.md`](docs/architecture/FRAMEWORKS.md), and each `src/frameworks/<name>/README.md` |
| Follow a frame, a message, a death, NEW RUN | [`docs/architecture/RUNTIME_FLOWS.md`](docs/architecture/RUNTIME_FLOWS.md) |
| Change a script the browser or the server loads | [`docs/architecture/BUILD_PIPELINE.md`](docs/architecture/BUILD_PIPELINE.md): edit `src/`, then `npm run build` (the compiled client, `src/core/client/game/`, is TypeScript: `dev/tools/build/client.js` builds it with its locked npm packages) |
| Know what one part may rely on from another | [`docs/architecture/CONTRACTS.md`](docs/architecture/CONTRACTS.md) |
| Know what was proven to be unchanged, and how | [`docs/architecture/PARITY_MATRIX.md`](docs/architecture/PARITY_MATRIX.md) |
| Read a past decision | [`docs/architecture/ADRS/`](docs/architecture/ADRS/) |
| Find an old stage report | [`dev/archive/INDEX.md`](dev/archive/INDEX.md) (the version history this README used to hold is there too) |

```text
npm run build          # writes public/ and generated/ from src/          npm run build:check   # are they what src/ builds?
npm test               # the scenario suite (some cases fail on the accepted build too: see QUICKSTART)
npm run gate -- --packages <folder>   # the modernization gate against the accepted build (about 20 minutes; the folder holds the
                                      # compiled client's 31 locked npm packages)
```

## Where things are

```text
server.js        the server's composition root            public/       the web root: everything the browser may load
src/core/        the composition roots, server and client  generated/    what the build writes for the server (never served)
src/frameworks/  one folder per framework (its owner)      docs/         architecture and development documentation
dev/             development only: tests, tools, the gate, the stage folders, and dev/archive/ (earlier stages' reports)
```

## License

This repository includes no license file: its code and assets belong to its owner. The compiled client bundle contains PixiJS, which
is MIT-licensed.
