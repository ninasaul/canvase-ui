"use client";

import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PROSE_CLASS =
  "playground-chat-markdown text-sm leading-[1.65] text-zinc-700 dark:text-zinc-200";

const PROSE_COMPACT_CLASS = "space-y-2";

function InlineCode({ children }: { children?: ReactNode }) {
  return (
    <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </code>
  );
}

function extractCodeLanguage(children: ReactNode): string | undefined {
  if (!isValidElement<{ className?: string }>(children)) {
    return undefined;
  }
  const match = /language-([\w-]+)/.exec(children.props.className ?? "");
  return match?.[1];
}

function PreBlock({ children }: { children?: ReactNode }) {
  const language = extractCodeLanguage(children);
  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-zinc-200/80 bg-zinc-50/70 last:mb-0 dark:border-zinc-800/80 dark:bg-zinc-900/40">
      {language ? (
        <div className="border-b border-zinc-200/80 px-2.5 py-1 font-mono text-[10px] text-zinc-400 dark:border-zinc-800/80">
          {language}
        </div>
      ) : null}
      <pre className="overflow-x-auto p-2.5 font-mono text-xs leading-6 text-zinc-700 dark:text-zinc-200">
        {children}
      </pre>
    </div>
  );
}

const markdownComponents = {
  p({ children }: { children?: ReactNode }) {
    return (
      <p className="mb-2 whitespace-pre-wrap wrap-anywhere last:mb-0">
        {children}
      </p>
    );
  },
  h1({ children }: { children?: ReactNode }) {
    return <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h1>;
  },
  h2({ children }: { children?: ReactNode }) {
    return <h2 className="mb-2 mt-3 text-sm font-semibold first:mt-0">{children}</h2>;
  },
  h3({ children }: { children?: ReactNode }) {
    return <h3 className="mb-1.5 mt-2.5 text-sm font-medium first:mt-0">{children}</h3>;
  },
  h4({ children }: { children?: ReactNode }) {
    return <h4 className="mb-1.5 mt-2 text-sm font-medium first:mt-0">{children}</h4>;
  },
  ul({ children }: { children?: ReactNode }) {
    return <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>;
  },
  ol({ children }: { children?: ReactNode }) {
    return <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>;
  },
  li({ children }: { children?: ReactNode }) {
    return <li className="wrap-anywhere">{children}</li>;
  },
  blockquote({ children }: { children?: ReactNode }) {
    return (
      <blockquote className="mb-2 border-l border-zinc-300 pl-3 text-zinc-500 last:mb-0 dark:border-zinc-600 dark:text-zinc-400">
        {children}
      </blockquote>
    );
  },
  a({ href, children }: { href?: string; children?: ReactNode }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-zinc-800 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-600 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:text-zinc-300"
      >
        {children}
      </a>
    );
  },
  hr() {
    return <hr className="my-2.5 border-zinc-200/80 dark:border-zinc-800" />;
  },
  strong({ children }: { children?: ReactNode }) {
    return <strong className="font-semibold text-zinc-900 dark:text-zinc-50">{children}</strong>;
  },
  em({ children }: { children?: ReactNode }) {
    return <em className="italic">{children}</em>;
  },
  table({ children }: { children?: ReactNode }) {
    return (
      <div className="mb-2 overflow-x-auto rounded-lg border border-zinc-200/80 last:mb-0 dark:border-zinc-800/80">
        <table className="w-full min-w-[20rem] text-left text-xs">{children}</table>
      </div>
    );
  },
  thead({ children }: { children?: ReactNode }) {
    return <thead className="bg-zinc-50 dark:bg-zinc-900/80">{children}</thead>;
  },
  th({ children }: { children?: ReactNode }) {
    return (
      <th className="border-b border-zinc-200 px-3 py-2 font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
        {children}
      </th>
    );
  },
  td({ children }: { children?: ReactNode }) {
    return (
      <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
        {children}
      </td>
    );
  },
  pre({ children }: { children?: ReactNode }) {
    return <PreBlock>{children}</PreBlock>;
  },
  code({
    className,
    children,
  }: {
    className?: string;
    children?: ReactNode;
  }) {
    if (className?.includes("language-")) {
      return <code className={className}>{children}</code>;
    }
    return <InlineCode>{children}</InlineCode>;
  },
};

export function PlaygroundChatMarkdown({
  content,
  streaming = false,
  compact = false,
}: {
  content: string;
  streaming?: boolean;
  compact?: boolean;
}) {
  const rootClass = `${PROSE_CLASS}${compact ? ` ${PROSE_COMPACT_CLASS}` : ""}`;

  if (!content && streaming) {
    return (
      <div className={rootClass}>
        <StreamingCursor />
      </div>
    );
  }

  if (!content.trim()) {
    return streaming ? (
      <div className={rootClass}>
        <StreamingCursor />
      </div>
    ) : null;
  }

  return (
    <div className={rootClass}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
      {streaming ? <StreamingCursor /> : null}
    </div>
  );
}

export function StreamingCursor() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-zinc-400 dark:bg-zinc-500"
    />
  );
}
