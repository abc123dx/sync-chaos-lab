# Sync Chaos Lab 中文版

面向 Local-first 系统的确定性故障注入与收敛证据实验室。

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square)
![Automerge](https://img.shields.io/badge/Automerge-3.3-c8f36b?style=flat-square&labelColor=151714)
![Yjs](https://img.shields.io/badge/Yjs-13.6-f0bf58?style=flat-square&labelColor=151714)
![Tests](https://img.shields.io/badge/tests-passing-c8f36b?style=flat-square&labelColor=151714)
![License](https://img.shields.io/badge/license-MIT-f2efe5?style=flat-square&labelColor=151714)

Sync Chaos Lab 会在真实的 [Automerge](https://automerge.org/) 与
[Yjs](https://docs.yjs.dev/) 文档实现上运行同一套种子化工作负载。实验会注入
网络分区、延迟、丢包、重复投递、乱序与副本重启，然后执行确定性恢复，并验证
每个副本最终是否得到完全一致的物化状态。

仓库包含：

- 可复用的 TypeScript 模拟核心；
- 统一的 Automerge 3 与 Yjs 适配器；
- 保持兼容的 `run` / `replay` / `report` 命令行工具；
- JSON 证据与完全自包含的中文 HTML 报告；
- 中文交互式 Vite 可视化页面；
- 确定性回归种子与基于属性的测试。

## 为什么需要它

Local-first 应用在离线时仍允许写入，因此短暂分歧是正常现象。真正需要回答的
工程问题是：一段具体的编辑与网络故障历史能否被准确重现，以及所有副本最终
能否重新收敛。

Automerge 3 是为 Local-first 同步设计的引擎，其第三个主版本显著降低了保留
文档历史的内存成本。Yjs 则提供共享 CRDT 类型和二进制更新能力。本实验室用
同一套可检查的传输模型，对两种引擎的合并行为进行测试。

主要参考资料：

- [Automerge 3.0 发布说明](https://automerge.org/blog/automerge-3/)
- [Automerge 文档](https://automerge.org/docs/)
- [Yjs 文档](https://docs.yjs.dev/)
- [Local-first 软件原则](https://www.inkandswitch.com/essay/local-first/)

## 快速开始

需要 Node.js 22.13 或更高版本。

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

启动中文交互页面：

```bash
npm run dev
```

页面可以直接运行新的种子化场景，并下载 JSON 与中文 HTML 两种报告。整个过程
不会发送网络请求，也不包含遥测。

## 命令行工具

命令名和参数名作为稳定接口继续使用英文，帮助信息、状态、错误与报告内容均为
中文优先。

### `run`：运行实验

```text
sync-chaos run [options]
```

常用选项：

| 选项 | 含义 |
| --- | --- |
| `--engine automerge\|yjs` | 选择 CRDT 适配器 |
| `--seed <value>` | 确定性回放种子 |
| `--clients <2..10>` | 副本数量 |
| `--steps <4..500>` | 本地编辑逻辑时钟数 |
| `--drop <0..1>` | 随机丢包率 |
| `--duplicate <0..1>` | 重复投递率 |
| `--reorder <0..1>` | 额外乱序抖动率 |
| `--restart <0..1>` | 每个逻辑时钟的副本重启概率 |
| `--no-partition` | 关闭计划性网络分区 |
| `--config <file>` | 载入部分场景配置 JSON |
| `--output <file>` | 指定 JSON 证据输出位置 |

运行仓库内置场景：

```bash
npm run cli -- run \
  --config examples/partition-storm.json \
  --output partition-storm.json
```

### `replay`：确定性回放

`replay` 会载入原报告中的标准化配置，重新运行模拟，并比较完整的
`fingerprint`：

```bash
npm run cli -- replay partition-storm.json
```

成功时会输出：

```text
回放一致（MATCH） sc-xxxxxxxx → sc-xxxxxxxx
```

### `report`：生成中文报告

```bash
npm run cli -- report partition-storm.json --output partition-storm.html
```

报告是单个 HTML 文件，内含样式、筛选交互与完整 JSON 证据，不需要服务器或
外部资源。

## 兼容性与确定性契约

固定包版本下，下面这组输入决定完整轨迹：

```text
engine + normalized config + seed
```

为保证已有自动化与 v0.1.0 报告继续可用，汉化版保留以下稳定接口：

- `run`、`replay`、`report` 命令及全部参数名；
- JSON 的 `schemaVersion`、键名、`engine` 值和事件代码；
- `sc-xxxxxxxx` fingerprint 格式；
- 模拟核心中的原始证据值与旧版本确定性轨迹。

网页和 HTML 报告会在展示层把事件、状态与内置文档内容转换为中文，嵌入的原始
JSON 不会被改写。因此旧报告仍可跨进程、逐字节地确定性回放。

种子化生成器控制副本选择、本地操作、延迟、乱序抖动、丢包、复制与重启。
客户端 ID 和 Automerge actor ID 也由输入确定。报告会主动排除墙上时钟、
机器标识和运行时随机元数据。

结果 fingerprint 覆盖：

- 标准化场景配置；
- 每一个可观测模拟事件；
- 最终副本快照与摘要；
- 聚合投递和恢复统计。

## 故障模型

模拟器使用离散逻辑时钟：

```text
本地编辑
    │
    ├── 编码完整的二进制 CRDT 状态
    ├── 丢包 / 复制 / 延迟 / 乱序
    ├── 可选的双向网络分区
    └── 在接收副本执行合并
                     │
                     └── 强制全互联恢复，最多 3 轮
```

副本重启的含义是：“持久化本地 CRDT 状态，创建新的确定性副本身份，恢复状态，
继续编辑。”它不会从其他节点拉取状态来替代本地状态。

内置文档会测试：

- 容易产生冲突的标题寄存器；
- 每个客户端独立累加、最终物化为总数的计数器；
- 多方并发追加的记录序列。

## 项目结构

```text
src/
├── core/
│   ├── adapters.ts   # Automerge 与 Yjs 实现
│   ├── locale.ts     # 中文展示层，不改写证据
│   ├── random.ts     # 种子 PRNG、规范 JSON、fingerprint
│   ├── reducer.ts    # 确定性最短前缀缩减
│   ├── report.ts     # JSON schema 解析与自包含中文 HTML
│   ├── simulator.ts  # 故障调度、投递与收敛
│   └── types.ts      # 公共类型契约
├── cli.ts            # run / replay / report
├── App.tsx           # 中文交互式证据浏览器
├── main.tsx
└── styles.css
```

`npm run build` 会生成：

- `dist/src` 下的可分发 CLI 与类型声明；
- `dist/web` 下的静态 Vite 应用。

## 测试

```bash
npm run typecheck
npm test
npm run build
```

测试覆盖：

- 种子 PRNG 与规范 fingerprint；
- 并发编辑合并；
- 重复更新的幂等性；
- 重启后的持久状态；
- 网络分区、完全丢包与恢复；
- 2 个与 10 个副本的边界；
- 跨进程逐字节确定性回放；
- JSON schema、自包含中文 HTML 与注入转义；
- 中文 CLI 帮助、状态与关键报告文案；
- 单调最短前缀缩减。

## 前缀缩减

`reduceToReproducingPrefix` 使用二分查找，寻找仍能触发单调失败条件的最短前缀。
当故障从确定性轨迹中的稳定位置开始时，它可以帮助缩小重现范围。

这不是完整的 delta debugging：它不会删除轨迹中间的事件，而且调用方必须
保证，随着重现前缀增长，判定结果仍保持为真。

## 已知限制

- 传输层发送完整二进制 CRDT 状态。它测试真实的 Automerge 合并与 Yjs 更新
  语义，但不覆盖 Automerge 增量同步状态机、Yjs provider、awareness 消息或
  生产环境重连逻辑。
- 逻辑时钟只模拟顺序，不代表真实时间调度或吞吐量。
- 内置操作模型有意保持精简，不是应用 schema 模糊测试器。
- 收敛只在同一引擎内检查；Automerge 与 Yjs 可能为并发寄存器写入合法地选择
  不同结果。
- 这是正确性实验室，不是性能基准或安全评估工具。

稳定回归场景见
[examples/regression-seeds.json](examples/regression-seeds.json)。

## 许可证

MIT，详见 [LICENSE](LICENSE)。
