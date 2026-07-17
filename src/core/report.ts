import type {
  EventTone,
  SimulationEvent,
  SimulationResult,
} from "./types.js";

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function eventMarkup(event: SimulationEvent): string {
  return `<li class="event event--${event.tone}" data-tone="${event.tone}">
    <div class="event__rail"><span></span></div>
    <div class="event__time">T${event.tick.toString().padStart(2, "0")}</div>
    <div class="event__body">
      <div class="event__kind">${escapeHtml(event.kind.replaceAll("-", " "))}</div>
      <strong>${escapeHtml(event.summary)}</strong>
      ${event.detail ? `<p>${escapeHtml(event.detail)}</p>` : ""}
    </div>
  </li>`;
}

function clientMarkup(
  client: SimulationResult["clients"][number],
  index: number,
): string {
  return `<article class="replica">
    <div class="replica__top">
      <span class="replica__index">${String(index + 1).padStart(2, "0")}</span>
      <span class="replica__status">synced</span>
    </div>
    <h3>${escapeHtml(client.id)}</h3>
    <code>${escapeHtml(client.digest)}</code>
    <dl>
      <div><dt>Counter</dt><dd>${client.snapshot.counter}</dd></div>
      <div><dt>Notes</dt><dd>${client.snapshot.notes.length}</dd></div>
      <div><dt>Restarts</dt><dd>${client.restartCount}</dd></div>
    </dl>
  </article>`;
}

function toneCount(events: SimulationEvent[], tone: EventTone): number {
  return events.filter((event) => event.tone === tone).length;
}

