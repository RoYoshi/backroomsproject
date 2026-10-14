# devlog4dev

**What this folder is.** The home for new engineering logs, starting with Stage 3H: findings, recommendations, deferred work and performance baselines that outlive one stage. Stage-specific audits, tools and evidence stay in their stage folder, such as `dev/stage-3h/`.

| File | What it holds |
|---|---|
| `3H_FINDINGS.md` | Confirmed bugs, suspected risks, verified limitations and opportunities, each with an ID (F-…), its location, evidence, severity, player-visible effect, framework, recommendation, risk, disposition and owner |
| `3H_RECOMMENDATIONS.md` | Improvements (R-…), each classed as development-only, refactor, behaviour change or the user's decision. None is authorized by being listed |
| `3H_DEFERRED_WORK.md` | Work that belongs to another stage (3E art, 3F audio, 3G, Stage 4 LogicZ, items, levels, security), with what must happen first |
| `3H_PERFORMANCE_BASELINE.md` | The B++ baseline numbers, how they were measured, their A/A noise, and what a software renderer cannot say |

**Rules:**
- **Nothing here changes the game.** A finding is a record, not a fix.
- **The repository is public.** No passcodes, secrets, tokens, production addresses, exploit details or personal data are written here. Security details go to the user privately.
- **Old reports stay where they are.** The reports in the repository root are cited by path and hash in earlier checkpoints, so Stage 3H1 moved none of them. A later migration needs a path and hash audit, and must be reversible (`3H_RECOMMENDATIONS.md` R-017).
- **IDs are never reused.** A finding that is later fixed keeps its ID and gets a dated disposition line.
