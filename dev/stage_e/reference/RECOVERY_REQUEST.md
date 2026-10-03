# THE FAR BACKROOMS — 2.5D STAGE E
## CODEx CLOUD RECOVERY + IMPLEMENTATION

Continue **2.5D Stage E — Surface Navigation & Sensors** in the connected GitHub repository:

`RoYoshi/backroomsproject`

This is a **regular coding task**, not an onboarding/setup task.

You ARE authorized to modify application source and tests as required by the Stage E specification.

Do not begin Stage F.

---

# WORKING BRANCH

Use the existing branch:

`stage-e`

Do NOT create another branch unless explicitly required.

The branch was prepared from the accepted Stage D state.

Current prepared Stage D base commit:

`478ada6cf534d40810e28709755e88f0b53b6ee5`

Before editing:

- switch to `stage-e`
- fetch/pull the current remote state safely
- report current commit SHA
- report `git status --short`
- confirm there is no unexpected uncommitted work
- preserve all existing files

Do not reset, clean, force-push, or discard work.

---

# RUNTIME

Use Node.js:

`v25.9.0`

Ensure every shell execution context uses:

`/workspace/.runtime/node25/bin`

at the beginning of PATH.

Example:

`export PATH=/workspace/.runtime/node25/bin:$PATH`

Confirm:

`node --version`

returns:

`v25.9.0`

before implementation or validation commands.

Node 25.9.0 is the active implementation/test/deployment runtime.

Historical 2.5D evidence from Node 24.19.0 remains frozen historical evidence.

Do not regenerate historical traces merely because Node/V8 serialization differs slightly.

---

# AUTHORITATIVE MATERIALS

Read and obey, in this order where available:

1. `/workspace/stage-e-reference/HANDOFF.md`
2. `README_FIRST.txt`
3. `STAGE_E_MASTER_PROMPT.txt`
4. `CURRENT_STATUS_AND_AUTHORITY.md`
5. `STAGE_D_ACCEPTANCE.md`
6. `THE_FAR_BACKROOMS_2_5D_WORLD_ARCHITECTURE.md`

Treat the supplied Stage D ZIP as the immutable parent/reference artifact.

The Stage E master prompt remains authoritative for technical scope.

This recovery prompt adds the durable Git checkpoint policy and defines E0–E5.

If anything conflicts, preserve the locked 2.5D architecture and Stage E scope. Do not expand into Stage F.

---

# CORE STAGE E RULE

**THE ENTITY PREDICTS. IT DOES NOT KNOW.**

The physical simulation/navigation system may know world geometry.

The entity brain may only use information legitimately obtained through:

- sight
- hearing
- contact
- remembered observations
- authorized evidence
- existing legitimate inter-entity communication

Do not leak hidden player:

- exact Z
- support ID
- floor
- hidden route
- velocity
- position
- destination

into entity decision-making simply because the simulation knows it.

If two scenarios provide identical legitimate evidence and identical RNG state, entity decisions and RNG consumption must remain identical until legitimate evidence differs.

This is a hard acceptance gate.

---

# STAGE E PURPOSE

Upgrade the existing flat entity navigation/sensor architecture to operate correctly in the 2.5D spatial world.

Preserve the existing Hound and Smiler brains.

Do NOT replace A* with unrestricted XYZ steering.

Evolve navigation into:

**NavSurface + TraversalLink**

The same XY coordinate may belong to multiple distinct navigable surfaces at different elevations.

Example:

`LowerFloor:(10,15)`

and

`UpperFloor:(10,15)`

must be distinct navigation states.

Never use an implicit:

`highest floor at XY`

shortcut.

---

# EXISTING NAVIGATION TO PRESERVE

Retain existing behavior where applicable:

- A*
- approximately 48-unit grid
- 8-neighbor navigation
- no diagonal corner cutting
- clearance classes/checks
- wall-distance costs
- route smoothing
- route commitment
- steering
- vault/traversal concepts
- species-specific traversal abilities

Stage E extends this architecture; it does not replace it.

---

# NAVSURFACE

Introduce deterministic navigable surface identity derived from canonical world geometry.

A NavSurface must support:

- local navigation cells
- support/elevation context
- clearance
- slope/traversability
- connectivity
- deterministic reconstruction

Vertically stacked surfaces must remain distinct.

---

# TRAVERSALLINK

Explicitly connect surfaces through legal traversal.

Support at minimum where physically appropriate:

- ramps
- stairs
- valid steps
- vaults
- crawl passages
- one-way drops

TraversalLink capability requirements must be explicit.

Different species may have different traversal capabilities.

Do not make every entity capable of every traversal.

---

# REAL MOTION PROOF

A graph route is not sufficient proof.

Representative routes must physically succeed through the actual Stage C movement/support kernel.

Prove at least:

- staircase traversal
- ramp traversal
- stacked-floor route
- legal step/seam transitions
- relevant one-way traversal

No teleporting.

No Z snapping.

No unrelated support selection.

---

# KNOWN SUPPORT-SEAM ISSUE

The failed previous Astra Stage E run discovered this legitimate case:

