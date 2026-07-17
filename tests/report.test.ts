import assert from "node:assert/strict";
import test from "node:test";

import {
  parseResult,
  renderHtmlReport,
  serializeResult,
} from "../src/core/report.js";
import { reduceToReproducingPrefix } from "../src/core/reducer.js";
import { runScenario } from "../src/core/simulator.js";

test("JSON reports round-trip without losing evidence", () => {
  const result = runScenario({ seed: "json-round-trip", steps: 10 });
  assert.deepEqual(parseResult(serializeResult(result)), result);
});

test("invalid report schemas are rejected", () => {
  assert.throws(() => parseResult("{}"), /schemaVersion 1/);
  assert.throws(
    () => parseResult('{"schemaVersion":2,"events":[],"clients":[]}'),
    /schemaVersion 1/,
  );
});

test("HTML reports are self-contained and include the fingerprint", () => {
  const result = runScenario({ seed: "html-report", steps: 10 });
  const html = renderHtmlReport(result);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, new RegExp(result.fingerprint));
  assert.match(html, /id="sync-chaos-data"/);
  assert.doesNotMatch(html, /(?:src|href)=["']https?:/);
});

test("HTML report escapes seed content and embedded JSON", () => {
  const result = runScenario({
    seed: '</script><script data-unsafe="true">',
    steps: 8,
  });
  const html = renderHtmlReport(result);
  assert.doesNotMatch(html, /<script data-unsafe="true">/);
  assert.match(html, /&lt;\/script&gt;/);
  assert.match(html, /\\u003c\/script>/);
});

test("prefix reducer finds the shortest monotonic reproducer", () => {
  const trace = ["boot", "edit", "partition", "failure", "cleanup"];
  const reduced = reduceToReproducingPrefix(
    trace,
    (prefix) => prefix.includes("failure"),
  );
  assert.equal(reduced.originalLength, 5);
  assert.equal(reduced.reducedLength, 4);
  assert.deepEqual(reduced.prefix, trace.slice(0, 4));
});

test("prefix reducer rejects traces that do not reproduce", () => {
  assert.throws(
    () => reduceToReproducingPrefix([1, 2, 3], () => false),
    /does not reproduce/,
  );
});
