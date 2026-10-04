# PART 3B AUTHORITY — MOVEMENT, CAMERA & DEPTH PRESENTATION

## Accepted parent

Repository:
`RoYoshi/backroomsproject`

Accepted Part 3A final source:
`4d1f17a600a10599b848b6db9d02fa16b4f479f0`

Tree:
`c1e0fc5fd84e5fbea412cf3fca7c309243e8de6e`

Immutable Part 3A ZIP:
`PARENT_PART_3A_ACCEPTED.zip`

SHA-256:
`6a498a2e498328ebe8064f1a67b406e5d600e614137438df67a79409bf64bdcf`

Bytes:
`108224116`

Part 3A engineering status is complete. The user has accepted it for continuation
into later Part 3 work, while explicitly identifying presentation behavior that
must be corrected in 3B.

## User presentation intent — LOCKED

The user wants the 2.5D world to communicate height and falling visually.

The camera/presentation should react to player Z so:
- lower surfaces subtly recede/shrink when the player is above them,
- the destination floor visually approaches during a fall,
- upper/lower layers have restrained relative parallax,
- stairs do not look like the camera is snapping tread-by-tread,
- landing has restrained presentation response,
- the player feels vertical motion instead of appearing airborne in a static image.

This is an ILLUSION OF DEPTH, not a change to simulation truth.

## Cutaway / roof behavior — LOCKED

The user does NOT want normal Level 0 rooms blacked out until entry.

Level 0 is one continuous interior.
Ordinary rooms/hallways remain visually continuous and readable.

Surviv.io-style conceal/reveal is reserved for:

1. local crawlspaces / hide-under cover,
2. genuine vertically overlapping floor/slab structures,
3. future genuinely separate buildings (e.g. outside area -> enter a distinct
   building).

A standard Level 0 ceiling is physical simulation geometry but is NOT a room-entry
roof mask.

A local cover/slab may conceal what is beneath it for an outside viewer and locally
fade for the player actually underneath it.

Future separate-building behavior may use whole-building roof groups, but 3B is NOT
authorization to implement future levels or multi-level runtime.

## Absolute law

**SIMULATION TRUTH != PRESENTATION INTERPRETATION**

Part 3B may smooth/project presentation.
It may NOT falsify:
- x/y/z physical position,
- support,
- collision,
- navigation,
- AI evidence,
- light rays,
- sound,
- network authority,
- death physics,
- picking truth.

Part 3B must not create a tactical field-of-view advantage.
