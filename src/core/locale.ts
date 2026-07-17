import type {
  EventKind,
  SimulationEvent,
} from "./types.js";

const EVENT_KIND_LABELS: Record<EventKind, string> = {
  convergence: "收敛判定",
  "local-change": "本地变更",
  "message-delivered": "消息送达",
  "message-dropped": "消息丢弃",
  "message-duplicated": "消息复制",
  "message-queued": "消息入队",
  "partition-healed": "分区恢复",
  "partition-started": "分区开始",
  "replica-restarted": "副本重启",
};

const DOCUMENT_TITLES: Record<string, string> = {
  "Conflict atlas": "冲突图谱",
  "Edge incident brief": "边缘事件简报",
  "Offline field notes": "离线现场记录",
  "Recovery ledger": "恢复台账",
};

export function eventKindLabelZh(kind: EventKind): string {
  return EVENT_KIND_LABELS[kind];
}

export function localizeDocumentText(value: string): string {
  const titled = /^(Conflict atlas|Edge incident brief|Offline field notes|Recovery ledger)( · \d+)?$/.exec(
    value,
  );
  if (titled) {
    return `${DOCUMENT_TITLES[titled[1] ?? ""] ?? titled[1]}${titled[2] ?? ""}`;
  }
  return value.replace(/ · field note (\d+)$/, " · 现场记录 $1");
}

export function eventSummaryZh(event: SimulationEvent): string {
  const source = event.source ?? "未知副本";
  const target = event.target ?? "未知副本";
  const messageId = event.messageId ?? "消息";

  switch (event.kind) {
    case "message-queued":
      return `${messageId} 已入队：${source} → ${target}`;
    case "message-delivered":
      return `${messageId} 已送达：${source} → ${target}`;
    case "message-duplicated":
      return `${messageId} 在传输途中被复制`;
    case "message-dropped":
      if (event.summary.startsWith("Partition blocked")) {
        return `网络分区阻断：${source} → ${target}`;
      }
      if (event.summary.startsWith("Packet loss")) {
        return `链路丢包：${source} → ${target}`;
      }
      return `${messageId} 到达时网络分区仍处于激活状态`;
    case "partition-started": {
      const sizes = /Network split into (\d+) \+ (\d+) replicas/.exec(
        event.summary,
      );
      return sizes
        ? `网络已拆分为 ${sizes[1]} + ${sizes[2]} 个副本`
        : "网络分区已开始";
    }
    case "partition-healed":
      return event.summary.includes("force-healed")
        ? "已强制修复网络分区并开始恢复"
        : "网络分区已恢复";
    case "replica-restarted":
      return `${source} 已从本地持久化状态重启`;
    case "convergence": {
      const count = /All (\d+) replicas converged/.exec(event.summary)?.[1];
      return event.tone === "ok"
        ? `全部 ${count ?? ""} 个副本已收敛`.replace("全部  个", "全部")
        : "副本未能在三轮恢复内收敛";
    }
    case "local-change": {
      const increment =
        /^(.+?) incremented the shared counter by (\d+)$/.exec(event.summary);
      if (increment) {
        return `${increment[1]} 将共享计数器增加 ${increment[2]}`;
      }
      const appended = /^(.+?) appended “(.*)”$/.exec(event.summary);
      if (appended) {
        return `${appended[1]} 追加了“${localizeDocumentText(appended[2] ?? "")}”`;
      }
      const renamed =
        /^(.+?) renamed the document to “(.*)”$/.exec(event.summary);
      if (renamed) {
        return `${renamed[1]} 将文档重命名为“${localizeDocumentText(
          renamed[2] ?? "",
        )}”`;
      }
      return event.summary;
    }
  }
}

export function eventDetailZh(event: SimulationEvent): string | undefined {
  if (!event.detail) return undefined;

  if (event.kind === "message-queued") {
    return event.detail
      .replace(/(\d+) bytes/g, "$1 字节")
      .replace(/due T(\d+)/g, "计划于 T$1 送达")
      .replace(/reorder jitter \+(\d+)/g, "乱序抖动 +$1")
      .replace(/duplicate of (M\d+)/g, "复制自 $1");
  }

  const exact: Record<string, string> = {
    "Cross-partition messages are dropped, local edits continue.":
      "跨分区消息将被丢弃，但各副本仍可继续本地编辑。",
    "Normal delivery resumes; final recovery is still pending.":
      "常规消息投递已恢复，最终同步恢复仍待执行。",
    "The sender will resynchronize after the partition heals.":
      "网络分区恢复后，发送方将重新同步。",
    "recovery synchronization": "恢复同步",
    increment: "操作类型：increment（增加计数）",
    "append-note": "操作类型：append-note（追加记录）",
    "set-title": "操作类型：set-title（修改标题）",
  };
  if (exact[event.detail]) return exact[event.detail];

  const restart = /^restart #(\d+)$/.exec(event.detail);
  if (restart) return `第 ${restart[1]} 次重启（restart #${restart[1]}）`;

  const recovery = /^(sc-[0-9a-f]+) · (\d+) recovery rounds?$/.exec(
    event.detail,
  );
  if (recovery) {
    return `${recovery[1]} · ${recovery[2]} 轮确定性恢复`;
  }

  return event.detail;
}