At the top staircase tread / landing transition, the actor footprint may overlap more than one legitimate support patch.

Requiring one exact support patch ID rejected a physically valid transition.

Reimplement the correct behavior from first principles.

Required behavior:

- accept physically continuous support across legitimate overlapping seam candidates
- retain deterministic contextual support selection
- do not select unrelated upper surfaces
- do not teleport or snap
- do not globally weaken support correctness merely to make the staircase pass

Add a focused regression test.

The previous implementation files were lost.

Do not invent or claim to reproduce unavailable source code.

---

# SPATIAL PERCEPTION

## Sight

Use real XYZ physical occlusion.

Walls, floors, ceilings, and vertical separation must matter.

Identical XY does not imply visibility.

## Gaze / Eye Contact

Hound eye contact must not work:

- through floors
- through ceilings
- through opaque blocking geometry

Preserve existing rule:

Eye contact may delay pre-pursuit behavior but must never cancel committed pursuit.

## Contact / Capture

No cross-floor capture.

XY overlap alone must not count as physical contact.

## Visible Light

Visible lighting may legitimately affect perception.

Do not leak hidden player state through lighting APIs.

## IR

**IR IS INVISIBLE TO AI.**

Do not expose player IR to Hounds, Smilers, or generic entity perception.

---

# SOUND

Sound becomes spatial but must preserve uncertainty.

Do not automatically give an entity:

- exact hidden source Z
- exact support ID
- exact hidden floor

unless legitimate sensory evidence actually provides that information.

Ambiguous above/below sound must remain ambiguous.

Add deterministic tests for stacked-floor sound uncertainty.

---

# HOUND

Use the actual existing Hound brain.

Do not create a simplified Stage E fixture brain as a substitute.

Preserve:

- pursuit
- prediction
- evidence/memory
- route commitment
- search behavior
- eye-contact rule
- multiplayer behavior
- pack/group boundaries

Make them spatially correct.

Test at minimum:

- same-surface pursuit
- stair pursuit
- ramp pursuit
- player occluded by floor
- player lost before upper/lower choice
- stale remembered elevation
- cross-floor capture rejection
- traversal interruption/replanning
- valid one-way traversal where capability allows

---

# SMILER

Use the real existing Smiler behavior.

Do not turn Smiler into Hound-like generic navigation.

Preserve existing canon/project restrictions.

IR remains invisible.

Existing SM01 baseline status must be reported honestly.

Do not weaken tests to eliminate inherited failures.

---

# PACK / GROUP BEHAVIOR

Make existing group behavior spatially legitimate.

Do not create a hive mind.

Exact hidden simulation truth must not propagate merely because one entity exists on another floor.

Test entities distributed across multiple stories/elevations.

---

# LOD / SLEEP

Existing entity LOD/sleep logic must not:

- snap entities between elevations
- sleep them midway through traversal
- mishandle airborne entities
- break stair/ramp traversal
- teleport through support transitions

Test traversal/fall states explicitly.

---

# LEVEL 0

Do not redesign Level 0 simply to demonstrate Stage E.

Preserve normal Level 0 behavior.

Use synthetic fixtures for:

- stacked floors
- stairs
- ramps
- drops
- crawl routes
- vertical perception cases

---

# FIXED TIMESTEP

Preserve:

- gameplay simulation = 60 Hz fixed timestep
- 1/60 simulation tick
- maximum 15 catch-up steps
- 250 ms clamp
- render FPS never changes gameplay behavior

---

# HARD HIDDEN-ELEVATION TEST

Create a deterministic anti-cheating test.

Prepare two runs with identical:

- entity state
- RNG seed/state
- known history
- visible evidence
- audible evidence
- timing
- geometry

After losing the player:

### Run A
Player secretly takes upper route.

### Run B
Player secretly takes lower route.

Until legitimate evidence differs:

- entity decisions must remain identical
- RNG consumption must remain identical
- investigation behavior must remain identical
- belief/memory state must remain equivalent

The test must fail if hidden player Z, support, route, velocity, or exact simulation state leaks into decision-making.

---

# E0–E5 DURABLE CHECKPOINTS

GitHub is the durable workspace.

Do not allow substantial implementation to exist only in the Codex cloud filesystem.

After each checkpoint below:

1. run its focused tests
2. inspect `git diff`
3. commit changes
4. push to remote `stage-e`
5. record the commit SHA
6. only then continue

Do NOT wait until Stage E is complete before pushing.

## E0 — VERIFIED STAGE D PARENT / PREFLIGHT

Current prepared base:

`478ada6cf534d40810e28709755e88f0b53b6ee5`

Confirm:

- Stage D parent/reference integrity
- repository matches expected parent state
- baseline focused tests reproduce expected results
- no unexpected source modifications

E0 may reference the existing Stage D base commit if no implementation files change.

Record the SHA in the final checkpoint report.

---

## E1 — NAVSURFACE + TRAVERSALLINK CORE

Implement and focused-test:

- deterministic NavSurface identity
- stacked-surface distinction
- local nav cells/surface context
- TraversalLink representation
- species/capability restrictions
- integration with existing A*

