"use client";

import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export type PaginationItem = number | "ellipsis";

/**
 * Build a compact page list with ellipsis, e.g. `1 … 4 5 6 … 20`.
 */
export function getPaginationItems(
  page: number,
  totalPages: number,
  siblingCount = 1,
): PaginationItem[] {
  const safeTotal = Math.max(0, Math.floor(totalPages));
  const safePage = Math.min(
    Math.max(1, Math.floor(page)),
    Math.max(1, safeTotal),
  );

  if (safeTotal <= 0) {
    return [];
  }
  if (safeTotal === 1) {
    return [1];
  }

  const totalNumbers = siblingCount * 2 + 5;
  if (safeTotal <= totalNumbers) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1);
  }

  const leftSibling = Math.max(safePage - siblingCount, 1);
  const rightSibling = Math.min(safePage + siblingCount, safeTotal);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < safeTotal - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftRange = Array.from(
      { length: 3 + siblingCount * 2 },
      (_, index) => index + 1,
    );
    return [...leftRange, "ellipsis", safeTotal];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightRange = Array.from(
      { length: 3 + siblingCount * 2 },
      (_, index) => safeTotal - (3 + siblingCount * 2) + 1 + index,
    );
    return [1, "ellipsis", ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, index) => leftSibling + index,
  );
  return [1, "ellipsis", ...middleRange, "ellipsis", safeTotal];
}

export type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  previousLabel: string;
  nextLabel: string;
  /** Optional summary on the left, e.g. "第 1 / 10 页". */
  summary?: ReactNode;
  /** Builds accessible name for each page button. Defaults to the page number. */
  pageLabel?: (page: number) => string;
  /** How many pages to show on each side of the current page. */
  siblingCount?: number;
  /** Hide the whole control when there is only one page. Default true. */
  hideWhenSinglePage?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function Pagination({
  page,
  totalPages,
  onPageChange,
  previousLabel,
  nextLabel,
  summary,
  pageLabel = (value) => String(value),
  siblingCount = 1,
  hideWhenSinglePage = true,
  className = "",
  "aria-label": ariaLabel,
}: PaginationProps) {
  const safeTotal = Math.max(1, Math.floor(totalPages) || 1);
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), safeTotal);

  if (hideWhenSinglePage && safeTotal <= 1) {
    return null;
  }

  const items = getPaginationItems(safePage, safeTotal, siblingCount);
  const canPrev = safePage > 1;
  const canNext = safePage < safeTotal;

  return (
    <nav
      aria-label={ariaLabel}
      className={`flex flex-wrap items-center gap-3 ${
        summary ? "justify-between" : "justify-end"
      } ${className}`.trim()}
    >
      {summary ? (
        <p className="min-w-0 text-xs tabular-nums text-zinc-500">{summary}</p>
      ) : null}

      <div className="flex items-center gap-1.5">
        <Button
          size="xs"
          variant="secondary"
          disabled={!canPrev}
          aria-label={previousLabel}
          title={previousLabel}
          className="w-8 px-0"
          onClick={() => onPageChange(safePage - 1)}
        >
          <Icon icon={ArrowLeft} size={14} />
        </Button>

        {items.map((item, index) => {
          if (item === "ellipsis") {
            return (
              <span
                key={`ellipsis-${index}`}
                aria-hidden
                className="inline-flex h-8 min-w-4 items-center justify-center px-0.5 text-xs text-zinc-400 select-none"
              >
                …
              </span>
            );
          }

          const active = item === safePage;
          return (
            <Button
              key={item}
              size="xs"
              variant={active ? "primary" : "secondary"}
              aria-label={pageLabel(item)}
              aria-current={active ? "page" : undefined}
              className="min-w-8 px-2 tabular-nums"
              onClick={() => {
                if (!active) {
                  onPageChange(item);
                }
              }}
            >
              {item}
            </Button>
          );
        })}

        <Button
          size="xs"
          variant="secondary"
          disabled={!canNext}
          aria-label={nextLabel}
          title={nextLabel}
          className="w-8 px-0"
          onClick={() => onPageChange(safePage + 1)}
        >
          <Icon icon={ArrowRight} size={14} />
        </Button>
      </div>
    </nav>
  );
}
