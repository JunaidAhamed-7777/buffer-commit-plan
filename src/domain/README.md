# Pure product rules

This directory holds the patch planner, exact text bindings and workspace types. The patch planner validates Unicode ranges and rejects overlapping links before preparing diffs.

Keep these rules independent of Buffer, storage and framework code so they can be tested in isolation.
