import assert from "node:assert/strict";
import test from "node:test";

import {
  automergeAdapter,
  yjsAdapter,
} from "../src/core/adapters.js";
import { stableStringify } from "../src/core/random.js";
import type { ReplicaAdapter } from "../src/core/types.js";

const adapters: Array<[string, ReplicaAdapter<unknown>]> = [
  ["Automerge", automergeAdapter as ReplicaAdapter<unknown>],
  ["Yjs", yjsAdapter as ReplicaAdapter<unknown>],
];

for (const [name, adapter] of adapters) {
  test(`${name} merges concurrent edits to convergence`, () => {
    let left = adapter.create(`${name}:left`);
    let right = adapter.create(`${name}:right`);
    left = adapter.applyLocal(
      left,
      { kind: "increment", amount: 2 },
      "C1",
    );
    right = adapter.applyLocal(
      right,
      { kind: "append-note", value: "C2 · concurrent note" },
      "C2",
    );
    const leftPayload = adapter.encode(left);
    const rightPayload = adapter.encode(right);
    left = adapter.receive(left, rightPayload);
    right = adapter.receive(right, leftPayload);
    assert.equal(
      stableStringify(adapter.snapshot(left)),
      stableStringify(adapter.snapshot(right)),
    );
    assert.equal(adapter.snapshot(left).counter, 2);
    assert.deepEqual(adapter.snapshot(left).notes, ["C2 · concurrent note"]);
  });

  test(`${name} treats duplicate delivery as idempotent`, () => {
    let sender = adapter.create(`${name}:sender`);
    let receiver = adapter.create(`${name}:receiver`);
    sender = adapter.applyLocal(
      sender,
      { kind: "append-note", value: "exactly-once state" },
      "C1",
    );
    const payload = adapter.encode(sender);
    receiver = adapter.receive(receiver, payload);
    const once = stableStringify(adapter.snapshot(receiver));
    receiver = adapter.receive(receiver, payload);
    assert.equal(stableStringify(adapter.snapshot(receiver)), once);
    assert.deepEqual(adapter.snapshot(receiver).notes, ["exactly-once state"]);
  });

  test(`${name} restart preserves local persisted state`, () => {
    let replica = adapter.create(`${name}:before`);
    replica = adapter.applyLocal(
      replica,
      { kind: "set-title", value: "Restart ledger" },
      "C1",
    );
    replica = adapter.applyLocal(
      replica,
      { kind: "increment", amount: 3 },
      "C1",
    );
    const before = stableStringify(adapter.snapshot(replica));
    replica = adapter.restart(replica, `${name}:after`);
    assert.equal(stableStringify(adapter.snapshot(replica)), before);
  });
}

test("both adapters expose the same materialized snapshot shape", () => {
  const automerge = automergeAdapter.snapshot(
    automergeAdapter.create("shape-a"),
  );
  const yjs = yjsAdapter.snapshot(yjsAdapter.create("shape-y"));
  assert.deepEqual(Object.keys(automerge).sort(), Object.keys(yjs).sort());
  assert.deepEqual(automerge, yjs);
});
