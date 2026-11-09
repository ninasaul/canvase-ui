"use client";

import {
  Check,
  Copy,
  PaintBrush,
  Plus,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { ConfirmModal } from "@/components/confirm-modal";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Search } from "@/components/ui/search";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { useOverlayState } from "@/hooks/use-overlay-state";
import {
  useFeatureMessages,
  useMessages,
} from "@/hooks/use-feature-messages";
import {
  createCanvas,
  deleteCanvas,
  duplicateCanvas,
  listCanvases,
  updateCanvas,
  type CanvasSummary,
} from "@/lib/canvas/canvas-api";
import {
  canvasTemplateKeys,
  createCanvasTemplateGraph,
  type CanvasTemplateKey,
} from "@/lib/canvas/canvas-templates";
import { formatShortDate } from "@/lib/format";
import { useLocaleRouter } from "@/lib/locale-navigation";
import type { RuntimeMessages } from "@/messages";
import { parseCanvasGraph } from "@/lib/tu-shared-browser";

function templateLabelsFor(
  canvas: RuntimeMessages["canvas"],
): Record<CanvasTemplateKey, { label: string; hint: string }> {
  return {
    blank: {
      label: canvas.templateBlank,
      hint: canvas.templateBlankHint,
    },
    "text-to-image": {
      label: canvas.templateTextToImage,
      hint: canvas.templateTextToImageHint,
    },
    "image-to-video": {
      label: canvas.templateImageToVideo,
      hint: canvas.templateImageToVideoHint,
    },
    "multi-reference": {
      label: canvas.templateMultiReference,
      hint: canvas.templateMultiReferenceHint,
    },
  };
}

function CanvasPreview({ document }: { document: CanvasSummary }) {
  if (!document.previewUrl) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <Icon
          icon={PaintBrush}
          size={26}
          className="text-zinc-300 dark:text-zinc-700"
        />
      </div>
    );
  }
  if (document.previewType === "video") {
    return (
      <video
        src={document.previewUrl}
        muted
        preload="metadata"
        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- canvas list preview
    <img
      src={document.previewUrl}
      alt=""
      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      draggable={false}
    />
  );
}

