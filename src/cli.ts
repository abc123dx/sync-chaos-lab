#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  parseResult,
  renderHtmlReport,
  serializeResult,
} from "./core/report.js";
import {
  isEngineName,
  replayScenario,
  runScenario,
} from "./core/simulator.js";
import type { ScenarioInput } from "./core/types.js";

type ParsedArguments = {
  command?: string;
  positionals: string[];
  options: Map<string, string | boolean>;
};

function parseArguments(argv: string[]): ParsedArguments {
  const [command, ...rest] = argv;
  const positionals: string[] = [];
  const options = new Map<string, string | boolean>();
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token?.startsWith("--")) {
      if (token) positionals.push(token);
      continue;
    }
    const name = token.slice(2);
    if (name.startsWith("no-")) {
      options.set(name.slice(3), false);
      continue;
    }
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options.set(name, true);
      continue;
    }
    options.set(name, next);
    index += 1;
  }
  return { command, positionals, options };
}

function numberOption(
  options: Map<string, string | boolean>,
  name: string,
): number | undefined {
  const value = options.get(name);
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`--${name} 需要一个数字`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${name} 需要一个有限数值`);
  }
  return parsed;
}

function stringOption(
  options: Map<string, string | boolean>,
  name: string,
): string | undefined {
  const value = options.get(name);
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`--${name} 需要一个参数值`);
  }
  return value;
}

async function scenarioFromOptions(
  options: Map<string, string | boolean>,
): Promise<ScenarioInput> {
  let input: ScenarioInput = {};
  const configPath = stringOption(options, "config");
  if (configPath) {
    input = JSON.parse(await readFile(resolve(configPath), "utf8")) as ScenarioInput;
  }

  const engine = stringOption(options, "engine");
  if (engine) {
    if (!isEngineName(engine)) {
      throw new Error("--engine 必须是 automerge 或 yjs");
    }
    input.engine = engine;
  }
  const seed = stringOption(options, "seed");
  const clients = numberOption(options, "clients");
  const steps = numberOption(options, "steps");
  if (seed !== undefined) input.seed = seed;
  if (clients !== undefined) input.clientCount = clients;
  if (steps !== undefined) input.steps = steps;

  input.network = {
    ...input.network,
    ...(numberOption(options, "drop") !== undefined
      ? { dropRate: numberOption(options, "drop") }
      : {}),
    ...(numberOption(options, "duplicate") !== undefined
      ? { duplicateRate: numberOption(options, "duplicate") }
      : {}),
    ...(numberOption(options, "reorder") !== undefined
      ? { reorderRate: numberOption(options, "reorder") }
      : {}),
    ...(numberOption(options, "restart") !== undefined
      ? { restartRate: numberOption(options, "restart") }
      : {}),
    ...(options.has("partition")
      ? { partition: options.get("partition") !== false }
      : {}),
  };
  return input;
}

function defaultJsonName(engine: string, seed: string): string {
  const safeSeed = seed.replaceAll(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 48);
  return `sync-chaos-${engine}-${safeSeed || "run"}.json`;
}

async function runCommand(options: Map<string, string | boolean>) {
  const result = runScenario(await scenarioFromOptions(options));
  const output = resolve(
    stringOption(options, "output") ??
      defaultJsonName(result.config.engine, result.config.seed),
  );
  await writeFile(output, serializeResult(result), "utf8");
  console.log(
    `${result.converged ? "已收敛（CONVERGED）" : "未收敛（DIVERGED）"} ${result.config.engine} ` +
      `${result.config.clientCount} 个副本 · ${result.events.length} 个事件 · ${result.fingerprint}`,
  );
  console.log(`JSON 报告：${output}`);
  if (!result.converged) process.exitCode = 2;
}

async function replayCommand(path: string | undefined) {
  if (!path) throw new Error("replay 需要一个 JSON 报告路径");
  const previous = parseResult(await readFile(resolve(path), "utf8"));
  const replay = replayScenario(previous);
  console.log(
    `${replay.matches ? "回放一致（MATCH）" : "回放不一致（MISMATCH）"} ${previous.fingerprint} → ${replay.result.fingerprint}`,
  );
  if (!replay.matches) process.exitCode = 3;
}

async function reportCommand(
  path: string | undefined,
  options: Map<string, string | boolean>,
) {
  if (!path) throw new Error("report 需要一个 JSON 报告路径");
  const inputPath = resolve(path);
  const result = parseResult(await readFile(inputPath, "utf8"));
  const fallbackName = `${basename(inputPath, extname(inputPath))}.html`;
  const output = resolve(stringOption(options, "output") ?? fallbackName);
  await writeFile(output, renderHtmlReport(result), "utf8");
  console.log(`HTML 报告：${output}`);
}

function help(): string {
  return `Sync Chaos Lab 中文版 0.1.1

用法：
  sync-chaos run [options]
  sync-chaos replay <result.json>
  sync-chaos report <result.json> [--output report.html]

run 选项：
  --config <path>       载入部分场景配置 JSON 文件
  --engine <name>       automerge | yjs
  --seed <value>        确定性回放种子
  --clients <2..10>     副本数量
  --steps <4..500>      本地编辑逻辑时钟数
  --drop <0..1>         随机丢包率
  --duplicate <0..1>    重复投递率
  --reorder <0..1>      乱序抖动率
  --restart <0..1>      每个逻辑时钟的副本重启率
  --no-partition        关闭确定性网络分区
  --output <path>       JSON 输出路径
`;
}

export async function runCli(argv: string[]): Promise<void> {
  const parsed = parseArguments(argv);
  if (
    !parsed.command ||
    parsed.command === "help" ||
    parsed.options.has("help")
  ) {
    console.log(help());
    return;
  }
  if (parsed.command === "run") {
    await runCommand(parsed.options);
    return;
  }
  if (parsed.command === "replay") {
    await replayCommand(parsed.positionals[0]);
    return;
  }
  if (parsed.command === "report") {
    await reportCommand(parsed.positionals[0], parsed.options);
    return;
  }
  throw new Error(`未知命令：${parsed.command}\n\n${help()}`);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(
      `sync-chaos 错误：${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
