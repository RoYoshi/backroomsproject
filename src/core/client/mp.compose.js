/** @part public/mp.js - core: mp.js's composition: it makes each owner's module, hands the session the modules made after it, and closes the wrapper
 * Continuation C3c (M-024). Each module is given what it uses of the modules made before it (the arguments below) and nothing else;
 * what it registers on window or on the session's window.__net it registers itself. The order keeps every moment the page can see:
 * the lamp-failure sound registered (core), then the WebSocket made (the session), the listeners and the observer of the dread's sound,
 * the hover tip and its timer (BR-R), the admin panel's elements, listeners and timers (OVERSEER); window.__net's entries in M8's order
 * (the session's, then L.O.S.T.'s exitLocal, G.I.B.'s peerScreen, OVERSEER's testHum). S.P.A.C.E.'s module, which reads L.O.S.T.'s
 * exit flag, is made after it (at M8 its part came before; it registers nothing the page sees, and nothing runs before the end).
 * The session (B++) handles every message the server sends and calls its owners' functions, and they use the session: it is made
 * first, and wire() hands it the later modules once, here, before the page runs anything (the late wiring the modules check proves).
 * provides: -
 * uses: audioDread, bppSession, brrWanderers, gibDeaths, lostGlitch, mpCore, mpFrame, naniMonsters, overseerAdmin, pocketCartograph,
 *       spacePeers
 * writes: -
 */
/* (C3c) the modules */
const core = mpCore();
const session = bppSession({ core });
const glitch = lostGlitch({ session });
const cartograph = pocketCartograph({ session });
const monsters = naniMonsters({ core, session, glitch, cartograph });
const space = spacePeers({ session, glitch });
const audio = audioDread();
const wanderers = brrWanderers({ session });
const deaths = gibDeaths({ core, session, monsters, wanderers });
const admin = overseerAdmin({ core, session, glitch, cartograph });
mpFrame({ core, session, glitch, cartograph, monsters, audio, deaths, admin });
session.wire({ glitch, cartograph, monsters, space, wanderers, deaths, admin });
})();
