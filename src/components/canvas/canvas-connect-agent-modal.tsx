"use client";

import { Copy, Plugs, Trash } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { useMessages } from "@/hooks/use-feature-messages";
import {
  createAgentToken,
  listAgentTokens,
  revokeAgentToken,
  type AgentTokenCreated,
  type AgentTokenListItem,
} from "@/lib/canvas/canvas-api";

export function CanvasConnectAgentModal({
  open,
  canvasId,
  onClose,
  onTokensChanged,
}: {
  open: boolean;
  canvasId: string;
  onClose: () => void;
  onTokensChanged?: (hasActive: boolean) => void;
}) {
  const messages = useMessages();
  const [items, setItems] = useState<AgentTokenListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [created, setCreated] = useState<AgentTokenCreated | null>(null);

  const refresh = useCallback(async () => {
    if (!canvasId) {
      return;
    }
    setLoading(true);
    try {
      const result = await listAgentTokens(canvasId);
      setItems(result.items);
      onTokensChanged?.(result.items.some((item) => item.active));
    } catch {
      toast.danger(messages.canvas.connectAgentListFailed);
    } finally {
      setLoading(false);
    }
  }, [canvasId, messages.canvas.connectAgentListFailed, onTokensChanged]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setCreated(null);
    void refresh();
  }, [open, refresh]);

  async function handleIssue() {
    setIssuing(true);
    try {
      const result = await createAgentToken({
        canvasId,
        scopes: ["canvas:read", "canvas:edit", "canvas:run"],
        ttlHours: 24,
        label: "Codex MCP",
      });
      setCreated(result);
      await refresh();
    } catch {
      toast.danger(messages.canvas.connectAgentIssueFailed);
    } finally {
      setIssuing(false);
    }
  }

  async function handleRevoke(tokenId: string) {
    try {
      await revokeAgentToken(tokenId);
      toast.success(messages.canvas.connectAgentRevoked);
      if (created?.id === tokenId) {
        setCreated(null);
      }
      await refresh();
    } catch {
      toast.danger(messages.canvas.connectAgentRevokeFailed);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(messages.canvas.connectAgentCopied);
    } catch {
      toast.danger(messages.copyFailed);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.canvas.connectAgentTitle}
      description={messages.canvas.connectAgentHint}
      closeLabel={messages.close}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {messages.canvas.connectAgentPolling}
          </p>
          <Button
            type="button"
            variant="primary"
            disabled={issuing || !canvasId}
            onClick={() => void handleIssue()}
          >
            <Icon icon={Plugs} size={14} />
            {issuing
              ? messages.canvas.connectAgentIssuing
              : messages.canvas.connectAgentIssue}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {created ? (
          <section className="flex flex-col gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/60">
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              {messages.canvas.connectAgentTokenOnce}
            </p>
            <pre className="max-h-48 overflow-auto rounded-md bg-zinc-950/90 p-3 text-[11px] leading-relaxed text-zinc-100">
              {JSON.stringify(created.mcpConfig, null, 2)}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  void copyText(JSON.stringify(created.mcpConfig, null, 2))
                }
              >
                <Icon icon={Copy} size={14} />
                {messages.canvas.connectAgentCopyConfig}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  void copyText(
                    [
                      `CANVASE_BASE_URL=${created.env.CANVASE_BASE_URL}`,
                      `CANVASE_TOKEN=${created.env.CANVASE_TOKEN}`,
                      `CANVASE_CANVAS_ID=${created.env.CANVASE_CANVAS_ID}`,
                    ].join("\n"),
                  )
                }
              >
                <Icon icon={Copy} size={14} />
                {messages.canvas.connectAgentCopyEnv}
              </Button>
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {messages.canvas.connectAgentActiveTokens}
          </h3>
          {loading && items.length === 0 ? (
            <p className="text-sm text-zinc-500">{messages.loading}</p>
          ) : null}
          {!loading && items.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {messages.canvas.connectAgentNoTokens}
            </p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const statusLabel = item.revokedAt
                ? messages.canvas.connectAgentRevoked
                : item.active
                  ? null
                  : messages.canvas.connectAgentExpired;
              return (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200/80 px-3 py-2 dark:border-zinc-700/70"
                >
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {item.label || item.id}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {messages.canvas.connectAgentScopes}:{" "}
                      {item.scopes.join(", ")}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {messages.canvas.connectAgentExpires}:{" "}
                      {new Date(item.expiresAt).toLocaleString()}
                      {statusLabel ? ` · ${statusLabel}` : ""}
                    </span>
                  </div>
                  {item.active ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleRevoke(item.id)}
                    >
                      <Icon icon={Trash} size={14} />
                      {messages.canvas.connectAgentRevoke}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
