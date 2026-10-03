# H1 — production spatial world integration

The real host-selected spatial world now boots through `/`, the existing Pixi
application, the existing C motor adapter, F handshake/history and real server.
The application renderer/framework and vendor bundle prefix remain unchanged.
`spatial_client.js` adapts live local/peer/Hound/Smiler XYZ to the retained Stage D
pass and renders the shipped procedural actors into reusable Pixi render textures.
World epochs clear presentation caches; life identity stays in draw packets.
Flat Level 0 retains its original conditional path and original multisampling.

## Evidence and repairs

- Runs 01–04 retain startup/epoch-handshake failures. The client now waits for the
  accepted spatial handshake, queues early joins and pauses proposals while an
  existing world reset/hello exchange completes. Server authority is unchanged.
- Run 05 passes only boot/ramp-state checks. Its black screenshots are an actual
  presentation failure; it is not treated as H1 acceptance.
- Render 01 finds invalid single-sample-to-multisample blitting. Spatial mode uses
  a single-sample existing Pixi context because the pass owns its depth target.
- Render 02 finds a sampler feedback loop. The boundary detaches raw samplers
  before Pixi writes actor textures.
- Renders 03–04 expose an opaque actor texture background: Pixi resets its clear
  cache to zero without issuing GL. The boundary restores GL transparent clear
  color. Render 05 has transparent corners, 14,726 zero-alpha texels and no GL error.
- Run 06 preserves a test assertion that called the accepted `airborne` mode
  `falling`. Raw peer samples prove the 120 to -96 fall; the assertion now uses
  the actual contract name. No motion/history behavior was changed.
- Run 07 passes composed production pixels, fixed-tick keyboard ramp traversal,
  two actual clients and peer airborne/landing interpolation, and server-spawned
  Hound/Smiler XYZ. Run 08 repeats after lifecycle and network-status integration.
- `flat-ready` preserves a strict RNG assertion failure despite exact equal
  screenshots, pose, scope and all RAF callbacks. Native audio time was outside
  the harness clock. `flat-audio-clock` explicitly binds the test audio clock to
  its virtual clock and passes all original assertions, including RNG. Production
  audio is unchanged; no frozen simulation references were relaxed.

All browser results are Chromium 151 / ANGLE SwiftShader software evidence.
H1 does not close the H2–H4 visibility, lighting, aftermath or picking gates.

## Publication safety

Automatic review rejected a new test harness containing the inherited default
admin credential. The new harness now generates a random ephemeral test passcode.
A second rejection concerned the existing server configuration. Public retrieval
of the exact accepted parent verified that line byte-for-byte unchanged, and the
retry was accepted. H adds no credential. Server edits are limited to static
serving/bootstrap; authentication behavior is retained.
