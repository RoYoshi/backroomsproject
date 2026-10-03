# F4 common spatial interpolation

PASS stairs, ramp, drop/landing, explicit teleport, missing transition, unrelated
stacked support hold and unknown-ledge extrapolation hold. The sampler checks
physical clearance and uses shared fixed-tick motion for known steps/flight.
Supported motion reconstructs actual support through continuous support proof.
It keeps eight samples/entity and 100 ms delay / 150 ms bounded extrapolation.
No rendering call mutates physical state. Missing/unreconstructable transitions
hold a valid endpoint; they never draw through a slab.

Actual server plus two shared protocol clients: stair rise 0.0528 -> 12.05, drop
120.034 -> -95.95, 329 sampled draws, zero physical clearance errors, teleport
snap. Deterministic 15/30/60/120/144/240/360 FPS sampling agrees at identical times.
The first schedule harness compared different final delivery endpoints; raw failure
is preserved. Equal endpoints pass the unchanged pose-equality assertion.

Explicit reused h1 fixture: x5000/time60/Z0 -> x1000/time1/Z200; epoch reset removes
old history/clock and rejects old packets. 200 jitter samples cause zero resets.
Per-entity generation/discontinuity clears affected slots; world resets clear all.
Common histories feed mp.js entity consumers and are exposed for later adapters;
full Stage H world presentation remains deferred. Flat interpolation and network
trace captures pass with no modification to frozen baselines.

Conservative holding is intentional when a sparse sample pair lacks a provable
continuous transition: stairs 659/1420 subsamples held, drop 34/240, ramp 104/600
(including exact interval starts). Human QA must assess presentation smoothness.
Stage G not begun. F5 will run complete retained and adversarial gates.
