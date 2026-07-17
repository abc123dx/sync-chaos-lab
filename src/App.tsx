import {
  type CSSProperties,
  type FormEvent,
  useMemo,
  useState,
} from "react";

import { renderHtmlReport, serializeResult } from "./core/report.js";
import {
  eventDetailZh,
  eventKindLabelZh,
  eventSummaryZh,
  localizeDocumentText,
} from "./core/locale.js";
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
  { label: "全部事件", value: "all" },
  { label: "故障", value: "fault" },
  { label: "警告", value: "warn" },
  { label: "恢复", value: "ok" },
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
    <div className="topology" aria-label="最终副本拓扑">
      <div className="topology__grid" />
      <div className="topology__pulse topology__pulse--one" />
      <div className="topology__pulse topology__pulse--two" />
      <div className="topology__hub">
        <span>恢复状态</span>
        <strong>{result.converged ? "已同步" : "有偏移"}</strong>
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
            {client.digest === expectedDigest ? "摘要一致" : "检测到偏移"}
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
        <a className="brand" href="#top" aria-label="Sync Chaos Lab 中文版首页">
          SYNC<span>/</span>CHAOS
        </a>
        <div className="header-meta">
          <span className="live-pill">
            <i />
            确定性运行时
          </span>
          <code>v0.1.1</code>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero__copy">
          <div className="eyebrow">
            <span>01</span>
            LOCAL-FIRST 故障实验室
          </div>
          <h1>
            打破网络连接，
            <br />
            <em>验证最终合并。</em>
          </h1>
          <p>
            面向 Automerge 与 Yjs 的种子化、可回放实验室。注入网络分区、
            丢包、重复投递、乱序和副本重启，再验证每段独立历史能否到达
            同一状态。
          </p>
        </div>

        <form className="control-deck" onSubmit={runExperiment}>
          <div className="control-deck__head">
            <div>
              <span className="deck-number">运行 / {runNumber.toString().padStart(2, "0")}</span>
              <h2>实验控制台</h2>
            </div>
            <span className={result.converged ? "verdict verdict--ok" : "verdict verdict--bad"}>
              {result.converged ? "已收敛" : "未收敛"}
            </span>
          </div>

          <fieldset>
            <legend>CRDT 引擎</legend>
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
            <span>回放种子</span>
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
              <span>故障配置</span>
              <select
                value={profile}
                onChange={(event) =>
                  setProfile(event.target.value as FaultProfile)
                }
              >
                <option value="calm">平稳链路</option>
                <option value="field">现场网络</option>
                <option value="hostile">恶劣网络</option>
              </select>
            </label>
            <label className="field field--range">
              <span>
                副本数量 <strong>{clientCount}</strong>
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
              <strong>计划性网络分区</strong>
              <small>进度 29% 时分区，68% 时恢复</small>
            </span>
          </label>

          <button className="run-button" type="submit">
            <span>运行确定性实验</span>
            <i aria-hidden="true">↗</i>
          </button>
        </form>
      </section>

      <section className="results-stage" aria-live="polite">
        <div className="section-title">
          <div>
            <span className="section-index">02 / 最终拓扑</span>
            <h2>历史各自独立，最终摘要一致。</h2>
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
              导出 JSON
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
              导出 HTML
            </button>
          </div>
        </div>

        <div className="results-grid">
          <div className="topology-card" key={result.fingerprint}>
            <div className="topology-card__bar">
              <span>
                <i />
                网络拓扑
              </span>
              <code>{result.config.engine} / {result.config.clientCount} 个节点</code>
            </div>
            <ResultTopology result={result} />
          </div>

          <aside className="digest-card">
            <div className="digest-card__status">
              <span className="eyebrow-small">收敛判定</span>
              <strong>{result.converged ? "通过" : "失败"}</strong>
              <p>
                {result.converged
                  ? `全部 ${result.clients.length} 个副本均收敛到 ${result.clients[0]?.digest}。`
                  : "最终副本摘要不一致。"}
              </p>
            </div>
            <div className="digest-card__document">
              <span>最终文档</span>
              <h3>{localizeDocumentText(result.clients[0]?.snapshot.title ?? "")}</h3>
              <dl>
                <div>
                  <dt>计数</dt>
                  <dd>{result.clients[0]?.snapshot.counter}</dd>
                </div>
                <div>
                  <dt>记录</dt>
                  <dd>{result.clients[0]?.snapshot.notes.length}</dd>
                </div>
                <div>
                  <dt>恢复轮次</dt>
                  <dd>{result.stats.convergenceRounds}</dd>
                </div>
              </dl>
            </div>
            <code className="digest-code">{result.fingerprint}</code>
          </aside>
        </div>
      </section>

      <section className="metrics-strip">
        <Metric label="本地编辑" value={result.stats.localChanges} />
        <Metric label="已送达" value={result.stats.delivered} />
        <Metric label="已丢弃" value={result.stats.dropped} />
        <Metric label="已乱序" value={result.stats.reordered} />
        <Metric label="已复制" value={result.stats.duplicated} />
        <Metric
          accent
          label="恢复"
          value={`${result.stats.convergenceRounds} 轮`}
        />
      </section>

      <section className="trace-section">
        <div className="section-title section-title--trace">
          <div>
            <span className="section-index">03 / 事件轨迹</span>
            <h2>每一段故障过程都可以重现。</h2>
          </div>
          <div className="trace-summary">
            <span><i className="dot dot--fault" />{faultCount} 个故障</span>
            <span><i className="dot dot--ok" />{result.stats.delivered} 次送达</span>
            <span><i className="dot dot--warn" />{result.stats.restarts} 次重启</span>
          </div>
        </div>

        <div className="trace-layout">
          <aside className="trace-aside">
            <div className="trace-filters" aria-label="筛选事件轨迹">
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
              <span className="eyebrow-small">回放契约</span>
              <p>
                相同的 engine + config + seed 会生成相同的事件序列、
                最终状态与 fingerprint。
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
                  <span>{eventKindLabelZh(event.kind)}</span>
                  <strong>{eventSummaryZh(event)}</strong>
                  {eventDetailZh(event) && <p>{eventDetailZh(event)}</p>}
                </div>
                <code>{event.messageId ?? event.source ?? "LAB"}</code>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="method-strip">
        <div>
          <span className="section-index">04 / 方法</span>
          <h2>真实 CRDT，合成网络故障。</h2>
        </div>
        <p>
          适配器交换完整的二进制 CRDT 状态更新，因此每次投递都具备幂等性且
          与顺序无关。实验室在保持传输模型确定、可检查的同时，运行真实的
          Automerge 与 Yjs 合并逻辑。
        </p>
        <div className="method-engines">
          <span>AUTOMERGE 3</span>
          <i>×</i>
          <span>YJS 13</span>
        </div>
      </section>

      <footer>
        <a className="brand" href="#top">SYNC<span>/</span>CHAOS</a>
        <p>为 Local-first 系统生成确定性证据。</p>
        <code>无遥测 · 无外部资源</code>
      </footer>
    </main>
  );
}
