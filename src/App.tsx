import {
  type CSSProperties,
  type FormEvent,
  useMemo,
  useState,
} from "react";

import { renderHtmlReport, serializeResult } from "./core/report.js";
import {
  DEFAULT_SCENARIO,
  runScenario,
} from "./core/simulator.js";
import type {
  EngineName,
  EventTone,
  NetworkConfig,
  SimulationResult,
} from "./core/types.js";

type FaultProfile = "calm" | "field" | "hostile";
type TraceFilter = "all" | EventTone;

const PROFILES: Record<FaultProfile, NetworkConfig> = {
  calm: {
    dropRate: 0.04,
    duplicateRate: 0.03,
    minDelay: 1,
    maxDelay: 2,
    reorderRate: 0.12,
    restartRate: 0.03,
    partition: true,
  },
  field: { ...DEFAULT_SCENARIO.network },
  hostile: {
    dropRate: 0.28,
    duplicateRate: 0.24,
    minDelay: 1,
    maxDelay: 6,
    reorderRate: 0.68,
    restartRate: 0.14,
    partition: true,
  },
};

const FILTERS: Array<{ label: string; value: TraceFilter }> = [
  { label: "All events", value: "all" },
  { label: "Faults", value: "fault" },
  { label: "Warnings", value: "warn" },
  { label: "Recovery", value: "ok" },
];

function safeFilename(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40) || "run";
}

function download(
  filename: string,
  contents: string,
  mediaType: string,
): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mediaType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function topologyPosition(
  index: number,
  total: number,
): CSSProperties {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    left: `${50 + Math.cos(angle) * 37}%`,
    top: `${50 + Math.sin(angle) * 34}%`,
  };
}