export function serializeResult(result: SimulationResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function parseResult(text: string): SimulationResult {
  const parsed = JSON.parse(text) as Partial<SimulationResult>;
  if (
    parsed.schemaVersion !== 1 ||
    !parsed.config ||
    !Array.isArray(parsed.events) ||
    !Array.isArray(parsed.clients) ||
    typeof parsed.fingerprint !== "string"
  ) {
    throw new Error("Input is not a Sync Chaos Lab schemaVersion 1 report");
  }
  return parsed as SimulationResult;
}

export function renderHtmlReport(result: SimulationResult): string {
  const embeddedJson = JSON.stringify(result).replaceAll("<", "\\u003c");
  const events = result.events.map(eventMarkup).join("\n");
  const clients = result.clients.map(clientMarkup).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Sync Chaos Lab · ${escapeHtml(result.config.engine)} · ${escapeHtml(result.config.seed)}</title>
  <style>
    :root{--ink:#f4f1e8;--muted:#9c9b92;--panel:#151714;--panel2:#1c1f1a;--line:#30342d;--acid:#c7f36b;--coral:#ff7f66;--amber:#f2c45c;--blue:#77b8ff}
    *{box-sizing:border-box}html{background:#090b09;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    body{margin:0;background:radial-gradient(circle at 80% 5%,rgba(199,243,107,.1),transparent 28rem),#090b09;min-height:100vh}
    code,.mono,.event__time,.eyebrow{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace}
    .shell{width:min(1180px,calc(100% - 32px));margin:auto;padding:32px 0 80px}
    header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:18px}
    .brand{font-weight:800;letter-spacing:-.03em}.brand span{color:var(--acid)}
    .fingerprint{font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:8px 12px}
    .hero{display:grid;grid-template-columns:1.45fr .7fr;gap:32px;align-items:end;padding:70px 0 42px}
    .eyebrow{color:var(--acid);font-size:12px;text-transform:uppercase;letter-spacing:.14em}
    h1{font-size:clamp(44px,7vw,88px);letter-spacing:-.075em;line-height:.88;margin:18px 0 20px;max-width:900px}
    .hero p{font-size:18px;line-height:1.65;color:#b7b8ae;max-width:680px}
    .verdict{border:1px solid ${result.converged ? "rgba(199,243,107,.42)" : "rgba(255,127,102,.5)"};background:${result.converged ? "rgba(199,243,107,.07)" : "rgba(255,127,102,.08)"};padding:24px;border-radius:18px}
    .verdict strong{display:block;font-size:30px;margin-top:8px;color:${result.converged ? "var(--acid)" : "var(--coral)"}}
    .verdict small{display:block;color:var(--muted);margin-top:8px;line-height:1.5}
    .metrics{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid var(--line);border-radius:18px;overflow:hidden;background:var(--panel)}
    .metric{padding:22px;border-right:1px solid var(--line)}.metric:last-child{border:0}.metric span{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}.metric strong{display:block;font-size:32px;margin-top:8px}
    section{margin-top:56px}.section-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:18px}.section-head h2{font-size:28px;letter-spacing:-.04em;margin:0}.section-head p{color:var(--muted);margin:0;font-size:13px}
    .replicas{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.replica{border:1px solid var(--line);background:linear-gradient(145deg,var(--panel2),var(--panel));padding:18px;border-radius:16px}
    .replica__top{display:flex;justify-content:space-between;align-items:center}.replica__index{color:#64675f;font:11px "SFMono-Regular",monospace}.replica__status{font-size:10px;text-transform:uppercase;color:var(--acid);border:1px solid rgba(199,243,107,.3);border-radius:999px;padding:4px 7px}
    .replica h3{font-size:21px;margin:24px 0 7px}.replica code{font-size:11px;color:var(--muted)}dl{display:flex;gap:20px;border-top:1px solid var(--line);padding-top:15px;margin:18px 0 0}dl div{flex:1}dt{font-size:10px;text-transform:uppercase;color:var(--muted)}dd{font:600 16px "SFMono-Regular",monospace;margin:5px 0 0}
    .filters{display:flex;gap:8px;flex-wrap:wrap}.filters button{color:var(--muted);background:transparent;border:1px solid var(--line);border-radius:999px;padding:7px 10px;cursor:pointer}.filters button:hover,.filters button.active{color:#0b0d0b;background:var(--acid);border-color:var(--acid)}
    .timeline{list-style:none;margin:0;padding:0;border:1px solid var(--line);border-radius:18px;background:var(--panel);overflow:hidden}.event{display:grid;grid-template-columns:22px 54px 1fr;gap:10px;min-height:76px;padding:15px 18px;border-bottom:1px solid var(--line)}.event:last-child{border:0}.event[hidden]{display:none}
    .event__rail{position:relative}.event__rail:after{content:"";position:absolute;width:1px;background:var(--line);top:17px;bottom:-32px;left:5px}.event:last-child .event__rail:after{display:none}.event__rail span{display:block;width:11px;height:11px;border-radius:50%;background:var(--blue);margin-top:3px}.event--fault .event__rail span{background:var(--coral)}.event--warn .event__rail span{background:var(--amber)}.event--ok .event__rail span{background:var(--acid)}
    .event__time{font-size:11px;color:var(--muted);padding-top:2px}.event__kind{text-transform:uppercase;color:var(--muted);font-size:10px;letter-spacing:.08em;margin-bottom:6px}.event__body strong{font-size:14px}.event__body p{color:var(--muted);font-size:12px;margin:6px 0 0}
    footer{display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:20px;margin-top:56px;color:var(--muted);font-size:12px}
    @media(max-width:800px){.hero{grid-template-columns:1fr;padding-top:48px}.metrics{grid-template-columns:repeat(2,1fr)}.metric{border-bottom:1px solid var(--line)}.replicas{grid-template-columns:1fr 1fr}.section-head{align-items:start;flex-direction:column;gap:12px}}
    @media(max-width:520px){.shell{width:min(100% - 20px,1180px)}header{align-items:start;gap:12px;flex-direction:column}.replicas{grid-template-columns:1fr}.metrics{grid-template-columns:1fr}.metric{border-right:0}.event{grid-template-columns:18px 42px 1fr;padding:13px 10px}footer{flex-direction:column;gap:8px}}
    @media print{.filters{display:none}.shell{width:100%;padding:16px}body{background:#090b09}}
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div class="brand">SYNC<span>/</span>CHAOS LAB</div>
      <code class="fingerprint">${escapeHtml(result.fingerprint)}</code>
    </header>
    <section class="hero">
      <div>
        <div class="eyebrow">Deterministic local-first experiment</div>
        <h1>Faults happened.<br>State survived.</h1>
        <p>${escapeHtml(result.config.engine)} ran ${result.config.steps} ticks across ${result.config.clientCount} replicas using seed <code>${escapeHtml(result.config.seed)}</code>. The trace includes partitions, packet faults, reordered delivery and replica recovery.</p>
      </div>
      <aside class="verdict">
        <span class="eyebrow">Final verdict</span>
        <strong>${result.converged ? "CONVERGED" : "DIVERGED"}</strong>
        <small>${result.stats.convergenceRounds} deterministic recovery round${result.stats.convergenceRounds === 1 ? "" : "s"} · ${toneCount(result.events, "fault")} fault events observed</small>
      </aside>
    </section>
    <div class="metrics">
      <div class="metric"><span>Local edits</span><strong>${result.stats.localChanges}</strong></div>
      <div class="metric"><span>Delivered</span><strong>${result.stats.delivered}</strong></div>
      <div class="metric"><span>Dropped</span><strong>${result.stats.dropped}</strong></div>
      <div class="metric"><span>Reordered</span><strong>${result.stats.reordered}</strong></div>
      <div class="metric"><span>Restarts</span><strong>${result.stats.restarts}</strong></div>
    </div>
    <section>
      <div class="section-head"><div><div class="eyebrow">Replica ledger</div><h2>Same state, independent histories.</h2></div><p>${escapeHtml(result.clients[0]?.snapshot.title ?? "")}</p></div>
      <div class="replicas">${clients}</div>
    </section>
    <section>
      <div class="section-head">
        <div><div class="eyebrow">Event trace</div><h2>${result.events.length} deterministic events</h2></div>
        <div class="filters" aria-label="Filter trace">
          <button class="active" data-filter="all">All</button>
          <button data-filter="fault">Faults</button>
          <button data-filter="warn">Warnings</button>
          <button data-filter="ok">Recovery</button>
        </div>
      </div>
      <ol class="timeline">${events}</ol>
    </section>
    <footer><span>Generated by Sync Chaos Lab 0.1.0</span><span>No external assets · replay with ${escapeHtml(result.fingerprint)}</span></footer>
  </main>
  <script type="application/json" id="sync-chaos-data">${embeddedJson}</script>
  <script>
    document.querySelectorAll("[data-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        document.querySelectorAll("[data-filter]").forEach(function (item) { item.classList.remove("active"); });
        button.classList.add("active");
        var filter = button.getAttribute("data-filter");
        document.querySelectorAll(".event").forEach(function (event) {
          event.hidden = filter !== "all" && event.getAttribute("data-tone") !== filter;
        });
      });
    });
  </script>
</body>
</html>`;
}
