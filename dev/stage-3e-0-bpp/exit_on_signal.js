/* Stage 3E-0 B++ (development only): preloaded with `node -r` by net_profile.js so that SIGTERM / SIGINT end the server through
 * process.exit - a normal exit, after which node --cpu-prof writes its profile.  Changes nothing else. */
'use strict';
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => process.exit(0));
