# P3A1 preservation checkpoint

P3A0 verified remote: `db9078e50e18ab9b43f687decc3c9fb4294e5ed6`, tree `f88d313541e14d7941cf99273bc33076aade8257`.

Base generator creates the original 9216×6912 map with 873 finite solids, 285 floor patches, 285 air regions, 441 portals, 90 preserved lamps, all 12 rooms and 18 props. Repeated serialization equals the generated artifact. Physical compile and clear player spawn pass. Existing Stage D view assertions pass.

Renderer has conservative 768-unit chunk candidates, a complete geometry texture atlas, and deterministic 64-entry candidate pages consumed by nested GPU batch loops. Every candidate page participates in each physical ray; CPU picking remains complete. Dynamic light loops do not truncate at 128. Camera cutaway never changes candidates or physics. Local lamp art avoids processing geometrically out-of-view source anchors.

P3A1 is IN PROGRESS. No vertical content or production spawn-selection change yet. Browser testing is pending environment setup; Playwright's Chrome download returned truncated archives. Raw install failure is preserved. This is not a browser PASS.

New test attempts are retained: build-01 used an unexported helper; base-01 compared unsorted copied definition metadata; base-02 used an invalid radius-zero body; base-03 asked for valid body support inside a retained pillar. These are new harness/generator issues, with raw logs retained. No inherited threshold or frozen reference was changed.

Next: finish focused content and served-browser validation, publish verified P3A1 completion, then start P3A2.
