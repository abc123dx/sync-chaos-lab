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
    throw new Error(`--${name} expects a number`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${name} expects a finite number`);
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
    throw new Error(`--${name} expects a value`);
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
      throw new Error("--engine must be automerge or yjs");
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
    `${result.converged ? "CONVERGED" : "DIVERGED"} ${result.config.engine} ` +
      `${result.config.clientCount} replicas · ${result.events.length} events · ${result.fingerprint}`,
  );
  console.log(`JSON ${output}`);
  if (!result.converged) process.exitCode = 2;
}

async function replayCommand(path: string | undefined) {
  if (!path) throw new Error("replay expects a JSON report path");
  const previous = parseResult(await readFile(resolve(path), "utf8"));
  const replay = replayScenario(previous);
  console.log(
    `${replay.matches ? "MATCH" : "MISMATCH"} ${previous.fingerprint} → ${replay.result.fingerprint}`,
  );
  if (!replay.matches) process.exitCode = 3;
}

async function reportCommand(
  path: string | undefined,
  options: Map<string, string | boolean>,
) {
  if (!path) throw new Error("report expects a JSON report path");
  const inputPath = resolve(path);
  const result = parseResult(await readFile(inputPath, "utf8"));
  const fallbackName = `${basename(inputPath, extname(inputPath))}.html`;
  const output = resolve(stringOption(options, "output") ?? fallbackName);
  await writeFile(output, renderHtmlReport(result), "utf8");
  console.log(`HTML ${output}`);
}

function help(): string {
  return `Sync Chaos Lab 0.1.0

Usage:
  sync-chaos run [options]
  sync-chaos replay <result.json>
  sync-chaos report <result.json> [--output report.html]

Run options:
  --config <path>       Load a partial scenario JSON file
  --engine <name>       automerge | yjs
  --seed <value>        Deterministic replay seed
  --clients <2..10>     Number of replicas
  --steps <4..500>      Number of local edit ticks
  --drop <0..1>         Random packet-loss rate
  --duplicate <0..1>    Duplicate-delivery rate
  --reorder <0..1>      Reorder-jitter rate
  --restart <0..1>      Replica-restart rate per tick
  --no-partition        Disable the deterministic network split
  --output <path>       JSON output path
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
  throw new Error(`Unknown command: ${parsed.command}\n\n${help()}`);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(
      `sync-chaos: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
