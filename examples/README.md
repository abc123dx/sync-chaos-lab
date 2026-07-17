# 示例场景

本目录提供可直接运行的确定性故障配置：

- `partition-storm.json`：Automerge 场景，重点施加网络分区、丢包、重复投递与
  高乱序压力；
- `restart-pressure.json`：Yjs 场景，提高副本重启概率，验证本地持久状态恢复；
- `regression-seeds.json`：适合后续回归测试的稳定种子清单。

运行单个场景：

```bash
npm run cli -- run \
  --config examples/partition-storm.json \
  --output partition-storm.json
```

然后执行确定性回放并生成中文单文件报告：

```bash
npm run cli -- replay partition-storm.json
npm run cli -- report partition-storm.json --output partition-storm.html
```

`seed`、`engine`、`clientCount`、`steps` 以及 `network` 内的键名属于稳定 JSON
接口，因此继续保留原有英文代码标识。
