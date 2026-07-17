# Sync Chaos Lab

Deterministic fault injection and convergence evidence for local-first systems.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square)
![Automerge](https://img.shields.io/badge/Automerge-3.3-c8f36b?style=flat-square&labelColor=151714)
![Yjs](https://img.shields.io/badge/Yjs-13.6-f0bf58?style=flat-square&labelColor=151714)
![Tests](https://img.shields.io/badge/tests-34%20passing-c8f36b?style=flat-square&labelColor=151714)
![License](https://img.shields.io/badge/license-MIT-f2efe5?style=flat-square&labelColor=151714)

Sync Chaos Lab runs the same seeded local-first workload against real
[Automerge](https://automerge.org/) and [Yjs](https://docs.yjs.dev/) document
implementations. It introduces partitions, latency, packet loss, duplicate
delivery, reordering and replica restarts, then performs deterministic recovery
and verifies that every replica resolves to the same materialized state.

The repository contains:

- a reusable TypeScript simulation core;
- unified Automerge 3 and Yjs adapters;
- a `run` / `replay` / `report` CLI;
- JSON evidence and self-contained HTML reports;
- an interactive Vite visualization;
- deterministic regression seeds and property-based tests.

## Why this exists

Local-first applications remain writable while offline, so temporary divergence
is expected. The engineering question is whether a specific history of edits and
network faults can be reproduced and whether all replicas eventually converge.

Automerge 3 is designed as a local-first sync engine and significantly reduced
the memory cost of retained document history in its third major release. Yjs
provides shared CRDT types and binary updates for collaborative applications.
This lab provides a small, inspectable place to test the merge behavior of both
engines under the same transport model.

Primary references:

- [Automerge 3.0 release notes](https://automerge.org/blog/automerge-3/)
- [Automerge documentation](https://automerge.org/docs/)
- [Yjs documentation](https://docs.yjs.dev/)
- [Local-first software principles](https://www.inkandswitch.com/essay/local-first/)

## Quick start

Requires Node.js 22.13 or newer.

```bash
npm ci
npm test

npm run cli -- run \
  --engine automerge \
  --seed partition-amber-42 \
  --clients 6 \
  --steps 28 \
  --output run.json

npm run cli -- replay run.json
npm run cli -- report run.json --output run.html
```

Open the interactive lab:

```bash
npm run dev
```

The page can run new seeded scenarios and download both report formats without
network requests or telemetry.

## CLI

### `run`

```text
sync-chaos run [options]
```

Important options:

| Option | Meaning |
| --- | --- |
| `--engine automerge\|yjs` | CRDT adapter |
| `--seed <value>` | deterministic replay seed |
| `--clients <2..10>` | number of replicas |
| `--steps <4..500>` | local edit ticks |
| `--drop <0..1>` | random packet-loss rate |
| `--duplicate <0..1>` | duplicate-delivery rate |
| `--reorder <0..1>` | additional delivery-jitter rate |
| `--restart <0..1>` | replica restart probability per tick |
| `--no-partition` | disable the scheduled network split |
| `--config <file>` | load a partial scenario JSON file |
| `--output <file>` | JSON evidence destination |

Run a checked-in scenario:

```bash
npm run cli -- run \
  --config examples/partition-storm.json \
  --output partition-storm.json
```

### `replay`

`replay` loads the original normalized config, reruns the simulation and
compares the complete result fingerprint:

```bash
npm run cli -- replay partition-storm.json
```

A successful replay prints:

```text
MATCH sc-xxxxxxxx → sc-xxxxxxxx
```

### `report`

```bash
npm run cli -- report partition-storm.json --output partition-storm.html
```

The report is one HTML file with inline CSS, inline filtering behavior and the
complete JSON evidence. It does not require a server or external assets.

## Determinism contract

For a fixed package version, the tuple below determines the trace:

```text
engine + normalized config + seed
```

The seeded generator controls client selection, local operations, delay,
reorder jitter, packet loss, duplication and restarts. Client IDs and Automerge
actor IDs are derived deterministically. Reports deliberately exclude wall
clock time, machine identifiers and random runtime metadata.

The result fingerprint covers:

- normalized scenario configuration;
- every observable simulation event;
- final replica snapshots and digests;
- aggregate delivery and recovery statistics.

## Fault model

The simulator uses discrete logical ticks:

```text
local edit
    │
    ├── encode complete binary CRDT state
    │
    ├── drop / duplicate / delay / reorder
    │
    ├── optional two-way partition
    │
    └── merge at receiving replica
                     │
                     └── forced all-to-all recovery, maximum 3 rounds
```

Replica restart means “persist local CRDT state, create a new deterministic
replica identity, restore state, continue editing.” It does not restore state
from another peer.

The built-in document exercises:

- a conflict-prone title register;
- per-client numeric counters, materialized as a total;
- a concurrently appended note sequence.

## Architecture

```text
src/
├── core/
│   ├── adapters.ts   # Automerge and Yjs implementations
│   ├── random.ts     # seeded PRNG, canonical JSON, fingerprints
│   ├── reducer.ts    # deterministic shortest-prefix reduction
│   ├── report.ts     # JSON schema parsing and self-contained HTML
│   ├── simulator.ts  # fault scheduler, delivery and convergence
│   └── types.ts      # public contracts
├── cli.ts            # run / replay / report
├── App.tsx           # interactive evidence explorer
├── main.tsx
└── styles.css
```

`npm run build` emits:

- the distributable CLI and declarations under `dist/src`;
- the static Vite application under `dist/web`.

## Tests

```bash
npm run typecheck
npm test
npm run build
```

The suite currently contains 34 named tests, including 48 generated fault
profiles across the two engines. Coverage includes:

- seeded PRNG and canonical fingerprints;
- concurrent edit merge behavior;
- duplicate-update idempotence;
- restart persistence;
- partition, total loss and recovery;
- 2- and 10-replica limits;
- byte-for-byte replay determinism;
- report schema, HTML self-containment and injection escaping;
- monotonic shortest-prefix reduction.

## Prefix reduction

`reduceToReproducingPrefix` uses binary search to find the shortest prefix that
still satisfies a monotonic failure predicate. It is useful when a failure
begins at a stable point in a deterministic trace.

This is intentionally not full delta debugging: it does not remove events from
the middle of a trace, and the predicate must remain true as a reproducing
prefix grows.

## Limitations

- The transport sends complete binary CRDT state. It exercises real Automerge
  merge and Yjs update semantics, but not Automerge's incremental sync state
  machine, Yjs providers, awareness messages or production reconnect logic.
- Logical ticks model ordering, not wall-clock scheduling or throughput.
- The built-in operation model is deliberately small and is not an application
  schema fuzzer.
- Convergence is checked within an engine. Automerge and Yjs may legally select
  different winners for concurrent register writes.
- This is a correctness laboratory, not a performance benchmark or security
  assessment.

See [examples/regression-seeds.json](examples/regression-seeds.json) for stable
scenarios intended for future regression suites.

## License

MIT. See [LICENSE](LICENSE).
