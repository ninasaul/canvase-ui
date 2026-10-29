"use client";

import { Button } from "@/components/ui/button";
import type { OverlayState } from "@/hooks/use-overlay-state";
import type { ReactNode } from "react";
import { AppModal } from "@/components/app-modal";
import { messages } from "@/messages";

export function ConfirmModal({
  state,
  title,
  description,
  confirmLabel = messages.confirm,
  danger,
  submitting,
  onConfirm,
}: {
  state: OverlayState;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  submitting?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AppModal
      state={state}
      title={title}
      size="sm"
      stackClassName="z-[80]"
      onSubmit={() => {
        if (!submitting) {
          onConfirm();
        }
      }}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={state.close}>
            {messages.cancel}
          </Button>
          <Button
            type="submit"
            variant={danger ? "danger" : "primary"}
            disabled={submitting}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {description ? (
        <p className="text-sm text-zinc-500">{description}</p>
      ) : null}
    </AppModal>
  );
}