Commit and push.

Suggested commit:

`Stage E E1: NavSurface and TraversalLink core`

---

## E2 — PHYSICAL SPATIAL ROUTING

Implement and prove:

- stacked-floor routing
- real staircase route
- real ramp route
- physical traversal through `world_motion.js`
- support-seam regression
- relevant one-way traversal
- no teleport/Z snap/support leak

Commit and push.

Suggested commit:

`Stage E E2: spatial routing and traversal proof`

---

## E3 — SPATIAL SENSOR QUERY BOUNDARY

Implement and focused-test:

- XYZ sight
- gaze/eye contact
- contact/capture
- visible lighting
- IR exclusion
- spatial sound
- above/below ambiguity
- cross-floor negative cases

At or before E3 also create:

`thefarbackrooms-level0-25d-stageE-WORKING-CHECKPOINT.zip`

Compute its SHA-256.

Verify ZIP integrity.

Commit and push.

Suggested commit:

`Stage E E3: spatial sensor boundaries`

---

## E4 — REAL ENTITY-BRAIN INTEGRATION

Integrate the new navigation/perception boundaries with the real:

- Hound brain
- Smiler brain
- group/pack behavior
- LOD/traversal behavior

Implement and pass the hidden-elevation anti-cheating proof.

No fixture AI may substitute for actual entity behavior.

Commit and push.

Suggested commit:

`Stage E E4: entity spatial integration and anti-cheat`

---

## E5 — REGRESSION CANDIDATE

Before long final validation:

- all focused Stage E suites pass
- no known new regression remains unexplained
- Stage A–D protected boundaries remain intact
- package structure remains correct
- working recovery ZIP exists
- Git branch is clean after checkpoint commit

Commit and push the regression candidate.

Suggested commit:

`Stage E E5: regression candidate`

Only after E5 is safely pushed may the longest full regression/package runs begin.

---

# REQUIRED REGRESSION

At minimum run/reproduce:

- Stage C spatial core
- Stage C adversarial suite
- camera fairness
- FPS/fixed-timestep tests
- Hound suite
- Smiler suite
- shared suite
- human-QA targeted suite
- `ir_net.js`
- Stage D view tests where relevant
- Stage E navigation suite
- Stage E perception suite
- hidden-elevation anti-cheating test
- physical staircase/ramp traversal
- one-way traversal tests
- ambiguous sound tests
- cross-floor capture negative tests
- LOD/traversal tests
- served-package tests
- build reproducibility where required
- frozen flat trace parity
- aggregate simulation suite

Known aggregate baseline:

`151/162`

with 11 documented inherited failures.

Preserve honest reporting for:

- P08 — UNKNOWN / NEEDS INVESTIGATION
- F22 — historical exact-source guard
- SM01 — inherited status
- L5b/L5c randomized historical sensitivity

Do not delete/weaken assertions.

Do not regenerate frozen traces merely to obtain green output.

---

# STARTUP MOTD — SMALL AUTHORIZED SUBTASK

As a minor non-invasive Stage E subtask, add a small custom **The Far Backrooms** server startup/log banner.

This must be presentation-only and must not expand gameplay scope.

Useful output may include:

- THE FAR BACKROOMS
- Node version
- Git branch if safely available
- short commit SHA if safely available
- active server port
- BOOTING status
- ONLINE status

Do NOT log:

- passwords
- access tokens
- secrets
- private environment values
- admin credentials

Do not introduce external dependencies solely for the banner.

---

# FINAL PACKAGE

Produce:

`thefarbackrooms-level0-25d-stageE-surface-navigation-sensors.zip`

Also produce:

- `25D_STAGE_E_SHA256.txt`
- `25D_STAGE_E_PACKAGE_VERIFICATION.json`
- `25D_STAGE_E_REPORT.md`
- `25D_STAGE_E_TEST_SUMMARY.md`
- `25D_STAGE_E_BASELINE_FAILURES.md`
- `25D_STAGE_E_PARITY.md`
- `25D_STAGE_E_CHANGED_FILES.txt`
- `25D_STAGE_E_HUMAN_QA.md`
- `25D_STAGE_E_GIT_CHECKPOINTS.md`

The checkpoint report must list:

- E0 SHA
- E1 SHA
- E2 SHA
- E3 SHA
- E4 SHA
- E5 SHA
- final Stage E SHA

Keep:

`redirect.js`

at project root.

Normal game startup remains:

`node server.js`

Render redirect service remains:

`node redirect.js`

---

# STOP CONDITION

When Stage E is complete:

STOP.

Do not begin Stage F.

Report:

- branch name
- Stage D starting SHA
- E0–E5 checkpoint SHAs
- final commit SHA
- final ZIP SHA-256
- tests passed
- inherited failures
- new regressions if any
- blocked validation if any
- unresolved risks

Do not merge `stage-e` into `main`.

The user will review/test the finished Stage E branch first and will decide when it is authorized to merge.

The goal is not merely green tests.

The goal is:

**existing entities genuinely navigating and perceiving the spatial world without secretly knowing where the player is.**