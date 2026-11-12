/**
 * Brand mark, drawn as a CSS mask over `currentColor` so it follows the theme
 * (dark logo on light surfaces, light logo in dark mode) instead of shipping a
 * second asset. `alt` is only set when the mark is meaningful on its own; it is
 * decorative next to a wordmark.
 */
const LOGO_SRC = "/veme.svg";

type BrandLogoProps = {
  size?: number;
  className?: string;
  alt?: string;
  /** Kept for API compatibility; a mask needs no preloading hint. */
  priority?: boolean;
};

export function BrandLogo({
  size = 32,
  className,
  alt = "",
  priority: _priority = false,
}: BrandLogoProps) {
  // Non-null assertion keeps the prop consumed without lint noise.
  void _priority;
  const mask = `url("${LOGO_SRC}")`;
  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={`brand-logo inline-block shrink-0 bg-current text-zinc-900 dark:text-zinc-100 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        maskImage: mask,
        WebkitMaskImage: mask,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  );
}
