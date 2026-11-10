# Tests

Use `npm test` for unit and integration tests and `npm run test:e2e` for the sample browser workflow. [Setup](../docs/development/getting-started.md#checks)

- unit: deterministic patch planning, binding and review rules; no network.
- integration: server authorization, persistence and controlled provider adapter behavior.
- e2e: sample workflow in Chromium.
- fixtures: synthetic, non-sensitive example inputs only.

Use the [acceptance matrix](../docs/engineering/validation.md) for remaining cases. Live test drafts and credentials require their own authorization.
