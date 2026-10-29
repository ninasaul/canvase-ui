import type { HTMLAttributes, ReactNode } from "react";

import { cardClassName } from "@/components/ui/card";

export function Surface({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div className={cardClassName({ padded: false, className })} {...props}>
      {children}
    </div>
  );
}
