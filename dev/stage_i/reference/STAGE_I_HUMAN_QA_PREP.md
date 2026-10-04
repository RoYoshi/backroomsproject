# STAGE I HUMAN QA PREP

Stage I should not intentionally change gameplay feel. Human QA is still required
because final engineering certification cannot prove subjective quality.

## Flat Level 0 control
Play the normal game and confirm:
- movement feels unchanged
- camera feels unchanged
- Hound/Smiler behavior feels unchanged
- lighting/equipment feels unchanged
- death/corpse behavior feels unchanged
- multiplayer/reconnect feels normal

## Spatial fixture control
Use the real Stage H production spatial path and confirm:
- ramps/stairs/falls remain continuous
- cutaway remains readable
- no hidden-state leaks
- aim/interactions remain intuitive
- visible/IR lighting remains coherent
- corpses/gear/effects remain spatially coherent
- two-client independent views still feel correct

## Performance observation
On actual hardware record:
- browser/GPU
- resolution/DPR
- full/reduced quality
- client count
- obvious stutter or long stalls
- any case where Reduced detail is required for acceptable play

Human QA does not need to prove a marketing capacity number.

## Final decision

Stage I decision:
PASS / FAIL / NEEDS FOLLOW-UP

Only after human PASS may the project treat the locked A–I 2.5D infrastructure as
accepted.

That approval still does NOT mean the production 2.5D Level 0 content has been
built. That is the next content phase after Stage I.
