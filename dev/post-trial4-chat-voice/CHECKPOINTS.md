# Post-Trial 4 chat polish — checkpoints

Branch `post-trial4-chat-voice-polish`, created from the review's verified head `1a89863286d218c8b67ccc5456ee08bbf8c15066` (tree
`ddc6385c0f6d7112bfaf9dac3e40154acd4bbaed`). Every checkpoint is a normal fast-forward push of this branch only, read back from GitHub by
`tools/verify_remote_v.py` (the commit, its tree and parent; `main`, Stage 3H, B++, the Trials 1–2 branch, the closed Trial 4 branch and the
review branch unchanged; no other branch moved or new). Receipts are in `evidence/remote/`. A commit cannot name its own hash, so each
row's hash is filled in by the next checkpoint.

**Live status: in progress.** Nothing merged or deployed. Trial 3 not started.

| # | What | Commit | Tree | Game change | Tests | Rollback |
|---|---|---|---|---|---|---|
| C1 | The chat icon (chat.js, ui.css) in place of Trial 4's Enter hint and the touch SAY; `dev/tools/checks/chat_voice_browser.js` (icon section); chat_browser.js checks the icon instead of the hint and SAY; CHAT.md; this folder | this commit | — | a small speech-bubble button low on the right opens nearby chat; the bottom-centre hint and SAY are gone | `evidence/c1/`: icon 30 of 30 at four sizes, 4 of 4 mutants; chat_browser nearby and phone 22 of 22; build:check, docs PASS | `git checkout 1a89863` (the review's head) |
