# W.A.R.D.: trust and deployment security

`src/frameworks/ward/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

The edges of trust: what the server serves (`server/static.js`: only `public/`, through the `SERVE` allowlist; MIME types, caching, gzip, `/sounds`) and the checks on every field a client sends (`server/fields.js`). The admin passcode, its constant-time check and the lockout per address are W.A.R.D.'s concern too, and stay in `server.js` as they were.

## What it must not own

Secrecy of browser files (anything in `public/` is public), and anything like DRM. It never weakens a check to make a feature easier.

## Its rule

Server source stays private to the server (never served); no secret in a client file; any change to a security default is separately approved by the owner.

## Its files

<!-- generated: sources:ward (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`server/fields.js`](server/fields.js) | server/fields.js - the checks server.js applies to the fields clients send. | a server module: `server.js` requires it |
| [`server/static.js`](server/static.js) | server/static.js - the static file serving of server.js. | a server module: `server.js` requires it |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header.

## How it connects

- `server.js` gives `static.js` its web root; the session applies `fields.js`'s checks to the fields of the messages it reads.
- The deployment pulls `main` and runs `node server.js` (`.github/workflows/deploy-bloom.yml`, unchanged).

## Changing it

Only with the owner's approval. Security findings go to the owner privately, never into this public repository.

## Tests

- `npm run gate`: the static step, `raw_live` (every HTTP answer, including traversal and the folders that must answer 404), the scope step (the passcode line and the deployment workflow compared by hash).
- `node dev/tests/audit_net.js` (the path cases).

## Known debt

- Moving the session out of `server.js` waits for the owner (M-023).
