import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SCENARIO,
  normalizeConfig,
  replayScenario,
  runScenario,
} from "../src/core/simulator.js";

test("default scenario is valid and bounded", () => {
  const config = normalizeConfig();
  assert.deepEqual(config, DEFAULT_SCENARIO);
  assert.ok(config.clientCount >= 2 && config.clientCount <= 10);
});

test("invalid client counts are rejected", () => {
  assert.throws(() => normalizeConfig({ clientCount: 1 }), /between 2 and 10/);
  assert.throws(() => normalizeConfig({ clientCount: 11 }), /between 2 and 10/);
});

test("invalid fault rates are rejected", () => {
  assert.throws(
    () => normalizeConfig({ network: { dropRate: 1.1 } }),
    /between 0 and 1/,
  );
  assert.throws(
    () => normalizeConfig({ network: { restartRate: -0.01 } }),
    /between 0 and 1/,
  );
});

for (const engine of ["automerge", "yjs"] as const) {
  test(`${engine} converges after hostile network faults`, () => {
    const result = runScenario({
      engine,
      seed: `hostile-${engine}`,
      clientCount: 6,
      steps: 18,
      network: {
        dropRate: 0.45,
        duplicateRate: 0.5,
        reorderRate: 0.8,
        restartRate: 0.22,
        partition: true,
      },
    });
    assert.equal(result.converged, true);
    assert.equal(new Set(result.clients.map((client) => client.digest)).size, 1);
    assert.ok(result.stats.dropped > 0);
    assert.ok(result.stats.duplicated > 0);
    assert.ok(result.stats.reordered > 0);
    assert.ok(result.stats.restarts > 0);
  });

  test(`${engine} is byte-for-byte replay deterministic`, () => {
    const first = runScenario({
      engine,
      seed: `replay-${engine}`,
      clientCount: 4,
      steps: 14,
    });
    const second = runScenario(first.config);
    assert.equal(second.fingerprint, first.fingerprint);
    assert.deepEqual(second, first);
    assert.deepEqual(replayScenario(first), { matches: true, result: second });
  });
}

test("different seeds create different traces", () => {
  const left = runScenario({ seed: "trace-left", steps: 12 });
  const right = runScenario({ seed: "trace-right", steps: 12 });
  assert.notEqual(left.fingerprint, right.fingerprint);
  assert.notDeepEqual(left.events, right.events);
});

test("two and ten client boundaries both converge", () => {
  for (const clientCount of [2, 10]) {
    const result = runScenario({
      engine: "yjs",
      seed: `boundary-${clientCount}`,
      clientCount,
      steps: 10,
    });
    assert.equal(result.clients.length, clientCount);
    assert.equal(result.converged, true);
  }
});

test("partition start and healing are visible in the trace", () => {
  const result = runScenario({
    seed: "partition-events",
    clientCount: 5,
    steps: 16,
    network: { partition: true },
  });
  assert.ok(result.events.some((event) => event.kind === "partition-started"));
  assert.ok(result.events.some((event) => event.kind === "partition-healed"));
});

test("partition can be disabled", () => {
  const result = runScenario({
    seed: "no-partition",
    steps: 10,
    network: { partition: false },
  });
  assert.equal(
    result.events.some((event) => event.kind.startsWith("partition-")),
    false,
  );
  assert.equal(result.converged, true);
});

test("100% packet loss still converges through forced recovery", () => {
  const result = runScenario({
    engine: "automerge",
    seed: "total-loss",
    clientCount: 4,
    steps: 10,
    network: {
      dropRate: 1,
      duplicateRate: 0,
      reorderRate: 0,
      restartRate: 0,
      partition: false,
    },
  });
  assert.ok(result.stats.dropped > 0);
  assert.ok(result.stats.convergenceRounds > 0);
  assert.equal(result.converged, true);
});

test("event IDs are unique and monotonically increasing", () => {
  const result = runScenario({ seed: "ordered-events", steps: 12 });
  const ids = result.events.map((event) => event.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [...ids].sort((left, right) => left - right));
});
