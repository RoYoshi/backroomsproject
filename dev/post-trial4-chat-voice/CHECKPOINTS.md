# Post-Trial 4 chat polish — checkpoints

Branch `post-trial4-chat-voice-polish`, created from the review's verified head `1a89863286d218c8b67ccc5456ee08bbf8c15066` (tree
`ddc6385c0f6d7112bfaf9dac3e40154acd4bbaed`). Every checkpoint is a normal fast-forward push of this branch only, read back from GitHub by
`tools/verify_remote_v.py` (the commit, its tree and parent; `main`, Stage 3H, B++, the Trials 1–2 branch, the closed Trial 4 branch and the
review branch unchanged; no other branch moved or new). Receipts are in `evidence/remote/`. A commit cannot name its own hash, so each
row's hash is filled in by the next checkpoint.

**Live status: in progress.** Nothing merged or deployed. Trial 3 not started.

| # | What | Commit | Tree | Game change | Tests | Rollback |
|---|---|---|---|---|---|---|
| C1 | The chat icon (chat.js, ui.css) in place of Trial 4's Enter hint and the touch SAY; `dev/tools/checks/chat_voice_browser.js` (icon section); chat_browser.js checks the icon instead of the hint and SAY; CHAT.md; this folder | `d0e47260462a158478d6d288bfc996deced55aef` | `27422842d095691f06cabdd4a2f3edbde335119b` | a small speech-bubble button low on the right opens nearby chat; the bottom-centre hint and SAY are gone | `evidence/c1/`: icon 30 of 30 at four sizes, 4 of 4 mutants; chat_browser nearby and phone 22 of 22; build:check, docs PASS. Push verified (`evidence/remote/verify_c1_d0e4726.json`); scanned clean after the push | `git checkout 1a89863` (the review's head) |
| C2 | Nearby chat in Settings -> Controls (ui.js: the action, PAGE, the migration, the pause list and Help); chat.js opens on the binding (trusted presses only); the keys section of chat_voice_browser.js; CHAT.md | `b47377ba933b899e49678c66758ab105fea9a56f` | `a828895817a064e1b0b060ee408b0ff6332aef77` | the chat key can be changed (Enter by default); Enter no longer opens chat once moved; the pause screen lists the key | `evidence/c2/STEPS.txt`: icon and keys 45 of 45; keys 15 of 15, 5 of 5 mutants; chat_browser nearby 22 of 23 then 20 of 20 alone (frame pacing). Push verified (`evidence/remote/verify_c2_b47377b.json`); scanned clean after the push | `git checkout d0e4726` (C1) |
| C3 | Typed-out bubbles (chat.js: the schedule, the written and unwritten parts, the instant option; ui.css; ui.js's Display switch); the type section of chat_voice_browser.js; chat_browser's HTML mutant aimed at the written part; CHAT.md | this commit | — | each heard line writes itself out in its bubble (pauses at punctuation, at most 6.5 s), then holds; reduced motion or the switch shows it whole | `evidence/c3/STEPS.txt`: type 10 of 10, 6 of 6 mutants; chat_browser nearby 23 of 23; hook 0.19 ms a frame with nine typing bubbles | `git checkout b47377b` (C2) |
