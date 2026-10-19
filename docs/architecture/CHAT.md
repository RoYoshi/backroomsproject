# Chat: the main menu's lounge and nearby speech in a run

Post-3H Trial 2 (the owner's integration pack of 2026-10-15, authorized 2026-10-16). Two separate things, never mixed:

| | **MENU · LOUNGE** | **IN LEVEL · NEARBY** |
|---|---|---|
| Who | everyone on the main menu of this server process, whatever `?room=` they will play in | the players of one room who are in the world and alive |
| Transport | its own WebSocket, `/social` (`src/frameworks/bpp/server/lounge.js`) | the game's WebSocket, `/ws?room=NAME`: one more client message, `say` (`src/frameworks/bpp/server/speech.js`) |
| Who receives a line | every socket in the lounge at that moment, the sender included | every player of the same room, in the world and alive, within **576 px** (6 cells) of the speaker at that moment, the speaker included |
| Shown as | lines in the lounge panel, under unverified nicknames | a short-lived speech bubble over the speaker, or a small hint at the screen's edge pointing to a speaker who is off screen |
| Kept | nothing: no history, no replay to newcomers, no transcript, no log | nothing |

Every text passes one check first, W.A.R.D.'s `src/frameworks/ward/server/chat_text.js`, and every client shows it with
`textContent` only. The lounge is not a player: it takes no room slot, has no world, and cannot send a game packet.

## How the server is wired

`server.js` (the composition root) requires the three modules and registers **one** upgrade handler on the HTTP server, a dispatcher:
a request for `/social` goes to the lounge; every other request goes to the session's own handler, unchanged (the session,
`src/frameworks/bpp/server/session.js`, is the M8 code moved verbatim and registers its handler on the object it is given, which keeps
it for the dispatcher). The session is given `speech.readerFor(reader)`: B++'s WebSocket reader as before, handing it every message
as before, except `{t:'say'}`, which the session never read and which goes to the speech module instead. So no line of the session
changes, `/ws` behaves as before for every request and message it handled, and nothing runs on the loop's ticks: both chats are
event-driven. The server's rates (`TICK_MS = 25`, `SNAP_EVERY = 2`, the fresher poses) are untouched.

## Protocol (version 1)

JSON text frames. The WebSocket reader (`src/frameworks/bpp/server/ws.js`) reads text frames under 1,400 bytes and drops bigger ones
unread; it answers pings and closes on a close frame; unparseable frames are dropped.

**Nearby speech, on the game socket** (names chosen after checking every existing message type; none collides):

| Direction | Message | Meaning |
|---|---|---|
| client → server | `{t:'say', text[, c]}` | say one line. Only `text` and (since Trial 4) `c`, the speaker's HUD colour, are read: an `x`, `y`, `room`, `id`, name or admin flag in the packet is ignored |
| server → listener | `{t:'heard', id, text, seq, c}` | `id`: the speaker's session id (which every client of the room already has, with its position, from the snapshots); `seq`: the server's counter; `c` (Trial 4): the speaker's colour if it was exactly `#RRGGBB` (sent lower-cased), otherwise `''` - never anything that could reach a page's CSS unchecked, and it changes nobody's hearing. No position, room or name is added |
| server → speaker | `{t:'said', ok:0, why[, wait]}` | refused: `menu` (not in the world), `dead`, `slow` (with `wait`, seconds), `repeat`, `empty`, `long`, `bad`. A line that was accepted comes back to its speaker as `heard` |

**The lounge, on `/social`:**

