"use client";

import { useCallback, useState } from "react";

export type OverlayState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

export function useOverlayState(defaultOpen = false): OverlayState {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((value) => !value), []);

  return {
    isOpen,
    open,
    close,
    setOpen: setIsOpen,
    toggle,
  };
}
