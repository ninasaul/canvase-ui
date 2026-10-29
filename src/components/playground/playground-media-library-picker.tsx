"use client";

import {
  Check,
  Image,
  MusicNote,
  Trash,
  UploadSimple,
  VideoCamera,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { Search } from "@/components/ui/search";
import { toast } from "@/components/ui/toast";
import { PlaygroundConfirmModal } from "./playground-confirm-modal";
import { ViewModeToggle, type ViewMode } from "@/components/ui/view-mode-toggle";
import {
  deletePortalMediaLibraryItem,
  listPortalMediaLibrary,
  type PortalMediaLibraryItem,
} from "@/lib/playground-media-library";
import {
  mediaReferenceUrlKey,
  type PlaygroundMediaType,
} from "@/lib/playground/media-references";
import { messages } from "@/messages";

const LIBRARY_BODY_HEIGHT_CLASS =
  "h-[min(54dvh,30rem)] min-h-[min(54dvh,30rem)] max-h-[min(54dvh,30rem)]";

type MediaLibraryPurposeFilter =
  | "all"
  | "playground_upload"
  | "generation_output";

type PlaygroundMediaLibraryPickerProps = {
  open: boolean;
  onClose: () => void;
  allowedMediaTypes: readonly PlaygroundMediaType[];
  /** Raw reference URLs already present in the composer stack. */
  selectedUrls?: readonly string[];
  /** Max items that can be pending-selected. Default unlimited. Frame slot = 1. */
  maxSelection?: number;
  onConfirm: (items: PortalMediaLibraryItem[]) => void;
  onUpload: () => void;
  /** When storage is missing, empty state shows a CTA that calls this. */
  onConfigureStorage?: () => void;
  /** When false, empty state prefers the storage configuration CTA. */
  storageConfigured?: boolean;
};

function LibraryPreview({
  item,
  iconSize = 18,
}: {
  item: PortalMediaLibraryItem;
  iconSize?: number;
}) {
  if (item.mediaType === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- library CDN URLs
      <img
        src={item.thumbnailUrl ?? item.url}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    );
  }
  if (item.mediaType === "video") {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {item.thumbnailUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- library CDN URLs */}
            <img
              src={item.thumbnailUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/15">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
                <Icon icon={VideoCamera} size={13} />
              </span>
            </span>
          </>
        ) : (
          <Icon icon={VideoCamera} size={iconSize} className="text-zinc-400" />
        )}
      </div>
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 dark:bg-zinc-800">
      <Icon icon={MusicNote} size={iconSize} className="text-zinc-400" />
    </div>
  );
}

function mediaTypeLabel(type: PlaygroundMediaType): string {
  if (type === "image") {
    return messages.playground.mentionTokenImage;
  }
  if (type === "video") {
    return messages.playground.mentionTokenVideo;
  }
  return messages.playground.mentionTokenAudio;
}

function formatAssetAge(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return messages.playground.justNow;
  }
  if (minutes < 60) {
    return messages.playground.minutesAgo.replace("{count}", String(minutes));
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return messages.playground.hoursAgo.replace("{count}", String(hours));
  }
  const days = Math.floor(hours / 24);
  return messages.playground.mediaLibraryDaysAgo.replace("{count}", String(days));
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function purposeLabelFor(item: PortalMediaLibraryItem): string {
  return item.purpose === "generation_output"
    ? messages.playground.mediaLibraryPurposeOutput
    : messages.playground.mediaLibraryPurposeUpload;
}

