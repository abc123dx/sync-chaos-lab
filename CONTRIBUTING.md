# Contributing

Contributions that improve deterministic replay, add a documented CRDT adapter,
strengthen the fault model or reduce a reproducible convergence bug are
welcome.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Keep changes focused and add a regression seed when fixing simulation behavior.
New adapters must implement the complete `ReplicaAdapter` contract and include
tests for:

1. concurrent edit convergence;
2. duplicate update idempotence;
3. restart persistence;
4. deterministic replay.

## Design rules

- No wall-clock values, random runtime IDs or machine metadata in fingerprints.
- Keep JSON reports backward compatible within a schema version.
- Escape all report content before inserting it into HTML.
- Avoid network calls, telemetry and hidden persistence in the browser lab.
- Document modeling shortcuts and unsupported production behavior.

## Changes

Use a concise commit subject and explain observable behavior changes in the
pull request. Update `CHANGELOG.md` for user-facing features, report-schema
changes or compatibility notes.