export function CanvasList() {
  const messages = useMessages();
  const common = useFeatureMessages("common");
  const templateLabels = templateLabelsFor(messages.canvas);
  // Node count per template, so a card says what it will actually create.
  const templateNodeCounts = useMemo(() => {
    const counts = {} as Record<CanvasTemplateKey, number>;
    for (const key of canvasTemplateKeys) {
      counts[key] = createCanvasTemplateGraph(key).nodes.length;
    }
    return counts;
  }, []);

  const { push } = useLocaleRouter();
  const importRef = useRef<HTMLInputElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<CanvasTemplateKey>("blank");
  const [deleteTarget, setDeleteTarget] = useState<CanvasSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteModal = useOverlayState();
  const [busy, setBusy] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CanvasSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const requestRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadPage = useCallback(
    async (targetPage: number, reset: boolean) => {
      const requestId = ++requestRef.current;
      if (reset) {
        setLoading(true);
        setLoadingMore(false);
        setError(null);
      } else {
        setLoadingMore(true);
      }
      try {
        const result = await listCanvases({
          page: targetPage,
          limit: PAGE_SIZE,
          search,
        });
        if (requestId !== requestRef.current) {
          return;
        }
        setItems((current) => {
          if (reset) {
            return result.items;
          }
          const seen = new Set(current.map((item) => item.id));
          return [
            ...current,
            ...result.items.filter((item) => !seen.has(item.id)),
          ];
        });
        setTotal(result.total);
        setHasMore(targetPage * PAGE_SIZE < result.total);
      } catch (caught) {
        if (requestId !== requestRef.current) {
          return;
        }
        const message =
          caught instanceof Error
            ? caught.message
            : messages.canvas.importFailed;
        if (reset) {
          setItems([]);
          setError(message);
        } else {
          toast.danger(message);
        }
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [messages.canvas.importFailed, search],
  );

  useEffect(() => {
    void loadPage(1, true);
  }, [loadPage]);

  const reload = useCallback(() => {
    void loadPage(1, true);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) {
      return;
    }
    void loadPage(Math.floor(items.length / PAGE_SIZE) + 1, false);
  }, [hasMore, items.length, loadPage, loading, loadingMore]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) {
      return;
    }
    const node = sentinelRef.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore, loadingMore]);

  const documents = items;

  function errorToast(error: unknown) {
    toast.danger(
      error instanceof Error ? error.message : messages.canvas.importFailed,
    );
  }

  async function create() {
    setBusy(true);
    try {
      const document = await createCanvas({
        title: title.trim() || messages.canvas.untitled,
        graph: createCanvasTemplateGraph(template),
      });
      setCreateOpen(false);
      setTitle("");
      setTemplate("blank");
      push(`/canvas/${document.id}`);
    } catch (error) {
      errorToast(error);
    } finally {
      setBusy(false);
    }
  }

  async function rename(document: CanvasSummary, nextTitle: string) {
    if (!nextTitle.trim() || nextTitle.trim() === document.title) {
      return;
    }
    try {
      await updateCanvas(document.id, {
        version: document.version,
        title: nextTitle,
      });
      reload();
    } catch (error) {
      errorToast(error);
    }
  }

  async function duplicate(document: CanvasSummary) {
    try {
      await duplicateCanvas(
        document.id,
        `${document.title} ${messages.canvas.copySuffix}`,
      );
      reload();
    } catch (error) {
      errorToast(error);
    }
  }

  function requestRemove(document: CanvasSummary) {
    setDeleteTarget(document);
    deleteModal.open();
  }

  async function confirmRemove() {
    if (!deleteTarget || deleting) {
      return;
    }
    setDeleting(true);
    try {
      await deleteCanvas(deleteTarget.id);
      deleteModal.close();
      setDeleteTarget(null);
      reload();
    } catch (error) {
      errorToast(error);
    } finally {
      setDeleting(false);
    }
  }

  async function importJson(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as {
        title?: unknown;
        graph?: unknown;
      };
      const graph = parseCanvasGraph(parsed.graph ?? parsed);
      const title =
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title.trim()
          : file.name.replace(/\.json$/i, "");
      const created = await createCanvas({
        title: title || messages.canvas.untitled,
        graph,
      });
      push(`/canvas/${created.id}`);
    } catch {
      toast.danger(messages.canvas.importFailed);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="canvas-page-in mx-auto w-full max-w-7xl px-5 py-8">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandLogo size={28} alt={common.appName} className="shrink-0" />
            <h1 className="shrink-0 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {messages.canvas.title}
            </h1>
            {total > 0 ? (
              <span
                className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                title={messages.canvas.canvasCount.replace(
                  "{count}",
                  String(total),
                )}
              >
                {total}
              </span>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
            <Search
              value={searchInput}
              onChange={setSearchInput}
              placeholder={messages.canvas.searchCanvas}
              clearLabel={messages.canvas.clearSearch}
              wrapperClassName="min-w-0 flex-1 sm:w-56 sm:flex-none"
            />
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importJson(file);
                }
                event.target.value = "";
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => importRef.current?.click()}
            >
              <Icon icon={UploadSimple} size={14} />
              {messages.canvas.importJson}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="shrink-0"
              onClick={() => setCreateOpen(true)}
            >
              <Icon icon={Plus} size={14} />
              {messages.canvas.newCanvas}
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="py-20 text-center text-sm text-zinc-400">
            {messages.loading}
          </div>
        ) : error ? (
          <Empty icon={PaintBrush} className="py-20">
            <p className="font-medium text-zinc-700 dark:text-zinc-200">
              {error}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={reload}
            >
              {messages.canvas.reload}
            </Button>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {documents.length === 0 ? (
              search ? (
                <div
                  className="flex aspect-[4/3] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-5 dark:border-zinc-800 dark:bg-zinc-950"
                  role="status"
                >
                  <p className="text-center text-xs leading-relaxed text-zinc-400">
                    {messages.canvas.emptySearchTitle}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  aria-label={messages.canvas.newCanvas}
                  className="group flex aspect-[4/3] flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 outline-none transition-[color,border-color,transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-50/80 focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400/30 active:translate-y-0 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-500 dark:hover:bg-zinc-950/80 dark:focus-visible:border-zinc-500 dark:focus-visible:ring-zinc-500/30"
                >
                  <Icon
                    icon={Plus}
                    size={20}
                    className="text-zinc-300 transition-[color,transform] duration-200 ease-out group-hover:scale-110 group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400"
                  />
                  <span className="text-xs font-medium tracking-wide text-zinc-400 transition-colors duration-200 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300">
                    {messages.canvas.newCanvas}
                  </span>
                </button>
              )
            ) : null}
            {documents.map((document, index) => (
              <div
                key={document.id}
                className="canvas-card-in group overflow-hidden rounded-xl border border-zinc-200 bg-white transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-zinc-300 hover:shadow-[0_16px_36px_-24px_rgba(24,24,27,0.5)] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
              >
                <button
                  type="button"
                  className="block aspect-[4/3] w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950"
                  onClick={() => push(`/canvas/${document.id}`)}
                >
                  <CanvasPreview document={document} />
                </button>
                <div className="space-y-2 p-3">
                  <input
                    defaultValue={document.title}
                    aria-label={messages.canvas.canvasName}
                    className="w-full truncate border-0 bg-transparent p-0 text-sm font-medium text-zinc-800 outline-none dark:text-zinc-100"
                    onBlur={(event) => void rename(document, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[10px] text-zinc-400">
                      {messages.canvas.nodeCount.replace(
                        "{count}",
                        String(document.nodeCount),
                      )}{" "}
                      · {formatShortDate(document.updatedAt)}
                    </p>
                    <div className="canvas-card-actions flex shrink-0 items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={messages.canvas.duplicate}
                        title={messages.canvas.duplicate}
                        onClick={() => void duplicate(document)}
                      >
                        <Icon icon={Copy} size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-500 hover:text-red-600"
                        aria-label={messages.canvas.delete}
                        title={messages.canvas.delete}
                        onClick={() => requestRemove(document)}
                      >
                        <Icon icon={Trash} size={13} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && documents.length > 0 && hasMore ? (
          <div
            ref={sentinelRef}
            className="mt-6 flex items-center justify-center border-t border-zinc-100 pt-4 dark:border-zinc-800"
          >
            <Button
              variant="ghost"
              size="sm"
              disabled={loadingMore}
              onClick={loadMore}
            >
              {loadingMore ? messages.loading : messages.canvas.loadMore}
            </Button>
          </div>
        ) : null}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={messages.canvas.createTitle}
        size="lg"
        closeLabel={messages.close}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setCreateOpen(false)}
            >
              {messages.canvas.cancel}
            </Button>
            <Button
              type="submit"
              form="create-canvas-form"
              variant="primary"
              size="sm"
              disabled={busy}
            >
              {busy ? messages.loading : messages.canvas.create}
            </Button>
          </div>
        }
      >
        <form
          id="create-canvas-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-zinc-400">
              {messages.canvas.canvasName}
            </span>
            <Input
              autoFocus
              value={title}
              size="sm"
              maxLength={80}
              disabled={busy}
              placeholder={messages.canvas.canvasNamePlaceholder}
              onChange={(event) => setTitle(event.target.value)}
            />
            <span className="block text-xs text-zinc-400">
              {title.trim().length > 0
                ? `${title.trim().length}/80`
                : messages.canvas.createNameHint}
            </span>
          </label>
          <div className="space-y-1.5">
            <span
              id="create-canvas-template-label"
              className="text-[11px] font-medium text-zinc-400"
            >
              {messages.canvas.templateLabel}
            </span>
            <div
              role="radiogroup"
              aria-labelledby="create-canvas-template-label"
              className="grid gap-2 sm:grid-cols-2"
            >
              {canvasTemplateKeys.map((key) => {
                const option = templateLabels[key];
                const selected = template === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={busy}
                    className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-60 ${
                      selected
                        ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900"
                        : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
                    }`}
                    onClick={() => setTemplate(key)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {option.label}
                      </p>
                      {selected ? (
                        <Icon
                          icon={Check}
                          size={14}
                          weight="bold"
                          className="mt-0.5 shrink-0 text-zinc-900 dark:text-zinc-100"
                        />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {option.hint}
                    </p>
                    {templateNodeCounts[key] > 0 ? (
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {messages.canvas.createNodeCount.replace(
                          "{count}",
                          String(templateNodeCounts[key]),
                        )}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        state={deleteModal}
        title={messages.canvas.deleteCanvasTitle}
        description={
          deleteTarget
            ? `${deleteTarget.title} · ${messages.canvas.deleteConfirm}`
            : messages.canvas.deleteConfirm
        }
        confirmLabel={messages.canvas.delete}
        danger
        submitting={deleting}
        onConfirm={() => void confirmRemove()}
      />
    </div>
  );
}
