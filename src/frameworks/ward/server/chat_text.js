/* src/frameworks/ward/server/chat_text.js - W.A.R.D. on the server: the one check every chat text and nickname passes before anybody
 * else sees it (post-3H Trial 2; docs/architecture/CHAT.md).  Used by the menu's lounge (bpp/server/lounge.js) and by nearby speech in a
 * run (bpp/server/speech.js).  Pure functions: no state, no timer, nothing required.  Never served.
 *
 *   cleanText(v, max = TEXT)   -> { ok: true, text } | { ok: false, why }
 *   cleanNick(v)               -> the nickname to show (never empty: 'wanderer' when nothing usable is left)
 *
 * What it does, in order (why: the reason a refusal gives back to the sender, never the text itself):
 *   1. not a string: 'bad'.  More than 4 x the code point cap in UTF-16 units: 'long' (before any other work).
 *   2. not well formed (a lone surrogate, which JSON escapes can carry): 'bad'.
 *   3. Unicode NFC.
 *   4. the invisible and direction-changing characters are counted and removed: C0 and C1 controls and DEL (tab, line and paragraph
 *      breaks become a space instead), the bidirectional embeddings, overrides, isolates and marks, zero-width space, word joiner,
 *      the byte-order mark, the Mongolian vowel separator, interlinear annotation marks, the tag characters, U+FFFE and U+FFFF.
 *      Zero-width joiner and non-joiner stay (emoji sequences and several scripts need them).  More than 4 removed: 'bad'
 *      (control-heavy input is refused, not repaired).
 *   5. a run of more than 4 combining marks keeps its first 4 (stacked "zalgo" text cannot grow over other lines).
 *   6. whitespace runs become one space; the ends are trimmed.  Nothing left: 'empty'.
 *   7. more than max.cp code points or max.bytes UTF-8 bytes: 'long' (refused, never cut: the sender sees why).
 * The result is plain text: the client only ever shows it with textContent; no markup, link or format is interpreted anywhere. */
'use strict';
const TEXT = { cp: 160, bytes: 600 };                                     // a chat line (the WebSocket reader takes text frames under 1,400 bytes)
const NICK = { cp: 20, bytes: 60 };
const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const BREAK = /[\t\n\v\f\r\u0085\u2028\u2029]/g;
// eslint-disable-next-line no-control-regex
const HIDDEN = /[\u0000-\u001F\u007F-\u009F\u061C\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB\uFFFE\uFFFF]|\uDB40[\uDC00-\uDC7F]/g;
const MARKS = /(\p{M}{4})\p{M}+/gu;

function cleanText(v, max = TEXT) {
  if (typeof v !== 'string') return { ok: false, why: 'bad' };
  if (v.length > max.cp * 4) return { ok: false, why: 'long' };
  if (LONE.test(v)) return { ok: false, why: 'bad' };
  let s = v.normalize('NFC').replace(BREAK, ' ');
  let hidden = 0;
  s = s.replace(HIDDEN, () => { hidden++; return ''; });
  if (hidden > 4) return { ok: false, why: 'bad' };
  s = s.replace(MARKS, '$1').replace(/\s+/gu, ' ').trim();
  if (!s) return { ok: false, why: 'empty' };
  let cp = 0; for (const _ of s) cp++;                                    // code points, not UTF-16 units
  if (cp > max.cp || Buffer.byteLength(s, 'utf8') > max.bytes) return { ok: false, why: 'long' };
  return { ok: true, text: s };
}
function cleanNick(v) { const r = cleanText(v, NICK); return r.ok ? r.text : 'wanderer'; }

module.exports = { TEXT, NICK, cleanText, cleanNick };