| Direction | Message | Meaning |
|---|---|---|
| client → server | `{t:'social_hello', nick}` | first, once, within 10 s of the upgrade |
| | `{t:'social_send', text}` | a line |
| | `{t:'social_nick', nick}` | a new nickname |
| | `{t:'social_ping'}` | keep-alive: a socket that sends nothing for 75 s is closed |
| server → client | `{t:'social_welcome', v:1, id, nick, online}` | this connection's server-given id and its cleaned nickname |
| | `{t:'social_message', id, nick, text, seq}` | a line, to every socket in the lounge (the sender's own copy is its receipt) |
| | `{t:'social_nick', nick}` | the nickname now in use |
| | `{t:'social_error', why[, wait]}` | a refused line: `slow` (with `wait`), `busy` (the whole lounge's budget), `repeat`, `empty`, `long`, `bad` |
| | `{t:'social_count', online}` | how many are in the lounge, at most once every 2 s |

## Limits

| What | Limit | Where |
|---|---|---|
| A line | 160 Unicode code points and 600 UTF-8 bytes, after cleaning; refused (`long`), never cut | `chat_text.js` |
| A nickname | 20 code points, 60 bytes; `wanderer` if nothing usable is left | `chat_text.js` |
| Cleaning | NFC; C0/C1 controls, DEL, bidirectional embeddings/overrides/isolates/marks, zero-width space, word joiner, BOM, tag characters and noncharacters removed (more than 4 of them: refused, `bad`); line breaks and tabs become spaces; runs of combining marks cut to 4; whitespace collapsed; a lone surrogate (possible through a JSON escape) refused | `chat_text.js` |
| Speech per connection | 3 lines, refilled at 3 per 5 s (every `say` pays, valid or not); `slow` told at most once a second; the same text again within 3 s refused | `speech.js` |
| Speech recipients | the speaker's room only; in the world and alive; within 576 px (Euclidean, the server's positions at that moment); a recipient with more than 256 KB of unsent output is skipped (the game's own messages are untouched) | `speech.js` |
| Lounge sockets | 64 at once (`503`); 30 new ones per 10 s for the whole lounge (`429`) | `lounge.js` |
| Lounge per socket | 3 lines per 5 s (lines and nickname changes pay); the same text within 3 s refused; 16 KB received per 10 s, else closed; 8 invalid messages in its life, else closed; hello within 10 s; 75 s of silence, closed | `lounge.js` |
| Lounge in all | 10 lines a second (a 2-second bucket), else `busy` | `lounge.js` |
| Lounge output per socket | over 64 KB unsent, a line is not queued for it; over 256 KB, it is closed | `lounge.js` |
| Lounge handshake | `GET`, `Upgrade: websocket`, a 16-byte base64 `Sec-WebSocket-Key`, version 13, and an `Origin` whose host is the request's `Host` (or its `X-Forwarded-Host`); no extensions (no compression) | `lounge.js` |

## The threat model (the pack's eight questions)

1. **Who may send and receive.** Lounge: any page of this site that opens `/social`, says hello and keeps to the limits; it receives
   the lounge's lines while connected and nothing else. Nearby: only a game connection whose player is in the world and alive (held
   by a monster counts as alive) may speak; a menu player is refused `menu`, a dead one `dead`, a closed or leaving connection is not
   found and nothing happens. Receivers: the same room, in the world, alive, within 576 px. A spectator does not exist in this game:
   a dead player watching receives nothing; the menu receives nothing of a run; another room nothing at all.
2. **Where the radius is evaluated.** On the server, in `speech.js`, at the moment the line arrives, from the server's own player
   positions (the ones movement validation accepted). The packet's own fields are ignored; the speaker is the socket. Spoofing a
   position, id, room or name changes nothing (`chat_server.js`: `sock_speech_spoof_ignored`, and mutants that trust a spoofed
   position or id are caught).
3. **Same origin; no backdoor.** `/social` refuses (`403`) a missing Origin, another site's, a look-alike host, or a non-http(s)
   origin. A reverse proxy that rewrites `Host` is accepted when it sends the public host in `X-Forwarded-Host`. The lounge's message
   handler knows only the four lounge messages: a game packet (`join`, `p`, `admin`, `say`...) sent there is an invalid message and
   reaches nothing. Game sockets never see a lounge line (checked both ways).
4. **Markup, fan-out, memory, stuck sockets.** Texts are plain strings, shown with `textContent`; markup and links stay literal text
   (no auto-linking). Fan-out: speech touches at most one room's clients (8); the lounge at most 64 sockets, at most 10 lines a second.
   Memory: per lounge socket a few counters and its unsent output (bounded, then closed); per game connection a small record in a
   WeakMap. No queue, history or index of texts exists anywhere. Stuck sockets: hello and idle timeouts, the output limit, and the
   byte budget close them.
5. **Mute and controls on a phone.** Yes (see [The page](#the-page)): the Lounge button, mute by the sender's name, Turn the lounge off,
   and in a run the chat icon, Options, hide and mute are all buttons, used by touch in the browser check (`chat_browser.js`).
6. **What is kept, logged, broadcast or given to an AI.** Nothing of a text is kept or logged by the server (the check reads the
   server's own output and finds no test text). A line is broadcast only to the receivers above. No AI, monster or other module gets
   any of it: the future-entity hook below is inert.
7. **Static files and production behaviour.** No file is newly served but the client's own `assets/chat.js` under the existing
   `assets/` rule; `/social` is refused as a plain HTTP request (404, as before). No dependency is added. The game's `/ws` handshake,
   room cap, messages and rates are unchanged.
8. **Inherited admin issues.** Unchanged and still open: the built-in fallback admin passcode when `ADMIN_PASSCODE` is not set, and
   the admin lockout keyed on a forwarded address a client can forge. Neither chat path reads either. Both need their own approved
   security work before any public deployment.

## The future-entity contract: `onLocallyHeardSpeech` (inert)

Not implemented, not connected to N.A.N.I. or any AI. If a future, separately approved trial gives an entity the ability to "hear"
speech, it may receive only what a player standing where that entity stands could have received under the rules above:

```text
onLocallyHeardSpeech({ speakerId, roomId, boundedText, timestamp, distance })
  - only lines that passed chat_text.js and were accepted by speech.js, in the entity's own room, from a speaker within the same
    576 px radius of the entity at that moment;
  - never a lounge (menu) line, never a line from another room, never a refused or distant line, never a line older than the moment
    it was said (no history, no store);
  - the text may not be kept beyond the entity's immediate reaction, logged, or used to build a model of a player.
```

Today `speech.js` holds `ON_HEARD = null`, never assigned and never called (the unit check asserts it).

## Honest limits

- **One server process.** The lounge is global to the process that serves the page. Several processes would each have their own
  lounge; a shared one needs a broker and a separate deployment decision.
- **No per-player-address limits.** A client's address is not trusted (`X-Forwarded-For` can be forged; behind a proxy every socket
  is the proxy). The join budget is the whole lounge's: someone opening sockets fast can make others wait a few seconds to join.
- **Nicknames are not accounts.** Anyone can type any name; the page says so. Mutes are per connection id for this page session: a
  muted sender who reconnects gets a new id.
- **No moderation tools.** No report button, filter list or admin view of the lounge (the pack asks for none; it would be a separate
  decision with its own privacy rules).
- **Walls do not block speech.** The radius is the rule (no line-of-sight is invented).
- **Fragmented frames** are not reassembled by the reader (browsers do not fragment such small messages); a fragment is read as it
  is and fails to parse.
- **Old clients** (a page loaded before the update) ignore `heard` like any message they do not know, and never send `say`. A page from
  before Trial 4 sends no `c` (its lines get `c: ''`, the neutral accent) and ignores the `c` it receives.

## The page

F.R.O.N.T.'s `src/frameworks/front/client/chat.js` (built to `public/assets/chat.js`, loaded first of the page's scripts) and its
styles at the end of `public/assets/ui.css`. B++'s client session (`mp.session.js`) links in its send of `{t:'say'}` (`window.__chat.link({say})`, once, as it loads; `window.__net` is unchanged) and hands `heard`
and `said` to `window.__chat.net(m, peer)` (with the speaker's peer record, for its name); core's per-frame hook (`mp.frame.js`) calls
`window.__chatFrame({p, cam, sc, W, H, run})` after drawing the other players. Nothing else of the page changed.

**The lounge (MENU).** Open only while the main menu is shown and the lounge is on; closed the moment a run begins (and its list
emptied: nothing said meanwhile reaches a player in a run), and after 30 s in a hidden tab; it reconnects with a growing wait (2 s to
30 s) when the server cannot be reached or is full. Wide screens (at least 1180 x 620): a panel at the lower right, between the utility
rail and the corner, foldable to its title (remembered). Smaller screens: a **Lounge** button at the end of the left rail (with the count
online and a badge for unread lines) opens it over the menu (a phone held upright: the full width; on its side: the right side);
**Close** or Esc puts it away and gives the focus back to the button. Each line is the sender's nickname (a button: press it to mute that
sender until the page is left; "Undo" and "Unmute everyone" put it back) and the text; your own lines say "You". The panel says plainly
that names are not verified and nothing is kept. **Turn the lounge off** closes its socket (and so leaves the count); **Turn the lounge
on** opens it again. At most 80 lines are kept on the page.

**Nearby (IN LEVEL).** Only in a live run, online, alive and with nothing open over the game: **Enter** (or a click or tap on the
chat icon, low on the right) opens a one-line composer labelled *Nearby* (its field is announced as "Say to players near you"); every key the game was holding is
let go first. Enter sends and closes; Esc or a click elsewhere closes. A line heard shows as a bubble over its speaker (yours too:
your own line comes back from the server as its receipt) for 3 to 5 s (3 s plus 12.5 ms a character), one bubble a speaker, the newest
replacing the last. A speaker off screen gets the same line as a small one-line hint at the screen's edge, with an arrow pointing their
way. Bubbles end at once when their speaker leaves, dies or the world resets, and all of them when you die, leave the run or lose the
connection. **Options** in the composer: speech bubbles shown or hidden, text size normal or large, and the people heard this visit,
each one muted or heard (by the server's id for that connection, never by name). A refused line says why for a few seconds (too fast,
too long, not while dead...). Offline (SOLO), Enter does what it always did.

**The chat icon** (post-Trial 4 chat polish; it replaced Trial 4's bottom-centre `ENTER Nearby Chat` hint and Trial 2's SAY button).
While the composer could open and is closed, one small speech-bubble button (`#chatIcon`) sits low on the right, quiet until hovered
or focused (as the pause button is): on a keyboard screen at the corner the coordinates use (lifted over them while they are on), with
its key as a small key cap beside it and "Nearby chat" above it on hover or focus, scaled with the HUD; on a touch screen a 48 px square
just above the right-hand action buttons (a phone on its side: on the bottom row, just left of them), inside the safe area, and the
passing hints keep clear of its column while it is shown. Its accessible name is "Nearby chat (KEY)". A click or tap opens the composer
exactly as the key does (held keys let go); the icon hides while the composer is open, and whenever speaking is not possible (offline,
dead, paused, on the menu, anything open over the game).

**Trial 4.** Each bubble's border, tail and edge-hint arrow take the speaker's
colour as the server passed it (`c`; the neutral `#e3c768` when it is `''`); the text stays cream on the dark bubble. The page sends
the HUD colour from Settings (`window.__settings`), or `''` while the HUD colour is Default.

**Keys.** While a chat field (or anything inside the lounge or the composer) has focus, chat.js's window capture listener stops each
keydown and keypress there from reaching the game, the menus or the key remapping (key releases still pass, so nothing stays held); the
browser's own typing, Tab and form sending are untouched. (The game, the inventory, the camcorder and the menus already ignore keys typed into a text field; chat.js's
stop is a second wall, which is why the browser check tests what a player would notice - nobody walks, the light does not toggle, Esc
only closes - rather than the stop itself.) Esc leaves the field (closes the composer or the phone's lounge). The admin
key, pause and every game key behave as before whenever no chat field has focus.

**Accessibility.** Every control is a real button or field with a label, reachable by keyboard and by touch. New lines are announced
through one polite region at most every 2.5 s (more waiting lines become one count, never a flood): nearby lines always, lounge lines
only while the focus is inside the lounge. A bubble appears at once and fades out over its last 0.4 s; with reduced motion (Settings,
or the device under System) it simply goes. Nothing moves but the bubbles following their speakers; nothing flashes. Saved (`tfb.chat.v1` in this browser): lounge on or off, folded or not, bubbles shown or hidden, text size.
Never a text, a name or a mute.

## Checks

`node dev/tools/checks/chat_browser.js [--mutants 1] [--shots DIR]`: real pages in headless Chromium against the real server: the lounge
across two rooms, typing isolated from the game and the menu, markup kept literal, mute, fold, off, the phone's Lounge button, the
lounge closed during a run, and its place at five screen sizes (covering nothing of the menu); nearby speech between players in one
room with a third elsewhere: the composer (held keys let go, nobody walks while typing, Esc only closes), bubbles on both screens and
gone within 5 s, an edge hint pointing the right way for a listener off screen, nothing beyond the radius or in the other room, hide
and mute, a leaver's bubble going with it, SAY on a phone, reduced motion. Its mutants break the page's chat.js seven ways (a bubble
written as HTML, the composer opening over the pause screen, held keys kept, the lounge left open in a run, no edge hint, mutes ignored,
bubbles that never end).

`node dev/tools/checks/chat_server.js [--mutants 1]`: the cleaning, `speech.js` on hand-made rooms and `lounge.js` on fake sockets
(unit cases); the real server driven by raw WebSocket clients (every rule above, positive and negative); and, with `--mutants 1`,
copies of the server with one deliberate fault each (a cross-room leak, the radius ignored, a spoofed position or id trusted, the menu
or the dead allowed to speak, dead listeners, the cleaning bypassed, either rate limit removed, the Origin check removed, a position
added to the event, lounge lines written to game sockets, hello not required), each of which its cases must catch.
