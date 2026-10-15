# W.A.R.D.: trust and deployment security

`src/frameworks/ward/`. Has code in this repository (below). Stage 3H moved code here without changing what it does: the game must play exactly as the accepted build does.

## What it owns

The edges of trust: what the server serves (`server/static.js`: only `public/`, through the `SERVE` allowlist; MIME types, caching, gzip, `/sounds`) and the checks on every field a client sends (`server/fields.js`). The admin login is W.A.R.D.'s too (`server/admin_login.js`, continuation C2): the passcode's hash and its constant-time check, the count of wrong guesses per client identity and the 60 s lockout after the fifth, moved out of `server.js` as they were. The passcode's source (`ADMIN_PASSCODE`, or the built-in default) stays in `server.js`'s configuration, which gives it to the login.

## What it must not own

Secrecy of browser files (anything in `public/` is public), and anything like DRM. It never weakens a check to make a feature easier.

## Its rule

Server source stays private to the server (never served); no secret in a client file; any change to a security default is separately approved by the owner.

## Its files

<!-- generated: sources:ward (dev/tools/docs/docs.js) -->
| File | What it is | Goes into |
|---|---|---|
| [`server/admin_login.js`](server/admin_login.js) | src/frameworks/ward/server/admin_login.js - W.A.R.D. on the server: the admin login.  A client's {t:'admin', pass} is checked here: | a server module: `server.js` requires it |
| [`server/fields.js`](server/fields.js) | server/fields.js - the checks server.js applies to the fields clients send. | a server module: `server.js` requires it |
| [`server/static.js`](server/static.js) | server/static.js - the static file serving of server.js. | a server module: `server.js` requires it |
<!-- end of generated block -->

A file marked "(a part)" is one part of a bigger script: its `/** @part` header says which script, what the part provides to the others, what it uses of theirs and which of their bindings it writes; `node dev/tools/checks/parts.js` proves the header.

## How it connects

- `server.js` gives `static.js` its web root and `admin_login.js` the configured passcode; the session (B++, `session.js`) applies `fields.js`'s checks to the fields of the messages it reads, and hands each `{t:'admin'}` to `adminLogin`.
- The deployment pulls `main` and runs `node server.js` (`.github/workflows/deploy-bloom.yml`, unchanged).

## Changing it

Only with the owner's approval. Security findings go to the owner privately, never into this public repository.

## Tests

- `npm run gate`: the static step, `raw_live` (every HTTP answer, including traversal and the folders that must answer 404), the scope step (the passcode line and the deployment workflow compared by hash).
- `node dev/tests/audit_net.js` (the path cases).

## Known debt

- None: the login moved at C2 with its semantics unchanged (M-023). Any change to what it decides is a separate security change that the owner approves.
