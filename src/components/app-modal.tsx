"use client";

import type { FormEvent, ReactNode } from "react";
import { Modal, type ModalSize } from "@/components/ui/modal";
import type { OverlayState } from "@/hooks/use-overlay-state";
import { messages } from "@/messages";

const SIZE_MAP: Record<
  "xs" | "sm" | "md" | "lg" | "xl" | "cover" | "full",
  ModalSize
> = {
  xs: "md",
  sm: "md",
  md: "lg",
  lg: "2xl",
  xl: "3xl",
  cover: "5xl",
  full: "7xl",
};

export function AppModal({
  state,
  title,
  description,
  children,
  footer,
  size = "lg",
  stackClassName,
  onSubmit,
}: {
  state: OverlayState;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "cover" | "full";
  stackClassName?: string;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      open={state.isOpen}
      onClose={state.close}
      title={title}
      description={description}
      size={SIZE_MAP[size]}
      stackClassName={stackClassName}
      as={onSubmit ? "form" : "div"}
      onSubmit={
        onSubmit
          ? (event) => {
              event.preventDefault();
              onSubmit(event);
            }
          : undefined
      }
      closeLabel={messages.close}
      footer={
        footer ? (
          <div className="flex justify-end gap-2">{footer}</div>
        ) : undefined
      }
      contentClassName="flex flex-col gap-4"
    >
      {children}
    </Modal>
  );
}
