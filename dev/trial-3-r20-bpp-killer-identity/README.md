# Trial 3 R20 — B++ killer-identity correction (isolated WIP)

**NOT OWNER-APPROVED. NOT MERGED. NOT DEPLOYED.**

Owner authorized starting the Hound/Smiler kill-visibility correction on a **separate branch**. This branch starts from R20 combined Human QA commit `3a0d7418a8b472e211f45b5f440a421c94e4ddae`. Do not modify the R20 combined, R19, R18, or main branches while completing it.

## Confirmed defect

On R19 and R20 combined, a spectator can see a Hound pack-mate disappear instead of the killer, and the killer drawn twice. The client chose the closest same-species mirror within 240 px of the death source, not the server's actual killer. Smilers use the same unsafe fallback.

## Implemented in this isolated branch

- `src/frameworks/gib/server/death_srv.js`: authenticated server death-replay payload adds **one optional positive safe-integer field, `e`**, the actual killer entity ID, for Hound and Smiler as well as Skin-Stealer. In field order it appears after `c`. Everything else retains its order.
- `src/frameworks/gib/client/mp.deaths.js`: Hound and Smiler death-replay hides select mirrors **by entity ID**. The match is resolved again each frame (slots can change), bounded within 400 px of the death source. Missing, invalid, stale or absent IDs **do not hide a guessed nearby creature**.
- `public/mp.js` and `generated/BUILD_MANIFEST.json`: regenerated the one changed browser output from its 12 declared recipe parts, with validated SHA-256 and the unchanged parts from the parent. The previous compiled output was verified byte-for-byte against its recipe before writing the replacement.
- `dev/stage-3h/gate/protocol_bpp.json`: retains all historical accepted message key orders and adds only the `e` path and the two new death-FX key orders (normal and late `el`). Historical B++ trace fixtures remain unchanged.
- `dev/tests/s_r20rv.js`: updated targeted assertions to require IDs for all three species and no bystander hiding on missing ID.

## Validation performed so far

- GitHub branch exists and is ahead of the R20 combined checkpoint with no changes to that parent.
- Read-back and parse/syntax checks passed for `src/frameworks/gib/client/mp.deaths.js`, `src/frameworks/gib/server/death_srv.js`, `dev/tests/s_r20rv.js`, and the generated `public/mp.js`.
- SHA-256 calculation was checked against a known test vector and the previous manifest; the previous compiled `mp.js` exactly matched the 12 source parts.

**NOT RUN:** `npm test`, `npm run build:check`, the B++ golden/gate suites, and live browser Human QA. This environment does not have an executable checkout of the repository or its locked client packages. Source parsing and build-source equivalence are not substitutes for those checks.

## Remaining engineering gate — DO NOT call this complete

1. Run the focused `node dev/tests/run.js s_r20rv.js` and full `npm test`. Investigate any new failure rather than altering historical expectations indiscriminately.
2. Run `npm run build:check` and `npm run gate`. The historical B++ `srv_golden`/`bpp_golden` comparators may correctly flag the **one intentionally added `e` field**; resolve this with an explicit, tightly bounded allowance for `t:fx, k:death, c:Hound|Smiler`, while preserving comparison of all remaining fields, message timing, and counts. Do not regenerate old B++ golden evidence just to pass.
3. Run browser cases: two Hounds with a closer non-killer, two Smilers, Hound + Smiler + Skin-Stealer, swapped killer, simultaneous kills, every death variant, spectators, own victim, late events and reconnects. Verify exactly one drawn attacker and no bystander hidden. Test slot churn, stale ID, missing ID, and a replay >400 px from the original kill. Ensure the existing Skin-Stealer fix is unchanged.
4. Verify the protocol's **backward compatibility policy**: old server messages without `e` intentionally hide no same-species mirror rather than risking hiding an innocent bystander (so a duplicate attacker might briefly appear under an unsupported older server). Do not claim old-client interoperability until tested.
5. Independently review the branch before any combined Human QA integration. **No merge or deployment** without owner authorization.

The user's **60-minute AFK timeout** is a separate request and is not implemented by this branch.