function Metric({
  accent,
  label,
  value,
}: {
  accent?: boolean;
  label: string;
  value: string | number;
}) {
  return (
    <div className={accent ? "metric metric--accent" : "metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResultTopology({ result }: { result: SimulationResult }) {
  const expectedDigest = result.clients[0]?.digest;
  return (
    <div className="topology" aria-label="Final replica topology">
      <div className="topology__grid" />
      <div className="topology__pulse topology__pulse--one" />
      <div className="topology__pulse topology__pulse--two" />
      <div className="topology__hub">
        <span>recovery</span>
        <strong>{result.converged ? "SYNCED" : "DRIFT"}</strong>
        <code>{result.fingerprint.slice(3)}</code>
      </div>
      {result.clients.map((client, index) => (
        <article
          className="replica-node"
          style={topologyPosition(index, result.clients.length)}
          key={client.id}
        >
          <div className="replica-node__head">
            <span className="status-dot" />
            <span>{client.id}</span>
          </div>
          <strong>{client.snapshot.counter}</strong>
          <small>
            {client.digest === expectedDigest ? "same digest" : "drift detected"}
          </small>
        </article>
      ))}
    </div>
  );
}

export default function App() {
  const [engine, setEngine] = useState<EngineName>("automerge");
  const [seed, setSeed] = useState(DEFAULT_SCENARIO.seed);
  const [clientCount, setClientCount] = useState(
    DEFAULT_SCENARIO.clientCount,
  );
  const [profile, setProfile] = useState<FaultProfile>("field");
  const [partition, setPartition] = useState(true);
  const [traceFilter, setTraceFilter] = useState<TraceFilter>("all");
  const [runNumber, setRunNumber] = useState(1);
  const [result, setResult] = useState(() => runScenario(DEFAULT_SCENARIO));

  const visibleEvents = useMemo(
    () =>
      result.events
        .filter(
          (event) => traceFilter === "all" || event.tone === traceFilter,
        )
        .slice(-36)
        .reverse(),
    [result, traceFilter],
  );

  function runExperiment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const network = { ...PROFILES[profile], partition };
    setResult(
      runScenario({
        engine,
        seed,
        clientCount,
        steps: profile === "hostile" ? 30 : 24,
        network,
      }),
    );
    setTraceFilter("all");
    setRunNumber((value) => value + 1);
  }

  const fileStem = `sync-chaos-${result.config.engine}-${safeFilename(
    result.config.seed,
  )}`;
  const faultCount = result.events.filter(
    (event) => event.tone === "fault",
  ).length;

  return (
    <main className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Sync Chaos Lab home">
          SYNC<span>/</span>CHAOS
        </a>
        <div className="header-meta">
          <span className="live-pill">
            <i />
            deterministic runtime
          </span>
          <code>v0.1.0</code>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero__copy">
          <div className="eyebrow">
            <span>01</span>
            LOCAL-FIRST FAULT LAB
          </div>
          <h1>
            Break the network.
            <br />
            <em>Prove the merge.</em>
          </h1>
          <p>
            A seeded, replayable laboratory for Automerge and Yjs. Inject
            partitions, packet loss, duplication, reordering and replica
            restarts—then verify every independent history reaches the same
            state.
          </p>
        </div>

        <form className="control-deck" onSubmit={runExperiment}>
          <div className="control-deck__head">
            <div>
              <span className="deck-number">RUN / {runNumber.toString().padStart(2, "0")}</span>
              <h2>Experiment controls</h2>
            </div>
            <span className={result.converged ? "verdict verdict--ok" : "verdict verdict--bad"}>
              {result.converged ? "converged" : "diverged"}
            </span>
          </div>

          <fieldset>
            <legend>CRDT engine</legend>
            <div className="segment">
              {(["automerge", "yjs"] as const).map((value) => (
                <button
                  className={engine === value ? "active" : ""}
                  type="button"
                  key={value}
                  onClick={() => setEngine(value)}
                  aria-pressed={engine === value}
                >
                  {value === "automerge" ? "Automerge 3" : "Yjs"}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>Replay seed</span>
            <input
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              minLength={1}
              maxLength={80}
              spellCheck={false}
              required
            />
          </label>

          <div className="control-row">
            <label className="field">
              <span>Fault profile</span>
              <select
                value={profile}
                onChange={(event) =>
                  setProfile(event.target.value as FaultProfile)
                }
              >
                <option value="calm">Calm link</option>
                <option value="field">Field conditions</option>
                <option value="hostile">Hostile network</option>
              </select>
            </label>
            <label className="field field--range">
              <span>
                Replicas <strong>{clientCount}</strong>
              </span>
              <input
                type="range"
                min="2"
                max="10"
                value={clientCount}
                onChange={(event) =>
                  setClientCount(Number(event.target.value))
                }
              />
            </label>
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={partition}
              onChange={(event) => setPartition(event.target.checked)}
            />
            <span className="toggle__track"><i /></span>
            <span>
              <strong>Scheduled partition</strong>
              <small>Split at 29%, heal at 68%</small>
            </span>
          </label>

          <button className="run-button" type="submit">
            <span>Run deterministic experiment</span>
            <i aria-hidden="true">↗</i>
          </button>
        </form>
      </section>

      <section className="results-stage" aria-live="polite">
        <div className="section-title">
          <div>
            <span className="section-index">02 / FINAL TOPOLOGY</span>
            <h2>Independent histories, one digest.</h2>
          </div>
          <div className="export-actions">
            <button
              type="button"
              onClick={() =>
                download(
                  `${fileStem}.json`,
                  serializeResult(result),
                  "application/json",
                )
              }
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() =>
                download(
                  `${fileStem}.html`,
                  renderHtmlReport(result),
                  "text/html",
                )
              }
            >
              Export HTML
            </button>
          </div>
        </div>

        <div className="results-grid">
          <div className="topology-card" key={result.fingerprint}>
            <div className="topology-card__bar">
              <span>
                <i />
                network graph
              </span>
              <code>{result.config.engine} / {result.config.clientCount} nodes</code>
            </div>
            <ResultTopology result={result} />
          </div>

          <aside className="digest-card">
            <div className="digest-card__status">
              <span className="eyebrow-small">CONVERGENCE VERDICT</span>
              <strong>{result.converged ? "PASS" : "FAIL"}</strong>
              <p>
                {result.converged
                  ? `All ${result.clients.length} replicas resolved to ${result.clients[0]?.digest}.`
                  : "Final replica digests do not match."}
              </p>
            </div>
            <div className="digest-card__document">
              <span>Final document</span>
              <h3>{result.clients[0]?.snapshot.title}</h3>
              <dl>
                <div>
                  <dt>Counter</dt>
                  <dd>{result.clients[0]?.snapshot.counter}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{result.clients[0]?.snapshot.notes.length}</dd>
                </div>
                <div>
                  <dt>Rounds</dt>
                  <dd>{result.stats.convergenceRounds}</dd>
                </div>
              </dl>
            </div>
            <code className="digest-code">{result.fingerprint}</code>
          </aside>
        </div>
      </section>

      <section className="metrics-strip">
        <Metric label="Local edits" value={result.stats.localChanges} />
        <Metric label="Delivered" value={result.stats.delivered} />
        <Metric label="Dropped" value={result.stats.dropped} />
        <Metric label="Reordered" value={result.stats.reordered} />
        <Metric label="Duplicated" value={result.stats.duplicated} />
        <Metric
          accent
          label="Recovery"
          value={`${result.stats.convergenceRounds}r`}
        />
      </section>

      <section className="trace-section">
        <div className="section-title section-title--trace">
          <div>
            <span className="section-index">03 / EVENT TRACE</span>
            <h2>The failure story is replayable.</h2>
          </div>
          <div className="trace-summary">
            <span><i className="dot dot--fault" />{faultCount} faults</span>
            <span><i className="dot dot--ok" />{result.stats.delivered} deliveries</span>
            <span><i className="dot dot--warn" />{result.stats.restarts} restarts</span>
          </div>
        </div>

        <div className="trace-layout">
          <aside className="trace-aside">
            <div className="trace-filters" aria-label="Filter event trace">
              {FILTERS.map((filter) => (
                <button
                  className={traceFilter === filter.value ? "active" : ""}
                  key={filter.value}
                  type="button"
                  aria-pressed={traceFilter === filter.value}
                  onClick={() => setTraceFilter(filter.value)}
                >
                  <span>{filter.label}</span>
                  <i>↗</i>
                </button>
              ))}
            </div>
            <div className="replay-contract">
              <span className="eyebrow-small">REPLAY CONTRACT</span>
              <p>
                Same engine + config + seed produces the same event sequence,
                final state and fingerprint.
              </p>
              <code>{result.config.seed}</code>
            </div>
          </aside>

          <ol className="event-list">
            {visibleEvents.map((event) => (
              <li className={`event event--${event.tone}`} key={event.id}>
                <div className="event__tick">T{event.tick.toString().padStart(2, "0")}</div>
                <div className="event__rail"><i /></div>
                <div className="event__content">
                  <span>{event.kind.replaceAll("-", " ")}</span>
                  <strong>{event.summary}</strong>
                  {event.detail && <p>{event.detail}</p>}
                </div>
                <code>{event.messageId ?? event.source ?? "LAB"}</code>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="method-strip">
        <div>
          <span className="section-index">04 / METHOD</span>
          <h2>Real CRDTs. Synthetic network.</h2>
        </div>
        <p>
          The adapters exchange complete binary CRDT state updates so every
          delivery is idempotent and order-independent. The lab exercises real
          Automerge and Yjs merge behavior while keeping the transport model
          deterministic and inspectable.
        </p>
        <div className="method-engines">
          <span>AUTOMERGE 3</span>
          <i>×</i>
          <span>YJS 13</span>
        </div>
      </section>

      <footer>
        <a className="brand" href="#top">SYNC<span>/</span>CHAOS</a>
        <p>Deterministic evidence for local-first systems.</p>
        <code>No telemetry · no external assets</code>
      </footer>
    </main>
  );
}
