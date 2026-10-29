import type { HTMLAttributes, ReactNode } from "react";

const CARD_CLASS =
  "rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";

const CARD_INTERACTIVE_CLASS =
  "transition-[border-color,box-shadow,background-color,transform] duration-200 ease-out hover:border-zinc-300 hover:shadow-sm active:scale-[0.995] dark:hover:border-zinc-700";

export type CardClassNameOptions = {
  padded?: boolean;
  interactive?: boolean;
  className?: string;
};

export function cardClassName({
  padded = true,
  interactive = false,
  className = "",
}: CardClassNameOptions = {}): string {
  const paddingClass = padded ? "p-4" : "";
  const interactiveClass = interactive ? CARD_INTERACTIVE_CLASS : "";
  return `${CARD_CLASS} ${paddingClass} ${interactiveClass} ${className}`.trim();
}

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
  /** 可点击/可选卡片时开启 hover 与轻微按压反馈 */
  interactive?: boolean;
  children?: ReactNode;
};

export function Card({
  padded = true,
  interactive = false,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div className={cardClassName({ padded, interactive, className })} {...props}>
      {children}
    </div>
  );
}
