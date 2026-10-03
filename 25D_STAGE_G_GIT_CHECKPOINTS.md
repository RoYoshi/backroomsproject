# Stage G external checkpoints

Parent: ba4fd2d63f440aa113722942bcb4861ba665e1f3 (tree 1f33fdd0bfff9ed3268b4fd39648eb4112813199).
Branch: stage-g. main is excluded.

G0 preflight source/evidence ready; commit identity and verified remote SHA are recorded immediately after publication, avoiding a self-referential commit hash.

G0 verified remote: `6d5cc47ed33c1512d20324873fee26d9ec91864e`; tree `b27587438d3395571a0eb60f1c30f8902067a6c0`. Published through authenticated GitHub connector because HTTPS Git has no credentials. Remote ref and fetched tree verified before G1.

G1 verified remote: `9853df3c92ea008609f349b5e0d95fb811abfa80`; tree `a3246cdf97178f88458d65dc4d7d97650627e2d6`. Remote ref and fetched tree verified before continuing.

G2 verified remote: `2672d5bc5408a6c76381e28f880abb85f36c9bd0`; tree `6735ad816518818bb03f3a7e33cf29ad409f7f9a`. Remote ref and fetched tree verified before continuing.

G3 verified remote: `defadec985a09ae74b33d284c5ee050bc787c93b`; tree `77795e7802c5150fddff8f088c582f13c4431d37`. Remote ref and fetched tree verified before continuing.

G4-recovery verified remote: `40e55da0ef404fd97bff5eb47e4c9d8457a09955`; tree `e0d9fe36023b3639e20b2e55e3d4b74514adf543`. Remote ref and fetched tree verified before continuing.

G4 verified remote: `86968bfaacfd7f2210b01985281a4b8304f39301`; tree `02cf17b7819790db9bc5e711104af8b51cd9cd8a`. Remote ref and fetched tree verified before continuing.

G5-recovery verified remote: `fff5d085ff9c87b0d4904cf44e0f438a7793fb56`; tree `79d01890e45ef8c33c26d1a2f3479089c1793f1e`. Remote ref and fetched tree verified before continuing.

G5 final source publication is the commit containing the completed report set,
full regression evidence and package finalizer. Its verified remote SHA/tree are
recorded in the external package verification and released checkpoint report
after pushing, avoiding a self-referential commit identifier. No merge to main;
Stage H has not begun.
