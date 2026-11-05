"use client";

import {
  ArrowSquareOut,
  CaretDown,
  MagnifyingGlass,
  PuzzlePiece,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PlaygroundChatMarkdown } from "@/components/playground/playground-chat-markdown";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  listCanvasSkills,
  readCanvasSkill,
  type CanvasSkillDetail,
  type CanvasSkillSummary,
} from "@/lib/canvas/canvas-api";
import { messages } from "@/messages";

/** Only the head of a long SKILL.md is rendered; the model still gets it all. */
const PREVIEW_LIMIT = 6_000;

function skillText(skill: CanvasSkillSummary | CanvasSkillDetail): string {
  return skill.descriptionZh?.trim() || skill.description;
}

/**
 * Read-only gallery of the built-in skills. Skills ship with the code, so this
 * panel only browses them and hands the chosen one to the agent composer.
 *
 * Layout: the list row itself selects a skill, the detail column fills the
 * dialog height, and insert works in one click (load then hand over).
 */
export function SkillsSettingsTab({
  onInsert,
}: {
  onInsert: (skill: CanvasSkillDetail) => void;
}) {
  const [skills, setSkills] = useState<CanvasSkillSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<
    Record<string, CanvasSkillDetail>
  >({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [inserting, setInserting] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const requestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void listCanvasSkills()
      .then((list) => {
        if (!cancelled) {
          setSkills(list);
          setActiveId((current) => current ?? list[0]?.id ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(messages.canvas.skillsEmpty);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the selected skill once. The in-flight guard lives in a ref: keying it
  // on state re-ran the effect, cancelled the request and looped forever.
  useEffect(() => {
    if (!activeId || requestedRef.current.has(activeId)) {
      return;
    }
    requestedRef.current.add(activeId);
    setDetailLoading(activeId);
    void readCanvasSkill(activeId)
      .then((detail) => {
        setDetailCache((current) => ({ ...current, [detail.id]: detail }));
      })
      .catch(() => {
        requestedRef.current.delete(activeId);
      })
      .finally(() => {
        setDetailLoading((current) => (current === activeId ? null : current));
      });
  }, [activeId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return skills;
    }
    return skills.filter(
      (skill) =>
        skill.id.includes(needle) ||
        skill.name.toLowerCase().includes(needle) ||
        skillText(skill).toLowerCase().includes(needle) ||
        skill.tags.some((tag) => tag.toLowerCase().includes(needle)),
    );
  }, [query, skills]);

  const detail = activeId ? detailCache[activeId] : undefined;

  // One click: load (if needed) then insert. Waiting for a second click was
  // the main "nothing happens" complaint.
  async function insertSkill(skill: { id: string }) {
    if (inserting) {
      return;
    }
    setInserting(true);
    try {
      const next = detailCache[skill.id] ?? (await readCanvasSkill(skill.id));
      setDetailCache((current) => ({ ...current, [next.id]: next }));
      onInsert(next);
    } finally {
      setInserting(false);
    }
  }

  return (
    <div className="grid h-full min-h-[440px] gap-3 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <section className="flex min-h-0 min-w-0 flex-col">
        <label className="mb-2 flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
          <Icon icon={MagnifyingGlass} size={13} className="text-zinc-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={messages.canvas.skillsSearch}
            className="w-full bg-transparent text-xs outline-none placeholder:text-zinc-400"
          />
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-[11px] text-zinc-400">
              {messages.loading}
            </p>
          ) : error ? (
            <p className="py-6 text-center text-[11px] text-red-500">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-zinc-400">
              {skills.length === 0
                ? messages.canvas.skillsEmpty
                : messages.canvas.skillsNoMatch}
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((skill) => {
                const active = skill.id === activeId;
                return (
                  <li key={skill.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-pressed={active}
                      onClick={() => setActiveId(skill.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setActiveId(skill.id);
                        }
                      }}
                      className={`group flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                        active
                          ? "border-sky-300 bg-sky-50/70 dark:border-sky-500/40 dark:bg-sky-950/30"
                          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <Icon
                        icon={PuzzlePiece}
                        size={14}
                        className={`mt-0.5 shrink-0 ${
                          active ? "text-sky-500" : "text-zinc-400"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-100">
                          {skill.name}
                        </p>
                        {skill.descriptionZh ? (
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-zinc-600 dark:text-zinc-300">
                            {skill.descriptionZh}
                          </p>
                        ) : null}
                        <p
                          className={`mt-0.5 text-[10px] text-zinc-400 ${
                            skill.descriptionZh ? "line-clamp-1" : "line-clamp-2"
                          }`}
                        >
                          {skill.description}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label={messages.canvas.skillsInsert}
                        disabled={inserting}
                        onClick={(event) => {
                          event.stopPropagation();
                          void insertSkill(skill);
                        }}
                      >
                        <Icon icon={ArrowSquareOut} size={12} />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="flex min-h-0 min-w-0 flex-col rounded-lg border border-zinc-200 dark:border-zinc-700">
        {detail ? (
          <>
            <header className="flex shrink-0 items-center gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-100">
                  {detail.name}
                </p>
                <p className="truncate text-[10px] text-zinc-400">
                  {skillText(detail)}
                </p>
              </div>
              {detail.files.length > 0 ? (
                <div className="relative shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilesOpen((open) => !open)}
                  >
                    {messages.canvas.skillsFiles} ({detail.files.length})
                    <Icon icon={CaretDown} size={10} />
                  </Button>
                  {filesOpen ? (
                    <div className="absolute right-0 top-full z-10 mt-1 max-h-48 w-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                      {detail.files.map((file) => (
                        <p
                          key={file}
                          className="truncate rounded px-2 py-1 font-mono text-[10px] text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          {file}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                disabled={inserting}
                onClick={() => void insertSkill(detail)}
              >
                <Icon icon={ArrowSquareOut} size={12} />
                {inserting ? messages.loading : messages.canvas.skillsInsert}
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              <PlaygroundChatMarkdown
                content={detail.content.slice(0, PREVIEW_LIMIT)}
                compact
                className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-200"
              />
              {detail.content.length > PREVIEW_LIMIT ? (
                <p className="mt-2 rounded bg-zinc-50 px-2 py-1 text-[10px] text-zinc-400 dark:bg-zinc-800/60">
                  {messages.canvas.skillsTruncated
                    .replace("{shown}", String(PREVIEW_LIMIT))
                    .replace("{total}", String(detail.content.length))}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-zinc-400">
            <Icon icon={PuzzlePiece} size={22} />
            <p className="text-[11px]">
              {detailLoading
                ? messages.loading
                : messages.canvas.skillsSelectHint}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
