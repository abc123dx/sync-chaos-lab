# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Keep Automerge change metadata independent of wall-clock time so reports
  replay byte-for-byte across separate CLI processes.

## [0.1.0] - 2026-07-17

### Added

- Deterministic discrete-tick network simulator for 2–10 replicas.
- Unified Automerge 3 and Yjs adapters backed by real CRDT state.
- Packet loss, duplicate delivery, latency, reordering, partition and restart
  faults.
- Seeded replay fingerprints and automatic post-fault convergence validation.
- `run`, `replay` and `report` CLI commands.
- Self-contained HTML and structured JSON evidence.
- Interactive Vite topology and event-trace explorer.
- Monotonic shortest-prefix reducer with documented limits.
- Example scenarios, regression seeds and property-based tests.

[Unreleased]: https://github.com/abc123dx/sync-chaos-lab/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/abc123dx/sync-chaos-lab/releases/tag/v0.1.0
