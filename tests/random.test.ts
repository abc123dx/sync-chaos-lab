import assert from "node:assert/strict";
import test from "node:test";

import {
  createRandom,
  deterministicActorId,
  deterministicClientId,
  fingerprint,
  stableStringify,
} from "../src/core/random.js";

test("seeded random streams are repeatable", () => {
  const left = createRandom("repeat-me");
  const right = createRandom("repeat-me");
  assert.deepEqual(
    Array.from({ length: 20 }, () => left.next()),
    Array.from({ length: 20 }, () => right.next()),
  );
});

test("different seeds produce different streams", () => {
  const left = createRandom("left");
  const right = createRandom("right");
  assert.notDeepEqual(
    Array.from({ length: 8 }, () => left.next()),
    Array.from({ length: 8 }, () => right.next()),
  );
});

test("random integer bounds are inclusive", () => {
  const random = createRandom("integer-bounds");
  const values = Array.from({ length: 300 }, () => random.int(2, 4));
  assert.ok(values.every((value) => value >= 2 && value <= 4));
  assert.ok(values.includes(2));
  assert.ok(values.includes(4));
});

test("stableStringify sorts object keys recursively", () => {
  const left = { z: 1, nested: { y: 2, x: 3 }, a: [2, 1] };
  const right = { a: [2, 1], nested: { x: 3, y: 2 }, z: 1 };
  assert.equal(stableStringify(left), stableStringify(right));
});

test("fingerprints are stable and content sensitive", () => {
  assert.equal(fingerprint({ b: 2, a: 1 }), fingerprint({ a: 1, b: 2 }));
  assert.notEqual(fingerprint({ a: 1 }), fingerprint({ a: 2 }));
  assert.match(fingerprint("evidence"), /^sc-[0-9a-f]{8}$/);
});

test("deterministic actor and client IDs fit engine constraints", () => {
  assert.match(deterministicActorId("client"), /^[0-9a-f]{32}$/);
  assert.equal(
    deterministicActorId("client"),
    deterministicActorId("client"),
  );
  const clientId = deterministicClientId("client");
  assert.ok(Number.isSafeInteger(clientId));
  assert.ok(clientId > 0 && clientId < 0x7fffffff);
});
