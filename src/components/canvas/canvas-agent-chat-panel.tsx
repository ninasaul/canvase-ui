"use client";

import { memo } from "react";

import {
  CaretDown,
  CaretRight,
  ChatCircle,
  Check,
  CircleNotch,
  FileAudio,
  Paperclip,
  PaperPlaneTilt,
  Play,
  Plus,
  ShieldWarning,
  Stop,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { PlaygroundChatMarkdown } from "@/components/playground/playground-chat-markdown";
import { PlaygroundModelSelect } from "@/components/playground/playground-model-select";
import { Button } from "@/components/ui/button";
import { selectTriggerClassName } from "@/components/ui/form-control";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { useMessages } from "@/hooks/use-feature-messages";
import {
  cancelAgentRun,
  getCanvasRun,
  resolveAgentApproval,
  steerCanvasAgentChat,
  streamCanvasAgentChat,
  summarizeCanvasChat,
  type CanvasAgentChatSseEvent,
  type CanvasChatHistoryMessage,
  clearCanvasChatMessages,
  listCanvasChatMessages,
} from "@/lib/canvas/canvas-api";
import {
  getChatMediaAccept,
  getChatMediaCapabilityProfile,
  inferChatMediaKind,
  type ChatMediaKind,
} from "@/lib/playground/chat-capabilities";
import { uploadPlaygroundAssetWithMeta } from "@/lib/playground-media";
import type { PortalPublicModel } from "@/types/admin";

const AGENT_MEDIA_KINDS: readonly ChatMediaKind[] = [
  "image",
  "video",
  "audio",
];
const AGENT_MEDIA_ACCEPT = getChatMediaAccept(AGENT_MEDIA_KINDS);

type ChatAttachment = {
  id: string;
  url: string;
  assetId?: string;
  name: string;
  previewUrl: string;
  kind: ChatMediaKind;
};

type UiMessage =
  | {
      id: string;
      kind: "user";
      content: string;
      sessionId?: string;
      createdAt?: string;
      /** Sent while the agent was mid-turn (queued for the next step). */
      steering?: boolean;
      /** The agent has folded this instruction into the conversation. */
      delivered?: boolean;
      failed?: boolean;
      attachments?: Array<{
        url: string;
        name?: string;
        kind?: ChatMediaKind;
      }>;
    }
  | {
      id: string;
      kind: "assistant";
      content: string;
      sessionId?: string;
      createdAt?: string;
    }
  | {
      id: string;
      kind: "tool";
      tool: string;
      status: "running" | "done" | "failed";
      summary?: string;
      expanded?: boolean;
    }
  | {
      id: string;
      kind: "run";
      mode: string;
      runId?: string;
      nodeIds: string[];
      status: "queued" | "running" | "succeeded" | "partial" | "failed" | "cancelled";
      total: number;
      done: number;
      failed: number;
      error?: string;
    }
  | {
      id: string;
      kind: "approval";
      tool: string;
      summary: string;
      details?: Record<string, unknown>;
      status: "pending" | "allowed" | "denied";
      scope?: "once" | "session";
    }
  | { id: string; kind: "error"; content: string };

const OPEN_STORAGE_KEY = "canvase.canvas-agent-chat.open";
const WIDTH_STORAGE_KEY = "canvase.canvas-agent-chat.width";
const DEFAULT_PANEL_WIDTH = 360;
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 640;
const MAX_ATTACHMENTS = 4;

function storageKey(canvasId: string): string {
  return `canvase.canvas-agent-chat.messages.${canvasId}`;
}

function modelStorageKey(canvasId: string): string {
  return `canvase.canvas-agent-chat.model.${canvasId}`;
}

function loadModelId(canvasId: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return window.localStorage.getItem(modelStorageKey(canvasId))?.trim() ?? "";
  } catch {
    return "";
  }
}

function saveModelId(canvasId: string, modelId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (modelId) {
      window.localStorage.setItem(modelStorageKey(canvasId), modelId);
    }
  } catch {
    // Ignore quota errors.
  }
}

function mapHistoryToItems(rows: CanvasChatHistoryMessage[]): UiMessage[] {
  return rows.map((row) =>
    row.role === "user"
      ? {
          id: row.id,
          kind: "user" as const,
          content: row.content,
          sessionId: row.sessionId,
          createdAt: row.createdAt,
          ...(row.attachments && row.attachments.length > 0
            ? {
                attachments: row.attachments.map((item) => ({
                  url: item.url,
                  ...(item.name ? { name: item.name } : {}),
                  kind: normalizeUiAttachmentKind(item.kind),
                })),
              }
            : {}),
        }
      : {
          id: row.id,
          kind: "assistant" as const,
          content: row.content,
          sessionId: row.sessionId,
          createdAt: row.createdAt,
        },
  );
}

function loadMessages(canvasId: string): UiMessage[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(storageKey(canvasId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UiMessage[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(canvasId: string, messages: UiMessage[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const trimmed = messages.slice(-80).map((item) => {
      if (item.kind === "tool") {
        return {
          id: item.id,
          kind: item.kind,
          tool: item.tool,
          status: item.status,
          ...(item.summary ? { summary: item.summary } : {}),
        };
      }
      return item;
    });
    window.localStorage.setItem(storageKey(canvasId), JSON.stringify(trimmed));
  } catch {
    // Ignore quota errors.
  }
}

function loadOpenPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(OPEN_STORAGE_KEY) === "1";
}

function saveOpenPreference(open: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(OPEN_STORAGE_KEY, open ? "1" : "0");
}

function clampPanelWidth(width: number): number {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(width)));
}

function loadPanelWidth(): number {
  if (typeof window === "undefined") {
    return DEFAULT_PANEL_WIDTH;
  }
  const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_PANEL_WIDTH;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PANEL_WIDTH;
  }
  return clampPanelWidth(parsed);
}

function savePanelWidth(width: number): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(WIDTH_STORAGE_KEY, String(clampPanelWidth(width)));
}

/** `canvas_run` results are JSON; tolerate plain text. */
function readRunSummary(summary: string | undefined): {
  runId?: string;
  status?: "queued" | "running" | "succeeded" | "partial" | "failed" | "cancelled";
  nodeIds?: string[];
} {
  const text = (summary ?? "").trim();
  const start = text.indexOf("{");
  if (start < 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(text.slice(start)) as Record<string, unknown>;
    const run = (parsed.run ?? parsed) as Record<string, unknown>;
    return {
      ...(typeof run.runId === "string" ? { runId: run.runId } : {}),
      ...(typeof run.id === "string" ? { runId: run.id } : {}),
      ...(typeof run.status === "string"
        ? { status: run.status as "queued" }
        : {}),
      ...(Array.isArray(run.nodeIds)
        ? {
            nodeIds: run.nodeIds.filter(
              (id): id is string => typeof id === "string",
            ),
          }
        : {}),
    };
  } catch {
    return {};
  }
}

