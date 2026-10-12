# Light lifecycle, rerun after the regression: check 4b counted only the other wanderers' lights

This run passed checks 1–4 with no unplanned death. Its check 4b ("the victim's own screen after a world reset: no dead light") reported
that it held. But it counted only the dead lights of other wanderers on her screen (`__peerLights`), not her own dying light.

Her own death played on after the reset, and its light was lit until 4.6 s after it (`aliceLastLit` 1791826377.289 against the reset at
1791826372.694), failing on its normal schedule. The independent review of the documents found the contradiction.

In HQ1-4 the check counts her own light too, and the light lifecycle was run again (`../../hq1/light_lifecycle.json`). 4b is recorded as
known (a D7 behaviour, like the wall stain's 8b), not as holding.
