# Part 3A external checkpoints

Parent: `106c87015ae8702f452979e0277cbacb5435fa6a`, tree `82be2ca8d031f2d46c70a17b5c14c83689dbf8c8`. Stage I human QA PASS.

P3A0 source commit/tree is recorded by the external checkpoint receipt after push. Later milestones incorporate previous verified receipts. Final identity belongs in the external publication receipt to avoid self-referential source hashes.

- P3A0: `db9078e50e18ab9b43f687decc3c9fb4294e5ed6`; tree `f88d313541e14d7941cf99273bc33076aade8257`.
- P3A1 preservation: `d7ceada47267207a5dd5647e138cb08da493f5af`; tree `9c9cdb3f3cbc2370fe9a79a6906bc2c4f5730449`.
- P3A1 COMPLETE: `b8d327afefeb6ac1431ca341a87e1977bdf5ab05`; tree `e8d6bf1865de6df2bfc127da607cb28995259862`.
- P3A2 COMPLETE: `f587587b327bf3dc5a16f98e3462b9e38a25b457`; tree `da427d785f074801040a365c7aa8dcf11ac15db7`.
- P3A3 preservation: `f33c6b8aa60aa0084302111ab7a91266d9039d09`; tree `d91b2d7886c8d933665e9c0f360654efe74c7ca3`.
- P3A3 COMPLETE: `ed1747e299115df0e0c9e9dc299078eb23516627`; tree `4dd2b27925261100121bf4ed935d76d7fe519888`.

- P3A4 recovery start independently verified: `4bcafa871e40f592ef5480572b55a4f764674558`; tree `358ee808ed9fc1d003ce9319c2a4f13cbc2938a5`.
- P3A4 completed checkpoint: source identity is recorded in the external remote receipt after push, then appended at P3A5.

- P3A4 COMPLETE: `bf68c5ba2c0956c8b7123396475dfc9ddb14fe4b`; tree `2a85e500d2a0790aa9f58d01552a0da8d379eb19`. Remote API, Git fetch and exact-tree verification PASS.

- P3A5 release-tooling preservation: `3ebd1298b0e0b4f46c5ecfa76e64e2418eba7f82`; tree `eee9853d46ba8c1d3b5998b62e2aa40a023ed46b`. No production runtime changes; final regression then executes from an exact fresh extraction.
