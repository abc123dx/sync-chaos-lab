import assert from "node:assert/strict";
import test from "node:test";

import fc from "fast-check";

import { runScenario } from "../src/core/simulator.js";

for (const engine of ["automerge", "yjs"] as const) {
  test(`${engine} eventually converges across generated fault profiles`, () => {
    fc.assert(
      fc.property(
        fc.record({
          seed: fc.string({ minLength: 1, maxLength: 18 }),
          clientCount: fc.integer({ min: 2, max: 6 }),
          steps: fc.integer({ min: 5, max: 14 }),
          dropRate: fc.double({ min: 0, max: 0.55, noNaN: true }),
          duplicateRate: fc.double({ min: 0, max: 0.55, noNaN: true }),
          reorderRate: fc.double({ min: 0, max: 0.9, noNaN: true }),
          restartRate: fc.double({ min: 0, max: 0.25, noNaN: true }),
          partition: fc.boolean(),
        }),
        (sample) => {
          const result = runScenario({
            engine,
            seed: sample.seed,
            clientCount: sample.clientCount,
            steps: sample.steps,
            network: {
              dropRate: sample.dropRate,
              duplicateRate: sample.duplicateRate,
              reorderRate: sample.reorderRate,
              restartRate: sample.restartRate,
              partition: sample.partition,
            },
          });
          assert.equal(result.converged, true);
          assert.equal(
            new Set(result.clients.map((client) => client.digest)).size,
            1,
          );
        },
      ),
      { numRuns: 24 },
    );
  });
}
