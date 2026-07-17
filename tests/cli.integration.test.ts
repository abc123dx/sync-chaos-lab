import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("compiled CLI run report replays exactly in a fresh process", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sync-chaos-cli-"));
  const reportPath = join(directory, "release-smoke.json");
  const cliPath = resolve("dist/src/cli.js");

  try {
    const run = spawnSync(
      process.execPath,
      [
        cliPath,
        "run",
        "--engine",
        "automerge",
        "--seed",
        "release-smoke",
        "--clients",
        "3",
        "--steps",
        "8",
        "--output",
        reportPath,
      ],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 0, run.stderr || run.stdout);
    assert.match(run.stdout, /^已收敛（CONVERGED） automerge 3 个副本/m);

    const replay = spawnSync(
      process.execPath,
      [cliPath, "replay", reportPath],
      { encoding: "utf8" },
    );
    assert.equal(replay.status, 0, replay.stderr || replay.stdout);

    const report = JSON.parse(await readFile(reportPath, "utf8")) as {
      fingerprint: string;
    };
    assert.equal(
      replay.stdout.trim(),
      `回放一致（MATCH） ${report.fingerprint} → ${report.fingerprint}`,
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("compiled CLI help is Chinese-first while command names stay stable", () => {
  const cliPath = resolve("dist/src/cli.js");
  const help = spawnSync(process.execPath, [cliPath, "help"], {
    encoding: "utf8",
  });

  assert.equal(help.status, 0, help.stderr || help.stdout);
  assert.match(help.stdout, /Sync Chaos Lab 中文版 0\.1\.1/);
  assert.match(help.stdout, /用法：/);
  assert.match(help.stdout, /sync-chaos run \[options\]/);
  assert.match(help.stdout, /确定性回放种子/);
});
