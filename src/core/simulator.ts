import { getAdapter } from "./adapters.js";
import {
  createRandom,
  fingerprint,
  stableStringify,
} from "./random.js";
import type {
  EngineName,
  EventKind,
  EventTone,
  NetworkConfig,
  Operation,
  ReplicaAdapter,
  ScenarioConfig,
  ScenarioInput,
  SimulationEvent,
  SimulationResult,
  SimulationStats,
} from "./types.js";

const DEFAULT_NETWORK: NetworkConfig = {
  dropRate: 0.14,
  duplicateRate: 0.12,
  minDelay: 1,
  maxDelay: 4,
  reorderRate: 0.34,
  restartRate: 0.08,
  partition: true,
};

export const DEFAULT_SCENARIO: ScenarioConfig = {
  seed: "field-note-2026",
  engine: "automerge",
  clientCount: 5,
  steps: 24,
  network: DEFAULT_NETWORK,
};

type InternalClient = {
  id: string;
  replica: unknown;
  restartCount: number;
};

type QueuedMessage = {
  dueTick: number;
  id: string;
  payload: Uint8Array;
  recovery: boolean;
  sequence: number;
  source: string;
  target: string;
};

function assertRate(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1`);
  }
}

export function normalizeConfig(input: ScenarioInput = {}): ScenarioConfig {
  const network: NetworkConfig = {
    ...DEFAULT_NETWORK,
    ...input.network,
  };
  const config: ScenarioConfig = {
    ...DEFAULT_SCENARIO,
    ...input,
    seed: String(input.seed ?? DEFAULT_SCENARIO.seed),
    network,
  };

  if (config.engine !== "automerge" && config.engine !== "yjs") {
    throw new Error(`Unsupported engine: ${String(config.engine)}`);
  }
  if (
    !Number.isInteger(config.clientCount) ||
    config.clientCount < 2 ||
    config.clientCount > 10
  ) {
    throw new Error("clientCount must be an integer between 2 and 10");
  }
  if (!Number.isInteger(config.steps) || config.steps < 4 || config.steps > 500) {
    throw new Error("steps must be an integer between 4 and 500");
  }
  assertRate("dropRate", network.dropRate);
  assertRate("duplicateRate", network.duplicateRate);
  assertRate("reorderRate", network.reorderRate);
  assertRate("restartRate", network.restartRate);
  if (
    !Number.isInteger(network.minDelay) ||
    !Number.isInteger(network.maxDelay) ||
    network.minDelay < 0 ||
    network.maxDelay < network.minDelay ||
    network.maxDelay > 100
  ) {
    throw new Error(
      "Network delay must use integers with 0 <= minDelay <= maxDelay <= 100",
    );
  }
  return config;
}

function describeOperation(operation: Operation): string {
  if (operation.kind === "increment") {
    return `incremented the shared counter by ${operation.amount}`;
  }
  if (operation.kind === "append-note") {
    return `appended “${operation.value}”`;
  }
  return `renamed the document to “${operation.value}”`;
}

function createOperation(
  clientId: string,
  tick: number,
  random: ReturnType<typeof createRandom>,
): Operation {
  const roll = random.next();
  if (roll < 0.46) {
    return { kind: "increment", amount: random.int(1, 3) };
  }
  if (roll < 0.82) {
    return {
      kind: "append-note",
      value: `${clientId} · field note ${tick.toString().padStart(2, "0")}`,
    };
  }
  const titles = [
    "Conflict atlas",
    "Edge incident brief",
    "Offline field notes",
    "Recovery ledger",
  ] as const;
  return {
    kind: "set-title",
    value: `${random.pick(titles)} · ${tick}`,
  };
}

function makeStats(): SimulationStats {
  return {
    convergenceRounds: 0,
    delivered: 0,
    dropped: 0,
    duplicated: 0,
    localChanges: 0,
    queued: 0,
    reordered: 0,
    restarts: 0,
    ticks: 0,
  };
}

export function runScenario(input: ScenarioInput = {}): SimulationResult {
  const config = normalizeConfig(input);
  const random = createRandom(`${config.engine}:${config.seed}`);
  const adapter = getAdapter(config.engine) as ReplicaAdapter<unknown>;
  const events: SimulationEvent[] = [];
  const stats = makeStats();
  const clients: InternalClient[] = Array.from(
    { length: config.clientCount },
    (_, index) => {
      const id = `C${index + 1}`;
      return {
        id,
        replica: adapter.create(`${config.seed}:${id}:0`),
        restartCount: 0,
      };
    },
  );
  const queue: QueuedMessage[] = [];
  let eventSequence = 0;
  let messageSequence = 0;
  let queueSequence = 0;
  let partitionActive = false;

  const record = (
    tick: number,
    kind: EventKind,
    tone: EventTone,
    summary: string,
    extra: Partial<Omit<SimulationEvent, "id" | "tick" | "kind" | "tone" | "summary">> = {},
  ) => {
    events.push({
      id: ++eventSequence,
      tick,
      kind,
      tone,
      summary,
      ...extra,
    });
  };

  const clientById = (id: string): InternalClient => {
    const client = clients.find((candidate) => candidate.id === id);
    if (!client) throw new Error(`Unknown client: ${id}`);
    return client;
  };

  const partitionSide = (id: string): number => {
    const index = Number.parseInt(id.slice(1), 10) - 1;
    return index < Math.ceil(config.clientCount / 2) ? 0 : 1;
  };

  const connected = (source: string, target: string): boolean =>
    !partitionActive || partitionSide(source) === partitionSide(target);

  const enqueue = (
    source: InternalClient,
    target: InternalClient,
    tick: number,
    payload: Uint8Array,
    recovery: boolean,
    duplicateOf?: string,
  ) => {
    const messageId = `M${(++messageSequence).toString().padStart(4, "0")}`;
    let delay = recovery
      ? 0
      : random.int(config.network.minDelay, config.network.maxDelay);
    let reorderDetail = "";
    if (!recovery && random.bool(config.network.reorderRate)) {
      const jitter = random.int(1, Math.max(1, config.network.maxDelay + 1));
      delay += jitter;
      stats.reordered += 1;
      reorderDetail = ` · reorder jitter +${jitter}`;
    }
    queue.push({
      dueTick: tick + delay,
      id: messageId,
      payload,
      recovery,
      sequence: ++queueSequence,
      source: source.id,
      target: target.id,
    });
    stats.queued += 1;
    record(
      tick,
      "message-queued",
      recovery ? "ok" : "info",
      `${messageId} queued ${source.id} → ${target.id}`,
      {
        source: source.id,
        target: target.id,
        messageId,
        detail: `${payload.byteLength} bytes · due T${tick + delay}${reorderDetail}${
          duplicateOf ? ` · duplicate of ${duplicateOf}` : ""
        }`,
      },
    );
    return messageId;
  };

  const send = (
    source: InternalClient,
    target: InternalClient,
    tick: number,
    recovery = false,
  ) => {
    if (!recovery && !connected(source.id, target.id)) {
      stats.dropped += 1;
      record(
        tick,
        "message-dropped",
        "fault",
        `Partition blocked ${source.id} → ${target.id}`,
        {
          source: source.id,
          target: target.id,
          detail: "The sender will resynchronize after the partition heals.",
        },
      );
      return;
    }
    if (!recovery && random.bool(config.network.dropRate)) {
      stats.dropped += 1;
      record(
        tick,
        "message-dropped",
        "fault",
        `Packet loss on ${source.id} → ${target.id}`,
        {
          source: source.id,
          target: target.id,
          detail: `dropRate=${config.network.dropRate.toFixed(2)}`,
        },
      );
      return;
    }

    const payload = adapter.encode(source.replica);
    const original = enqueue(source, target, tick, payload, recovery);
    if (!recovery && random.bool(config.network.duplicateRate)) {
      stats.duplicated += 1;
      record(
        tick,
        "message-duplicated",
        "warn",
        `${original} duplicated in transit`,
        {
          source: source.id,
          target: target.id,
          messageId: original,
        },
      );
      enqueue(source, target, tick, payload.slice(), false, original);
    }
  };

  const broadcast = (source: InternalClient, tick: number, recovery = false) => {
    for (const target of clients) {
      if (source.id !== target.id) {
        send(source, target, tick, recovery);
      }
    }
  };

  const deliverUntil = (tick: number) => {
    queue.sort(
      (left, right) =>
        left.dueTick - right.dueTick || left.sequence - right.sequence,
    );
    while (queue.length > 0 && (queue[0]?.dueTick ?? Infinity) <= tick) {
      const message = queue.shift();
      if (!message) break;
      if (
        !message.recovery &&
        !connected(message.source, message.target)
      ) {
        stats.dropped += 1;
        record(
          message.dueTick,
          "message-dropped",
          "fault",
          `${message.id} reached an active partition`,
          {
            source: message.source,
            target: message.target,
            messageId: message.id,
          },
        );
        continue;
      }
      const target = clientById(message.target);
      target.replica = adapter.receive(target.replica, message.payload);
      stats.delivered += 1;
      record(
        message.dueTick,
        "message-delivered",
        message.recovery ? "ok" : "info",
        `${message.id} delivered ${message.source} → ${message.target}`,
        {
          source: message.source,
          target: message.target,
          messageId: message.id,
          ...(message.recovery
            ? { detail: "recovery synchronization" }
            : {}),
        },
      );
    }
  };

  const partitionStart = Math.max(2, Math.floor(config.steps * 0.29));
  const partitionHeal = Math.max(
    partitionStart + 1,
    Math.floor(config.steps * 0.68),
  );

  for (let tick = 1; tick <= config.steps; tick += 1) {
    stats.ticks = tick;
    if (config.network.partition && tick === partitionStart) {
      partitionActive = true;
      record(
        tick,
        "partition-started",
        "fault",
        `Network split into ${Math.ceil(config.clientCount / 2)} + ${Math.floor(
          config.clientCount / 2,
        )} replicas`,
        { detail: "Cross-partition messages are dropped, local edits continue." },
      );
    }
    if (config.network.partition && tick === partitionHeal) {
      partitionActive = false;
      record(
        tick,
        "partition-healed",
        "ok",
        "Network partition healed",
        { detail: "Normal delivery resumes; final recovery is still pending." },
      );
    }

    deliverUntil(tick);

    const source = random.pick(clients);
    const operation = createOperation(source.id, tick, random);
    source.replica = adapter.applyLocal(
      source.replica,
      operation,
      source.id,
    );
    stats.localChanges += 1;
    record(
      tick,
      "local-change",
      "info",
      `${source.id} ${describeOperation(operation)}`,
      { source: source.id, detail: operation.kind },
    );
    broadcast(source, tick);

    if (random.bool(config.network.restartRate)) {
      const restartTarget = random.pick(clients);
      restartTarget.restartCount += 1;
      restartTarget.replica = adapter.restart(
        restartTarget.replica,
        `${config.seed}:${restartTarget.id}:${restartTarget.restartCount}`,
      );
      stats.restarts += 1;
      record(
        tick,
        "replica-restarted",
        "warn",
        `${restartTarget.id} restarted from local persisted state`,
        {
          source: restartTarget.id,
          detail: `restart #${restartTarget.restartCount}`,
        },
      );
    }
  }

  if (partitionActive) {
    partitionActive = false;
    record(
      config.steps + 1,
      "partition-healed",
      "ok",
      "Network partition force-healed for recovery",
    );
  }

  const drainTick =
    config.steps + config.network.maxDelay * 2 + 4;
  deliverUntil(drainTick);

  const snapshotsConverged = (): boolean => {
    const digests = clients.map((client) =>
      stableStringify(adapter.snapshot(client.replica)),
    );
    return new Set(digests).size === 1;
  };

  let convergenceRounds = 0;
  while (!snapshotsConverged() && convergenceRounds < 3) {
    convergenceRounds += 1;
    const recoveryTick = drainTick + convergenceRounds;
    for (const source of clients) {
      broadcast(source, recoveryTick, true);
    }
    deliverUntil(recoveryTick);
  }
  stats.convergenceRounds = convergenceRounds;

  const finalClients = clients.map((client) => {
    const snapshot = adapter.snapshot(client.replica);
    return {
      id: client.id,
      digest: fingerprint(snapshot),
      restartCount: client.restartCount,
      snapshot,
    };
  });
  const converged = new Set(finalClients.map((client) => client.digest)).size === 1;
  record(
    drainTick + convergenceRounds + 1,
    "convergence",
    converged ? "ok" : "fault",
    converged
      ? `All ${config.clientCount} replicas converged`
      : "Replicas did not converge within three recovery rounds",
    {
      detail: converged
        ? `${finalClients[0]?.digest ?? "unknown"} · ${convergenceRounds} recovery round${
            convergenceRounds === 1 ? "" : "s"
          }`
        : finalClients.map((client) => client.digest).join(", "),
    },
  );

  const resultWithoutFingerprint = {
    schemaVersion: 1 as const,
    config,
    converged,
    events,
    clients: finalClients,
    stats,
  };

  return {
    ...resultWithoutFingerprint,
    fingerprint: fingerprint(resultWithoutFingerprint),
  };
}

export function replayScenario(previous: SimulationResult): {
  matches: boolean;
  result: SimulationResult;
} {
  const result = runScenario(previous.config);
  return {
    matches: result.fingerprint === previous.fingerprint,
    result,
  };
}

export function isEngineName(value: string): value is EngineName {
  return value === "automerge" || value === "yjs";
}
