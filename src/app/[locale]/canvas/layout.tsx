import type { ReactNode } from "react";

/**
 * Canvas editor/list need a definite viewport height.
 * The ported editor uses `h-full` + React Flow panels; without this,
 * `.react-flow` collapses to height 0 and the toolbar sits off-screen.
 */
export default function CanvasLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      {children}
    </div>
  );
}