export function PlaygroundMediaLibraryPicker({
  open,
  onClose,
  allowedMediaTypes,
  selectedUrls = [],
  maxSelection,
  onConfirm,
  onUpload,
  onConfigureStorage,
  storageConfigured = true,
}: PlaygroundMediaLibraryPickerProps) {
  const [items, setItems] = useState<PortalMediaLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalMediaLibraryItem | null>(
    null,
  );
  const [mediaFilter, setMediaFilter] = useState<PlaygroundMediaType | "all">(
    allowedMediaTypes.length === 1 ? allowedMediaTypes[0]! : "all",
  );
  const [purposeFilter, setPurposeFilter] =
    useState<MediaLibraryPurposeFilter>("all");
  const requestRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Stabilize by content so parent re-renders with a fresh array do not refetch.
  const allowedMediaTypesKey = allowedMediaTypes.join(",");
  const stableAllowedMediaTypes = useMemo(
    () =>
      (allowedMediaTypesKey
        ? allowedMediaTypesKey.split(",")
        : []) as PlaygroundMediaType[],
    [allowedMediaTypesKey],
  );
  const selectedUrlsKey = selectedUrls.join("\0");
  const stableSelectedUrls = useMemo(
    () => (selectedUrlsKey ? selectedUrlsKey.split("\0") : []),
    [selectedUrlsKey],
  );

  const selectedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const url of stableSelectedUrls) {
      const key = mediaReferenceUrlKey(url);
      if (key) {
        keys.add(key);
      }
    }
    return keys;
  }, [stableSelectedUrls]);

  const pendingIdSet = useMemo(() => new Set(pendingIds), [pendingIds]);

  useEffect(() => {
    if (!open) {
      requestRef.current += 1;
      return;
    }
    // Reset the picker when it opens or its allowed media types change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMediaFilter(
      stableAllowedMediaTypes.length === 1
        ? stableAllowedMediaTypes[0]!
        : "all",
    );
    setPurposeFilter("all");
    setQuery("");
    setPendingIds([]);
  }, [stableAllowedMediaTypes, open]);

  const loadPage = useCallback(
    async (cursor: string | undefined, reset: boolean) => {
      const requestId = ++requestRef.current;
      if (reset) {
        setLoading(true);
        setError(null);
        setItems([]);
        setNextCursor(null);
        setLoadingMore(false);
      } else {
        setLoadingMore(true);
      }
      try {
        const mediaType =
          mediaFilter === "all"
            ? stableAllowedMediaTypes.length === 1
              ? stableAllowedMediaTypes[0]
              : undefined
            : mediaFilter;
        const result = await listPortalMediaLibrary({
          mediaType,
          purpose:
            purposeFilter === "all" ? undefined : purposeFilter,
          limit: 60,
          cursor,
        });
        if (requestId !== requestRef.current) {
          return;
        }
        setItems((current) => {
          const next = reset ? [] : current;
          const seen = new Set(next.map((item) => item.id));
          return [
            ...next,
            ...result.items.filter(
              (item) =>
                item.mediaType !== "other" &&
                stableAllowedMediaTypes.includes(item.mediaType) &&
                !seen.has(item.id),
            ),
          ];
        });
        setNextCursor(result.nextCursor);
      } catch (caught) {
        if (requestId !== requestRef.current) {
          return;
        }
        if (reset) {
          setError(
            caught instanceof Error
              ? caught.message
              : messages.playground.mediaLibraryLoadFailed,
          );
          setItems([]);
        } else {
          toast.danger(
            caught instanceof Error
              ? caught.message
              : messages.playground.mediaLibraryLoadFailed,
          );
        }
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [mediaFilter, purposeFilter, stableAllowedMediaTypes],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    // Fetching on open/filter change is the intended external synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPage(undefined, true);
  }, [loadPage, open]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loading || loadingMore) {
      return;
    }
    void loadPage(nextCursor, false);
  }, [loadPage, loading, loadingMore, nextCursor]);

  useEffect(() => {
    if (!open || !nextCursor || loading || loadingMore) {
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
  }, [loadMore, loading, loadingMore, nextCursor, open]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matched = items.filter((item) => {
      if (!normalized) {
        return true;
      }
      return (
        item.displayName.toLowerCase().includes(normalized) ||
        item.mimeType.toLowerCase().includes(normalized)
      );
    });
    return [...matched].sort((left, right) => {
      const leftUsed = selectedKeys.has(mediaReferenceUrlKey(left.url) ?? "");
      const rightUsed = selectedKeys.has(mediaReferenceUrlKey(right.url) ?? "");
      if (leftUsed !== rightUsed) {
        return leftUsed ? 1 : -1;
      }
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });
  }, [items, query, selectedKeys]);

  const usedCount = filtered.filter((item) =>
    selectedKeys.has(mediaReferenceUrlKey(item.url) ?? ""),
  ).length;

  const pendingItems = useMemo(
    () =>
      pendingIds
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is PortalMediaLibraryItem => Boolean(item)),
    [items, pendingIds],
  );

  function togglePending(item: PortalMediaLibraryItem, used: boolean) {
    if (used) {
      return;
    }
    const alreadyPending = pendingIds.includes(item.id);
    if (
      !alreadyPending &&
      maxSelection !== undefined &&
      maxSelection > 1 &&
      pendingIds.length >= maxSelection
    ) {
      toast.danger(messages.playground.mediaLibrarySelectionLimit);
      return;
    }
    setPendingIds((current) => {
      if (current.includes(item.id)) {
        return current.filter((id) => id !== item.id);
      }
      if (maxSelection === 1) {
        return [item.id];
      }
      return [...current, item.id];
    });
  }

  function handleConfirm() {
    if (pendingItems.length === 0) {
      return;
    }
    onConfirm(pendingItems);
    setPendingIds([]);
    onClose();
  }

  function handleDelete(
    event: { stopPropagation: () => void },
    item: PortalMediaLibraryItem,
  ) {
    event.stopPropagation();
    if (!item.deletable || deletingId) {
      return;
    }
    setDeleteTarget(item);
  }

  async function confirmDelete(item: PortalMediaLibraryItem) {
    setDeletingId(item.id);
    try {
      await deletePortalMediaLibraryItem(item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      setPendingIds((current) => current.filter((id) => id !== item.id));
      toast.success(messages.playground.mediaLibraryDeleted);
    } catch (caught) {
      toast.danger(
        caught instanceof Error
          ? caught.message
          : messages.playground.mediaLibraryDeleteFailed,
      );
    } finally {
      setDeletingId(null);
    }
  }

  function itemAriaLabel(
    item: PortalMediaLibraryItem,
    used: boolean,
    pending: boolean,
  ): string {
    if (used) {
      return `${item.displayName} · ${messages.playground.mediaLibraryInUse}`;
    }
    if (pending) {
      return `${item.displayName} · ${messages.playground.mediaLibrarySelected}`;
    }
    return `${item.displayName} · ${messages.playground.mediaLibrarySelect}`;
  }

  function handleItemKeyDown(
    event: { key: string; preventDefault: () => void },
    item: PortalMediaLibraryItem,
    used: boolean,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      togglePending(item, used);
    }
  }

  return (
    <>
      <Modal
      open={open}
      onClose={onClose}
      title={messages.playground.mediaLibraryTitle}
      size="7xl"
      variant="frame"
      closeLabel={messages.close}
      contentClassName={LIBRARY_BODY_HEIGHT_CLASS}
      headerExtra={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {allowedMediaTypes.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  variant={mediaFilter === "all" ? "secondary" : "ghost"}
                  onClick={() => setMediaFilter("all")}
                >
                  {messages.playground.mediaLibraryFilterAll}
                </Button>
                {allowedMediaTypes.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="xs"
                    variant={mediaFilter === type ? "secondary" : "ghost"}
                    onClick={() => setMediaFilter(type)}
                  >
                    {mediaTypeLabel(type)}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="xs"
                variant={purposeFilter === "all" ? "secondary" : "ghost"}
                onClick={() => setPurposeFilter("all")}
              >
                {messages.playground.mediaLibraryFilterAll}
              </Button>
              <Button
                type="button"
                size="xs"
                variant={
                  purposeFilter === "playground_upload" ? "secondary" : "ghost"
                }
                onClick={() => setPurposeFilter("playground_upload")}
              >
                {messages.playground.mediaLibraryPurposeUpload}
              </Button>
              <Button
                type="button"
                size="xs"
                variant={
                  purposeFilter === "generation_output" ? "secondary" : "ghost"
                }
                onClick={() => setPurposeFilter("generation_output")}
              >
                {messages.playground.mediaLibraryPurposeOutput}
              </Button>
            </div>
            <p className="shrink-0 text-[11px] tabular-nums text-zinc-400">
              {messages.playground.mediaLibraryCount.replace(
                "{count}",
                String(filtered.length),
              )}
              {usedCount > 0
                ? ` · ${messages.playground.mediaLibraryUsedCount.replace(
                    "{count}",
                    String(usedCount),
                  )}`
                : ""}
              {pendingIds.length > 0
                ? ` · ${messages.playground.mediaLibraryPendingCount.replace(
                    "{count}",
                    String(pendingIds.length),
                  )}`
                : ""}
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:max-w-lg sm:flex-1 sm:justify-end">
            <Search
              value={query}
              onChange={setQuery}
              placeholder={messages.playground.mediaLibrarySearch}
              clearLabel={messages.dateTimePicker.clear}
              className="min-w-0 flex-1"
            />
            <ViewModeToggle value={viewMode} onChange={setViewMode} size="sm" />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0"
              onClick={onUpload}
            >
              <Icon icon={UploadSimple} size={14} />
              {messages.playground.mediaLibraryChooseUpload}
            </Button>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-xs text-zinc-400">
            {messages.playground.mediaLibraryHint}
          </p>
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="shrink-0"
            disabled={pendingItems.length === 0}
            onClick={handleConfirm}
          >
            {pendingItems.length === 0
              ? messages.playground.mediaLibraryConfirmEmpty
              : messages.playground.mediaLibraryConfirm.replace(
                  "{count}",
                  String(pendingItems.length),
                )}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div
          className={`flex ${LIBRARY_BODY_HEIGHT_CLASS} items-center justify-center`}
        >
          <p className="text-sm text-zinc-500">{messages.loading}</p>
        </div>
      ) : error ? (
        <div
          className={`flex ${LIBRARY_BODY_HEIGHT_CLASS} flex-col items-center justify-center gap-3 px-4`}
        >
          <p className="text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void loadPage(undefined, true)}
            >
              {messages.playground.mediaLibraryRetry}
            </Button>
            {!storageConfigured && onConfigureStorage ? (
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={onConfigureStorage}
              >
                {messages.playground.mediaLibraryConfigureStorage}
              </Button>
            ) : null}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className={`flex ${LIBRARY_BODY_HEIGHT_CLASS} flex-col items-center justify-center gap-3 px-4`}
        >
          {!query.trim() && !storageConfigured ? (
            <>
              <Empty icon={Image} size="compact">
                {messages.canvas.storageNotConfigured}
              </Empty>
              {onConfigureStorage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={onConfigureStorage}
                >
                  {messages.playground.mediaLibraryConfigureStorage}
                </Button>
              ) : null}
            </>
          ) : (
            <Empty icon={Image} size="compact">
              {query.trim()
                ? messages.playground.mediaLibraryNoResults
                : messages.playground.mediaLibraryEmpty}
            </Empty>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div
          className={`grid ${LIBRARY_BODY_HEIGHT_CLASS} grid-cols-3 content-start gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7`}
        >
          {filtered.map((item) => {
            const used = selectedKeys.has(mediaReferenceUrlKey(item.url) ?? "");
            const pending = pendingIdSet.has(item.id);
            const age = formatAssetAge(item.createdAt);
            const purposeLabel = purposeLabelFor(item);

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={used ? -1 : 0}
                aria-disabled={used}
                aria-pressed={pending}
                aria-label={itemAriaLabel(item, used, pending)}
                className={`group relative overflow-hidden rounded-lg text-left outline-none transition-[opacity,box-shadow] focus-visible:ring-2 focus-visible:ring-zinc-500 ${
                  used
                    ? "cursor-not-allowed opacity-55"
                    : pending
                      ? "cursor-pointer ring-2 ring-zinc-800 ring-offset-1 ring-offset-white dark:ring-zinc-200 dark:ring-offset-zinc-950"
                      : "cursor-pointer hover:shadow-md"
                }`}
                onClick={() => togglePending(item, used)}
                onKeyDown={(event) => handleItemKeyDown(event, item, used)}
              >
                <div className="relative aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                  <LibraryPreview item={item} iconSize={16} />
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-1">
                    <span className="rounded bg-black/55 px-1 py-0.5 text-[9px] font-medium leading-none text-white">
                      {purposeLabel}
                    </span>
                    <div className="pointer-events-auto flex items-center gap-1">
                      {item.deletable ? (
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-red-600"
                          aria-label={messages.playground.mediaLibraryDelete}
                          disabled={deletingId === item.id}
                          onClick={(event) => handleDelete(event, item)}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <Icon icon={Trash} size={11} />
                        </button>
                      ) : null}
                      {used || pending ? (
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
                            used
                              ? "bg-white text-zinc-900"
                              : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          }`}
                        >
                          <Icon icon={Check} size={10} />
                        </span>
                      ) : (
                        <span className="h-4 w-4 rounded-full border border-white/80 bg-black/25" />
                      )}
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/65 to-transparent px-1.5 pb-1.5 pt-5">
                    <p className="truncate text-[10px] font-medium text-white">
                      {item.displayName}
                    </p>
                    {age || formatBytes(item.sizeBytes) ? (
                      <p className="mt-0.5 truncate text-[9px] text-white/65">
                        {[age, formatBytes(item.sizeBytes)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`${LIBRARY_BODY_HEIGHT_CLASS} flex flex-col gap-1`}>
          {filtered.map((item) => {
            const used = selectedKeys.has(mediaReferenceUrlKey(item.url) ?? "");
            const pending = pendingIdSet.has(item.id);
            const age = formatAssetAge(item.createdAt);
            const purposeLabel = purposeLabelFor(item);

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={used ? -1 : 0}
                aria-disabled={used}
                aria-pressed={pending}
                aria-label={itemAriaLabel(item, used, pending)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-zinc-500 ${
                  used
                    ? "cursor-not-allowed opacity-55"
                    : pending
                      ? "cursor-pointer bg-zinc-100 dark:bg-zinc-800"
                      : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
                onClick={() => togglePending(item, used)}
                onKeyDown={(event) => handleItemKeyDown(event, item, used)}
              >
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-950">
                  <LibraryPreview item={item} iconSize={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {item.displayName}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                    {purposeLabel}
                    {item.mediaType !== "other" && allowedMediaTypes.length > 1
                      ? ` · ${mediaTypeLabel(item.mediaType)}`
                      : ""}
                    {age ? ` · ${age}` : ""}
                    {formatBytes(item.sizeBytes)
                      ? ` · ${formatBytes(item.sizeBytes)}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    used || pending
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-950"
                  }`}
                >
                  {used || pending ? <Icon icon={Check} size={11} /> : null}
                </span>
                {item.deletable ? (
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    aria-label={messages.playground.mediaLibraryDelete}
                    disabled={deletingId === item.id}
                    onClick={(event) => handleDelete(event, item)}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <Icon icon={Trash} size={14} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {!loading && !error && nextCursor ? (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-3"
        >
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={loadingMore}
            onClick={loadMore}
          >
            {loadingMore
              ? messages.playground.mediaLibraryLoadingMore
              : messages.playground.mediaLibraryLoadMore}
          </Button>
        </div>
      ) : null}
      </Modal>
      <PlaygroundConfirmModal
        open={Boolean(deleteTarget)}
        title={messages.playground.mediaLibraryDeleteConfirmTitle}
        description={messages.playground.mediaLibraryDeleteConfirmDescription.replace(
          "{name}",
          deleteTarget?.displayName ?? "",
        )}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) {
            void confirmDelete(target);
          }
        }}
      />
    </>
  );
}
