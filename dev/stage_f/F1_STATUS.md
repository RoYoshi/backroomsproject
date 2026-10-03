# F1 handshake / identity / serialization

Shared protocol v1 specifies capabilities, epoch, geometry/schema/hash, motion
revision, integer tick and stable reference tables. Poses retain full precision,
complete support/profile/motion/velocity and finite bounds. Actual server hi now
carries the flat manifest; explicit hello mismatch returns incompatible. No flat
movement behavior changed. Spatial entry/runtime dispatch follows in F2.

PASS: codec cases and real WebSocket hello/mismatch test. The first localhost test
was blocked by sandbox listen EPERM; the identical test passes with permitted local
networking. Raw failure retained. Existing deterministic network traces captured
in a separate output directory; frozen traces untouched.
