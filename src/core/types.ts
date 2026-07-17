export type EngineName = "automerge" | "yjs";

export type Operation =
  | { kind: "increment"; amount: number }
  | { kind: "append-note"; value: string }
  | { kind: "set-title"; value: string };

export type LabSnapshot = {
  title: string;
  counter: number;
  counts: Record<string, number>;
  notes: string[];
};

export type NetworkConfig = {
  dropRate: number;
  duplicateRate: number;
  minDelay: number;
  maxDelay: number;
  reorderRate: number;
  restartRate: number;
  partition: boolean;
};

export type ScenarioConfig = {
  seed: string;
  engine: EngineName;
  clientCount: number;
  steps: number;
  network: NetworkConfig;
};

export type ScenarioInput = Partial<Omit<ScenarioConfig, "network">> & {
  network?: Partial<NetworkConfig>;
};

export type EventKind =
  | "convergence"
  | "local-change"
  | "message-delivered"
  | "message-dropped"
  | "message-duplicated"
  | "message-queued"
  | "partition-healed"
  | "partition-started"
  | "replica-restarted";

export type EventTone = "fault" | "info" | "ok" | "warn";

export type SimulationEvent = {
  id: number;
  tick: number;
  kind: EventKind;
  tone: EventTone;
  summary: string;
  detail?: string;
  source?: string;
  target?: string;
  messageId?: string;
};

export type ClientResult = {
  id: string;
  digest: string;
  restartCount: number;
  snapshot: LabSnapshot;
};

export type SimulationStats = {
  convergenceRounds: number;
  delivered: number;
  dropped: number;
  duplicated: number;
  localChanges: number;
  queued: number;
  reordered: number;
  restarts: number;
  ticks: number;
};

export type SimulationResult = {
  schemaVersion: 1;
  config: ScenarioConfig;
  converged: boolean;
  fingerprint: string;
  events: SimulationEvent[];
  clients: ClientResult[];
  stats: SimulationStats;
};

export type ReplicaAdapter<TReplica = unknown> = {
  readonly name: EngineName;
  create(replicaKey: string): TReplica;
  applyLocal(
    replica: TReplica,
    operation: Operation,
    logicalClientId: string,
  ): TReplica;
  encode(replica: TReplica): Uint8Array;
  receive(replica: TReplica, payload: Uint8Array): TReplica;
  restart(replica: TReplica, replicaKey: string): TReplica;
  snapshot(replica: TReplica): LabSnapshot;
};
