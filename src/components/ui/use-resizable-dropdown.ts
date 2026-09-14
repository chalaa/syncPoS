"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const STORAGE_KEY = "syncpos_dropdown_height";
export const DEFAULT_DROPDOWN_HEIGHT = 380;
export const MIN_DROPDOWN_HEIGHT = 160;
export const MAX_DROPDOWN_HEIGHT = 750;

function getInitialHeight(): { height: number; hasCustomHeight: boolean } {
  if (typeof window === "undefined") {
    return { height: DEFAULT_DROPDOWN_HEIGHT, hasCustomHeight: false };
  }
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed) && parsed >= MIN_DROPDOWN_HEIGHT && parsed <= MAX_DROPDOWN_HEIGHT) {
        return { height: parsed, hasCustomHeight: true };
      }
    }
  } catch {
    // Ignore storage access errors
  }
  return { height: DEFAULT_DROPDOWN_HEIGHT, hasCustomHeight: false };
}

export function useResizableDropdown(isOpen: boolean, openUpward: boolean) {
  const [{ height, hasCustomHeight }, setDimensions] = useState(getInitialHeight);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync native CSS resize (via resize-y handle in bottom corner)
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const el = dropdownRef.current;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const observedHeight = Math.round(entry.contentRect.height);
        if (
          observedHeight >= MIN_DROPDOWN_HEIGHT &&
          observedHeight <= MAX_DROPDOWN_HEIGHT &&
          Math.abs(observedHeight - height) > 4
        ) {
          setDimensions({ height: observedHeight, hasCustomHeight: true });
          try {
            window.localStorage.setItem(STORAGE_KEY, String(observedHeight));
          } catch {
            // Ignore storage access errors
          }
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen, height]);

  function handleResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget;
    const pointerId = event.pointerId;
    try {
      target.setPointerCapture(pointerId);
    } catch {
      // Ignore if setPointerCapture is unsupported
    }

    const startY = event.clientY;
    const startHeight = dropdownRef.current ? dropdownRef.current.offsetHeight : height;

    function onPointerMove(e: PointerEvent) {
      // When opening upward, dragging upward (decreasing clientY) increases the height
      const deltaY = openUpward ? startY - e.clientY : e.clientY - startY;
      const nextHeight = Math.min(
        Math.max(startHeight + deltaY, MIN_DROPDOWN_HEIGHT),
        Math.min(MAX_DROPDOWN_HEIGHT, window.innerHeight * 0.85),
      );
      setDimensions({ height: nextHeight, hasCustomHeight: true });
    }

    function onPointerUp(e: PointerEvent) {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        // Ignore
      }

      const deltaY = openUpward ? startY - e.clientY : e.clientY - startY;
      const finalHeight = Math.min(
        Math.max(startHeight + deltaY, MIN_DROPDOWN_HEIGHT),
        Math.min(MAX_DROPDOWN_HEIGHT, window.innerHeight * 0.85),
      );
      try {
        window.localStorage.setItem(STORAGE_KEY, String(Math.round(finalHeight)));
      } catch {
        // Ignore
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  return {
    height,
    hasCustomHeight,
    dropdownRef,
    handleResizeStart,
  };
}
