# QA2 probe_b3, first run in HQ1-3: one timing comparison

`qa2/probe_b3` passed every check but one: "a second visit reads the music from Cache Storage (no download) and is ready sooner".
- The cache part held: the warm visit had 2 cache hits and 0 downloads.
- The timing part did not: the page's ready moment was 5,711 ms on the warm visit against 5,223 ms on the cold one.

That moment waits for the game's scripts, the logo, the fonts and the first frames as well as the music. The menu itself is byte-identical to D7: `index.html`, `assets/ui.js`, the CSS and the music. The game scripts HQ1 changes grow by 21.9 KB in all (uncompressed), loaded once on both visits. The probe passed at D6 and D7.

The probe is run again after the regression, alone, on HQ1 and on the D7 parent (`steps.txt`, `qa2/probe_b3*.json`).
