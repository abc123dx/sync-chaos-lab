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
    assert.match(run.stdout, /^CONVERGED automerge 3 replicas/m);

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
      `MATCH ${report.fingerprint} → ${report.fingerprint}`,
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