/** First node id a tool call is about, if it names one. */
function readToolFocusNodeId(args: unknown): string | null {
  if (!args || typeof args !== "object") {
    return null;
  }
  const record = args as Record<string, unknown>;
  if (typeof record.nodeId === "string" && record.nodeId.trim()) {
    return record.nodeId.trim();
  }
  if (Array.isArray(record.nodeIds)) {
    const first = record.nodeIds.find(
      (id): id is string => typeof id === "string" && id.trim().length > 0,
    );
    if (first) {
      return first.trim();
    }
  }
  return null;
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

type MessageGroup =
  | { key: string; type: "user"; item: Extract<UiMessage, { kind: "user" }> }
  | {
      key: string;
      type: "assistant-turn";
      items: Array<
        Extract<UiMessage, { kind: "assistant" | "tool" | "approval" | "run" }>
      >;
    }
  | { key: string; type: "error"; item: Extract<UiMessage, { kind: "error" }> }
  | { key: string; type: "divider"; sessionId: string; at?: string };

function groupMessages(items: UiMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let lastSession = "";
  for (const item of items) {
    const sessionId = "sessionId" in item ? item.sessionId : undefined;
    if (sessionId && sessionId !== lastSession) {
      lastSession = sessionId;
      if (groups.length > 0) {
        groups.push({
          key: `divider-${sessionId}`,
          type: "divider",
          sessionId,
          at: "createdAt" in item ? item.createdAt : undefined,
        });
      }
    }
    if (item.kind === "user") {
      groups.push({ key: item.id, type: "user", item });
      continue;
    }
    if (item.kind === "error") {
      groups.push({ key: item.id, type: "error", item });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last?.type === "assistant-turn") {
      last.items.push(item);
    } else {
      groups.push({ key: item.id, type: "assistant-turn", items: [item] });
    }
  }
  return groups;
}

function normalizeUiAttachmentKind(kind: unknown): ChatMediaKind {
  if (kind === "video" || kind === "audio" || kind === "image") {
    return kind;
  }
  return "image";
}

function AttachmentPreview({
  url,
  name,
  kind,
  className = "h-20 w-20 object-cover",
}: {
  url: string;
  name?: string;
  kind: ChatMediaKind;
  className?: string;
}) {
  if (kind === "video") {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className={className}
        aria-label={name || "video"}
      />
    );
  }
  if (kind === "audio") {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 bg-zinc-100 px-1.5 text-center dark:bg-zinc-800 ${className}`}
        title={name}
      >
        <Icon icon={FileAudio} size={18} className="text-zinc-500" />
        <span className="line-clamp-2 w-full truncate text-[9px] leading-tight text-zinc-500">
          {name || "audio"}
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name || ""} className={className} />
  );
}

/** Keep API payload under route message limit after tool expansion. */
const MAX_API_HISTORY_MESSAGES = 80;
/** Character budget for one request; older turns are summarized away. */
const MAX_API_HISTORY_CHARS = 24_000;
/** Always keep the tail verbatim, even when it blows the budget. */
const KEEP_RECENT_MESSAGES = 6;
/** Start folding once this many messages sit outside the summary. */
const COMPACT_TRIGGER = 40;
/** Leave this many recent messages verbatim when folding. */
const COMPACT_KEEP_RECENT = 24;

/** Flatten UI transcript into API history (tools become assistant notes). */
function buildApiHistory(
  items: UiMessage[],
  summary?: { summary: string; coveredCount: number },
): Array<{
  role: "user" | "assistant";
  content: string;
  attachments?: Array<{ url: string; kind: ChatMediaKind }>;
}> {
  const history: Array<{
    role: "user" | "assistant";
    content: string;
    attachments?: Array<{ url: string; kind: ChatMediaKind }>;
  }> = [];
  for (const item of items) {
    if (item.kind === "user") {
      const content =
        typeof item.content === "string" ? item.content : String(item.content ?? "");
      const attachments = (item.attachments ?? [])
        .map((attachment) => {
          const url =
            typeof attachment.url === "string" ? attachment.url.trim() : "";
          if (!url || url.length > 16_000) {
            return null;
          }
          return {
            url,
            kind: normalizeUiAttachmentKind(attachment.kind),
          };
        })
        .filter((attachment): attachment is { url: string; kind: ChatMediaKind } =>
          Boolean(attachment),
        );
      if (!content.trim() && attachments.length === 0) {
        continue;
      }
      history.push({
        role: "user",
        content,
        ...(attachments.length > 0 ? { attachments } : {}),
      });
      continue;
    }
    if (item.kind === "assistant") {
      const content =
        typeof item.content === "string" ? item.content : String(item.content ?? "");
      if (!content.trim()) {
        continue;
      }
      history.push({ role: "assistant", content });
      continue;
    }
    if (item.kind === "run") {
      // The run is represented by its tool result line instead.
      continue;
    }
    if (item.kind === "approval") {
      // UI-only: the decision is already reflected in the tool result.
      continue;
    }
    if (item.kind === "tool" && item.status !== "running") {
      const summary = (item.summary ?? "").trim();
      const toolName =
        typeof item.tool === "string" && item.tool.trim()
          ? item.tool.trim()
          : "tool";
      history.push({
        role: "assistant",
        content: `[tool ${toolName} ${item.status}]${
          summary ? `\n${summary.slice(0, 420)}` : ""
        }`,
      });
    }
  }
  // Fold already-summarized turns away: the model gets the briefing instead.
  const covered = summary ? Math.max(0, summary.coveredCount) : 0;
  let base = history;
  if (summary && covered > 0) {
    let seen = 0;
    let cut = 0;
    while (cut < base.length && seen < covered) {
      const entry = base[cut]!;
      if (entry.role === "user" || entry.role === "assistant") {
        seen += 1;
      }
      cut += 1;
    }
    base = [
      {
        role: "assistant" as const,
        content: `[summary of the earlier conversation]\n${summary.summary}`,
      },
      ...base.slice(cut),
    ];
  }

  const trimmed =
    base.length <= MAX_API_HISTORY_MESSAGES
      ? base
      : base.slice(-MAX_API_HISTORY_MESSAGES);

  // Budget by characters: tool results dominate and are re-readable, so drop
  // the oldest turns first and tell the model they existed.
  let total = 0;
  let keepFrom = trimmed.length;
  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    const entry = trimmed[index]!;
    const cost = entry.content.length;
    const mustKeep = trimmed.length - index <= KEEP_RECENT_MESSAGES;
    if (!mustKeep && total + cost > MAX_API_HISTORY_CHARS) {
      break;
    }
    total += cost;
    keepFrom = index;
  }
  if (keepFrom === 0) {
    return trimmed;
  }
  const dropped = keepFrom;
  return [
    {
      role: "assistant" as const,
      content: `[earlier conversation omitted: ${dropped} message(s). Call canvas_get if you need the current state again.]`,
    },
    ...trimmed.slice(keepFrom),
  ];
}

function RunCard({
  item,
  onCancel,
}: {
  item: Extract<UiMessage, { kind: "run" }>;
  onCancel?: () => void;
}) {
  const messages = useMessages();
  const active = item.status === "queued" || item.status === "running";
  const modeLabel =
    item.mode === "all"
      ? messages.canvas.runAll
      : item.mode === "node"
        ? messages.canvas.runSelected
        : item.mode === "from"
          ? messages.canvas.runFrom
          : item.mode === "retry-failed"
            ? messages.canvas.retryFailed
            : messages.canvas.runSelected;
  const statusLabel =
    item.status === "queued"
      ? messages.canvas.runCardQueued
      : item.status === "running"
        ? messages.canvas.runCardRunning
        : item.status === "succeeded"
          ? messages.canvas.runCardSucceeded
          : item.status === "partial"
            ? messages.canvas.runCardPartial
            : item.status === "cancelled"
              ? messages.canvas.runCardCancelled
              : messages.canvas.runCardFailed;
  const total = item.total || item.nodeIds.length;
  const progress = total > 0 ? Math.round((item.done / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-sky-200/80 bg-sky-50/70 p-2.5 dark:border-sky-500/30 dark:bg-sky-950/25">
      <div className="flex items-center gap-2">
        <Icon
          icon={active ? CircleNotch : Play}
          size={13}
          className={`shrink-0 text-sky-600 dark:text-sky-300 ${
            active ? "animate-spin" : ""
          }`}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-sky-900 dark:text-sky-200">
          {messages.canvas.runCardTitle} · {modeLabel}
        </span>
        <span className="shrink-0 text-[10px] text-sky-700/80 dark:text-sky-300/80">
          {statusLabel}
        </span>
      </div>
      {total > 0 ? (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-sky-200/60 dark:bg-sky-900/60">
            <div
              className="h-full rounded-full bg-sky-500 transition-all"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] text-sky-800/80 dark:text-sky-300/80">
            {item.done}/{total}
          </span>
        </div>
      ) : null}
      {item.failed > 0 ? (
        <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">
          {messages.canvas.runCardFailures.replace(
            "{count}",
            String(item.failed),
          )}
        </p>
      ) : null}
      {item.error ? (
        <p className="mt-1 line-clamp-2 text-[10px] text-red-600 dark:text-red-400">
          {item.error}
        </p>
      ) : null}
      {active && onCancel ? (
        <button
          type="button"
          className="mt-2 rounded-md px-1.5 py-0.5 text-[10px] text-sky-700 transition-colors hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900/50"
          onClick={onCancel}
        >
          {messages.canvas.runCardCancel}
        </button>
      ) : null}
    </div>
  );
}

function ApprovalCard({
  item,
  onDecide,
}: {
  item: Extract<UiMessage, { kind: "approval" }>;
  onDecide: (decision: "allow_once" | "allow_session" | "deny") => void;
}) {
  const messages = useMessages();
  const pending = item.status === "pending";
  return (
    <div className="rounded-xl border border-amber-300/70 bg-amber-50/80 p-2.5 dark:border-amber-500/30 dark:bg-amber-950/25">
      <div className="flex items-start gap-2">
        <Icon
          icon={ShieldWarning}
          size={14}
          className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
            {messages.canvas.agentChatApprovalTitle}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-200/80">
            {item.summary}
          </p>
          {pending ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => onDecide("allow_once")}
              >
                {messages.canvas.agentChatApprovalOnce}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onDecide("allow_session")}
              >
                {messages.canvas.agentChatApprovalSession}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onDecide("deny")}
              >
                {messages.canvas.agentChatApprovalDeny}
              </Button>
            </div>
          ) : (
            <p className="mt-1 text-[10px] text-amber-700/80 dark:text-amber-300/70">
              {item.status === "denied"
                ? messages.canvas.agentChatApprovalDenied
                : item.scope === "session"
                  ? messages.canvas.agentChatApprovalAllowedSession
                  : messages.canvas.agentChatApprovalAllowedOnce}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CanvasAgentChatPanelInner({
  canvasId,
  chatModels,
  defaultModelId,
  open,
  onOpenChange,
  onOpenModelSettings,
  onGraphMutated,
  context,
  selectionChips,
  onRemoveSelection,
  onAgentFocusNode,
}: {
  canvasId: string;
  chatModels: PortalPublicModel[];
  defaultModelId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenModelSettings: () => void;
  onGraphMutated: () => void;
  /** Selection / focus / viewport snapshot passed to every turn. */
  context?: {
    version?: number;
    selection?: string[];
    focusNodeId?: string;
    visibleNodeIds?: string[];
  };
  /** What the user has selected, shown as chips above the composer. */
  selectionChips?: Array<{ id: string; label: string }>;
  onRemoveSelection?: (nodeId: string) => void;
  /** Reveal + flash a node the agent is touching. */
  onAgentFocusNode?: (nodeId: string) => void;
}) {
  const messages = useMessages();
  const [items, setItems] = useState<UiMessage[]>(() => loadMessages(canvasId));
  /** Rolling summaries per session, used to drop already-folded turns. */
  const [summaries, setSummaries] = useState<
    Record<string, { summary: string; coveredCount: number }>
  >({});
  const [draft, setDraft] = useState("");
  const [modelId, setModelId] = useState(
    () => loadModelId(canvasId) || defaultModelId || chatModels[0]?.id || "",
  );
  /** Current conversation boundary; empty until history resolves. */
  const [sessionId, setSessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [continuePending, setContinuePending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [pendingAttachments, setPendingAttachments] = useState<
    ChatAttachment[]
  >([]);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Set once the user sends in this mount, so a late history fetch can't clobber it. */
  const turnStartedRef = useRef(false);
  /**
   * Upstream gateways often buffer the first token for seconds and then dump
   * the rest in one burst. Queue deltas and reveal them per animation frame so
   * the answer always reads as a stream instead of a single paste.
   */
  const revealRef = useRef<{
    queue: string;
    messageId: string | null;
    raf: number | null;
  }>({ queue: "", messageId: null, raf: null });
  const drainRevealRef = useRef<() => void>(() => undefined);
  drainRevealRef.current = () => {
    const state = revealRef.current;
    if (!state.messageId || state.queue.length === 0) {
      state.raf = null;
      return;
    }
    // ~4 chars/frame ≈ 240 cps; speed up when the backlog grows.
    const step = Math.max(4, Math.ceil(state.queue.length / 24));
    const slice = state.queue.slice(0, step);
    state.queue = state.queue.slice(step);
    const id = state.messageId;
    setItems((current) =>
      current.map((item) =>
        item.id === id && item.kind === "assistant"
          ? { ...item, content: item.content + slice }
          : item,
      ),
    );
    state.raf = requestAnimationFrame(() => drainRevealRef.current());
  };
  /** Reveal whatever is still queued, then stop the loop. */
  const flushReveal = useCallback(() => {
    const state = revealRef.current;
    if (state.raf !== null) {
      cancelAnimationFrame(state.raf);
      state.raf = null;
    }
    const rest = state.queue;
    state.queue = "";
    if (state.messageId && rest) {
      const id = state.messageId;
      setItems((current) =>
        current.map((item) =>
          item.id === id && item.kind === "assistant"
            ? { ...item, content: item.content + rest }
            : item,
        ),
      );
    }
  }, []);
  const resizeDragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const selectedModel = useMemo(
    () => chatModels.find((item) => item.id === modelId),
    [chatModels, modelId],
  );
  const mediaProfile = useMemo(
    () => getChatMediaCapabilityProfile(modelId, selectedModel?.vendor),
    [modelId, selectedModel?.vendor],
  );
  const attachHint = mediaProfile.supportsImages
    ? messages.canvas.agentChatAttachHint
    : messages.canvas.agentChatAttachHintUrlOnly;

  useEffect(() => {
    setPanelWidth(loadPanelWidth());
  }, []);

  useEffect(() => {
    saveOpenPreference(open);
  }, [open]);

  useEffect(() => {
    return () => {
      resizeDragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // The reveal queue lives in a plain object ref, not a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const state = revealRef.current;
      if (state.raf !== null) {
        cancelAnimationFrame(state.raf);
        state.raf = null;
      }
    };
  }, []);

  useEffect(() => {
    const stored = loadModelId(canvasId);
    if (stored) {
      setModelId(stored);
    }
  }, [canvasId]);

  useEffect(() => {
    saveModelId(canvasId, modelId);
  }, [canvasId, modelId]);

  useEffect(() => {
    let cancelled = false;
    turnStartedRef.current = false;
    // Paint the local cache immediately, then adopt the server transcript.
    setItems(loadMessages(canvasId));
    void listCanvasChatMessages(canvasId)
      .then((payload) => {
        if (cancelled || turnStartedRef.current) {
          return;
        }
        setSummaries(
          Object.fromEntries(
            payload.summaries.map((entry) => [
              entry.sessionId,
              { summary: entry.summary, coveredCount: entry.coveredCount },
            ]),
          ),
        );
        if (payload.messages.length === 0) {
          return;
        }
        setItems(mapHistoryToItems(payload.messages));
        setSessionId(payload.messages[payload.messages.length - 1]!.sessionId);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [canvasId]);

  useEffect(() => {
    setContinuePending(false);
    setPendingAttachments((current) => {
      for (const item of current) {
        if (item.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
      return [];
    });
  }, [canvasId]);

  useEffect(() => {
    // Debounced: the reveal loop updates state every animation frame.
    const timer = window.setTimeout(() => saveMessages(canvasId, items), 250);
    return () => window.clearTimeout(timer);
  }, [canvasId, items]);

  useEffect(() => {
    if (!modelId && chatModels[0]?.id) {
      setModelId(defaultModelId || chatModels[0].id);
      return;
    }
    if (
      modelId &&
      chatModels.length > 0 &&
      !chatModels.some((item) => item.id === modelId)
    ) {
      setModelId(defaultModelId || chatModels[0]?.id || "");
    }
  }, [chatModels, defaultModelId, modelId]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [items, busy, continuePending, open, pendingAttachments]);

  useEffect(() => {
    return () => {
      for (const item of pendingAttachments) {
        if (item.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    };
  }, [pendingAttachments]);

  function setOpen(next: boolean) {
    onOpenChange(next);
    saveOpenPreference(next);
  }

  // Live progress for agent-triggered runs. Only active runs keep the timer on.
  const activeRunKey = useMemo(
    () =>
      items
        .filter(
          (item) =>
            item.kind === "run" &&
            item.runId &&
            (item.status === "queued" || item.status === "running"),
        )
        .map((item) => (item as Extract<UiMessage, { kind: "run" }>).runId!)
        .filter((id, index, all) => all.indexOf(id) === index)
        .join(","),
    [items],
  );
  useEffect(() => {
    if (!activeRunKey) {
      return;
    }
    let cancelled = false;
    const tick = async () => {
      for (const runId of activeRunKey.split(",")) {
        if (cancelled) {
          return;
        }
        try {
          const detail = await getCanvasRun(canvasId, runId);
          if (cancelled) {
            return;
          }
          const settled = detail.nodes.filter(
            (node) =>
              node.status === "succeeded" ||
              node.status === "failed" ||
              node.status === "cancelled",
          ).length;
          const failed = detail.nodes.filter(
            (node) => node.status === "failed",
          ).length;
          setItems((current) =>
            current.map((item) =>
              item.kind === "run" && item.runId === runId
                ? {
                    ...item,
                    status: detail.status,
                    done: settled,
                    failed,
                    total: detail.nodes.length || item.total,
                    ...(detail.error ? { error: detail.error } : {}),
                  }
                : item,
            ),
          );
        } catch {
          // Transient; the next tick retries.
        }
      }
    };
    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeRunKey, canvasId]);

  function handleClear() {
    if (busy) {
      return;
    }
    setContinuePending(false);
    revealRef.current.queue = "";
    revealRef.current.messageId = null;
    setItems([]);
    saveMessages(canvasId, []);
    void clearCanvasChatMessages(canvasId).catch(() => undefined);
  }

  function handleStop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setContinuePending(false);
    setItems((current) => [
      ...current.map((item) =>
        item.kind === "tool" && item.status === "running"
          ? {
              ...item,
              status: "failed" as const,
              summary: messages.canvas.agentChatCancelled,
              expanded: false,
            }
          : item,
      ),
      {
        id: newId("error"),
        kind: "error",
        content: messages.canvas.agentChatCancelled,
      },
    ]);
  }

  async function handlePickFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || busy) {
      return;
    }
    const remaining = MAX_ATTACHMENTS - pendingAttachments.length;
    if (remaining <= 0) {
      toast.danger(messages.canvas.agentChatAttachLimit);
      return;
    }
    const picked = Array.from(fileList);
    const files = picked
      .filter((file) => inferChatMediaKind(file.type) !== null)
      .slice(0, remaining);
    if (files.length === 0) {
      toast.danger(messages.canvas.agentChatAttachUnsupported);
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        const kind = inferChatMediaKind(file.type);
        if (!kind) {
          continue;
        }
        const previewUrl = URL.createObjectURL(file);
        try {
          const uploaded = await uploadPlaygroundAssetWithMeta(file, {
            allowedKinds: [...AGENT_MEDIA_KINDS],
            purpose: "playground_upload",
          });
          setPendingAttachments((current) => [
            ...current,
            {
              id: newId("attach"),
              url: uploaded.url,
              assetId: uploaded.assetId,
              name: file.name,
              previewUrl,
              kind,
            },
          ]);
        } catch (error) {
          URL.revokeObjectURL(previewUrl);
          throw error;
        }
      }
    } catch {
      toast.danger(messages.canvas.agentChatAttachFailed);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  }

  /** Stable session id for the next turn; creates one if history is empty. */
  function activeSessionId(): string {
    if (sessionId) {
      return sessionId;
    }
    const next = `session-${crypto.randomUUID()}`;
    setSessionId(next);
    return next;
  }

  function handleNewSession() {
    if (busy) {
      return;
    }
    flushReveal();
    revealRef.current.messageId = null;
    setContinuePending(false);
    setSessionId(`session-${crypto.randomUUID()}`);
  }

  async function runAgentTurn(
    userMessage: UiMessage,
    historySource: UiMessage[],
  ) {
    if (!modelId) {
      setItems((current) => [
        ...current,
        {
          id: newId("error"),
          kind: "error",
          content: messages.canvas.agentChatModelMissing,
        },
      ]);
      return;
    }

    // Only the active session feeds the model; earlier sessions stay visible
    // in the transcript without bloating the prompt.
    const scoped = historySource.filter(
      (item) =>
        ("sessionId" in item ? item.sessionId : undefined) ===
        (userMessage.kind === "user" ? userMessage.sessionId : undefined),
    );
    const sessionMessages = [...scoped, userMessage];
    const sessionIdForTurn = activeSessionId();
    const summaryForSession = summaries[sessionIdForTurn];
    let effectiveSummary = summaryForSession;
    const foldable = sessionMessages.filter(
      (item) => item.kind === "user" || item.kind === "assistant",
    );
    const coveredNow = summaryForSession?.coveredCount ?? 0;
    if (
      modelId &&
      foldable.length - coveredNow > COMPACT_TRIGGER &&
      foldable.length > COMPACT_KEEP_RECENT + 8
    ) {
      const foldCount = foldable.length - COMPACT_KEEP_RECENT;
      const toFold = foldable
        .slice(0, foldCount)
        .map((item) => ({
          role: (item.kind === "user" ? "user" : "assistant") as
            | "user"
            | "assistant",
          content: String(item.content ?? "").slice(0, 2_000),
        }))
        .filter((entry) => entry.content.trim().length > 0)
        .slice(0, 60);
      if (toFold.length >= 8) {
        try {
          const compacted = await summarizeCanvasChat({
            canvasId,
            sessionId: sessionIdForTurn,
            model: modelId,
            vendor: selectedModel?.vendor,
            messages: toFold,
          });
          effectiveSummary = compacted;
          setSummaries((current) => ({
            ...current,
            [sessionIdForTurn]: compacted,
          }));
        } catch {
          // Compaction is best effort; the turn still runs with full history.
        }
      }
    }
    const historyForApi = buildApiHistory(sessionMessages, effectiveSummary);
    if (historyForApi.length === 0) {
      setItems((current) => [
        ...current,
        userMessage,
        {
          id: newId("error"),
          kind: "error",
          content: messages.canvas.agentChatError,
        },
      ]);
      return;
    }
    setContinuePending(false);
    turnStartedRef.current = true;
    setItems((current) => [...current, userMessage]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let sawOutput = false;

    const applyEvent = (event: CanvasAgentChatSseEvent) => {
      if (event.type === "text_delta") {
        if (!event.text) {
          return;
        }
        sawOutput = true;
        const state = revealRef.current;
        state.queue += event.text;
        if (!state.messageId) {
          const id = newId("assistant");
          state.messageId = id;
          setItems((current) => [
            ...current,
            { id, kind: "assistant" as const, content: "", sessionId },
          ]);
        }
        if (state.raf === null) {
          state.raf = requestAnimationFrame(() => drainRevealRef.current());
        }
        return;
      }
      if (event.type === "tool_start") {
        sawOutput = true;
        flushReveal();
        revealRef.current.messageId = null;
        const focusId = readToolFocusNodeId(event.args);
        if (focusId) {
          onAgentFocusNode?.(focusId);
        }
        if (event.tool === "canvas_run") {
          const args = (event.args ?? {}) as Record<string, unknown>;
          const nodeIds = Array.isArray(args.nodeIds)
            ? args.nodeIds.filter((id): id is string => typeof id === "string")
            : [];
          setItems((current) => [
            ...current,
            {
              id: event.id || newId("run"),
              kind: "run" as const,
              mode: typeof args.mode === "string" ? args.mode : "selected",
              nodeIds,
              status: "queued" as const,
              total: nodeIds.length,
              done: 0,
              failed: 0,
            },
          ]);
          return;
        }
        setItems((current) => [
          ...current,
          {
            id: event.id || newId("tool"),
            kind: "tool",
            tool: event.tool,
            status: "running",
            expanded: false,
          },
        ]);
        return;
      }
      if (event.type === "approval_request") {
        sawOutput = true;
        flushReveal();
        revealRef.current.messageId = null;
        setItems((current) => [
          ...current,
          {
            id: event.id,
            kind: "approval" as const,
            tool: event.tool,
            summary: event.summary,
            details: event.details,
            status: "pending" as const,
          },
        ]);
        return;
      }
      if (event.type === "approval_resolved") {
        setItems((current) =>
          current.map((item) =>
            item.kind === "approval" && item.id === event.id
              ? {
                  ...item,
                  status:
                    event.decision === "deny"
                      ? ("denied" as const)
                      : ("allowed" as const),
                }
              : item,
          ),
        );
        return;
      }
      if (event.type === "steer_applied") {
        setItems((current) =>
          current.map((item) =>
            item.kind === "user" && item.id === event.id
              ? { ...item, delivered: true, failed: false }
              : item,
          ),
        );
        return;
      }
      if (event.type === "tool_result" && event.tool === "canvas_run") {
        const summary = readRunSummary(event.summary);
        setItems((current) => {
          const index = current.findIndex((item) => item.kind === "run");
          if (index < 0) {
            return current;
          }
          const next = [...current];
          const card = next[index] as Extract<UiMessage, { kind: "run" }>;
          next[index] = {
            ...card,
            ...(summary.runId ? { runId: summary.runId } : {}),
            ...(summary.nodeIds && summary.nodeIds.length > 0
              ? { nodeIds: summary.nodeIds, total: summary.nodeIds.length }
              : {}),
            status: event.ok ? (summary.status ?? "queued") : "failed",
            ...(event.ok ? {} : { error: event.summary }),
          };
          return next;
        });
        return;
      }
      if (event.type === "tool_result") {
        setItems((current) =>
          current.map((item) =>
            item.kind === "tool" && item.id === event.id
              ? {
                  ...item,
                  status: event.ok ? "done" : "failed",
                  summary: event.summary,
                  expanded: !event.ok,
                }
              : item,
          ),
        );
        return;
      }
      if (event.type === "graph_mutated") {
        onGraphMutated();
        return;
      }
      if (event.type === "step_budget") {
        sawOutput = true;
        flushReveal();
        revealRef.current.messageId = null;
        setContinuePending(true);
        setItems((current) => [
          ...current,
          {
            id: newId("assistant"),
            kind: "assistant",
            content: messages.canvas.agentChatStepBudget,
            sessionId,
          },
        ]);
        return;
      }
      if (event.type === "error") {
        if (controller.signal.aborted) {
          return;
        }
        sawOutput = true;
        setContinuePending(false);
        setItems((current) => [
          ...current,
          {
            id: newId("error"),
            kind: "error",
            content: event.message,
          },
        ]);
      }
    };

    try {
      await streamCanvasAgentChat({
        canvasId,
        messages: historyForApi,
        model: modelId.trim(),
        vendor: selectedModel?.vendor,
        messageId: userMessage.id,
        sessionId: activeSessionId(),
        ...(context ? { context } : {}),
        signal: controller.signal,
        onEvent: applyEvent,
      });
      if (!controller.signal.aborted && !sawOutput) {
        setItems((current) => [
          ...current,
          {
            id: newId("error"),
            kind: "error",
            content: messages.canvas.agentChatEmptyResponse,
          },
        ]);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setContinuePending(false);
        setItems((current) => [
          ...current,
          {
            id: newId("error"),
            kind: "error",
            content:
              error instanceof Error
                ? error.message
                : messages.canvas.agentChatError,
          },
        ]);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setBusy(false);
    }
  }

  async function handleCancelRun(runId?: string) {
    if (!runId) {
      return;
    }
    try {
      await cancelAgentRun(canvasId, runId);
      setItems((current) =>
        current.map((item) =>
          item.kind === "run" && item.runId === runId
            ? { ...item, status: "cancelled" as const }
            : item,
        ),
      );
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : messages.canvas.runCardCancelFailed,
      );
    }
  }

  /** Answer a blocked approval; the turn resumes as soon as this lands. */
  async function handleApproval(
    id: string,
    decision: "allow_once" | "allow_session" | "deny",
  ) {
    setItems((current) =>
      current.map((item) =>
        item.kind === "approval" && item.id === id
          ? {
              ...item,
              status: decision === "deny" ? ("denied" as const) : ("allowed" as const),
              scope:
                decision === "allow_session"
                  ? ("session" as const)
                  : ("once" as const),
            }
          : item,
      ),
    );
    try {
      await resolveAgentApproval(id, decision);
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : messages.canvas.agentChatApprovalFailed,
      );
    }
  }

  async function handleSteer(content: string) {
    if (!content.trim()) {
      return;
    }
    const id = newId("user");
    const sessionId = activeSessionId();
    const steeringMessage: UiMessage = {
      id,
      kind: "user",
      content,
      sessionId,
      steering: true,
    };
    setItems((current) => [...current, steeringMessage]);
    setDraft("");
    try {
      const result = await steerCanvasAgentChat({
        canvasId,
        sessionId,
        messageId: id,
        content,
      });
      if (result === "no-turn") {
        // The turn already finished; send it as a normal message instead.
        setItems((current) => current.filter((item) => item.id !== id));
        const plain: UiMessage = { id, kind: "user", content, sessionId };
        await runAgentTurn(plain, items);
      }
    } catch (caught) {
      setItems((current) =>
        current.map((item) =>
          item.id === id && item.kind === "user"
            ? { ...item, failed: true }
            : item,
        ),
      );
      toast.error(
        caught instanceof Error
          ? caught.message
          : messages.canvas.agentChatSteerFailed,
      );
    }
  }

  async function handleSend() {
    const content = draft.trim();
    const attachments = pendingAttachments;
    if ((!content && attachments.length === 0) || uploading) {
      return;
    }
    if (busy) {
      // The agent is working: add guidance at its next step instead of
      // forcing the user to stop and start over.
      if (attachments.length > 0) {
        return;
      }
      await handleSteer(content);
      return;
    }

    const userMessage: UiMessage = {
      id: newId("user"),
      kind: "user",
      content,
      sessionId: activeSessionId(),
      ...(attachments.length > 0
        ? {
            attachments: attachments.map((item) => ({
              url: item.url,
              name: item.name,
              kind: item.kind,
            })),
          }
        : {}),
    };

    setDraft("");
    setPendingAttachments([]);
    for (const item of attachments) {
      if (item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    }
    await runAgentTurn(userMessage, items);
  }

  async function handleContinue() {
    if (busy || !continuePending || uploading) {
      return;
    }
    const userMessage: UiMessage = {
      id: newId("user"),
      kind: "user",
      content: messages.canvas.agentChatContinuePrompt,
      sessionId: activeSessionId(),
    };
    await runAgentTurn(userMessage, items);
  }

  const canSend =
    Boolean(modelId) &&
    !uploading &&
    (draft.trim().length > 0 || pendingAttachments.length > 0);

  const messageGroups = useMemo(() => groupMessages(items), [items]);
  const streamingAssistantId = useMemo(() => {
    if (!busy || items.length === 0) {
      return null;
    }
    const last = items[items.length - 1];
    return last?.kind === "assistant" ? last.id : null;
  }, [busy, items]);

  if (!open) {
    return null;
  }

  function toggleToolExpanded(toolId: string) {
    setItems((current) =>
      current.map((entry) =>
        entry.id === toolId && entry.kind === "tool"
          ? { ...entry, expanded: !entry.expanded }
          : entry,
      ),
    );
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    resizeDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: panelWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = resizeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const nextWidth = clampPanelWidth(
      drag.startWidth + (drag.startX - event.clientX),
    );
    setPanelWidth(nextWidth);
  }

  function handleResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = resizeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    resizeDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    setPanelWidth((current) => {
      const next = clampPanelWidth(current);
      savePanelWidth(next);
      return next;
    });
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-zinc-200/70 dark:border-zinc-800"
      style={{ width: panelWidth }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={messages.canvas.agentChatResize}
        title={messages.canvas.agentChatResize}
        className="absolute inset-y-0 -left-1 z-20 w-2 cursor-col-resize touch-none"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
      />
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {messages.canvas.agentChatTitle}
          </h2>
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-1">
          {chatModels.length > 0 ? (
            <Tooltip content={selectedModel?.id ?? modelId}>
              <span className="min-w-0">
                <PlaygroundModelSelect
                  models={chatModels}
                  value={modelId}
                  disabled={busy}
                  menuZIndex={80}
                  className="min-w-0 max-w-40"
                  triggerClassName={selectTriggerClassName("soft", "mini", true)}
                  onChange={setModelId}
                />
              </span>
            </Tooltip>
          ) : null}
          <span className="h-4 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.agentChatNewSession}
            title={messages.canvas.agentChatNewSession}
            disabled={busy || items.length === 0}
            onClick={handleNewSession}
          >
            <Icon icon={Plus} size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.agentChatClear}
            title={messages.canvas.agentChatClear}
            disabled={busy || items.length === 0}
            onClick={handleClear}
          >
            <Icon icon={Trash} size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={messages.canvas.agentChatCollapse}
            title={messages.canvas.agentChatCollapse}
            onClick={() => setOpen(false)}
          >
            <Icon icon={CaretRight} size={14} />
          </Button>
        </div>
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3 pt-1"
      >
        {items.length === 0 ? (
          <div className="px-1 py-3 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {messages.canvas.agentChatEmpty}
          </div>
        ) : null}

        {messageGroups.map((group) => {
          if (group.type === "divider") {
            const time = group.at
              ? new Date(group.at).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            return (
              <div
                key={group.key}
                className="flex items-center gap-2 pt-1 text-[10px] text-zinc-400 dark:text-zinc-500"
              >
                <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                <span>
                  {messages.canvas.agentChatNewSession}
                  {time ? ` · ${time}` : ""}
                </span>
                <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              </div>
            );
          }
          if (group.type === "user") {
            const item = group.item;
            return (
              <div key={group.key} className="flex justify-end">
                <div className="max-w-[88%] space-y-1.5">
                  {item.attachments && item.attachments.length > 0 ? (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {item.attachments.map((attachment) => (
                        <a
                          key={attachment.url}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-xl ring-1 ring-zinc-200/80 dark:ring-zinc-700"
                        >
                          <AttachmentPreview
                            url={attachment.url}
                            name={attachment.name}
                            kind={normalizeUiAttachmentKind(attachment.kind)}
                          />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {item.content ? (
                    <div className="rounded-2xl rounded-br-md bg-zinc-900 px-3.5 py-2.5 text-[13px] leading-relaxed text-white dark:bg-zinc-100 dark:text-zinc-900">
                      {item.content}
                    </div>
                  ) : null}
                  {item.steering ? (
                    <p
                      className={`text-right text-[10px] ${
                        item.failed
                          ? "text-red-500 dark:text-red-400"
                          : item.delivered
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-zinc-400"
                      }`}
                    >
                      {item.failed
                        ? messages.canvas.agentChatSteerFailed
                        : item.delivered
                          ? messages.canvas.agentChatSteerDelivered
                          : messages.canvas.agentChatSteerQueued}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          }

          if (group.type === "error") {
            return (
              <div
                key={group.key}
                className="flex items-start gap-2 pl-8 text-[12px] leading-relaxed text-red-600 dark:text-red-400"
              >
                <Icon
                  icon={WarningCircle}
                  size={14}
                  weight="fill"
                  className="mt-0.5 shrink-0"
                />
                <p className="min-w-0">
                  <span className="font-medium">
                    {messages.canvas.agentChatError}
                  </span>
                  {": "}
                  {group.item.content}
                </p>
              </div>
            );
          }

          return (
            <div key={group.key} className="flex gap-2">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <Icon icon={ChatCircle} size={13} weight="fill" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {group.items.map((item) => {
                  if (item.kind === "assistant") {
                    const streaming = streamingAssistantId === item.id;
                    if (!item.content.trim() && !streaming) {
                      return null;
                    }
                    return (
                      <PlaygroundChatMarkdown
                        key={item.id}
                        content={item.content}
                        streaming={streaming}
                        compact
                        className="text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-100"
                      />
                    );
                  }

                  if (item.kind === "approval") {
                    return (
                      <ApprovalCard
                        key={item.id}
                        item={item}
                        onDecide={(decision) => {
                          void handleApproval(item.id, decision);
                        }}
                      />
                    );
                  }

                  if (item.kind === "run") {
                    return (
                      <RunCard
                        key={item.id}
                        item={item}
                        onCancel={
                          item.runId
                            ? () => {
                                void handleCancelRun(item.runId);
                              }
                            : undefined
                        }
                      />
                    );
                  }

                  const statusLabel =
                    item.status === "running"
                      ? messages.canvas.agentChatToolRunning
                      : item.status === "failed"
                        ? messages.canvas.agentChatToolFailed
                        : messages.canvas.agentChatToolDone;
                  const expanded = Boolean(item.expanded);
                  const canExpand = Boolean(item.summary);

                  return (
                    <div key={item.id} className="min-w-0">
                      <button
                        type="button"
                        className="flex max-w-full items-center gap-1.5 rounded-md py-0.5 text-left text-[11px] text-zinc-500 transition-colors hover:text-zinc-700 disabled:hover:text-zinc-500 dark:text-zinc-400 dark:hover:text-zinc-200 dark:disabled:hover:text-zinc-400"
                        aria-label={`${statusLabel}: ${item.tool}`}
                        title={
                          canExpand
                            ? `${statusLabel}: ${item.tool}`
                            : undefined
                        }
                        disabled={!canExpand && item.status !== "running"}
                        onClick={() => {
                          if (canExpand) {
                            toggleToolExpanded(item.id);
                          }
                        }}
                      >
                        {item.status === "running" ? (
                          <Icon
                            icon={CircleNotch}
                            size={12}
                            className="shrink-0 animate-spin"
                          />
                        ) : item.status === "failed" ? (
                          <Icon
                            icon={WarningCircle}
                            size={12}
                            weight="fill"
                            className="shrink-0 text-red-500 dark:text-red-400"
                          />
                        ) : (
                          <Icon
                            icon={Check}
                            size={12}
                            weight="fill"
                            className="shrink-0 text-emerald-600 dark:text-emerald-400"
                          />
                        )}
                        <span className="truncate font-medium">
                          {item.tool}
                        </span>
                        {canExpand ? (
                          <Icon
                            icon={expanded ? CaretDown : CaretRight}
                            size={10}
                            className="shrink-0 opacity-70"
                          />
                        ) : null}
                      </button>
                      {expanded && item.summary ? (
                        <pre className="mt-1 max-h-28 overflow-auto rounded-lg bg-white/70 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                          {item.summary}
                        </pre>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {busy ? (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200/80 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <Icon icon={ChatCircle} size={13} weight="fill" />
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-zinc-400">
              <Icon icon={CircleNotch} size={12} className="animate-spin" />
              {messages.canvas.agentChatThinking}
            </div>
          </div>
        ) : null}

        {continuePending && !busy ? (
          <div className="flex items-center gap-2 pl-8">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!modelId || uploading}
              onClick={() => void handleContinue()}
            >
              {messages.canvas.agentChatContinue}
            </Button>
          </div>
        ) : null}
      </div>

      <footer className="p-3">
        {chatModels.length === 0 ? (
          <div className="mb-2 flex flex-col gap-2">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {messages.canvas.agentChatModelMissing}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onOpenModelSettings}
            >
              {messages.canvas.agentChatOpenSettings}
            </Button>
          </div>
        ) : null}

        {(selectionChips?.length ?? 0) > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selectionChips?.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 ring-1 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/70"
                title={`${chip.label} (${chip.id})`}
              >
                <span className="truncate">{chip.label}</span>
                {onRemoveSelection ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-full px-0.5 text-sky-600/70 transition-colors hover:text-sky-800 disabled:opacity-50 dark:text-sky-300/70 dark:hover:text-sky-100"
                    aria-label={messages.canvas.agentChatDeselect.replace(
                      "{name}",
                      chip.label,
                    )}
                    disabled={busy}
                    onClick={() => onRemoveSelection(chip.id)}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}

        {pendingAttachments.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pendingAttachments.map((item) => (
              <div
                key={item.id}
                className="relative h-14 w-14 overflow-hidden rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-700"
              >
                <AttachmentPreview
                  url={item.previewUrl}
                  name={item.name}
                  kind={item.kind}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-950/70 text-white"
                  aria-label={messages.canvas.agentChatRemoveAttach}
                  disabled={busy || uploading}
                  onClick={() => removePendingAttachment(item.id)}
                >
                  <Icon icon={X} size={10} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <textarea
            value={draft}
            rows={2}
            placeholder={messages.canvas.agentChatPlaceholder}
            className="w-full resize-none bg-transparent px-1.5 py-1 text-[13px] leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Send with Cmd/Ctrl+Enter; plain Enter keeps inserting a
              // newline so multi-line prompts are easy to write.
              if (
                event.key === "Enter" &&
                (event.metaKey || event.ctrlKey) &&
                !event.shiftKey
              ) {
                event.preventDefault();
                void handleSend();
              }
            }}
            onPaste={(event) => {
              const files = event.clipboardData?.files;
              if (files && files.length > 0) {
                const media = Array.from(files).filter(
                  (file) => inferChatMediaKind(file.type) !== null,
                );
                if (media.length > 0) {
                  event.preventDefault();
                  const list = new DataTransfer();
                  for (const file of media) {
                    list.items.add(file);
                  }
                  void handlePickFiles(list.files);
                }
              }
            }}
          />
          <p className="px-1.5 pb-1 text-[10px] text-zinc-400">
            {messages.canvas.agentChatSendHint}
          </p>
          {busy ? (
            <p className="mt-1 px-1.5 text-[10px] text-zinc-400">
              {messages.canvas.agentChatSteerHint}
            </p>
          ) : null}
          <div className="mt-1 flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept={AGENT_MEDIA_ACCEPT}
              multiple
              className="hidden"
              onChange={(event) => {
                void handlePickFiles(event.target.files);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label={messages.canvas.agentChatAttach}
              title={attachHint}
              disabled={
                busy ||
                uploading ||
                pendingAttachments.length >= MAX_ATTACHMENTS
              }
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Icon icon={CircleNotch} size={15} className="animate-spin" />
              ) : (
                <Icon icon={Paperclip} size={15} />
              )}
            </Button>
            {busy ? (
              <>
                <Button
                  type="button"
                  size="icon-circle-sm"
                  variant="primary"
                  className="ml-auto shrink-0"
                  aria-label={messages.canvas.agentChatSteerAction}
                  title={messages.canvas.agentChatSteerAction}
                  disabled={!canSend}
                  onClick={() => void handleSend()}
                >
                  <Icon icon={PaperPlaneTilt} size={15} weight="fill" />
                </Button>
                <Button
                  type="button"
                  size="icon-circle-sm"
                  variant="danger"
                  className="shrink-0"
                  aria-label={messages.canvas.agentChatStop}
                  title={messages.canvas.agentChatStop}
                  onClick={handleStop}
                >
                  <Icon icon={Stop} size={15} weight="fill" />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="icon-circle-sm"
                variant="primary"
                className="ml-auto shrink-0"
                aria-label={messages.canvas.agentChatSend}
                title={messages.canvas.agentChatSend}
                disabled={!canSend}
                onClick={() => void handleSend()}
              >
                <Icon icon={PaperPlaneTilt} size={15} weight="fill" />
              </Button>
            )}
          </div>
        </div>
      </footer>
    </aside>
  );
}

export { loadOpenPreference as loadCanvasAgentChatOpenPreference };

export const CanvasAgentChatPanel = memo(CanvasAgentChatPanelInner);
