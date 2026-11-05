"use client";

import { ArrowSquareOut, MagnifyingGlass, PuzzlePiece } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PlaygroundChatMarkdown } from "@/components/playground/playground-chat-markdown";
import {
  listCanvasSkills,
  readCanvasSkill,
  type CanvasSkillDetail,
  type CanvasSkillSummary,
} from "@/lib/canvas/canvas-api";
import { messages } from "@/messages";

/**
 * Read-only gallery of the built-in skills. Skills ship with the code, so this
 * panel only browses them and hands the chosen one to the agent composer.
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
  const [detail, setDetail] = useState<CanvasSkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listCanvasSkills()
      .then((list) => {
        if (!cancelled) {
          setSkills(list);
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

  useEffect(() => {
    if (!activeId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void readCanvasSkill(activeId)
      .then((next) => {
        if (!cancelled) {
          setDetail(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
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
        skill.tags.some((tag) => tag.toLowerCase().includes(needle)),
    );
  }, [query, skills]);

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="min-w-0">
        <label className="mb-2 flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
          <Icon icon={MagnifyingGlass} size={13} className="text-zinc-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={messages.canvas.skillsSearch}
            className="w-full bg-transparent text-xs outline-none placeholder:text-zinc-400"
          />
        </label>

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
                    className={`rounded-lg border px-2.5 py-2 transition-colors ${
                      active
                        ? "border-sky-300 bg-sky-50/60 dark:border-sky-500/40 dark:bg-sky-950/30"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon
                        icon={PuzzlePiece}
                        size={14}
                        className="mt-0.5 shrink-0 text-zinc-400"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-100">
                          {skill.name}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                          {skill.description}
                        </p>
                        {skill.tags.length > 0 ? (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {skill.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-zinc-100 px-1 text-[9px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-1.5 flex justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveId(active ? null : skill.id)}
                      >
                        {messages.canvas.skillsPreview}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={detailLoading || detail?.id !== skill.id}
                        onClick={() => {
                          if (detail?.id === skill.id) {
                            onInsert(detail);
                          } else {
                            setActiveId(skill.id);
                          }
                        }}
                      >
                        <Icon icon={ArrowSquareOut} size={12} />
                        {messages.canvas.skillsInsert}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="min-w-0 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
        {detailLoading ? (
          <p className="py-6 text-center text-[11px] text-zinc-400">
            {messages.loading}
          </p>
        ) : detail ? (
          <div className="max-h-[360px] overflow-y-auto">
            <PlaygroundChatMarkdown
              content={detail.content.slice(0, 4_000)}
              compact
              className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-200"
            />
            {detail.files.length > 0 ? (
              <div className="mt-3 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                  {messages.canvas.skillsFiles}
                </p>
                <ul className="space-y-0.5">
                  {detail.files.map((file) => (
                    <li
                      key={file}
                      className="truncate font-mono text-[10px] text-zinc-500"
                    >
                      {file}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="py-10 text-center text-[11px] text-zinc-400">
            {messages.canvas.skillsPreview}
          </p>
        )}
      </section>
    </div>
  );
}
