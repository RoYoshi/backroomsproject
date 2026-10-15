/** @part public/world.js,generated/server/world.js - S.P.A.C.E.: the shared movement and noise constants (the client moves, the server listens); a module: worldMove
 * A module (continuation C3b, M-024): M8's part inside its factory, worldMove. Its parameter is what it takes from the modules made
 * before it, by giver; its return is what later modules take from it. world.compose.js makes it. Every line is M8's.
 * imports: head { W }
 * exports: -
 * provides: worldMove
 * uses: -
 * writes: -
 */
  function worldMove({ head: { W } }) {
  /* shared movement / noise constants (the client moves, the server listens) */
  W.MOVE = {
    walk: 172, run: 285, crouch: 92, crawl: 54, exhaustedWalk: 148, radius: 15,
    staminaDrainRun: 10.5, staminaRegen: { stand: 24, crouch: 17, walk: 9, crouchWalk: 10, crawl: 8 },
    exhaustAt: 0, recoverAt: 36, exhaustedAcc: .62, slideMin: 135, slideEnd: 62, slideCd: .7, slideCost: 6,
    vault: { fast: { t: .3, cost: 8 }, normal: { t: .46, cost: 2.5 }, slow: { t: .8, cost: 0 } },
  };
  /* the state numbers sent over the network */
  W.S = { stand: 0, walk: 1, run: 2, crouch: 3, crawl: 4, slide: 5, vault: 6, down: 7 };
  W.SN = ['stand', 'walk', 'run', 'crouch', 'crawl', 'slide', 'vault', 'down'];
  /* how loud each state is: radius in px at which an average entity notices it in open air */
  W.NOISE = { stand: 0, walk: 240, run: 640, crouch: 0, crouchMove: 85, crawl: 95, slide: 460, vaultFast: 520, vaultNormal: 360, vaultSlow: 170, light: 120, pick: 200, land: 420, exhaled: 300 };
  /* how high a body is off the floor (1 = upright).  lunges pass over low profiles */
  W.PROFILE = { stand: 1, walk: 1, run: 1, crouch: .62, crawl: .4, slide: .42, vault: .9, down: .3 };

  }
