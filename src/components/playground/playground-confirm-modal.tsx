"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { messages } from "@/messages";

export type PlaygroundConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function PlaygroundConfirmModal({
  open,
  title,
  description,
  confirmLabel = messages.playground.deleteConfirmAction,
  onClose,
  onConfirm,
}: PlaygroundConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      closeLabel={messages.close}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {messages.cancel}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        {description}
      </p>
    </Modal>
  );
}
