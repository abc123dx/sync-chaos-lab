import * as Automerge from "@automerge/automerge";
import * as Y from "yjs";

import {
  deterministicActorId,
  deterministicClientId,
  stableStringify,
} from "./random.js";
import type {
  EngineName,
  LabSnapshot,
  Operation,
  ReplicaAdapter,
} from "./types.js";

type LabDocument = {
  title: string;
  counts: Record<string, number>;
  notes: string[];
};

type AutomergeReplica = Automerge.Doc<LabDocument>;
type YjsReplica = Y.Doc;

const INITIAL_TITLE = "Offline field notes";

function snapshotFromParts(
  title: string,
  counts: Record<string, number>,
  notes: string[],
): LabSnapshot {
  const sortedCounts = Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
  return {
    title,
    counts: sortedCounts,
    counter: Object.values(sortedCounts).reduce(
      (total, value) => total + value,
      0,
    ),
    notes,
  };
}

function createAutomergeGenesis(): Uint8Array {
  let document = Automerge.init<LabDocument>({
    actor: deterministicActorId("sync-chaos-genesis"),
  });
  document = Automerge.change(
    document,
    {
      message: "Initialize lab document",
      // Automerge otherwise records the wall-clock time. It is advisory only,
      // but it changes the encoded payload and therefore the replay trace.
      time: 0,
    },
    (draft) => {
      draft.title = INITIAL_TITLE;
      draft.counts = {};
      draft.notes = [];
    },
  );
  return Automerge.save(document);
}

const automergeGenesis = createAutomergeGenesis();

export const automergeAdapter: ReplicaAdapter<AutomergeReplica> = {
  name: "automerge",
  create(replicaKey) {
    return Automerge.load<LabDocument>(automergeGenesis, {
      actor: deterministicActorId(replicaKey),
    });
  },
  applyLocal(replica, operation, logicalClientId) {
    return Automerge.change(
      replica,
      {
        message: `${logicalClientId}:${operation.kind}`,
        // Keep serialized state byte-for-byte stable across Node processes.
        time: 0,
      },
      (draft) => {
        if (operation.kind === "increment") {
          draft.counts[logicalClientId] =
            (draft.counts[logicalClientId] ?? 0) + operation.amount;
        } else if (operation.kind === "append-note") {
          draft.notes.push(operation.value);
        } else {
          draft.title = operation.value;
        }
      },
    );
  },
  encode(replica) {
    return Automerge.save(replica);
  },
  receive(replica, payload) {
    const remote = Automerge.load<LabDocument>(payload, {
      // The loaded document is a read-only network envelope. A fixed actor
      // keeps its ephemeral writable identity out of deterministic replays.
      actor: deterministicActorId("sync-chaos-incoming-envelope"),
    });
    return Automerge.merge(replica, remote);
  },
  restart(replica, replicaKey) {
    return Automerge.clone(replica, {
      actor: deterministicActorId(replicaKey),
    });
  },
  snapshot(replica) {
    return snapshotFromParts(
      replica.title,
      Object.fromEntries(Object.entries(replica.counts)),
      [...replica.notes],
    );
  },
};

function createYjsGenesis(): Uint8Array {
  const document = new Y.Doc({ guid: "sync-chaos-genesis" });
  document.clientID = deterministicClientId("sync-chaos-genesis");
  const root = document.getMap<unknown>("root");
  root.set("title", INITIAL_TITLE);
  root.set("counts", new Y.Map<number>());
  root.set("notes", new Y.Array<string>());
  return Y.encodeStateAsUpdate(document);
}

const yjsGenesis = createYjsGenesis();

function createYjsReplica(replicaKey: string): YjsReplica {
  const document = new Y.Doc({ guid: `sync-chaos-${replicaKey}` });
  document.clientID = deterministicClientId(replicaKey);
  Y.applyUpdate(document, yjsGenesis, "genesis");
  return document;
}

function getYjsTypes(document: Y.Doc) {
  const root = document.getMap<unknown>("root");
  const counts = root.get("counts");
  const notes = root.get("notes");
  if (!(counts instanceof Y.Map) || !(notes instanceof Y.Array)) {
    throw new Error("Yjs 文档缺少预期的共享类型");
  }
  return {
    root,
    counts: counts as Y.Map<number>,
    notes: notes as Y.Array<string>,
  };
}

export const yjsAdapter: ReplicaAdapter<YjsReplica> = {
  name: "yjs",
  create: createYjsReplica,
  applyLocal(replica, operation, logicalClientId) {
    const { root, counts, notes } = getYjsTypes(replica);
    replica.transact(() => {
      if (operation.kind === "increment") {
        counts.set(
          logicalClientId,
          (counts.get(logicalClientId) ?? 0) + operation.amount,
        );
      } else if (operation.kind === "append-note") {
        notes.push([operation.value]);
      } else {
        root.set("title", operation.value);
      }
    }, `${logicalClientId}:${operation.kind}`);
    return replica;
  },
  encode(replica) {
    return Y.encodeStateAsUpdate(replica);
  },
  receive(replica, payload) {
    Y.applyUpdate(replica, payload, "network");
    return replica;
  },
  restart(replica, replicaKey) {
    const payload = Y.encodeStateAsUpdate(replica);
    const restarted = createYjsReplica(replicaKey);
    Y.applyUpdate(restarted, payload, "restart");
    replica.destroy();
    return restarted;
  },
  snapshot(replica) {
    const { root, counts, notes } = getYjsTypes(replica);
    const title = root.get("title");
    return snapshotFromParts(
      typeof title === "string" ? title : INITIAL_TITLE,
      Object.fromEntries(counts.entries()),
      notes.toArray(),
    );
  },
};

export function getAdapter(engine: EngineName): ReplicaAdapter {
  return engine === "automerge" ? automergeAdapter : yjsAdapter;
}

export function replicaDigest(
  adapter: ReplicaAdapter,
  replica: unknown,
): string {
  return stableStringify(adapter.snapshot(replica));
}
