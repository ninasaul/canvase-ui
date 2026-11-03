import { create } from "zustand";

/**
 * True while the viewport is moving (pan or zoom). Components that derive
 * screen positions from the transform subscribe to this instead of the
 * transform itself: they then re-render twice per gesture instead of every
 * frame.
 */
type ViewportMotionState = {
  moving: boolean;
  setMoving: (moving: boolean) => void;
};

export const useViewportMotionStore = create<ViewportMotionState>((set) => ({
  moving: false,
  setMoving: (moving) => set((state) => (state.moving === moving ? state : { moving })),
}));
