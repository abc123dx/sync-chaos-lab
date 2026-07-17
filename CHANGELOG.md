# 更新日志

本项目的所有重要变更都会记录在此文件中。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.1] - 2026-07-17

### 新增

- README、贡献指南、安全策略与更新日志采用中文优先表达。
- React 交互页面、CLI 帮助、状态、错误和单文件 HTML 报告完成汉化。
- 增加独立中文展示层，在不改写原始证据的前提下翻译事件和内置文档内容。
- 增加中文 CLI 与报告文案测试。

### 兼容性

- 保留 `run`、`replay`、`report` 命令、参数名、JSON schema 与 `engine` 值。
- 保留 v0.1.0 模拟证据和 fingerprint 生成逻辑，旧报告仍可跨进程确定性回放。

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

[Unreleased]: https://github.com/abc123dx/sync-chaos-lab/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/abc123dx/sync-chaos-lab/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/abc123dx/sync-chaos-lab/releases/tag/v0.1.0
