"use client";

import { Button } from "@/components/ui/button";
import { FieldSurface, FormField } from "@/components/form-field";
import { Modal } from "@/components/ui/modal";
import { messages } from "@/messages";

/** Names a new group; the draft lives in the caller so behaviour is unchanged. */
export function CanvasGroupModal({
  open,
  name,
  onNameChange,
  onClose,
  onCreate,
}: {
  open: boolean;
  name: string;
  onNameChange: (next: string) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={messages.canvas.groupSelection}
      size="md"
      closeLabel={messages.close}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {messages.canvas.cancel}
          </Button>
          <Button variant="primary" size="sm" onClick={onCreate}>
            {messages.canvas.createGroup}
          </Button>
        </div>
      }
    >
      <FieldSurface>
        <FormField
          name="canvas-group-name"
          label={messages.canvas.groupName}
          value={name}
          onChange={onNameChange}
          autoFocus
        />
      </FieldSurface>
    </Modal>
  );
}
