"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

type ShortcutItem = { label: string; keys: string[] };
type ShortcutGroup = { title: string; items: ShortcutItem[] };

function Keycap({ children }: { children: string }) {
  return (
    <kbd className="min-w-6 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-center font-sans text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </kbd>
  );
}

export function CanvasShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl";
  const shift = isMac ? "⇧" : "Shift";

  const groups: ShortcutGroup[] = [
    {
      title: messages.canvas.shortcutTools,
      items: [
        {
          label: messages.canvas.shortcutHandPan,
          keys: ["H"],
        },
        {
          label: messages.canvas.shortcutSelectMove,
          keys: ["V"],
        },
        {
          label: messages.canvas.shortcutTemporaryPan,
          keys: ["Space"],
        },
        { label: messages.canvas.fitView, keys: ["F"] },
        { label: messages.canvas.zoom100, keys: ["1"] },
        { label: messages.canvas.lockViewport, keys: ["L"] },
        { label: messages.canvas.zoomIn, keys: ["+"] },
        { label: messages.canvas.zoomOut, keys: ["-"] },
        {
          label: messages.canvas.shortcutToggleAgent,
          keys: [mod, "\\"],
        },
      ],
    },
    {
      title: messages.canvas.shortcutNodes,
      items: [
        { label: messages.canvas.addText, keys: ["T"] },
        { label: messages.canvas.addImage, keys: ["I"] },
        { label: messages.canvas.addVideo, keys: ["M"] },
        { label: messages.canvas.addAudio, keys: ["A"] },
        {
          label: messages.canvas.addGroup,
          keys: [shift, "G"],
        },
        {
          label: messages.canvas.groupSelection,
          keys: ["G"],
        },
      ],
    },
    {
      title: messages.canvas.shortcutEdit,
      items: [
        {
          label: messages.canvas.shortcutSelectAll,
          keys: [mod, "A"],
        },
        {
          label: messages.canvas.shortcutDuplicate,
          keys: [mod, "D"],
        },
        {
          label: messages.canvas.shortcutDelete,
          keys: ["Delete"],
        },
        {
          label: messages.canvas.undo,
          keys: [mod, "Z"],
        },
        {
          label: messages.canvas.redo,
          keys: [mod, shift, "Z"],
        },
        ...(isMac
          ? []
          : [
              {
                label: messages.canvas.shortcutRedoAlt,
                keys: ["Ctrl", "Y"],
              },
            ]),
        {
          label: messages.canvas.shortcutSaveNow,
          keys: [mod, "S"],
        },
        {
          label: messages.canvas.refreshCanvas,
          keys: [shift, "R"],
        },
        {
          label: messages.canvas.shortcutClose,
          keys: ["Esc"],
        },
      ],
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.canvas.shortcuts}
      size="lg"
      closeLabel={messages.close}
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {messages.close}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {groups.map((group) => (
          <section key={group.title} className="min-w-0">
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              {group.title}
            </h3>
            <div className="space-y-1.5">
              {group.items.map((item) => (
                <div
                  key={`${group.title}:${item.label}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="min-w-0 truncate text-xs text-zinc-600 dark:text-zinc-300">
                    {item.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {item.keys.map((key) => (
                      <Keycap key={key}>{key}</Keycap>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
